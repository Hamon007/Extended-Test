import React, { useState, useEffect, useMemo } from 'react';
import { AuthService } from '../services/AuthService';
import { QuestService } from '../services/QuestService';
import { AchievementService } from '../services/AchievementService';
import { ExpeditionService } from '../services/ExpeditionService';
import { LuckySpinService } from '../services/LuckySpinService';
import { DailyLoginService } from '../services/DailyLoginService';
import './TitleScreen.css';

interface TitleScreenProps {
  onEnter: () => void;
  onAccountPress: () => void;
}

const B = import.meta.env.BASE_URL;

const TitleScreen: React.FC<TitleScreenProps> = ({ onEnter, onAccountPress }) => {
  const [loggedIn, setLoggedIn] = useState(() => AuthService.isLoggedIn);
  useEffect(() => AuthService.subscribe(u => setLoggedIn(u !== null)), []);

  const pendingItems = useMemo(() => {
    const items: { icon: string; label: string }[] = [];
    const claimableQuests = [...QuestService.getDailyQuests(), ...QuestService.getWeeklyQuests()]
      .filter(q => q.progress.completed && !q.progress.claimed).length;
    if (claimableQuests > 0)
      items.push({ icon: '📜', label: `${claimableQuests} Quest${claimableQuests > 1 ? 's' : ''}` });

    const achCount = AchievementService.getUnclaimedCount();
    if (achCount > 0)
      items.push({ icon: '🏆', label: `${achCount} Erfolg${achCount > 1 ? 'e' : ''}` });

    const expDone = ExpeditionService.getCompleted().length;
    if (expDone > 0)
      items.push({ icon: '⚔', label: `${expDone} Exp.` });

    if (LuckySpinService.canSpin())
      items.push({ icon: '🎰', label: 'Gratis-Dreh' });

    if (DailyLoginService.canClaim())
      items.push({ icon: '📅', label: 'Tages-Login' });

    return items;
  }, []);

  return (
    <div className="title-screen" onClick={onEnter}>

      {/* Vollbild-Hintergrund */}
      <img
        className="title-screen__bg"
        src={`${B}assets/title_bg.jpg`}
        alt=""
        aria-hidden="true"
      />
      <div className="title-screen__bg-overlay" />

      {/* Logo oben mittig */}
      <div className="title-screen__logo" onClick={e => e.stopPropagation()}>
        <span className="title-screen__logo-codex">Codex</span>
        <span className="title-screen__logo-immortalis">Immortalis</span>
      </div>

      {/* Pending rewards notification */}
      {pendingItems.length > 0 && (
        <div className="title-screen__pending" onClick={e => e.stopPropagation()}>
          <div className="title-screen__pending-label">
            ✦ {pendingItems.length} Belohnung{pendingItems.length > 1 ? 'en' : ''} warten!
          </div>
          <div className="title-screen__pending-chips">
            {pendingItems.map((item, i) => (
              <span key={i} className="title-screen__pending-chip">
                {item.icon} {item.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Start-Button unten mittig */}
      <div className="title-screen__bottom-center" onClick={e => e.stopPropagation()}>
        <button className="title-screen__start-btn" onClick={onEnter}>
          ZUM STARTEN DRÜCKEN
        </button>
      </div>

      {/* Untere linke Buttons */}
      <div className="title-screen__bottom-left" onClick={e => e.stopPropagation()}>
        <button className="title-screen__meta-btn">
          <span className="title-screen__meta-icon">📖</span>
          <span className="title-screen__meta-label">Chronik</span>
        </button>
        <button className="title-screen__meta-btn">
          <span className="title-screen__meta-icon">⚙️</span>
          <span className="title-screen__meta-label">Optionen</span>
        </button>
        <button className="title-screen__meta-btn">
          <span className="title-screen__meta-icon">🔔</span>
          <span className="title-screen__meta-label">News</span>
        </button>
      </div>

      {/* Untere rechte Buttons */}
      <div className="title-screen__bottom-right" onClick={e => e.stopPropagation()}>
        <button className="title-screen__meta-btn" onClick={onAccountPress}>
          <span className="title-screen__meta-icon">{loggedIn ? '✅' : '👤'}</span>
          <span className="title-screen__meta-label">Konto</span>
        </button>
        <button className="title-screen__meta-btn">
          <span className="title-screen__meta-icon">🌐</span>
          <span className="title-screen__meta-label">Sprache</span>
        </button>
        <button className="title-screen__meta-btn">
          <span className="title-screen__meta-icon">🚪</span>
          <span className="title-screen__meta-label">Beenden</span>
        </button>
      </div>

    </div>
  );
};

export default TitleScreen;
