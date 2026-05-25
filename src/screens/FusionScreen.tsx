import React, { useState } from 'react';
import { useFusionStore } from '../hooks/useFusionStore';
import { FusionSystem, type FusionGroup } from '../services/FusionSystem';
import { AwakeningSystem } from '../services/AwakeningSystem';
import { RARITY_COLOR } from '../types/Card';
import type { CardStats } from '../types/Card';
import './FusionScreen.css';

interface FusionScreenProps {
  onBack: () => void;
}

const ERROR_LABEL: Record<string, string> = {
  MAXED:                 'Karte ist bereits auf Maximalstufe (LR).',
  NOT_ENOUGH_DUPLICATES: 'Nicht genug Duplikate.',
  NOT_FOUND:             'Karte nicht gefunden.',
  CANNOT_AWAKEN:         'Diese Karte kann nicht erwachen.',
};

const FusionScreen: React.FC<FusionScreenProps> = ({ onBack }) => {
  const { state, groups, lastFusion, lastAwakening, error, fuse, awaken, clearLast } = useFusionStore();

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
        Pro Schritt 1 Duplikat: <strong>Basis → + → ++ → +++ → nächste Stufe</strong>.
        4 Duplikate heben eine Karte eine Hauptstufe (z.B. MR → LR).
        Jede Stufe erhöht Werte und senkt MP-Kosten.
        LR-Karten mit Awakening-Form können <strong>✦ ERWACHEN</strong>.
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
              <FusionRow
                key={g.cardId}
                group={g}
                onFuse={() => fuse(g.cardId)}
                onAwaken={() => awaken(g.carrier.uuid)}
              />
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
      {lastAwakening && (
        <AwakenResultOverlay lastAwakening={lastAwakening} onClose={clearLast} />
      )}
    </div>
  );
};

// ── Eine Karten-Zeile ─────────────────────────────────────────

interface FusionRowProps {
  group:    FusionGroup;
  onFuse:   () => void;
  onAwaken: () => void;
}

const FusionRow: React.FC<FusionRowProps> = ({ group, onFuse, onAwaken }) => {
  const { card, carrier, currentRarity, nextRarity, duplicatesNeeded, duplicatesAvailable,
          crystalCost, canFuse, totalCopies } = group;
  const [imgError, setImgError] = useState(false);

  const curColor  = RARITY_COLOR[currentRarity] ?? '#9e9e9e';
  const nextColor = nextRarity ? (RARITY_COLOR[nextRarity] ?? '#9e9e9e') : curColor;

  const curStats: CardStats = FusionSystem.getEffectiveStats(card, currentRarity);
  const nextStats: CardStats | null = nextRarity
    ? FusionSystem.getEffectiveStats(card, nextRarity)
    : null;

  const isMaxed   = !nextRarity;
  const awakenInfo = AwakeningSystem.getAwakenInfo(carrier);
  const canAwaken = awakenInfo.canAwaken;

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
          {isMaxed && !canAwaken && <span className="fusion-row__max">MAX</span>}
          {isMaxed && canAwaken && <span className="fusion-row__awaken-tag">✦ AWAKENING BEREIT</span>}
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
              {duplicatesNeeded} Duplikat nötig · {duplicatesAvailable} verfügbar
            </span>
            <span className="fusion-row__cost">💎 {crystalCost.toLocaleString('de-DE')}</span>
          </div>
        )}

        {/* Awakening-Anforderung */}
        {isMaxed && canAwaken && (
          <div className="fusion-row__req">
            <span className="fusion-row__awaken-target">→ {awakenInfo.awakenedCard?.name}</span>
            <span className={duplicatesAvailable >= 1 ? 'fusion-req--ok' : 'fusion-req--miss'}>
              1 LR Kopie nötig · {duplicatesAvailable} verfügbar
            </span>
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
      {isMaxed && canAwaken && (
        <button
          className="fusion-row__btn fusion-row__btn--awaken"
          onClick={onAwaken}
          disabled={duplicatesAvailable < 1}
        >
          ✦ ERWACHEN
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

// ── Awakening-Erfolgs-Overlay ─────────────────────────────────

interface AwakenOverlayProps {
  lastAwakening: { fromName: string; toName: string };
  onClose:       () => void;
}

const AwakenResultOverlay: React.FC<AwakenOverlayProps> = ({ lastAwakening, onClose }) => {
  const lrColor = RARITY_COLOR.LR;
  return (
    <div className="fusion-overlay" onClick={onClose}>
      <div className="fusion-overlay__box fusion-overlay__box--awaken"
           style={{ '--rc': lrColor } as React.CSSProperties}>
        <div className="fusion-overlay__spark">✦</div>
        <div className="fusion-overlay__title">TRUE AWAKENING</div>
        <div className="fusion-overlay__rarities">
          <span className="fusion-overlay__awaken-from">{lastAwakening.fromName}</span>
          <span className="fusion-overlay__arrow">→</span>
          <span className="fusion-overlay__to" style={{ color: lrColor }}>{lastAwakening.toName}</span>
        </div>
        <button className="fusion-overlay__btn" onClick={onClose}>Weiter</button>
      </div>
    </div>
  );
};

export default FusionScreen;
