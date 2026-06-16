import React, { useMemo } from 'react';
import { STREAK_REWARDS, getRewardForDay, type StreakRewardDef, type StreakState } from '../services/LoginStreakService';
import './LoginStreakPopup.css';

interface Props {
  result: {
    newStreak:   number;
    reward:      StreakRewardDef;
    isNewRecord: boolean;
  };
  streakState: StreakState;
  onClose: () => void;
}

const MILESTONE_DAYS = new Set([7, 14, 21, 30]);
const MILESTONE_LABELS: Record<number, string> = {
  7:  '🏆 WOCHE 1 VOLLSTÄNDIG!',
  14: '🌟 2 WOCHEN DABEI!',
  21: '✦ 3 WOCHEN DURCHGEHALTEN!',
  30: '👑 EIN GANZER MONAT!',
};

const LoginStreakPopup: React.FC<Props> = ({ result, onClose }) => {
  const { newStreak, reward } = result;
  const isMilestone = MILESTONE_DAYS.has(newStreak);
  const isLegendary = newStreak === 30;

  // Zeige Tage 1-7 (aktuelle Woche in der Streak)
  const weekStart = Math.floor((newStreak - 1) / 7) * 7 + 1;
  const weekDays  = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = weekStart + i;
      return { day, def: getRewardForDay(day) };
    });
  }, [weekStart]);

  // Milestone-Vorschau für Tag 7, 14, 21, 30
  const nextMilestone = STREAK_REWARDS.filter(r => r.crystalCards && r.day > newStreak)[0];

  return (
    <div className="streak-overlay" onClick={onClose}>
      <div className={`streak-popup ${isMilestone ? 'streak-popup--milestone' : ''} ${isLegendary ? 'streak-popup--legendary' : ''}`} onClick={e => e.stopPropagation()}>

        {/* Milestone particle burst */}
        {isMilestone && (
          <div className="streak-milestone-burst" aria-hidden="true">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className={`streak-ms-particle streak-ms-particle--${i % 4}`} style={{ '--i': i } as React.CSSProperties} />
            ))}
          </div>
        )}

        {/* Milestone banner */}
        {isMilestone && (
          <div className={`streak-milestone-banner ${isLegendary ? 'streak-milestone-banner--legendary' : ''}`}>
            {MILESTONE_LABELS[newStreak] ?? `🏆 MEILENSTEIN TAG ${newStreak}!`}
          </div>
        )}

        {/* Header */}
        <div className="streak-popup__header">
          <div className="streak-popup__flame">{isLegendary ? '👑' : '🔥'}</div>
          <h2 className="streak-popup__title">
            {newStreak === 1 ? 'Willkommen zurück!' : `${newStreak} Tage in Folge!`}
          </h2>
          {result.isNewRecord && (
            <div className="streak-popup__record">🏆 Neuer Rekord!</div>
          )}
        </div>

        {/* Heute Belohnung */}
        <div className="streak-popup__today">
          <div className="streak-popup__today-icon">{reward.icon}</div>
          <div className="streak-popup__today-text">
            <div className="streak-popup__today-label">Heutige Belohnung</div>
            <div className="streak-popup__today-reward">{reward.label}</div>
          </div>
        </div>

        {/* Wochen-Kalender */}
        <div className="streak-calendar">
          {weekDays.map(({ day, def }) => {
            const isClaimed = day < newStreak;
            const isToday   = day === newStreak;
            const isFuture  = day > newStreak;
            return (
              <div
                key={day}
                className={`streak-cal-day ${isClaimed ? 'streak-cal-day--done' : ''} ${isToday ? 'streak-cal-day--today' : ''} ${isFuture ? 'streak-cal-day--future' : ''}`}
              >
                <div className="streak-cal-day__num">T{day}</div>
                <div className="streak-cal-day__icon">
                  {isClaimed ? '✓' : def.icon}
                </div>
                <div className="streak-cal-day__crystals">{def.crystals}💎</div>
                {def.crystalCards && (
                  <div className="streak-cal-day__bonus">+KK</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Nächster Milestone */}
        {nextMilestone && (
          <div className="streak-popup__next">
            <span className="streak-popup__next-label">Nächster Bonus:</span>
            <span className="streak-popup__next-day">Tag {nextMilestone.day}</span>
            <span className="streak-popup__next-reward">{nextMilestone.label}</span>
          </div>
        )}

        <button className="streak-popup__btn" onClick={onClose}>
          Danke! ✓
        </button>

      </div>
    </div>
  );
};

export default LoginStreakPopup;
