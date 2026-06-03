import React, { useState, useEffect } from 'react';
import { useGachaStore } from '../hooks/useGachaStore';
import { CardDatabase } from '../services/CardDatabase';
import type { Card } from '../types/Card';
import type { PullResult, CardInstance } from '../types/GachaTypes';
import {
  PULL_COST_SINGLE, PULL_COST_MULTI,
  PITY_THRESHOLD, DROP_RATES,
} from '../types/GachaTypes';
import { RARITY_COLOR } from '../types/Card';
import { GachaSystem } from '../services/GachaSystem';
import { AudioService } from '../services/AudioService';
import { CollectionMilestoneService } from '../services/CollectionMilestoneService';
import CardDetailModal from '../components/CardDetailModal';
import './GachaScreen.css';

const ERROR_LABEL: Record<string, string> = {
  NOT_ENOUGH_CRYSTALS: 'Nicht genug Kristalle.',
  DB_EMPTY:            'Keine Karten in der Datenbank.',
};

/** Reveal-Glanz-Intensität nach Hauptstufe (0..1). */
function rarityIntensity(rarity: string): number {
  const major = rarity.replace(/\+/g, '');
  const map: Record<string, number> = { N: 0.25, R: 0.4, SR: 0.6, SSR: 0.8, MR: 0.95, LR: 1 };
  return map[major] ?? 0.4;
}

const GachaScreen: React.FC = () => {
  const store = useGachaStore();
  const { state, lastSingle, lastMulti, error, isPulling } = store;
  const [detailCard,     setDetailCard]     = useState<Card | null>(null);
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);

  const showResult = lastSingle !== null || lastMulti !== null;

  // Check collection milestones after each pull result
  useEffect(() => {
    if (!lastSingle && !lastMulti) return;
    const awarded = CollectionMilestoneService.checkAndAward();
    if (awarded.length > 0) {
      const msg = awarded.map(m => `${m.label}: +${m.crystals.toLocaleString('de-DE')} 💎`).join(' · ');
      setMilestoneToast(msg);
      setTimeout(() => setMilestoneToast(null), 5000);
    }
  }, [lastSingle, lastMulti]);

  const openDetail = (cardId: string) => {
    setDetailCard(CardDatabase.getById(cardId) ?? null);
  };

  return (
    <div className="gacha-screen">

      {/* ── Header ── */}
      <div className="gacha-header">
        <h1 className="gacha-header__title">◆ BESCHWÖRUNG ◆</h1>
        <div className="gacha-header__crystals">
          <span className="gacha-header__crystal-icon">💎</span>
          <span className="gacha-header__crystal-count">
            {state.crystals.toLocaleString('de-DE')}
          </span>
        </div>
      </div>

      {/* ── Pity-Anzeige ── */}
      <PityBar pity={state.pityCounter} total={state.totalPulls} />

      {/* ── Pull-History ── */}
      {state.inventory.length > 0 && (
        <PullHistoryStrip inventory={state.inventory} />
      )}

      {showResult ? (
        <>
          {lastSingle && (
            <SingleResult
              result={lastSingle}
              isPulling={isPulling}
              onClose={store.clearResults}
              onCardClick={openDetail}
              onSingleAgain={store.doSingle}
              onMultiAgain={store.doMulti}
            />
          )}
          {lastMulti && (
            <MultiResult
              results={lastMulti.results}
              isPulling={isPulling}
              onClose={store.clearResults}
              onCardClick={openDetail}
              onSingleAgain={store.doSingle}
              onMultiAgain={store.doMulti}
            />
          )}
        </>
      ) : (
        <div className="gacha-main">

          <BannerCard />
          <DropRateTable />

          {error && (
            <div className="gacha-error">
              ⚠ {ERROR_LABEL[error] ?? error}
            </div>
          )}

          <div className="gacha-actions">
            <button
              className={`gacha-btn gacha-btn--single ${!GachaSystem.canSinglePull(state.crystals) ? 'gacha-btn--disabled' : ''}`}
              onClick={store.doSingle}
              disabled={isPulling || !GachaSystem.canSinglePull(state.crystals)}
            >
              <span className="gacha-btn__label">EINZELN BESCHWÖREN</span>
              <span className="gacha-btn__cost">
                💎 {PULL_COST_SINGLE.toLocaleString('de-DE')}
              </span>
            </button>

            <button
              className={`gacha-btn gacha-btn--multi ${!GachaSystem.canMultiPull(state.crystals) ? 'gacha-btn--disabled' : ''}`}
              onClick={store.doMulti}
              disabled={isPulling || !GachaSystem.canMultiPull(state.crystals)}
            >
              <span className="gacha-btn__label">10× BESCHWÖREN</span>
              <span className="gacha-btn__cost">
                💎 {PULL_COST_MULTI.toLocaleString('de-DE')}
              </span>
            </button>
          </div>

          <div className="gacha-stats">
            <div className="gacha-stat">
              <span className="gacha-stat__label">GESAMT</span>
              <span className="gacha-stat__value">{state.totalPulls} Pulls</span>
            </div>
            <div className="gacha-stat">
              <span className="gacha-stat__label">INVENTAR</span>
              <span className="gacha-stat__value">{state.inventory.length} Karten</span>
            </div>
            <div className="gacha-stat gacha-stat--afford">
              <span className="gacha-stat__label">MÖGLICH</span>
              <span className="gacha-stat__value">
                {Math.floor(state.crystals / PULL_COST_SINGLE)}×
                <span className="gacha-stat__sep"> · </span>
                {Math.floor(state.crystals / PULL_COST_MULTI)}×10
              </span>
            </div>
          </div>

          {state.crystals < PULL_COST_SINGLE && (
            <button className="gacha-refill-btn" onClick={store.debugReset}>
              💎 Kristalle auffüllen (+{(3000).toLocaleString('de-DE')})
            </button>
          )}

        </div>
      )}

      <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />

      {/* Collection Milestone Toast */}
      {milestoneToast && (
        <div className="gacha-milestone-toast">
          <span className="gacha-milestone-toast__icon">🏆</span>
          <span className="gacha-milestone-toast__text">{milestoneToast}</span>
        </div>
      )}
    </div>
  );
};

