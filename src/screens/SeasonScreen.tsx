import React from 'react';
import {
  SeasonService,
  RANK_THRESHOLDS,
  RANK_COLORS,
  RANK_ICONS,
  SEASON_END_REWARDS,
  SP_REWARDS,
  type SeasonRank,
} from '../services/SeasonService';
import './SeasonScreen.css';

interface SeasonScreenProps {
  onBack: () => void;
}

const RANK_ORDER: SeasonRank[] = [
  'Novize', 'Kämpfer', 'Veteran', 'Elite', 'Champion', 'Meister', 'Legende',
];

const SP_SOURCE_ROWS: { label: string; sp: number; icon: string }[] = [
  { icon: '🗼', label: 'Turm-Sieg (Normal)',   sp: SP_REWARDS.tower_win },
  { icon: '⚡', label: 'Turm-Sieg (Elite)',    sp: SP_REWARDS.elite_win },
  { icon: '💀', label: 'Turm-Sieg (Boss)',     sp: SP_REWARDS.boss_win },
  { icon: '⚔️', label: 'PvP-Sieg',             sp: SP_REWARDS.pvp_win },
  { icon: '🛡️', label: 'PvP-Niederlage',       sp: SP_REWARDS.pvp_loss },
  { icon: '🌟', label: 'Tägliche Prüfung',     sp: SP_REWARDS.daily_trial },
];

