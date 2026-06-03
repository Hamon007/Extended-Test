import React, { useMemo } from 'react';
import { QuestService } from '../services/QuestService';
import { AchievementService } from '../services/AchievementService';
import { ExpeditionService } from '../services/ExpeditionService';
import { LuckySpinService } from '../services/LuckySpinService';
import './MenuScreen.css';

// ── Typen ─────────────────────────────────────────────────────

interface MenuScreenProps {
  onNav: (target: string) => void;
  onBack: () => void;
}

// ── Menüpunkte ────────────────────────────────────────────────

type MenuItem = { icon: string; label: string; target: string | null; badgeKey?: string };

const MENU_ITEMS: MenuItem[] = [
  { icon: '🏠', label: 'Hauptbildschirm',     target: 'main' },
  { icon: '📜', label: 'Aufgaben',            target: 'quests',       badgeKey: 'quests' },
  { icon: '🃏', label: 'Kartensammlung',     target: 'cardCollection' },
  { icon: '📋', label: 'Deck bauen',         target: 'deck' },
  { icon: '🔮', label: 'Fusion & Awakening', target: 'fusion' },
  { icon: '🗡️', label: 'Opfern',             target: 'training' },
  { icon: '🎒', label: 'Inventar',            target: 'inventory' },
  { icon: '👤', label: 'Mein Profil',        target: 'profile' },
  { icon: '👥', label: 'Freunde',            target: 'friends' },
  { icon: '⚔️', label: 'PvP Rangliste',      target: 'pvp' },
  { icon: '🏆', label: 'Achievements',       target: 'achievements',  badgeKey: 'achievements' },
  { icon: '⚔', label: 'Expeditionen',       target: 'expedition',    badgeKey: 'expedition' },
  { icon: '🏅', label: 'Saison-Rang',        target: 'season' },
  { icon: '🛒', label: 'Laden',              target: 'shop',          badgeKey: 'spin' },
  { icon: '🎰', label: 'Glücksrad',           target: 'lucky_spin',    badgeKey: 'spin' },
  { icon: '🔀', label: 'Handel',             target: 'trade' },
  { icon: '⚙️', label: 'Einstellungen',      target: 'settings' },
  { icon: 'ℹ️', label: 'Über das Spiel',     target: null },
  { icon: '🔄', label: 'Daten zurücksetzen', target: null },
];

// ── Haupt-Komponente ──────────────────────────────────────────

const MenuScreen: React.FC<MenuScreenProps> = ({ onNav, onBack }) => {
  const badges = useMemo(() => {
    const claimableQuests = [...QuestService.getDailyQuests(), ...QuestService.getWeeklyQuests()]
      .filter(q => q.progress.completed && !q.progress.claimed).length;
    return {
      quests:       claimableQuests,
      achievements: AchievementService.getUnclaimedCount(),
      expedition:   ExpeditionService.getCompleted().length,
      spin:         LuckySpinService.canSpin() ? 1 : 0,
    };
  }, []);

  return (
    <div className="menu-screen">

      {/* ── Header ── */}
      <div className="menu-header">
        <button className="menu-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="menu-header__title">Menü</h1>
        <div className="menu-header__spacer" />
      </div>

      {/* ── Zierlinie ── */}
      <div className="menu-ornament">✦ ─────────────── ✦</div>

      {/* ── Menüpunkte ── */}
      <div className="menu-list">
        {MENU_ITEMS.map(item => {
          const badgeCount = item.badgeKey ? (badges[item.badgeKey as keyof typeof badges] ?? 0) : 0;
          return (
            <button
              key={item.label}
              className={`menu-item ${item.target === null ? 'menu-item--disabled' : ''}`}
              onClick={() => item.target !== null && onNav(item.target)}
              disabled={item.target === null}
            >
              <span className="menu-item__icon">{item.icon}</span>
              <span className="menu-item__label">{item.label}</span>
              {badgeCount > 0 && (
                <span className="menu-item__badge">{badgeCount > 9 ? '9+' : badgeCount}</span>
              )}
              {item.target !== null && (
                <span className="menu-item__arrow">›</span>
              )}
              {item.target === null && (
                <span className="menu-item__soon">Kommt bald</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div className="menu-footer">
        <div className="menu-footer__line">─────── ✦ Codex Immortalis ✦ ───────</div>
        <div className="menu-footer__version">Version 0.1.0</div>
      </div>
    </div>
  );
};

export default MenuScreen;
