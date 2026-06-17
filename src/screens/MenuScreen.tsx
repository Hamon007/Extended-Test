import React, { useMemo } from 'react';
import { QuestService } from '../services/QuestService';
import { AchievementService } from '../services/AchievementService';
import { ExpeditionService } from '../services/ExpeditionService';
import { LuckySpinService } from '../services/LuckySpinService';
import { AudioService } from '../services/AudioService';
import './MenuScreen.css';

// ── Typen ─────────────────────────────────────────────────────

interface MenuScreenProps {
  onNav: (target: string) => void;
  onBack: () => void;
}

type MenuItem = {
  icon: string;
  label: string;
  target: string | null;
  badgeKey?: string;
  hintKey?: string;
};

// ── Menüpunkte ────────────────────────────────────────────────

const MENU_ITEMS: MenuItem[] = [
  { icon: '🏠', label: 'Hauptbildschirm',     target: 'main' },
  { icon: '📜', label: 'Aufgaben',            target: 'quests',       badgeKey: 'quests',       hintKey: 'quests' },
  { icon: '🃏', label: 'Kartensammlung',     target: 'cardCollection' },
  { icon: '📋', label: 'Deck bauen',         target: 'deck' },
  { icon: '🔮', label: 'Fusion & Awakening', target: 'fusion' },
  { icon: '🗡️', label: 'Opfern',             target: 'training' },
  { icon: '🎒', label: 'Inventar',            target: 'inventory' },
  { icon: '👤', label: 'Mein Profil',        target: 'profile' },
  { icon: '👥', label: 'Freunde',            target: 'friends' },
  { icon: '⚔️', label: 'PvP Rangliste',      target: 'pvp' },
  { icon: '🏆', label: 'Achievements',       target: 'achievements',  badgeKey: 'achievements', hintKey: 'achievements' },
  { icon: '⚔', label: 'Expeditionen',       target: 'expedition',    badgeKey: 'expedition',   hintKey: 'expedition' },
  { icon: '🏅', label: 'Saison-Rang',        target: 'season' },
  { icon: '🛒', label: 'Laden',              target: 'shop' },
  { icon: '🎰', label: 'Glücksrad',           target: 'lucky_spin',    badgeKey: 'spin',         hintKey: 'spin' },
  { icon: '🔀', label: 'Handel',             target: 'trade' },
  { icon: '⚙️', label: 'Einstellungen',      target: 'settings' },
  { icon: 'ℹ️', label: 'Über das Spiel',     target: null },
  { icon: '🔄', label: 'Daten zurücksetzen', target: null },
];

// ── Haupt-Komponente ──────────────────────────────────────────

const MenuScreen: React.FC<MenuScreenProps> = ({ onNav, onBack }) => {
  const badges = useMemo(() => {
    const allQuests  = [...QuestService.getDailyQuests(), ...QuestService.getWeeklyQuests()];
    const claimable  = allQuests.filter(q => q.progress.completed && !q.progress.claimed).length;
    const inProgress = allQuests.filter(q => !q.progress.completed && !q.progress.claimed).length;
    const achCount   = AchievementService.getUnclaimedCount();
    const expDone    = ExpeditionService.getCompleted().length;
    const spinReady  = LuckySpinService.canSpin();
    return {
      quests:       claimable,
      questsTotal:  allQuests.length,
      questsInProg: inProgress,
      achievements: achCount,
      expedition:   expDone,
      spin:         spinReady ? 1 : 0,
    };
  }, []);

  const hints: Record<string, string> = useMemo(() => {
    const h: Record<string, string> = {};
    if (badges.quests > 0) {
      h['quests'] = `${badges.quests} Belohnung${badges.quests !== 1 ? 'en' : ''} abholbereit!`;
    } else if (badges.questsInProg > 0) {
      h['quests'] = `${badges.questsInProg} Quest${badges.questsInProg !== 1 ? 's' : ''} läuft`;
    }
    if (badges.achievements > 0) {
      h['achievements'] = `${badges.achievements} Erfolg${badges.achievements !== 1 ? 'e' : ''} abholbereit!`;
    }
    if (badges.expedition > 0) {
      h['expedition'] = `${badges.expedition} Expedition${badges.expedition !== 1 ? 'en' : ''} abgeschlossen!`;
    }
    if (badges.spin > 0) {
      h['spin'] = 'Gratis-Dreh verfügbar! 🎰';
    }
    return h;
  }, [badges]);

  const totalPending = badges.quests + badges.achievements + badges.expedition + badges.spin;

  return (
    <div className="menu-screen">

      {/* ── Header ── */}
      <div className="menu-header">
        <button className="menu-header__back" onClick={() => { AudioService.tap(); onBack(); }}>← Zurück</button>
        <h1 className="menu-header__title">
          Menü
          {totalPending > 0 && (
            <span className="menu-header__pending">{totalPending > 9 ? '9+' : totalPending}</span>
          )}
        </h1>
        <div className="menu-header__spacer" />
      </div>

      {/* ── Today at a Glance ── */}
      {totalPending > 0 && (
        <div className="menu-glance">
          <div className="menu-glance__label">◆ HEUTE ZU TUN</div>
          <div className="menu-glance__chips">
            {badges.quests > 0 && (
              <button className="menu-glance__chip menu-glance__chip--quest" onClick={() => { AudioService.tap(); onNav('quests'); }}>
                📜 {badges.quests} Quest{badges.quests !== 1 ? 's' : ''}
              </button>
            )}
            {badges.achievements > 0 && (
              <button className="menu-glance__chip menu-glance__chip--ach" onClick={() => { AudioService.tap(); onNav('achievements'); }}>
                🏆 {badges.achievements} Erfolg{badges.achievements !== 1 ? 'e' : ''}
              </button>
            )}
            {badges.expedition > 0 && (
              <button className="menu-glance__chip menu-glance__chip--exp" onClick={() => { AudioService.tap(); onNav('expedition'); }}>
                ⚔ {badges.expedition} Exp.
              </button>
            )}
            {badges.spin > 0 && (
              <button className="menu-glance__chip menu-glance__chip--spin" onClick={() => { AudioService.tap(); onNav('lucky_spin'); }}>
                🎰 Gratis-Dreh!
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Zierlinie ── */}
      <div className="menu-ornament">✦ ─────────────── ✦</div>

      {/* ── Menüpunkte ── */}
      <div className="menu-list">
        {MENU_ITEMS.map(item => {
          const badgeCount = item.badgeKey ? (badges[item.badgeKey as keyof typeof badges] ?? 0) : 0;
          const hint       = item.hintKey ? (hints[item.hintKey] ?? '') : '';
          const isUrgent   = badgeCount > 0;
          return (
            <button
              key={item.label}
              className={`menu-item ${item.target === null ? 'menu-item--disabled' : ''} ${isUrgent ? 'menu-item--urgent' : ''}`}
              onClick={() => { if (item.target !== null) { AudioService.tap(); onNav(item.target); } }}
              disabled={item.target === null}
            >
              <span className="menu-item__icon">{item.icon}</span>
              <div className="menu-item__body">
                <span className="menu-item__label">{item.label}</span>
                {hint && <span className="menu-item__hint">{hint}</span>}
              </div>
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
