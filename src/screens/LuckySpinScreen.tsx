import React, { useState, useEffect, useRef } from 'react';
import { LuckySpinService, SPIN_PRIZES, type SpinPrize } from '../services/LuckySpinService';
import { AchievementService } from '../services/AchievementService';
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

const SEG_COUNT = SPIN_PRIZES.length;
const SEG_DEG   = 360 / SEG_COUNT;

const LuckySpinScreen: React.FC<Props> = ({ onBack }) => {
  const [canSpin,     setCanSpin]     = useState(() => LuckySpinService.canSpin());
  const [spinning,    setSpinning]    = useState(false);
  const [rotation,    setRotation]    = useState(0);
  const [prize,       setPrize]       = useState<SpinPrize | null>(null);
  const [showResult,  setShowResult]  = useState(false);
  const [streak,      setStreak]      = useState(() => LuckySpinService.getStreak());
  const [resetMs,     setResetMs]     = useState(() => msUntilMidnightUtc());
  const baseRotationRef = useRef(0);

  // Reset result on mount
  useEffect(() => { setPrize(null); setShowResult(false); }, []);

  // Countdown ticker
  useEffect(() => {
    const id = setInterval(() => setResetMs(msUntilMidnightUtc()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleSpin = () => {
    if (!canSpin || spinning) return;
    setShowResult(false);
    setPrize(null);
    setSpinning(true);

    const result = LuckySpinService.spin();
    if (!result) { setSpinning(false); return; }

    AchievementService.recordProgress('spin_first');
    AchievementService.recordProgress('spin_regular', 1);

    const { prize: won, prizeIndex } = result;

    // Target angle: spin 5+ full rotations, stop with prizeIndex segment at top
    // Wheel spins so segment[0] starts at top; each segment is SEG_DEG wide
    // To land on prizeIndex: rotate so that (prizeIndex * SEG_DEG + SEG_DEG/2) faces the pointer
    const targetStop = 360 - (prizeIndex * SEG_DEG + SEG_DEG / 2);
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const newRotation = baseRotationRef.current + fullSpins * 360 + targetStop;

    baseRotationRef.current = newRotation % 360;
    setRotation(newRotation);

    setTimeout(() => {
      setPrize(won);
      setShowResult(true);
      setSpinning(false);
      setCanSpin(false);
      setStreak(LuckySpinService.getStreak());
    }, 4200);
  };

  return (
    <div className="spin-screen">
      <div className="spin-header">
        <button className="spin-back" onClick={onBack}>← Zurück</button>
        <h1 className="spin-title">🎰 Glücksrad</h1>
        {streak >= 2 && (
          <span className="spin-streak-badge">🔥 {streak}T</span>
        )}
      </div>

      {!canSpin && (
        <div className="spin-reset-bar">
          <span className="spin-reset-bar__label">✓ Heute gedreht · Nächste Drehung in</span>
          <span className="spin-reset-bar__timer">{formatHMS(resetMs)}</span>
        </div>
      )}

      <div className="spin-arena">
        {/* Pointer */}
        <div className="spin-pointer">▼</div>

        {/* Wheel */}
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

        {/* Center cap */}
        <div className="spin-center">⭐</div>
      </div>

      {/* Spin Button */}
      <button
        className={`spin-btn ${(!canSpin || spinning) ? 'spin-btn--disabled' : ''}`}
        disabled={!canSpin || spinning}
        onClick={handleSpin}
      >
        {spinning ? '⏳ Drehe...' : canSpin ? '🎰 Drehen!' : '✓ Heute gedreht'}
      </button>

      {/* Result overlay */}
      {showResult && prize && (
        <div className="spin-result" onClick={() => setShowResult(false)}>
          <div className="spin-result__box">
            <div className="spin-result__icon">{prize.icon}</div>
            <div className="spin-result__label">Glückwunsch!</div>
            <div className="spin-result__prize" style={{ color: prize.color }}>{prize.label}</div>
            <div className="spin-result__note">gewonnen! Tippe zum Schließen.</div>
          </div>
        </div>
      )}

      <div className="spin-info">
        <p>Einmal täglich kostenlos drehen.</p>
      </div>

      {/* Prize legend */}
      <div className="spin-legend">
        {SPIN_PRIZES.map(p => (
          <div key={p.id} className="spin-legend-item">
            <span className="spin-legend-item__dot" style={{ background: p.color }} />
            <span className="spin-legend-item__label">{p.icon} {p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LuckySpinScreen;
