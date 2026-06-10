import React, { useState, useEffect } from 'react';
import type { AchievementDef } from '../services/AchievementService';
import { AchievementService } from '../services/AchievementService';
import './AchievementToast.css';

interface ToastItem {
  id:      number;
  def:     AchievementDef;
  claimed: boolean;
}

let _listeners: ((def: AchievementDef) => void)[] = [];
let _idCounter = 0;

/** Vom AchievementService aufrufen um einen Toast zu zeigen. */
export function showAchievementToast(def: AchievementDef): void {
  _listeners.forEach(fn => fn(def));
}

const AchievementToast: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (def: AchievementDef) => {
      const item: ToastItem = { id: ++_idCounter, def, claimed: false };
      setToasts(prev => [...prev, item]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== item.id));
      }, 5000);
    };
    _listeners.push(handler);
    return () => { _listeners = _listeners.filter(fn => fn !== handler); };
  }, []);

  const handleClaim = (toastId: number, defId: AchievementDef['id']) => {
    AchievementService.claim(defId);
    setToasts(prev => prev.map(t => t.id === toastId ? { ...t, claimed: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 1200);
  };

  return (
    <div className="ach-toast-container">
      {toasts.map(t => {
        const isBig = t.def.crystals >= 500;
        return (
          <div
            key={t.id}
            className={`ach-toast-item ${isBig ? 'ach-toast-item--big' : ''} ${t.claimed ? 'ach-toast-item--claimed' : ''}`}
          >
            <span className="ach-toast-item__icon">{t.def.icon}</span>
            <div className="ach-toast-item__text">
              <div className="ach-toast-item__label">Achievement freigeschaltet!</div>
              <div className="ach-toast-item__title">{t.def.title}</div>
            </div>
            {t.claimed ? (
              <div className="ach-toast-item__claimed-badge">✓ Erhalten!</div>
            ) : (
              <button
                className="ach-toast-item__claim-btn"
                onClick={() => handleClaim(t.id, t.def.id)}
              >
                +{t.def.crystals}💎
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AchievementToast;
