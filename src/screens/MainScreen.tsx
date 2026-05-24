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
  const staminaPct  = energyMax > 0 ? Math.min(100, (energy.energy / energyMax) * 100) : 0;
  const mpPct       = account.maxMana > 0 ? Math.min(100, (account.mana / account.maxMana) * 100) : 0;
  const xpMax       = AccountProgressionService.xpToNextLevel(account.level);
  const xpPct       = xpMax > 0 ? Math.min(100, (account.xp / xpMax) * 100) : 100;
  const xpPctInt    = Math.round(xpPct);

  const infoText = feedEvents.length > 0
    ? ActivityFeedService.formatEvent(feedEvents[feedIndex % feedEvents.length])
    : 'Willkommen zurück, Beschwörer. Deine nächste Schlacht wartet.';

  return (
    <div className="main-screen">

      {/* ── HEADER: Back | Crest-Timer | Reload + Bars ── */}
      <div className="ms-header">

        {/* Timer-Crest (absolut zentriert, überlagert Bars) */}
        <div className="ms-crest" aria-hidden="true">
          <img src={`${B}assets/ui/timer.png`} alt="" className="ms-crest__frame" draggable={false} />
          <div className="ms-crest__text">
            <span className="ms-crest__lbl">Bis zur nächsten Schlacht</span>
            <span className="ms-crest__val">{formatCountdown(countdown)}</span>
          </div>
        </div>

        {/* Zeile 1: Back | [Crest-Spacer] | Reload */}
        <div className="ms-hr1">
          <button className="ms-hbtn ms-hbtn--back" onClick={onBack}>
            <img src={`${B}assets/ui/back.png`} alt="Zurück" draggable={false} />
          </button>
          <div className="ms-hr1__spacer" />
          <button className="ms-hbtn ms-hbtn--reload" onClick={handleRefresh}>
            <img src={`${B}assets/ui/reload.png`} alt="Neu laden" draggable={false} />
          </button>
        </div>

        {/* Zeile 2: Linke Bars | [Crest-Spacer] | Rechte Bars */}
        <div className="ms-hr2">

          {/* Links: Stamina + MP */}
          <div className="ms-bars ms-bars--left">
            <div className="ms-bar-wrap">
              <img src={`${B}assets/ui/bar-stamina.png`} alt="" className="ms-bar__frame" draggable={false} />
              <div className="ms-bar__over">
                <span className="ms-bar__lbl">Ausdauer</span>
                <div className="ms-bar__track">
                  <div className="ms-bar__fill ms-bar__fill--sta" style={{ width: `${staminaPct}%` }} />
                </div>
                <span className="ms-bar__val">{energy.energy}/{energyMax}</span>
              </div>
            </div>
            <div className="ms-bar-wrap">
              <img src={`${B}assets/ui/bar-mp.png`} alt="" className="ms-bar__frame" draggable={false} />
              <div className="ms-bar__over">
                <span className="ms-bar__lbl">MP</span>
                <div className="ms-bar__track">
                  <div className="ms-bar__fill ms-bar__fill--mp" style={{ width: `${mpPct}%` }} />
                </div>
                <span className="ms-bar__val">{account.mana}/{account.maxMana}</span>
              </div>
            </div>
          </div>

          <div className="ms-hr2__spacer" />

          {/* Rechts: EXP + Mana */}
          <div className="ms-bars ms-bars--right">
            <div className="ms-bar-wrap">
              <img src={`${B}assets/ui/bar-exp.png`} alt="" className="ms-bar__frame" draggable={false} />
              <div className="ms-bar__over">
                <span className="ms-bar__lbl">EXP</span>
                <div className="ms-bar__track">
                  <div className="ms-bar__fill ms-bar__fill--exp" style={{ width: `${xpPct}%` }} />
                </div>
                <span className="ms-bar__val">{xpPctInt}%</span>
              </div>
            </div>
            <div className="ms-bar-wrap">
              <img src={`${B}assets/ui/bar-mana.png`} alt="" className="ms-bar__frame" draggable={false} />
              <div className="ms-bar__over ms-bar__over--mana">
                <span className="ms-bar__mana-lbl">Mana</span>
                <span className="ms-bar__mana-val">{account.mana.toLocaleString('de-DE')}</span>
              </div>
            </div>
          </div>

        </div>{/* hr2 */}
      </div>{/* header */}

      {/* ── INFO-PANEL ── */}
      <div className="ms-info">
        <img src={`${B}assets/ui/info.png`} alt="" className="ms-info__frame" draggable={false} />
        <div className="ms-info__text" key={feedIndex}>{infoText}</div>
      </div>

      {/* ── HAUPTINHALT: Karte links | Panel rechts ── */}
      <div className="ms-content">

        {/* Charakter-Karte */}
        <div
          className="ms-card"
          onClick={() => setDetailCard(profileCard ?? CardDatabase.getById('azazel') ?? null)}
          role="button"
          aria-label="Profilkarte"
        >
          <img
            className="ms-card__art"
            src={profileCard?.image ?? `${B}assets/cards/azazel.webp`}
            alt={profileCard?.name ?? ''}
            draggable={false}
          />
          <img
            className="ms-card__frame"
            src={`${B}assets/ui/card-frame.png`}
            alt=""
            draggable={false}
          />
          <div className="ms-card__footer">
            <div className="ms-card__name">{profileCard?.name ?? 'Azazel'},</div>
            <div className="ms-card__title">{profileCard?.title ?? 'Richter der sterbenden Sonne'}</div>
          </div>
        </div>

        {/* Rechtes Panel */}
        <div className="ms-panel">

          {/* Runde Buttons: Relics + Updates */}
          <div className="ms-panel__btns">
            <div className="ms-rbtn">
              <img src={`${B}assets/ui/btn-relics.png`} alt="Relics" className="ms-rbtn__img" draggable={false} />
              <span className="ms-rbtn__lbl">Relics kaufen</span>
            </div>
            <div className="ms-rbtn">
              <div className="ms-rbtn__wrap">
                <img src={`${B}assets/ui/btn-updates.png`} alt="Updates" className="ms-rbtn__img" draggable={false} />
                <span className="ms-rbtn__badge">3</span>
              </div>
              <span className="ms-rbtn__lbl">Updates</span>
            </div>
          </div>

          {/* Status */}
          <div className="ms-status">
            <div className="ms-status__hdr">
              <img src={`${B}assets/ui/status-header.png`} alt="" draggable={false} />
              <span className="ms-status__hdr-txt">Status</span>
            </div>
            <div className="ms-stat-row">
              <img src={`${B}assets/ui/stat-atk.png`} alt="" className="ms-stat-row__frame" draggable={false} />
              <div className="ms-stat-row__over">
                <span className="ms-stat-row__lbl">Gesamt ATK:</span>
                <span className="ms-stat-row__val">{deckStats ? deckStats.atk.toLocaleString('de-DE') : '—'}</span>
              </div>
            </div>
            <div className="ms-stat-row">
              <img src={`${B}assets/ui/stat-def.png`} alt="" className="ms-stat-row__frame" draggable={false} />
              <div className="ms-stat-row__over">
                <span className="ms-stat-row__lbl">Gesamt DEF:</span>
                <span className="ms-stat-row__val">{deckStats ? deckStats.def.toLocaleString('de-DE') : '—'}</span>
              </div>
            </div>
          </div>

          {/* Account-Level (klein) */}
          <div className="ms-panel__lv">
            Lv.{account.level} · {energy.potions > 0 ? `${energy.potions}× 🧪` : ''}
          </div>

        </div>{/* panel */}
      </div>{/* content */}

      {/* ── BOTTOM: Message-Box + NPC + Banner ── */}
      <div className="ms-bottom">
        <div className="ms-message">
          <img src={`${B}assets/ui/message.png`} alt="" className="ms-message__frame" draggable={false} />
          <div className="ms-message__text">{TIPS[tipIndex]}</div>
          <img
            key={npcIndex}
            src={`${B}assets/ui/guide.png`}
            alt=""
            className="ms-message__npc"
            draggable={false}
          />
        </div>
        <div className="ms-banner">
          <img src={`${B}assets/ui/banner.png`} alt="" className="ms-banner__frame" draggable={false} />
          <span className="ms-banner__txt">✦ Codex Immortalis ✦</span>
        </div>
      </div>

      <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />
    </div>
  );
};

export default MainScreen;