const SeasonScreen: React.FC<SeasonScreenProps> = ({ onBack }) => {
  const state    = SeasonService.load();
  const { rank, nextRank, progress } = SeasonService.progressToNext(state.sp);
  const daysLeft = SeasonService.getDaysLeft();
  const endReward = SEASON_END_REWARDS.find(r => r.rank === rank)!;

  // SP velocity: SP per day based on season start
  const startDate = new Date(state.startDate);
  const daysElapsed = Math.max(1, Math.round((Date.now() - startDate.getTime()) / 86400000));
  const spPerDay = Math.round(state.sp / daysElapsed);
  const nextRankThreshold = nextRank ? RANK_THRESHOLDS[nextRank] : null;
  const spNeeded = nextRankThreshold ? nextRankThreshold - state.sp : 0;
  const daysToNextRank = spNeeded > 0 && spPerDay > 0 ? Math.ceil(spNeeded / spPerDay) : null;

  // Urgency: deadline warning when < 7 days remain with a reachable next rank
  const spPerDayNeeded = nextRank && daysLeft > 0 ? Math.ceil(spNeeded / daysLeft) : null;
  const isUrgent = daysLeft <= 7 && nextRank && spNeeded > 0;
  const canStillReach = isUrgent && daysLeft > 0 && (daysToNextRank === null || daysToNextRank <= daysLeft);

  return (
    <div className="season-screen">

      {/* Header */}
      <div className="season-header">
        <button className="season-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="season-header__title">SAISON {state.seasonNumber}</h1>
        <div className={`season-header__days${daysLeft <= 3 ? ' season-header__days--urgent' : ''}`}>{daysLeft}T</div>
      </div>

      {/* Urgency Banner */}
      {isUrgent && nextRank && (
        <div className={`season-urgency ${canStillReach ? 'season-urgency--reachable' : 'season-urgency--danger'}`}>
          <div className="season-urgency__icon">{canStillReach ? '⚡' : '⚠'}</div>
          <div className="season-urgency__text">
            <div className="season-urgency__title">
              {canStillReach
                ? `${daysLeft} Tage bis Saisonende — ${nextRank} noch erreichbar!`
                : `Achtung: ${nextRank} nicht mehr auf Kurs!`}
            </div>
            <div className="season-urgency__sub">
              Benötigt: {spNeeded.toLocaleString('de-DE')} SP ·{' '}
              {canStillReach
                ? `${spPerDayNeeded?.toLocaleString('de-DE')} SP/Tag nötig`
                : `Fehlend: ${(spNeeded - (spPerDay ?? 0) * daysLeft).toLocaleString('de-DE')} SP`}
            </div>
          </div>
        </div>
      )}

      {/* Current Rank Hero */}
      <div className="season-hero" style={{ borderColor: RANK_COLORS[rank] }}>
        <div className="season-hero__icon" style={{ color: RANK_COLORS[rank] }}>
          {RANK_ICONS[rank]}
        </div>
        <div className="season-hero__name" style={{ color: RANK_COLORS[rank] }}>
          {rank}
        </div>
        <div className="season-hero__sp">{state.sp.toLocaleString('de-DE')} SP</div>

        {/* Progress to next rank */}
        <div className="season-hero__progress-wrap">
          <div className="season-hero__progress-bar">
            <div
              className="season-hero__progress-fill"
              style={{ width: `${progress * 100}%`, background: RANK_COLORS[rank] }}
            />
          </div>
          {nextRank ? (
            <div className="season-hero__progress-labels">
              <span style={{ color: RANK_COLORS[rank] }}>{rank}</span>
              <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>
                {Math.floor(progress * 100)}%
              </span>
              <span style={{ color: RANK_COLORS[nextRank] }}>{nextRank}</span>
            </div>
          ) : (
            <div className="season-hero__max">MAX RANG ERREICHT 🔥</div>
          )}
        </div>
      </div>

      {/* Rank Ladder */}
      <div className="season-section-title">Rangabstufungen</div>
      <div className="season-ladder">
        {RANK_ORDER.map(r => {
          const achieved = state.sp >= RANK_THRESHOLDS[r];
          const isCurrent = r === rank;
          const reward = SEASON_END_REWARDS.find(x => x.rank === r)!;
          return (
            <div
              key={r}
              className={`season-rung ${isCurrent ? 'season-rung--current' : ''} ${achieved ? 'season-rung--done' : ''}`}
              style={isCurrent ? { borderColor: RANK_COLORS[r] } : {}}
            >
              <span className="season-rung__icon" style={{ color: achieved ? RANK_COLORS[r] : undefined }}>
                {RANK_ICONS[r]}
              </span>
              <span className="season-rung__name" style={{ color: achieved ? RANK_COLORS[r] : undefined }}>
                {r}
              </span>
              <span className="season-rung__sp">{RANK_THRESHOLDS[r].toLocaleString('de-DE')} SP</span>
              <span className="season-rung__reward">💎 {reward.crystals.toLocaleString('de-DE')}</span>
            </div>
          );
        })}
      </div>

      {/* Season End Reward Preview */}
      <div className="season-section-title">Deine Saison-Belohnung</div>
      <div className="season-reward-card" style={{ borderColor: RANK_COLORS[rank] }}>
        <div className="season-reward-card__label">{endReward.description}</div>
        <div className="season-reward-card__crystals" style={{ color: RANK_COLORS[rank] }}>
          💎 {endReward.crystals.toLocaleString('de-DE')} Kristalle
        </div>
        <div className="season-reward-card__hint">
          Steige auf, um mehr zu erhalten!
        </div>
      </div>

      {/* SP velocity / rank forecast */}
      {spPerDay > 0 && (
        <div className="season-velocity">
          <div className="season-velocity__row">
            <span className="season-velocity__label">⚡ SP / Tag (Ø)</span>
            <span className="season-velocity__val">{spPerDay.toLocaleString('de-DE')}</span>
          </div>
          {nextRank && spNeeded > 0 && (
            <div className="season-velocity__row">
              <span className="season-velocity__label">
                📈 Bis {nextRank} ({spNeeded.toLocaleString('de-DE')} SP)
              </span>
              <span className="season-velocity__val">
                {daysToNextRank !== null
                  ? daysToNextRank <= daysLeft
                    ? `~${daysToNextRank}T`
                    : `⚠ +${daysToNextRank - daysLeft}T nach Saisonende`
                  : '—'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* SP Sources Table */}
      <div className="season-section-title">SP verdienen</div>
      <div className="season-sp-table">
        {SP_SOURCE_ROWS.map(row => (
          <div key={row.label} className="season-sp-row">
            <span className="season-sp-row__icon">{row.icon}</span>
            <span className="season-sp-row__label">{row.label}</span>
            <span className="season-sp-row__sp">+{row.sp} SP</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="season-footer">
        Saison endet am {state.endDate} · {daysLeft} Tage verbleibend
      </div>

    </div>
  );
};

export default SeasonScreen;
