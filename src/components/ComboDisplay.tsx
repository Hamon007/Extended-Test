import React from 'react';
import type { ComboState, DamagePopup } from '../types/ComboTypes';
import { COMBO_MULTIPLIERS, MAX_COMBO } from '../types/ComboTypes';
import './ComboDisplay.css';

// ── Combo-Haupt-Anzeige ───────────────────────────────────────

interface ComboDisplayProps extends ComboState {
  popups: DamagePopup[];
}

const ComboDisplay: React.FC<ComboDisplayProps> = ({
  count, timeLeft, maxTime, isActive, isBreaking, isMaxCombo, popups,
}) => {
  const show = isActive || isBreaking || count > 0;
  if (!show) return null;

  const progress  = maxTime > 0 ? Math.max(0, timeLeft / maxTime) : 0;
  const radius    = 34;
  const circ      = 2 * Math.PI * radius;
  const dashOffset = circ * (1 - progress);

  const multiplier = COMBO_MULTIPLIERS[Math.min(MAX_COMBO, count)] ?? 1.0;

  return (
    <div className={`combo-display
      ${isMaxCombo  ? 'combo-display--max'     : ''}
      ${isBreaking  ? 'combo-display--breaking': ''}
      ${count >= 4  ? 'combo-display--high'    : ''}
    `}>

      {/* Zirkulärer Timer-Ring */}
      <svg
        className="combo-ring"
        width="80" height="80"
        viewBox="0 0 80 80"
        aria-hidden="true"
      >
        {/* Hintergrund-Ring */}
        <circle
          cx="40" cy="40" r={radius}
          fill="none"
          stroke="rgba(42,21,37,0.8)"
          strokeWidth="5"
        />
        {/* Fortschritts-Ring */}
        <circle
          cx="40" cy="40" r={radius}
          fill="none"
          stroke={isMaxCombo ? '#f0d080' : count >= 4 ? '#ff9800' : '#c9a84c'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 40 40)"
          className="combo-ring__progress"
        />
      </svg>

      {/* Innere Anzeige */}
      <div className="combo-inner">
        <span className="combo-label">COMBO</span>
        <span className="combo-count">{count}</span>
        <span className="combo-mult">×{multiplier.toFixed(1)}</span>
      </div>

      {/* MAX-COMBO-Badge */}
      {isMaxCombo && (
        <div className="combo-max-badge">MAX!</div>
      )}

      {/* Break-Nachricht */}
      {isBreaking && (
        <div className="combo-break-msg">BREAK</div>
      )}

      {/* Damage-Popups */}
      {popups.map(p => (
        <DmgPopup key={p.id} popup={p} />
      ))}
    </div>
  );
};

// ── Damage-Popup ──────────────────────────────────────────────

const DmgPopup: React.FC<{ popup: DamagePopup }> = ({ popup }) => (
  <div
    className={`dmg-popup
      ${popup.combo >= MAX_COMBO  ? 'dmg-popup--max'     : ''}
      ${popup.combo >= 3          ? 'dmg-popup--high'    : ''}
      ${popup.hasSynergy          ? 'dmg-popup--synergy' : ''}
    `}
    style={{ left: `${popup.xPct}%` }}
    aria-hidden="true"
  >
    <span className="dmg-popup__number">
      {popup.damage.toLocaleString('de-DE')}
    </span>
    {popup.multiplier > 1.05 && (
      <span className="dmg-popup__mult">×{popup.multiplier.toFixed(2)}</span>
    )}
    <div className="dmg-popup__tags">
      {popup.hasSynergy && <span className="dmg-popup__tag dmg-popup__tag--syn">SYNERGY</span>}
      {popup.hasElement && <span className="dmg-popup__tag dmg-popup__tag--elem">ELEMENT</span>}
    </div>
  </div>
);

export default ComboDisplay;
