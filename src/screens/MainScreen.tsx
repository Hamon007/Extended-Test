import React, { useState, useEffect, useCallback } from 'react';
import { SaveService } from '../services/SaveService';
import { EnergyService } from '../services/EnergyService';
import { AccountProgressionService } from '../services/AccountProgressionService';
import { ActivityFeedService, type FeedEvent } from '../services/ActivityFeedService';
import { AuthService } from '../services/AuthService';
import type { AccountState } from '../types/AccountTypes';
import { CardDatabase } from '../services/CardDatabase';
import type { Card } from '../types/Card';
import CardDetailModal from '../components/CardDetailModal';
import './MainScreen.css';

interface MainScreenProps {
  onBack: () => void;
}

const TIPS = [
  'Du kannst Unsterbliche beschwören, um dein Deck zu stärken!',
  'Kombiniere Elemente für mächtige Combo-Angriffe.',
  'Seltenere Karten haben höhere Basis-Stats.',
  'Prüfe täglich dein Quest-Board für Belohnungen.',
  'MR-Karten dürfen nur einmal pro Deck verwendet werden.',
];

const B = import.meta.env.BASE_URL;

const NPC_IMAGES = [
  `${B}assets/cards/azazel.webp`,
  `${B}assets/cards/azgaroth.webp`,
  `${B}assets/cards/satan.webp`,
];

const BATTLE_HOURS = [0, 7, 14, 21];

