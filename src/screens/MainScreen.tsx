import React, { useState, useEffect, useCallback } from 'react';
import { SaveService } from '../services/SaveService';
import { CardDatabase } from '../services/CardDatabase';
import './MainScreen.css';

// ── Typen ─────────────────────────────────────────────────────

interface MainScreenProps {
  onBack: () => void;
}

// ── Konstanten ────────────────────────────────────────────────

const TIPS = [
  'Tipp: Du kannst Unsterbliche beschwören, um dein Deck zu stärken!',
  'Tipp: Kombiniere Elemente für mächtige Combo-Angriffe.',
  'Tipp: Seltenere Karten haben höhere Basis-Stats.',
  'Tipp: Prüfe täglich dein Quest-Board für Belohnungen.',
  'Tipp: MR-Karten dürfen nur einmal pro Deck verwendet werden.',
];

const B = import.meta.env.BASE_URL;

const NPC_IMAGES = [
  `${B}assets/cards/azazel.png`,
  `${B}assets/cards/azgaroth.png`,
  `${B}assets/cards/satan.png`,
];

const BATTLE_HOURS = [0, 7, 14, 21];

// ── Hilfsfunktionen ───────────────────────────────────────────

function nextBattleMs(): number {
  const now = new Date();
  // nächste UTC-Stunde in [0,7,14,21]
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const s = now.getUTCSeconds();

  const elapsedInHour = m * 60 + s;

  for (const bh of BATTLE_HOURS) {
    const diff = (bh - h + 24) % 24;
    if (diff === 0 && elapsedInHour === 0) return 0;
    if (diff > 0) {
      return (diff * 3600 - elapsedInHour) * 1000;
    }
  }
  // wrap um Mitternacht
  const firstHour = BATTLE_HOURS[0];
  const hoursUntil = (firstHour + 24 - h + 24) % 24 || 24;
  return (hoursUntil * 3600 - elapsedInHour) * 1000;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// ── Haupt-Komponente ──────────────────────────────────────────

const MainScreen: React.FC<MainScreenProps> = ({ onBack }) => {
  const [countdown, setCountdown] = useState(() => nextBattleMs());
  const [tipIndex,  setTipIndex]  = useState(0);
  const [npcIndex,  setNpcIndex]  = useState(0);
  const [deckStats, setDeckStats] = useState<{ atk: number; def: number } | null>(null);

  // Countdown-Tick
  useEffect(() => {
    const id = setInterval(() => setCountdown(nextBattleMs()), 1000);
    return () => clearInterval(id);
  }, []);

  // Tipp-Rotation alle 6s
  useEffect(() => {
    const id = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 6000);
    return () => clearInterval(id);
  }, []);

  // NPC-Rotation alle 5s
  useEffect(() => {
    const id = setInterval(() => setNpcIndex(i => (i + 1) % NPC_IMAGES.length), 5000);
    return () => clearInterval(id);
  }, []);

  // Deck-Stats laden
  useEffect(() => {
    const deck = SaveService.loadDeck();
    if (deck.uuids.length === 0) {
      setDeckStats(null);
      return;
    }
    const gachaState = SaveService.loadGachaState();
    const inventory = gachaState.inventory;
    let totalAtk = 0;
    let totalDef = 0;
    let found = 0;

    for (const uuid of deck.uuids) {
      const inst = inventory.find(ci => ci.uuid === uuid);
      if (!inst) continue;
      const card = CardDatabase.getById(inst.cardId);
      if (!card) continue;
      totalAtk += card.stats.atk;
      totalDef += card.stats.def;
      found++;
    }

    setDeckStats(found > 0 ? { atk: totalAtk, def: totalDef } : null);
  }, []);

  const handleRefresh = useCallback(() => {
    setCountdown(nextBattleMs());
  }, []);

  return (
    <div className="main-screen">

      {/* ── Top-Bar ── */}
      <div className="main-topbar">
        <button className="main-topbar__back" onClick={onBack}>← Zurück</button>
        <div className="main-topbar__countdown">
          <span className="main-topbar__countdown-label">Bis zur nächsten Schlacht</span>
          <span className="main-topbar__countdown-value">{formatCountdown(countdown)}</span>
        </div>
        <button className="main-topbar__refresh" onClick={handleRefresh} aria-label="Aktualisieren">↺</button>
      </div>

      {/* ── Ressourcen-Balken ── */}
      <div className="main-resources">
        <div className="main-res-row">
          <div className="main-res-item">
            <span className="main-res-label">Ausdauer</span>
            <div className="main-res-bar">
              <div className="main-res-bar__fill" style={{ width: '100%' }} />
            </div>
            <span className="main-res-value">100/100</span>
          </div>
          <div className="main-res-item">
            <span className="main-res-label">EXP</span>
            <div className="main-res-bar main-res-bar--exp">
              <div className="main-res-bar__fill main-res-bar__fill--exp" style={{ width: '0%' }} />
            </div>
            <span className="main-res-value">0%</span>
          </div>
        </div>
        <div className="main-res-row">
          <div className="main-res-item">
            <span className="main-res-label">MP</span>
            <div className="main-res-bar">
              <div className="main-res-bar__fill main-res-bar__fill--mp" style={{ width: '100%' }} />
            </div>
            <span className="main-res-value">100/100</span>
          </div>
          <div className="main-res-item">
            <span className="main-res-label">Mana</span>
            <div className="main-res-bar main-res-bar--mana" />
            <span className="main-res-value main-res-value--mana">500</span>
          </div>
        </div>
      </div>

      {/* ── Info-Banner ── */}
      <div className="main-infobanner">
        <span className="main-infobanner__icon">ⓘ</span>
        <span className="main-infobanner__text">Willkommen bei Codex Immortalis!</span>
      </div>

      {/* ── Scrollbarer Inhaltsbereich ── */}
      <div className="main-body">

      {/* ── Hauptkarte ── */}
      <div className="main-card">
        {/* Profil-Seite */}
        <div className="main-card__profile">
          <div className="main-profile-frame">
            <div className="main-profile-frame__card">
              <img
                className="main-profile-frame__img"
                src={`${B}assets/cards/azazel.png`}
                alt="Azazel"
              />
              <div className="main-profile-frame__num">006.</div>
              <div className="main-profile-frame__compass">✦</div>
              <div className="main-profile-frame__overlay">
                <div className="main-profile-frame__card-name">Azazel,</div>
                <div className="main-profile-frame__card-title">Richter der sterbenden Sonne</div>
              </div>
            </div>
            <div className="main-profile-frame__stars">★★★★★</div>
            <div className="main-profile-frame__name">Azazel</div>
          </div>
        </div>

        {/* Rechte Seite */}
        <div className="main-card__right">
          <button className="main-card__action-btn" onClick={() => {}}>
            💎 Relics kaufen
          </button>
          <button className="main-card__action-btn" onClick={() => {}}>
            📜 Updates <span className="main-card__badge">③</span>
          </button>
          <div className="main-card__divider" />
          <div className="main-card__status">
            <div className="main-card__status-title">Status</div>
            <div className="main-card__status-row">
              <span className="main-card__status-label">Gesamt ATK:</span>
              <span className="main-card__status-value">
                {deckStats ? deckStats.atk.toLocaleString('de-DE') : '—'}
              </span>
            </div>
            <div className="main-card__status-row">
              <span className="main-card__status-label">Gesamt DEF:</span>
              <span className="main-card__status-value">
                {deckStats ? deckStats.def.toLocaleString('de-DE') : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tipp-Bereich ── */}
      <div className="main-tip">
        <span className="main-tip__text">{TIPS[tipIndex]}</span>
        <img
          key={npcIndex}
          className="main-tip__npc"
          src={NPC_IMAGES[npcIndex]}
          alt="NPC"
        />
      </div>

      {/* ── Trenner ── */}
      <div className="main-divider">─────── ✦ Mobile Ignite ✦ ───────</div>

      </div>{/* end main-body */}

    </div>
  );
};

export default MainScreen;
