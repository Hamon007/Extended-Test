import React, { useState } from 'react';
import { useFusionStore } from '../hooks/useFusionStore';
import { FusionSystem, type FusionGroup, type FusionError } from '../services/FusionSystem';
import { RARITY_COLOR } from '../types/Card';
import type { CardStats } from '../types/Card';
import './FusionScreen.css';

interface FusionScreenProps {
  onBack: () => void;
}

const ERROR_LABEL: Record<FusionError, string> = {
  MAXED:                 'Karte ist bereits auf Maximalstufe (LR).',
  NOT_ENOUGH_DUPLICATES: 'Nicht genug Duplikate.',
  NOT_ENOUGH_CRYSTALS:   'Nicht genug Kristalle.',
  NOT_FOUND:             'Karte nicht gefunden.',
};

const FusionScreen: React.FC<FusionScreenProps> = ({ onBack }) => {
  const { state, groups, lastFusion, error, fuse, clearLast } = useFusionStore();

  // Nur Gruppen mit Material oder bereits fusioniertem Träger anzeigen
  const visible = groups.filter(g =>
    g.totalCopies >= 2 ||
    FusionSystem.ranksAboveBase(g.card.rarity, g.currentRarity) > 0
  );

  const fuseable = visible.filter(g => g.canFuse).length;

  return (
    <div className="fusion-screen">

      {/* ── Header ── */}
      <div className="fusion-header">
        <button className="fusion-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="fusion-header__title">◆ FUSION ◆</h1>
        <div className="fusion-header__crystals">
          💎 {state.crystals.toLocaleString('de-DE')}
        </div>
      </div>

      {/* ── Hinweis ── */}
      <div className="fusion-intro">
        Verschmelze Duplikate, um Karten aufzuwerten:
        <strong> N → R → SR → SSR → MR → MR+ → MR++ → MR+++ → LR</strong>.
        Jede Stufe erhöht die Werte und senkt die MP-Kosten.
      </div>

      {/* ── Liste ── */}
      <div className="fusion-scroll">
        {visible.length === 0 ? (
          <div className="fusion-empty">
            <span>🔮</span>
            <p>Keine fusionierbaren Karten.</p>
            <p className="fusion-empty__hint">
              Du brauchst mindestens 2 Kopien derselben Karte. Beschwöre mehr!
            </p>
          </div>
        ) : (
          <>
            <div className="fusion-count">
              {fuseable > 0
                ? `${fuseable} Karte${fuseable === 1 ? '' : 'n'} bereit zur Fusion`
                : 'Noch keine Karte bereit'}
            </div>
            {visible.map(g => (
              <FusionRow key={g.cardId} group={g} onFuse={() => fuse(g.cardId)} />
            ))}
          </>
        )}
      </div>

      {/* ── Fehler ── */}
      {error && (
        <div className="fusion-error">⚠ {ERROR_LABEL[error]}</div>
      )}

      {/* ── Erfolgs-Overlay ── */}
      {lastFusion && (
        <FusionResultOverlay lastFusion={lastFusion} onClose={clearLast} />
      )}
    </div>
  );
};

// ── Eine Karten-Zeile ─────────────────────────────────────────

interface FusionRowProps {
  group:  FusionGroup;
  onFuse: () => void;
}