function nextBattleMs(): number {
  const now = new Date();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const s = now.getUTCSeconds();
  const elapsedInHour = m * 60 + s;
  for (const bh of BATTLE_HOURS) {
    const diff = (bh - h + 24) % 24;
    if (diff === 0 && elapsedInHour === 0) return 0;
    if (diff > 0) return (diff * 3600 - elapsedInHour) * 1000;
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

const MainScreen: React.FC<MainScreenProps> = ({ onBack }) => {
  const [detailCard,    setDetailCard]    = useState<Card | null>(null);
  const [countdown,     setCountdown]     = useState(() => nextBattleMs());
  const [tipIndex,      setTipIndex]      = useState(0);
  const [npcIndex,      setNpcIndex]      = useState(0);
  const [deckStats,     setDeckStats]     = useState<{ atk: number; def: number } | null>(null);
  const [account,       setAccount]       = useState<AccountState>(() => SaveService.loadAccountState());
  const [energy,        setEnergy]        = useState(() => EnergyService.load());
  const [energyMax,     setEnergyMax]     = useState(() => EnergyService.getMax());
  const [feedEvents,    setFeedEvents]    = useState<FeedEvent[]>([]);
  const [feedIndex,     setFeedIndex]     = useState(0);
  const [profileCardId, setProfileCardId] = useState(() => localStorage.getItem('ci_profile_card_id') ?? 'azazel');
  const [loggedIn,      setLoggedIn]      = useState(AuthService.isLoggedIn);

  useEffect(() => {
    const id = setInterval(() => setCountdown(nextBattleMs()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 6000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNpcIndex(i => (i + 1) % NPC_IMAGES.length), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setLoggedIn(AuthService.isLoggedIn);
    return AuthService.subscribe(user => setLoggedIn(user !== null));
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    const load = () => ActivityFeedService.getRecent(15).then(setFeedEvents);
    load();
    const unsubRealtime = ActivityFeedService.subscribeToNew(load);
    const pollId = setInterval(load, 60_000);
    return () => { unsubRealtime(); clearInterval(pollId); };
  }, [loggedIn]);

  useEffect(() => {
    if (feedEvents.length < 2) return;
    const id = setInterval(() => setFeedIndex(i => (i + 1) % feedEvents.length), 5000);
    return () => clearInterval(id);
  }, [feedEvents.length]);

  useEffect(() => {
    const refresh = () => {
      setAccount(SaveService.loadAccountState());
      setEnergy(EnergyService.load());
      setEnergyMax(EnergyService.getMax());
      setProfileCardId(localStorage.getItem('ci_profile_card_id') ?? 'azazel');
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  useEffect(() => {
    const deck = SaveService.loadDeck();
    if (deck.uuids.length === 0) { setDeckStats(null); return; }
    const gachaState = SaveService.loadGachaState();
    const inventory = gachaState.inventory;
    let totalAtk = 0, totalDef = 0, found = 0;
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

  const handleRefresh = useCallback(() => setCountdown(nextBattleMs()), []);

  const profileCard = CardDatabase.getById(profileCardId);
  const staminaPct  = energyMax > 0 ? (energy.energy / energyMax) * 100 : 0;
  const mpPct       = account.maxMana > 0 ? (account.mana / account.maxMana) * 100 : 0;
  const xpMax       = AccountProgressionService.xpToNextLevel(account.level);
  const xpPct       = xpMax > 0 ? (account.xp / xpMax) * 100 : 100;
  const xpPctInt    = Math.round(xpPct);

  return (
    <div className="main-screen">

      {/* ── Kompakter 2-Zeilen-Header ── */}
      <div className="ms-header">

        {/* Zeile 1: Back | Stamina | 💎 | Timer | EXP | Reload */}
        <div className="ms-header__r1">
          <button className="ms-btn ms-btn--back" onClick={onBack}>← Zurück</button>

          <div className="ms-res">
            <span className="ms-res__icon">⚡</span>
            <div className="ms-bar">
              <div className="ms-bar__fill" style={{ width: `${staminaPct}%` }} />
            </div>
            <span className="ms-res__val">{energy.energy}/{energyMax}</span>
          </div>

          <span className="ms-gem">💎</span>

          <div className="ms-timer">
            <span className="ms-timer__lbl">Bis zur nächsten Schlacht</span>
            <span className="ms-timer__val">{formatCountdown(countdown)}</span>
          </div>

          <div className="ms-res ms-res--exp">
            <span className="ms-res__lv">Lv.{account.level} EXP</span>
            <div className="ms-bar ms-bar--exp">
              <div className="ms-bar__fill ms-bar__fill--exp" style={{ width: `${xpPct}%` }} />
            </div>
            <span className="ms-res__pct">{xpPctInt}%</span>
          </div>

          <button className="ms-btn ms-btn--reload" onClick={handleRefresh} aria-label="Aktualisieren">↺</button>
        </div>

        {/* Zeile 2: MP-Balken | Mana-Wert */}
        <div className="ms-header__r2">
          <span className="ms-res__icon">💧</span>
          <div className="ms-bar ms-bar--mp">
            <div className="ms-bar__fill ms-bar__fill--mp" style={{ width: `${mpPct}%` }} />
          </div>
          <span className="ms-res__val">{account.mana}/{account.maxMana}</span>
          <span className="ms-spacer" />
          <span className="ms-mana-label">Mana</span>
          <span className="ms-mana-val">{account.mana.toLocaleString('de-DE')}</span>
        </div>
      </div>

      {/* ── Hauptbereich: Portrait links | Panel rechts ── */}
      <div className="ms-content">

        {/* Großes Portrait */}
        <div
          className="ms-portrait"
          onClick={() => setDetailCard(profileCard ?? CardDatabase.getById('azazel') ?? null)}
          role="button"
          aria-label="Profilkarte anzeigen"
        >
          <img
            className="ms-portrait__img"
            src={profileCard?.image ?? `${B}assets/cards/azazel.webp`}
            alt={profileCard?.name ?? 'Azazel'}
          />
          <div className="ms-portrait__footer">
            <div className="ms-portrait__name">{profileCard?.name ?? 'Azazel'},</div>
            <div className="ms-portrait__title">{profileCard?.title ?? 'Richter der sterbenden Sonne'}</div>
          </div>
        </div>

        {/* Rechtes Panel */}
        <div className="ms-panel">
          <button className="ms-panel__btn">💎 Relics kaufen</button>
          <button className="ms-panel__btn ms-panel__btn--updates">
            📜 Updates
            <span className="ms-badge">③</span>
          </button>

          <div className="ms-panel__divider" />

          <div className="ms-status">
            <div className="ms-status__title">Status</div>
            <div className="ms-status__row">
              <span className="ms-status__label">Gesamt ATK:</span>
              <span className="ms-status__val">{deckStats ? deckStats.atk.toLocaleString('de-DE') : '—'}</span>
            </div>
            <div className="ms-status__row">
              <span className="ms-status__label">Gesamt DEF:</span>
              <span className="ms-status__val">{deckStats ? deckStats.def.toLocaleString('de-DE') : '—'}</span>
            </div>
            <div className="ms-status__row">
              <span className="ms-status__label">Tränke:</span>
              <span className="ms-status__val">{energy.potions}×</span>
            </div>
          </div>

          {/* Live-Feed (kompakt) */}
          {feedEvents.length > 0 && (
            <div className="ms-feed">
              <span className="ms-feed__dot" />
              <span className="ms-feed__text" key={feedIndex}>
                {ActivityFeedService.formatEvent(feedEvents[feedIndex % feedEvents.length])}
              </span>
            </div>
          )}
          {!loggedIn && (
            <div className="ms-feed ms-feed--hint">
              <span>🔒</span>
              <span className="ms-feed__text">Anmelden für Live-Ereignisse</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Tipp-Strip ── */}
      <div className="ms-tip">
        <span className="ms-tip__text">{TIPS[tipIndex]}</span>
        <img key={npcIndex} className="ms-tip__npc" src={NPC_IMAGES[npcIndex]} alt="" />
        <span className="ms-tip__brand">Codex Immortalis</span>
      </div>

      <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />
    </div>
  );
};

export default MainScreen;
