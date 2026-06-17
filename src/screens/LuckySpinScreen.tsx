import React, { useState, useEffect, useRef } from 'react';
import { LuckySpinService, SPIN_PRIZES, STREAK_MILESTONES, type SpinPrize } from '../services/LuckySpinService';
import { AchievementService } from '../services/AchievementService';
import { AudioService } from '../services/AudioService';
import './LuckySpinScreen.css';

function msUntilMidnightUtc(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.getTime() - now.getTime();
}

function formatHMS(ms: number): string {
  const s  = Math.max(0, Math.floor(ms / 1000));
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
}

interface Props {
  onBack: () => void;
}

const SEG_COUNT    = SPIN_PRIZES.length;
const SEG_DEG      = 360 / SEG_COUNT;
const TOTAL_WEIGHT = SPIN_PRIZES.reduce((s, p) => s + p.weight, 0);
const JACKPOT      = SPIN_PRIZES.reduce((best, p) => (p.crystals ?? 0) > (best.crystals ?? 0) ? p : best);

const LuckySpinScreen: React.FC<Props> = ({ onBack }) => {
  const [canSpin,      setCanSpin]      = useState(() => LuckySpinService.canSpin());
  const [spinning,     setSpinning]     = useState(false);
  const [rotation,     setRotation]     = useState(0);
  const [prize,        setPrize]        = useState<SpinPrize | null>(null);
  const [streakBonus,  setStreakBonus]  = useState<number | null>(null);
  const [nearMiss,     setNearMiss]     = useState<SpinPrize | null>(null);
  const [showResult,   setShowResult]   = useState(false);
  const [streak,       setStreak]       = useState(() => LuckySpinService.getStreak());
  const [history,      setHistory]      = useState<SpinPrize[]>(() => LuckySpinService.getHistory());
  const [resetMs,      setResetMs]      = useState(() => msUntilMidnightUtc());
  const baseRotationRef  = useRef(0);
  const tickTimersRef    = useRef<number[]>([]);

  useEffect(() => {
    setPrize(null);
    setShowResult(false);
    return () => { tickTimersRef.current.forEach(id => clearTimeout(id)); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setResetMs(msUntilMidnightUtc()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleSpin = () => {
    if (!canSpin || spinning) return;
    setShowResult(false);
    setPrize(null);
    setStreakBonus(null);
    setNearMiss(null);
    setSpinning(true);

    const result = LuckySpinService.spin();
    if (!result) { setSpinning(false); return; }

    AchievementService.recordProgress('spin_first');
    AchievementService.recordProgress('spin_regular', 1);

    const { prize: won, prizeIndex, streakBonus: bonus } = result;

    const targetStop = 360 - (prizeIndex * SEG_DEG + SEG_DEG / 2);
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const newRotation = baseRotationRef.current + fullSpins * 360 + targetStop;

    baseRotationRef.current = newRotation % 360;
    setRotation(newRotation);

    // Schedule wheel tick sounds: fast at start, slow near the end
    tickTimersRef.current.forEach(id => clearTimeout(id));
    const ids: number[] = [];
    let t = 0;
    let interval = 60; // start fast
    while (t < 3800) {
      const capturedT = t;
      ids.push(window.setTimeout(() => AudioService.tick(), capturedT));
      interval = Math.min(280, interval + 4); // gradually decelerate
      t += interval;
    }
    tickTimersRef.current = ids;
    AudioService.vibrate(20);

    // Near-miss: find the adjacent prize that would have been worth more
    const wonValue    = won.crystals ?? 0;
    const leftPrize   = SPIN_PRIZES[(prizeIndex - 1 + SEG_COUNT) % SEG_COUNT]!;
    const rightPrize  = SPIN_PRIZES[(prizeIndex + 1) % SEG_COUNT]!;
    const bestAdj     = (leftPrize.crystals ?? 0) >= (rightPrize.crystals ?? 0) ? leftPrize : rightPrize;
    const nearMissPrize = (bestAdj.crystals ?? 0) > wonValue ? bestAdj : null;

    setTimeout(() => {
      // Play result sound based on prize tier
      const crystals = won.crystals ?? 0;
      if (crystals >= 3000) {
        AudioService.jackpot();
        AudioService.vibrate([30, 20, 50, 20, 80, 20, 100]);
      } else if (crystals >= 1000) {
        AudioService.super();
        AudioService.vibrate([20, 30, 50, 30, 60]);
      } else if (crystals >= 200) {
        AudioService.synergy();
        AudioService.vibrate([20, 25, 30]);
      } else {
        AudioService.reward();
        AudioService.vibrate([15, 20]);
      }
      setPrize(won);
      setStreakBonus(bonus);
      setNearMiss(nearMissPrize);
      setShowResult(true);
      setSpinning(false);
      setCanSpin(false);
      setStreak(LuckySpinService.getStreak());
      setHistory(LuckySpinService.getHistory());
    }, 4200);
  };

  // Next streak milestone
  const nextMilestone = STREAK_MILESTONES.find(ms => ms.days > streak);
  const prevMilestone = [...STREAK_MILESTONES].reverse().find(ms => ms.days <= streak);
  const milestoneBase  = prevMilestone ? prevMilestone.days : 0;
  const milestoneNext  = nextMilestone ? nextMilestone.days : null;
  const milestonePct   = milestoneNext
    ? Math.min(100, ((streak - milestoneBase) / (milestoneNext - milestoneBase)) * 100)
    : 100;

  return (
    <div className="spin-screen">
      <div className="spin-header">
        <button className="spin-back" onClick={() => { AudioService.tap(); onBack(); }}>← Zurück</button>
        <h1 className="spin-title">🎰 Glücksrad</h1>
        {streak >= 1 && (
          <span className={`spin-streak-badge ${streak >= 7 ? 'spin-streak-badge--hot' : ''}`}>
            🔥 {streak}T
          </span>
        )}
      </div>

      {!canSpin && (
        <div className="spin-reset-bar">
          <span className="spin-reset-bar__label">✓ Heute gedreht · Nächste Drehung in</span>
          <span className="spin-reset-bar__timer">{formatHMS(resetMs)}</span>
        </div>
      )}

      {/* Streak Milestone Road */}
      {streak >= 1 && (
        <div className="spin-milestone-road">
          <div className="spin-milestone-road__top">
            <span className="spin-milestone-road__label">
              {nextMilestone
                ? `Noch ${nextMilestone.days - streak} Tag${nextMilestone.days - streak !== 1 ? 'e' : ''} bis +${nextMilestone.bonus.toLocaleString('de-DE')} 💎 Bonus`
                : '✦ Alle Serien-Boni freigeschaltet!'}
            </span>
            <span className="spin-milestone-road__streak">{streak} / {nextMilestone?.days ?? STREAK_MILESTONES[STREAK_MILESTONES.length - 1]!.days} Tage</span>
          </div>
          <div className="spin-milestone-road__bar">
            <div className="spin-milestone-road__fill" style={{ width: `${milestonePct}%` }} />
            {STREAK_MILESTONES.map(ms => (
              <div
                key={ms.days}
                className={`spin-milestone-road__pip ${streak >= ms.days ? 'spin-milestone-road__pip--done' : ''}`}
                style={{ left: `${(ms.days / STREAK_MILESTONES[STREAK_MILESTONES.length - 1]!.days) * 100}%` }}
                title={`${ms.label}: +${ms.bonus} 💎`}
              />
            ))}
          </div>
          <div className="spin-milestone-road__marks">
            {STREAK_MILESTONES.map(ms => (
              <span
                key={ms.days}
                className={`spin-milestone-road__mark ${streak >= ms.days ? 'spin-milestone-road__mark--done' : ''}`}
                style={{ left: `${(ms.days / STREAK_MILESTONES[STREAK_MILESTONES.length - 1]!.days) * 100}%` }}
              >
                {ms.days}T
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="spin-arena">
        <div className="spin-pointer">▼</div>
        <div
          className="spin-wheel"
          style={{
            transform:  `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.15, 1.00)' : 'none',
          }}
        >
          {SPIN_PRIZES.map((p, i) => {
            const midDeg = i * SEG_DEG + SEG_DEG / 2;
            return (
              <div
                key={p.id}
                className="spin-label"
                style={{ transform: `rotate(${midDeg}deg) translateY(-104px)` }}
              >
                <div className="spin-label__inner" style={{ transform: `rotate(${-midDeg}deg)` }}>
                  <span className="spin-label__icon">{p.icon}</span>
                  <span className="spin-label__text">{p.label.replace(' Kristalle', '').replace(' Account-XP', ' XP').replace(' Tränke', '🧪').replace(' Trank', '🧪')}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="spin-center">⭐</div>
      </div>

      {canSpin && !spinning && (
        <div className="spin-jackpot-hint">
          ✦ Jackpot: {JACKPOT.label} ·{' '}
          <span style={{ color: JACKPOT.color }}>
            {Math.round((JACKPOT.weight / TOTAL_WEIGHT) * 100)}% Chance
          </span>
        </div>
      )}

      <button
        className={`spin-btn ${(!canSpin || spinning) ? 'spin-btn--disabled' : canSpin && !spinning ? 'spin-btn--ready' : ''}`}
        disabled={!canSpin || spinning}
        onClick={handleSpin}
      >
        {spinning ? '⏳ Drehe...' : canSpin ? '🎰 Drehen!' : '✓ Heute gedreht'}
      </button>

      {/* Recent spin history */}
      {history.length > 0 && (
        <div className="spin-history">
          <div className="spin-history__label">Letzte Ergebnisse</div>
          <div className="spin-history__row">
            {history.map((p, i) => (
              <div
                key={i}
                className={`spin-history__chip ${i === 0 && !canSpin ? 'spin-history__chip--latest' : ''}`}
                title={p.label}
                style={{ borderColor: p.color }}
              >
                <span className="spin-history__chip-icon">{p.icon}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result overlay */}
      {showResult && prize && (() => {
        const isJackpot    = (prize.crystals ?? 0) >= 3000;
        const isBigWin     = (prize.crystals ?? 0) >= 1000;
        const isMediumWin  = !isBigWin && (prize.crystals ?? 0) >= 200;
        const resultClass  = isJackpot ? 'spin-result--jackpot' : isBigWin ? 'spin-result--big' : isMediumWin ? 'spin-result--medium' : '';
        return (
          <div className={`spin-result ${resultClass}`} onClick={() => { AudioService.tap(); setShowResult(false); }}>
            {isJackpot && (
              <div className="spin-jackpot-particles" aria-hidden="true">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className={`spin-jp-particle spin-jp-particle--${i % 4}`} />
                ))}
              </div>
            )}
            {isMediumWin && (
              <div className="spin-medium-particles" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={`spin-mw-particle spin-mw-particle--${i % 4}`} style={{ '--i': i } as React.CSSProperties} />
                ))}
              </div>
            )}
            <div className={`spin-result__box ${isJackpot ? 'spin-result__box--jackpot' : isBigWin ? 'spin-result__box--big' : isMediumWin ? 'spin-result__box--medium' : ''}`}>
              <div className={`spin-result__icon ${isJackpot ? 'spin-result__icon--jackpot' : ''}`}>{prize.icon}</div>
              <div className={`spin-result__label ${isJackpot ? 'spin-result__label--jackpot' : isMediumWin ? 'spin-result__label--medium' : ''}`}>
                {isJackpot ? '🎉 JACKPOT!' : isBigWin ? '⭐ GROSSER GEWINN!' : isMediumWin ? '✦ GUTER GEWINN!' : 'Glückwunsch!'}
              </div>
              <div className="spin-result__prize" style={{ color: prize.color }}>{prize.label}</div>
              {streakBonus && streakBonus > 0 && (
                <div className="spin-result__streak-bonus">
                  🔥 Serien-Bonus: +{streakBonus.toLocaleString('de-DE')} 💎
                </div>
              )}
              {nearMiss && (
                <div className="spin-near-miss">
                  <div className="spin-near-miss__label">SO NAH!</div>
                  <div className="spin-near-miss__content">
                    <span className="spin-near-miss__icon">{nearMiss.icon}</span>
                    <span className="spin-near-miss__prize" style={{ color: nearMiss.color }}>{nearMiss.label}</span>
                  </div>
                  <div className="spin-near-miss__sub">wäre es fast geworden — morgen wieder! 🍀</div>
                </div>
              )}
              <div className="spin-result__note">Tippe zum Schließen.</div>
            </div>
          </div>
        );
      })()}

      <div className="spin-info">
        <p>Einmal täglich kostenlos drehen.</p>
      </div>

      <div className="spin-legend">
        {SPIN_PRIZES.map(p => {
          const pct = Math.round((p.weight / TOTAL_WEIGHT) * 100);
          return (
            <div key={p.id} className="spin-legend-item">
              <span className="spin-legend-item__dot" style={{ background: p.color }} />
              <span className="spin-legend-item__label">{p.icon} {p.label}</span>
              <span className="spin-legend-item__pct" style={{ color: p.color }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LuckySpinScreen;