const FusionRow: React.FC<FusionRowProps> = ({ group, onFuse }) => {
  const { card, currentRarity, nextRarity, duplicatesNeeded, duplicatesAvailable,
          crystalCost, canFuse, totalCopies } = group;
  const [imgError, setImgError] = useState(false);

  const curColor  = RARITY_COLOR[currentRarity] ?? '#9e9e9e';
  const nextColor = nextRarity ? (RARITY_COLOR[nextRarity] ?? '#9e9e9e') : curColor;

  const curStats: CardStats = FusionSystem.getEffectiveStats(card, currentRarity);
  const nextStats: CardStats | null = nextRarity
    ? FusionSystem.getEffectiveStats(card, nextRarity)
    : null;

  const isMaxed = !nextRarity;

  return (
    <div className={`fusion-row ${canFuse ? 'fusion-row--ready' : ''}`}
         style={{ '--rc': curColor } as React.CSSProperties}>

      {/* Artwork */}
      <div className="fusion-row__art">
        {card.image && !imgError ? (
          <img src={card.image} alt={card.name} onError={() => setImgError(true)} loading="lazy" />
        ) : (
          <div className="fusion-row__placeholder">🌑</div>
        )}
        <div className="fusion-row__copies">×{totalCopies}</div>
      </div>

      {/* Info */}
      <div className="fusion-row__info">
        <div className="fusion-row__name">{card.name}</div>

        <div className="fusion-row__rarity-line">
          <span className="fusion-badge" style={{ color: curColor, borderColor: curColor }}>
            {currentRarity}
          </span>
          {!isMaxed && (
            <>
              <span className="fusion-row__arrow">→</span>
              <span className="fusion-badge" style={{ color: nextColor, borderColor: nextColor }}>
                {nextRarity}
              </span>
            </>
          )}
          {isMaxed && <span className="fusion-row__max">MAX</span>}
        </div>

        {/* Stat-Vorschau */}
        {nextStats && (
          <div className="fusion-row__stats">
            <StatDelta label="ATK" from={curStats.atk} to={nextStats.atk} />
            <StatDelta label="DEF" from={curStats.def} to={nextStats.def} />
            <StatDelta label="HP"  from={curStats.hp}  to={nextStats.hp} />
            <StatDelta label="MP"  from={curStats.mpCost} to={nextStats.mpCost} lowerBetter />
          </div>
        )}

        {/* Anforderung */}
        {!isMaxed && (
          <div className="fusion-row__req">
            <span className={duplicatesAvailable >= duplicatesNeeded ? 'fusion-req--ok' : 'fusion-req--miss'}>
              Duplikate {duplicatesAvailable}/{duplicatesNeeded}
            </span>
            <span className="fusion-row__cost">💎 {crystalCost.toLocaleString('de-DE')}</span>
          </div>
        )}
      </div>

      {/* Aktion */}
      {!isMaxed && (
        <button
          className="fusion-row__btn"
          onClick={onFuse}
          disabled={!canFuse}
        >
          FUSION
        </button>
      )}
    </div>
  );
};

// ── Stat-Delta Anzeige ────────────────────────────────────────

interface StatDeltaProps {
  label:        string;
  from:         number;
  to:           number;
  lowerBetter?: boolean;
}

const StatDelta: React.FC<StatDeltaProps> = ({ label, from, to, lowerBetter }) => {
  const improved = lowerBetter ? to < from : to > from;
  return (
    <div className="stat-delta">
      <span className="stat-delta__label">{label}</span>
      <span className="stat-delta__from">{from.toLocaleString('de-DE')}</span>
      <span className={`stat-delta__to ${improved ? 'stat-delta__to--up' : ''}`}>
        →{to.toLocaleString('de-DE')}
      </span>
    </div>
  );
};

// ── Erfolgs-Overlay ───────────────────────────────────────────

interface OverlayProps {
  lastFusion: { cardId: string; from: string; to: string };
  onClose:    () => void;
}

const FusionResultOverlay: React.FC<OverlayProps> = ({ lastFusion, onClose }) => {
  const toColor = RARITY_COLOR[lastFusion.to as keyof typeof RARITY_COLOR] ?? '#f0d080';
  return (
    <div className="fusion-overlay" onClick={onClose}>
      <div className="fusion-overlay__box" style={{ '--rc': toColor } as React.CSSProperties}>
        <div className="fusion-overlay__spark">✦</div>
        <div className="fusion-overlay__title">FUSION ERFOLGREICH</div>
        <div className="fusion-overlay__rarities">
          <span>{lastFusion.from}</span>
          <span className="fusion-overlay__arrow">→</span>
          <span className="fusion-overlay__to" style={{ color: toColor }}>{lastFusion.to}</span>
        </div>
        <button className="fusion-overlay__btn" onClick={onClose}>Weiter</button>
      </div>
    </div>
  );
};

export default FusionScreen;