// ── Pull-History Strip ────────────────────────────────────────

const PULL_DOT_COLORS: Record<string, string> = {
  N: '#666', R: '#4caf50', SR: '#2196f3', SSR: '#ffc107', MR: '#f44336', LR: '#e040fb',
};

const HIGH_RARITY = ['SSR', 'MR', 'LR'];

const PullHistoryStrip: React.FC<{ inventory: CardInstance[] }> = ({ inventory }) => {
  const sorted = [...inventory].sort((a, b) => (b.pullIndex ?? 0) - (a.pullIndex ?? 0));
  const last20 = sorted.slice(0, 20).reverse();

  if (last20.length === 0) return null;

  // Pulls since last high-rarity (dry streak)
  const lastHighIdx = sorted.findIndex(i => HIGH_RARITY.some(r => i.rarity.startsWith(r)));
  const dryStreak   = lastHighIdx === -1 ? sorted.length : lastHighIdx;
  const lastHigh    = lastHighIdx >= 0 ? sorted[lastHighIdx] : null;
  const dryUrgent   = dryStreak >= 50;
  const dryWarn     = dryStreak >= 25;

  const ssrCount = last20.filter(i => HIGH_RARITY.some(r => i.rarity.startsWith(r))).length;

  return (
    <div className="pull-history">
      <div className="pull-history__header">
        <span className="pull-history__label">
          Letzte {last20.length} · {ssrCount > 0 ? `${ssrCount}× SR+` : 'kein SR+'}
        </span>
        {dryStreak > 0 && (
          <span className={`pull-history__dry${dryUrgent ? ' pull-history__dry--urgent' : dryWarn ? ' pull-history__dry--warn' : ''}`}>
            {dryStreak} ohne SR+
          </span>
        )}
        {lastHigh && (
          <span
            className="pull-history__last-high"
            style={{ color: PULL_DOT_COLORS[lastHigh.rarity.replace(/\+/g, '')] ?? '#ccc' }}
          >
            ↑ {lastHigh.rarity}
          </span>
        )}
      </div>
      <div className="pull-history__dots">
        {last20.map((inst, i) => {
          const major = inst.rarity.replace(/\+/g, '');
          const color = PULL_DOT_COLORS[major] ?? '#666';
          const isBig = major === 'MR' || major === 'SSR' || major === 'LR';
          return (
            <div
              key={`${inst.uuid}-${i}`}
              className={`pull-dot ${isBig ? 'pull-dot--big' : ''}`}
              style={{ background: color, boxShadow: isBig ? `0 0 6px ${color}` : undefined }}
              title={`${inst.rarity} — ${inst.cardId}`}
            />
          );
        })}
      </div>
    </div>
  );
};

// ── Pity-Balken ───────────────────────────────────────────────

interface PityBarProps { pity: number; total: number; }

