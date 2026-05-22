import React, { useState, useEffect, useCallback } from 'react';
import { SaveService } from '../services/SaveService';
import { EnergyService } from '../services/EnergyService';
import { AccountProgressionService } from '../services/AccountProgressionService';
import type { AccountState } from '../types/AccountTypes';
import { CardDatabase } from '../services/CardDatabase';
import type { Card } from '../types/Card';
import CardDetailModal from '../components/CardDetailModal';
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

const B  = import.meta.env.BASE_URL;
const UI = `${B}assets/ui/`;

const BATTLE_HOURS = [0, 7, 14, 21];

// ── Hilfsfunktionen ───────────────────────────────────────────

function nextBattleMs(): number {
  const now = new Date();
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

function pct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

// ── Ressourcen-Balken ─────────────────────────────────────────

interface ResBarProps {
  variant: 'stamina' | 'exp' | 'mana' | 'crystal';
  label:   string;
  value:   string;
  fill?:   number;   // Füllstand in % (entfällt bei reinem Zähler)
}

const ResBar: React.FC<ResBarProps> = ({ variant, label, value, fill }) => (
  <div
    className={`ms-bar ms-bar--${variant}`}
    style={{ backgroundImage: `url(${UI}bar_${variant}.webp)` }}
  >
    <div className="ms-bar__track">
      {fill !== undefined && (
        <div className="ms-bar__fill" style={{ width: `${fill}%` }} />
      )}
      <span className="ms-bar__text">
        <span className="ms-bar__label">{label}</span>
        <span className="ms-bar__value">{value}</span>
      </span>
    </div>
  </div>
);

// ── Haupt-Komponente ──────────────────────────────────────────

const MainScreen: React.FC<MainScreenProps> = ({ onBack }) => {
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [countdown, setCountdown] = useState(() => nextBattleMs());
  const [tipIndex,  setTipIndex]  = useState(0);
  const [deckStats, setDeckStats] = useState<{ atk: number; def: number } | null>(null);
  const [account,   setAccount]   = useState<AccountState>(() => SaveService.loadAccountState());
  const [energy,    setEnergy]    = useState(() => EnergyService.load());
  const [energyMax, setEnergyMax] = useState(() => EnergyService.getMax());

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

  // Account + Energy beim Erscheinen und bei Fokus-Rückkehr aktualisieren
  useEffect(() => {
    const refresh = () => {
      setAccount(SaveService.loadAccountState());
      setEnergy(EnergyService.load());
      setEnergyMax(EnergyService.getMax());
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
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

  const xpNext = AccountProgressionService.xpToNextLevel(account.level);

  return (
    <div className="main-screen">

      {/* ── Top-Bar ── */}
      <div className="main-topbar">
        <button
          className="ms-iconbtn ms-iconbtn--back"
          style={{ backgroundImage: `url(${UI}back_button.webp)` }}
          onClick={onBack}
          aria-label="Zurück"
        />
        <div className="ms-timer" style={{ backgroundImage: `url(${UI}timer_header.webp)` }}>
          <span className="ms-timer__label">Bis zur nächsten Schlacht</span>
          <span className="ms-timer__value">{formatCountdown(countdown)}</span>
        </div>
        <button
          className="ms-iconbtn ms-iconbtn--refresh"
          style={{ backgroundImage: `url(${UI}refresh_button.webp)` }}
          onClick={handleRefresh}
          aria-label="Aktualisieren"
        />
      </div>

      {/* ── Scrollbarer Inhaltsbereich ── */}
      <div className="main-body">

        {/* ── Ressourcen-Balken ── */}
        <div className="ms-bars">
          <ResBar
            variant="stamina"
            label="Ausdauer"
            value={`${energy.energy}/${energyMax}`}
            fill={pct(energy.energy, energyMax)}
          />
          <ResBar
            variant="exp"
            label={`Lv.${account.level}`}
            value={`${account.xp.toLocaleString('de-DE')}/${xpNext.toLocaleString('de-DE')}`}
            fill={pct(account.xp, xpNext)}
          />
          <ResBar
            variant="mana"
            label="Mana"
            value={`${account.mana.toLocaleString('de-DE')}/${account.maxMana.toLocaleString('de-DE')}`}
            fill={pct(account.mana, account.maxMana)}
          />
          <ResBar
            variant="crystal"
            label="Tränke"
            value={`×${energy.potions}`}
          />
        </div>

        {/* ── Info-Banner ── */}
        <div className="ms-info" style={{ backgroundImage: `url(${UI}info_panel.webp)` }}>
          <span className="ms-info__text">Willkommen bei Codex Immortalis!</span>
        </div>

        {/* ── Hauptkarte: Spielerkarte + Aktionen/Status ── */}
        <div className="ms-maincard">

          {/* Spielerkarte */}
          <div
            className="ms-player"
            style={{ backgroundImage: `url(${UI}player_frame.webp)` }}
            onClick={() => setDetailCard(CardDatabase.getById('azazel') ?? null)}
          >
            <div className="ms-player__art">
              <img src={`${B}assets/cards/azazel.png`} alt="Azazel" />
              <div className="ms-player__caption">
                <span className="ms-player__name">Azazel</span>
                <span className="ms-player__title">Richter der sterbenden Sonne</span>
              </div>
            </div>
          </div>

          {/* Aktionen + Status */}
          <div className="ms-side">
            <div className="ms-actions">
              <button
                className="ms-rbtn"
                style={{ backgroundImage: `url(${UI}btn_relics.webp)` }}
                onClick={() => {}}
                aria-label="Relics kaufen"
              />
              <button
                className="ms-rbtn"
                style={{ backgroundImage: `url(${UI}btn_updates.webp)` }}
                onClick={() => {}}
                aria-label="Updates"
              >
                <span className="ms-rbtn__badge">3</span>
              </button>
            </div>

            <div className="ms-status">
              <div className="ms-status__head" style={{ backgroundImage: `url(${UI}status_header.webp)` }}>
                STATUS
              </div>
              <div className="ms-status__row" style={{ backgroundImage: `url(${UI}status_atk.webp)` }}>
                <span className="ms-status__val">
                  {deckStats ? deckStats.atk.toLocaleString('de-DE') : '—'}
                </span>
              </div>
              <div className="ms-status__row" style={{ backgroundImage: `url(${UI}status_def.webp)` }}>
                <span className="ms-status__val">
                  {deckStats ? deckStats.def.toLocaleString('de-DE') : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tipp-Bereich mit Begleiterin ── */}
        <div className="ms-tip">
          <div className="ms-tip__box" style={{ backgroundImage: `url(${UI}message_box.webp)` }}>
            <span className="ms-tip__text">{TIPS[tipIndex]}</span>
          </div>
          <img className="ms-tip__guide" src={`${UI}guide_character.webp`} alt="" aria-hidden="true" />
        </div>

        {/* ── Sektions-Banner ── */}
        <div className="ms-banner" style={{ backgroundImage: `url(${UI}section_banner.webp)` }}>
          <span className="ms-banner__text">Mobile Ignite</span>
        </div>

      </div>{/* end main-body */}

      {/* ── Kartendetail-Modal ── */}
      <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />

    </div>
  );
};

export default MainScreen;
