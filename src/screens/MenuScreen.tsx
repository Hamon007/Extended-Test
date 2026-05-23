import React from 'react';
import './MenuScreen.css';

// ── Typen ─────────────────────────────────────────────────────

interface MenuScreenProps {
  onNav: (target: string) => void;
  onBack: () => void;
}

// ── Menüpunkte ────────────────────────────────────────────────

const MENU_ITEMS: { icon: string; label: string; target: string | null }[] = [
  { icon: '🃏', label: 'Kartensammlung',     target: 'cardCollection' },
  { icon: '📋', label: 'Deck bauen',         target: 'deck' },
  { icon: '🔮', label: 'Fusion & Awakening', target: 'fusion' },
  { icon: '🗡️', label: 'Opfern',             target: 'training' },
  { icon: '👤', label: 'Mein Profil',        target: 'profile' },
  { icon: '👥', label: 'Freunde',            target: 'friends' },
  { icon: '🔀', label: 'Handel',             target: 'trade' },
  { icon: '⚙️', label: 'Einstellungen',      target: null },
  { icon: 'ℹ️', label: 'Über das Spiel',     target: null },
  { icon: '🔄', label: 'Daten zurücksetzen', target: null },
];

// ── Haupt-Komponente ──────────────────────────────────────────

const MenuScreen: React.FC<MenuScreenProps> = ({ onNav, onBack }) => {
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
        {MENU_ITEMS.map(item => (
          <button
            key={item.label}
            className={`menu-item ${item.target === null ? 'menu-item--disabled' : ''}`}
            onClick={() => item.target !== null && onNav(item.target)}
            disabled={item.target === null}
          >
            <span className="menu-item__icon">{item.icon}</span>
            <span className="menu-item__label">{item.label}</span>
            {item.target !== null && (
              <span className="menu-item__arrow">›</span>
            )}
            {item.target === null && (
              <span className="menu-item__soon">Kommt bald</span>
            )}
          </button>
        ))}
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