const PityBar: React.FC<PityBarProps> = ({ pity, total }) => {
  const pct = Math.min(100, (pity / PITY_THRESHOLD) * 100);
  const urgent = pity >= 80;

  return (
    <div className="pity-bar-wrap">
      <div className="pity-bar-header">
        <span className="pity-bar-label">PITY</span>
        <span className={`pity-bar-count ${urgent ? 'pity-bar-count--urgent' : ''}`}>
          {pity} / {PITY_THRESHOLD}
          {pity >= PITY_THRESHOLD - 1 && ' ← GARANTIERTER SSR!'}
        </span>
        <span className="pity-bar-total">Pull #{total}</span>
      </div>
      <div className="pity-bar-track">
        <div
          className={`pity-bar-fill ${urgent ? 'pity-bar-fill--urgent' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="pity-bar-note">
        Reset bei SSR oder MR ✦ Bei Pull {PITY_THRESHOLD} garantierter SSR
      </p>
    </div>
  );
};

// ── Banner-Card ───────────────────────────────────────────────

const BannerCard: React.FC = () => (
  <div className="gacha-banner">
    <div className="gacha-banner__glow" />
    <div className="gacha-banner__content">
      <div className="gacha-banner__icon">🌑</div>
      <h2 className="gacha-banner__title">Codex der Verdammten</h2>
      <p className="gacha-banner__subtitle">Beschwöre mächtige Unsterbliche</p>
    </div>
  </div>
);

// ── Drop-Rate-Tabelle ─────────────────────────────────────────

const DropRateTable: React.FC = () => (
  <div className="drop-table">
    <div className="drop-table__title">ZIEHCHANCEN</div>
    <div className="drop-table__rows">
      {DROP_RATES.map(entry => (
        <div key={entry.rarity} className="drop-table__row">
          <span
            className="drop-table__rarity"
            style={{ color: RARITY_COLOR[entry.rarity] ?? '#9e9e9e' }}
          >
            {entry.rarity}
          </span>
          <div className="drop-table__bar-wrap">
            <div
              className="drop-table__bar"
              style={{
                width: `${entry.rate}%`,
                background: RARITY_COLOR[entry.rarity] ?? '#9e9e9e',
              }}
            />
          </div>
          <span className="drop-table__pct">{entry.rate}%</span>
        </div>
      ))}
    </div>
  </div>
);

// ── Einzelner Pull – Ergebnis ─────────────────────────────────

interface SingleResultProps {
  result:       PullResult;
  isPulling:    boolean;
  onClose:      () => void;
  onCardClick:  (cardId: string) => void;
  onSingleAgain:() => void;
  onMultiAgain: () => void;
}

const SingleResult: React.FC<SingleResultProps> = ({
  result, isPulling, onClose, onCardClick, onSingleAgain, onMultiAgain,
}) => {
  const { instance, wasPity } = result;
  const card = CardDatabase.getById(instance.cardId);
  const rarityColor = RARITY_COLOR[instance.rarity] ?? '#9e9e9e';
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    AudioService.reveal(rarityIntensity(instance.rarity));
  }, [instance.uuid]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="result-single">
      <div
        className="result-single__card"
        style={{ '--rc': rarityColor } as React.CSSProperties}
        data-rarity={instance.rarity}
        onClick={() => onCardClick(instance.cardId)}
        role="button"
        tabIndex={0}
        aria-label={`Kartendetail öffnen: ${card?.name ?? instance.cardId}`}
      >
        <div className="result-single__art">
          {card && card.image && !imgError ? (
            <img src={card.image} alt={card.name} onError={() => setImgError(true)} />
          ) : (
            <div className="result-single__placeholder">🌑</div>
          )}
          <div className="result-single__art-gradient" />
        </div>

        {wasPity && <div className="result-badge result-badge--pity">PITY</div>}
        {instance.isNew && <div className="result-badge result-badge--new">NEU</div>}
        {!instance.isNew && ['SSR', 'MR', 'LR'].some(r => instance.rarity.startsWith(r)) && (
          <div className="result-badge result-badge--dup">⚗ FUSION +1</div>
        )}
        <div className="result-badge result-badge--rarity" style={{ color: rarityColor }}>
          {instance.rarity}
        </div>

        <div className="result-single__info">
          <p className="result-single__name">{card?.name ?? instance.cardId}</p>
          {card && <p className="result-single__title">{card.title}</p>}
        </div>

        <div className="result-single__tap-hint">Tippen für Details</div>
      </div>

      <div className="result-actions">
        <button
          className="result-again-btn result-again-btn--single"
          onClick={onSingleAgain}
          disabled={isPulling}
        >
          <span>EINZELN</span>
          <span className="result-again-btn__cost">💎 {PULL_COST_SINGLE.toLocaleString('de-DE')}</span>
        </button>
        <button
          className="result-again-btn result-again-btn--multi"
          onClick={onMultiAgain}
          disabled={isPulling}
        >
          <span>10×</span>
          <span className="result-again-btn__cost">💎 {PULL_COST_MULTI.toLocaleString('de-DE')}</span>
        </button>
      </div>

      <button className="result-close-btn" onClick={onClose}>
        ◀ ZURÜCK
      </button>
    </div>
  );
};

// ── Multi-Pull – Ergebnis ─────────────────────────────────────

interface MultiResultProps {
  results:      PullResult[];
  isPulling:    boolean;
  onClose:      () => void;
  onCardClick:  (cardId: string) => void;
  onSingleAgain:() => void;
  onMultiAgain: () => void;
}

const MultiResult: React.FC<MultiResultProps> = ({
  results, isPulling, onClose, onCardClick, onSingleAgain, onMultiAgain,
}) => {
  const [revealed, setRevealed] = useState(0);
  const allRevealed = revealed >= results.length;

  useEffect(() => {
    if (allRevealed) return;
    const next = results[revealed];
    if (next) AudioService.reveal(rarityIntensity(next.instance.rarity));
    const t = setTimeout(() => setRevealed(r => r + 1), 220);
    return () => clearTimeout(t);
  }, [revealed, allRevealed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="result-multi">
      <div className="result-multi__grid">
        {results.map((pr, i) => (
          <MultiCard
            key={pr.instance.uuid}
            pullResult={pr}
            visible={i < revealed}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      {allRevealed && (
        <div className="result-multi__actions">
          <div className="result-actions">
            <button
              className="result-again-btn result-again-btn--single"
              onClick={onSingleAgain}
              disabled={isPulling}
            >
              <span>EINZELN</span>
              <span className="result-again-btn__cost">💎 {PULL_COST_SINGLE.toLocaleString('de-DE')}</span>
            </button>
            <button
              className="result-again-btn result-again-btn--multi"
              onClick={onMultiAgain}
              disabled={isPulling}
            >
              <span>NOCHMAL 10×</span>
              <span className="result-again-btn__cost">💎 {PULL_COST_MULTI.toLocaleString('de-DE')}</span>
            </button>
          </div>
          <button className="result-close-btn result-close-btn--multi" onClick={onClose}>
            ◀ ZURÜCK
          </button>
        </div>
      )}
    </div>
  );
};

// ── Einzelne Karte im Multi-Grid ──────────────────────────────

interface MultiCardProps {
  pullResult:  PullResult;
  visible:     boolean;
  onCardClick: (cardId: string) => void;
}

const MultiCard: React.FC<MultiCardProps> = ({ pullResult, visible, onCardClick }) => {
  const { instance, wasPity } = pullResult;
  const card = CardDatabase.getById(instance.cardId);
  const rarityColor = RARITY_COLOR[instance.rarity] ?? '#9e9e9e';
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`multi-card ${visible ? 'multi-card--visible' : ''}`}
      style={{ '--rc': rarityColor } as React.CSSProperties}
      data-rarity={visible ? instance.rarity : undefined}
      onClick={() => visible && onCardClick(instance.cardId)}
      role={visible ? 'button' : undefined}
      tabIndex={visible ? 0 : undefined}
      aria-label={visible ? `${card?.name ?? instance.cardId} Details` : undefined}
    >
      {visible ? (
        <>
          <div className="multi-card__art">
            {card && card.image && !imgError ? (
              <img
                src={card.image}
                alt={card.name}
                onError={() => setImgError(true)}
                loading="lazy"
              />
            ) : (
              <div className="multi-card__placeholder">🌑</div>
            )}
            <div className="multi-card__gradient" />
          </div>

          {wasPity && (
            <div className="multi-card__pity-badge">P</div>
          )}
          {instance.isNew && (
            <div className="multi-card__new-badge">NEU</div>
          )}
          {!instance.isNew && ['SSR', 'MR', 'LR'].some(r => instance.rarity.startsWith(r)) && (
            <div className="multi-card__dup-badge">⚗ +1</div>
          )}

          <div className="multi-card__footer">
            <span className="multi-card__rarity" style={{ color: rarityColor }}>
              {instance.rarity}
            </span>
            <span className="multi-card__name">{card?.name ?? instance.cardId}</span>
          </div>
        </>
      ) : (
        <div className="multi-card__back">
          <span>?</span>
        </div>
      )}
    </div>
  );
};

export default GachaScreen;
