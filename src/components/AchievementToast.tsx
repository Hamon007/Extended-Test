import React, { useState, useEffect } from 'react';
import type { AchievementDef } from '../services/AchievementService';
import './AchievementToast.css';

interface ToastItem {
  id:  number;
  def: AchievementDef;
}

let _listeners: ((def: AchievementDef) => void)[] = [];
let _idCounter = 0;

/** Vom AchievementService (oder wo auch immer) aufrufen um einen Toast zu zeigen. */
export function showAchievementToast(def: AchievementDef): void {
  _listeners.forEach(fn => fn(def));
}

const AchievementToast: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (def: AchievementDef) => {
      const item: ToastItem = { id: ++_idCounter, def };
      setToasts(prev => [...prev, item]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== item.id));
      }, 3500);
    };
    _listeners.push(handler);
    return () => { _listeners = _listeners.filter(fn => fn !== handler); };
  }, []);

  return (
    <div className="ach-toast-container">
      {toasts.map(t => (
        <div key={t.id} className="ach-toast-item">
          <span className="ach-toast-item__icon">{t.def.icon}</span>
          <div className="ach-toast-item__text">
            <div className="ach-toast-item__label">Achievement freigeschaltet!</div>
            <div className="ach-toast-item__title">{t.def.title}</div>
          </div>
          <div className="ach-toast-item__crystals">+{t.def.crystals}💎</div>
        </div>
      ))}
    </div>
  );
};

export default AchievementToast;
