import React, { useState, useEffect, useCallback } from 'react';
import { SaveService } from '../services/SaveService';
import { EnergyService } from '../services/EnergyService';
import { AccountProgressionService } from '../services/AccountProgressionService';
import { ActivityFeedService, type FeedEvent } from '../services/ActivityFeedService';
import { AuthService } from '../services/AuthService';
import type { AccountState } from '../types/AccountTypes';
import { CardDatabase } from '../services/CardDatabase';
import { TowerService } from '../services/TowerService';
import { QuestService } from '../services/QuestService';
import { AchievementService } from '../services/AchievementService';
import { ExpeditionService } from '../services/ExpeditionService';
import { SeasonService } from '../services/SeasonService';
import { DailyLoginService, type DayReward } from '../services/DailyLoginService';
import { OfflineIncomeService, type OfflineResult } from '../services/OfflineIncomeService';
import { LuckySpinService } from '../services/LuckySpinService';
import { FirstWinService } from '../services/FirstWinService';
import { CardMasteryService } from '../services/CardMasteryService';
import { CardBondService } from '../services/CardBondService';
import { FusionSystem } from '../services/FusionSystem';
import type { Card } from '../types/Card';
import CardDetailModal from '../components/CardDetailModal';
import './MainScreen.css';

// ── Typen ─────────────────────────────────────────────────────

interface MainScreenProps {
  onBack: () => void;
  onNavigate?: (target: string) => void;
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
  `${B}assets/cards/azazel.webp`,
  `${B}assets/cards/azgaroth.webp`,
  `${B}assets/cards/satan.webp`,
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

const MainScreen: React.FC<MainScreenProps> = ({ onBack, onNavigate }) => {
  const [detailCard,    setDetailCard]    = useState<Card | null>(null);
  const [countdown,     setCountdown]     = useState(() => nextBattleMs());
  const [tipIndex,      setTipIndex]      = useState(0);
  const [npcIndex,      setNpcIndex]      = useState(0);
  const [deckStats,     setDeckStats]     = useState<{ atk: number; def: number; power: number } | null>(null);
  const [account,       setAccount]       = useState<AccountState>(() => SaveService.loadAccountState());
  const [energy,        setEnergy]        = useState(() => EnergyService.load());
  const [energyMax,     setEnergyMax]     = useState(() => EnergyService.getMax());
  const [feedEvents,    setFeedEvents]    = useState<FeedEvent[]>([]);
  const [feedIndex,     setFeedIndex]     = useState(0);
  const [profileCardId, setProfileCardId] = useState(() => localStorage.getItem('ci_profile_card_id') ?? 'azazel');
  const [towerFloor,    setTowerFloor]    = useState(() => TowerService.getFloor());
  const [questBadge,    setQuestBadge]    = useState(0);
  const [achBadge,      setAchBadge]      = useState(0);
  const [expBadge,      setExpBadge]      = useState(0);
  const [spinBadge,     setSpinBadge]     = useState(() => LuckySpinService.canSpin());
  const [dailyChecks,   setDailyChecks]   = useState(() => ({
    spin:        LuckySpinService.canSpin() ? false : true,
    login:       !DailyLoginService.canClaim(),
    firstWin:    !FirstWinService.isAvailable(),
    dailyQuests: QuestService.getDailyQuests().filter(q => q.progress.completed && q.progress.claimed).length,
    totalQuests: QuestService.getDailyQuests().length,
  }));
  const [regenMs,       setRegenMs]       = useState(() => EnergyService.msUntilNextRegen());
  const [loginReward,   setLoginReward]   = useState<DayReward | null>(null);
  const [activeExps,    setActiveExps]    = useState(() => ExpeditionService.getActive());
  const nearestAch = AchievementService.getNearestIncomplete();
  const [streakDay]  = useState(() => DailyLoginService.getStreakDay());
  const [offlineResult, setOfflineResult] = useState<OfflineResult | null>(null);
  const [crystals,      setCrystals]      = useState(() => SaveService.loadGachaState().crystals);
  const [displayCrystals, setDisplayCrystals] = useState(0);
  const [collectionStats] = useState(() => {
    const inv = SaveService.loadGachaState().inventory;
    const uniqueOwned = new Set(inv.map(i => i.cardId)).size;
    const total = CardDatabase.count();
    return { owned: uniqueOwned, total };
  });
  const [fusionReady] = useState(() => {
    const inv = SaveService.loadGachaState().inventory;
    const groups = FusionSystem.buildGroups(inv);
    return groups.filter(g => g.canFuse).slice(0, 3).map(g => g.card.name);
  });
  const seasonState = SeasonService.load();
  const seasonRank  = SeasonService.getRankForSp(seasonState.sp);
  // Track auth state reactively so feed loads after async AuthService.init()
  const [loggedIn,      setLoggedIn]      = useState(AuthService.isLoggedIn);

  // Countdown-Tick + Energy-Regen-Ticker
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(nextBattleMs());
      setRegenMs(EnergyService.msUntilNextRegen());
      // Wenn Energie regeneriert wurde, State aktualisieren
      const freshEnergy = EnergyService.load();
      setEnergy(prev => prev.energy !== freshEnergy.energy ? freshEnergy : prev);
      setActiveExps(ExpeditionService.getActive());
    }, 1000);
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

  // Track auth state reactively
  useEffect(() => {
    setLoggedIn(AuthService.isLoggedIn);
    return AuthService.subscribe(user => setLoggedIn(user !== null));
  }, []);

  // Live feed: load + Realtime subscription for instant updates + 60s polling backup
  useEffect(() => {
    if (!loggedIn) return;
    const load = () => ActivityFeedService.getRecent(15).then(setFeedEvents);
    load();
    const unsubRealtime = ActivityFeedService.subscribeToNew(load);
    const pollId = setInterval(load, 60_000);
    return () => { unsubRealtime(); clearInterval(pollId); };
  }, [loggedIn]);

  // Cycle through feed events every 5s
  useEffect(() => {
    if (feedEvents.length < 2) return;
    const id = setInterval(() => setFeedIndex(i => (i + 1) % feedEvents.length), 5000);
    return () => clearInterval(id);
  }, [feedEvents.length]);

  // Account + Energy beim Erscheinen und bei Fokus-Rückkehr aktualisieren
  useEffect(() => {
    const refresh = () => {
      setAccount(SaveService.loadAccountState());
      setEnergy(EnergyService.load());
      setEnergyMax(EnergyService.getMax());
      const freshCrystals = SaveService.loadGachaState().crystals;
      setCrystals(freshCrystals);
      setDisplayCrystals(freshCrystals);
      setProfileCardId(localStorage.getItem('ci_profile_card_id') ?? 'azazel');
      setTowerFloor(TowerService.getFloor());
      const claimable = [...QuestService.getDailyQuests(), ...QuestService.getWeeklyQuests()]
        .filter(q => q.progress.completed && !q.progress.claimed).length;
      setQuestBadge(claimable);
      setAchBadge(AchievementService.getUnclaimedCount());
      setExpBadge(ExpeditionService.getCompleted().length);
      const canSpin = LuckySpinService.canSpin();
      setSpinBadge(canSpin);
      setDailyChecks({
        spin:        !canSpin,
        login:       !DailyLoginService.canClaim(),
        firstWin:    !FirstWinService.isAvailable(),
        dailyQuests: QuestService.getDailyQuests().filter(q => q.progress.completed && q.progress.claimed).length,
        totalQuests: QuestService.getDailyQuests().length,
      });
      setRegenMs(EnergyService.msUntilNextRegen());
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  // Offline Income — claim crystals earned while away
  useEffect(() => {
    const result = OfflineIncomeService.claim();
    if (result) {
      setOfflineResult(result);
      setAccount(SaveService.loadAccountState());
    }
  }, []);

  // Daily Login Bonus — auto-claim on mount and show modal
  useEffect(() => {
    const reward = DailyLoginService.claim();
    if (reward) {
      setLoginReward(reward);
      // Refresh crystals/energy display after claim
      setAccount(SaveService.loadAccountState());
      setEnergy(EnergyService.load());
    }
  }, []);

  // Crystal count-up animation on mount
  useEffect(() => {
    if (crystals === 0) { setDisplayCrystals(0); return; }
    const duration = Math.min(1200, 400 + crystals / 50);
    const steps = 40;
    const stepMs = duration / steps;
    let step = 0;
    const id = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayCrystals(Math.round(crystals * eased));
      if (step >= steps) { clearInterval(id); setDisplayCrystals(crystals); }
    }, stepMs);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    let masteryAtk = 0;
    let bondMult = 0;

    for (const uuid of deck.uuids) {
      const inst = inventory.find(ci => ci.uuid === uuid);
      if (!inst) continue;
      const card = CardDatabase.getById(inst.cardId);
      if (!card) continue;
      totalAtk += card.stats.atk;
      totalDef += card.stats.def;
      masteryAtk += CardMasteryService.getAtkBonus(inst.cardId);
      bondMult += (CardBondService.getAtkMultiplier(inst.cardId) - 1);
      found++;
    }

    // Power score: ATK + half DEF + mastery flat + bond %-based bonus
    const power = found > 0
      ? Math.round((totalAtk + masteryAtk) * (1 + bondMult / Math.max(1, found)) + totalDef * 0.5)
      : 0;

    setDeckStats(found > 0 ? { atk: totalAtk + masteryAtk, def: totalDef, power } : null);
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

      {/* ── Kristall-Leiste ── */}
      <div className="main-crystal-bar">
        <span className="main-crystal-bar__icon">💎</span>
        <span className="main-crystal-bar__val" aria-live="polite">{displayCrystals.toLocaleString('de-DE')}</span>
        <span className="main-crystal-bar__label">Kristalle</span>
        <button
          className="main-crystal-bar__shop-btn"
          onClick={() => onNavigate?.('shop')}
        >
          🛒 Laden
        </button>
        <button
          className="main-crystal-bar__gacha-btn"
          onClick={() => onNavigate?.('gacha')}
        >
          ✨ Beschwören
        </button>
      </div>

      {/* ── Ressourcen-Balken ── */}
      <div className="main-resources">
        <div className="main-res-row">
          {/* Ausdauer — aus EnergyService (dynamisches Max aus Account-Level) */}
          <div className="main-res-item">
            <span className="main-res-label">
              Ausdauer
              {energy.energy < energyMax && regenMs > 0 && (
                <span className="main-res-regen"> +1 in {formatCountdown(regenMs)}</span>
              )}
            </span>
            <div className="main-res-bar">
              <div
                className="main-res-bar__fill"
                style={{ width: `${energyMax > 0 ? (energy.energy / energyMax) * 100 : 0}%` }}
              />
            </div>
            <span className="main-res-value">{energy.energy}/{energyMax}</span>
          </div>
          {/* EXP — Account-XP-Fortschritt */}
          <div className="main-res-item">
            <span className="main-res-label">
              Lv.{account.level} · EXP
            </span>
            <div className="main-res-bar main-res-bar--exp">
              <div
                className="main-res-bar__fill main-res-bar__fill--exp"
                style={{
                  width: `${AccountProgressionService.xpToNextLevel(account.level) > 0
                    ? (account.xp / AccountProgressionService.xpToNextLevel(account.level)) * 100
                    : 0}%`,
                }}
              />
            </div>
            <span className="main-res-value">
              {account.xp.toLocaleString('de-DE')} / {AccountProgressionService.xpToNextLevel(account.level).toLocaleString('de-DE')}
            </span>
          </div>
        </div>
        <div className="main-res-row">
          {/* Mana — Account-Mana */}
          <div className="main-res-item">
            <span className="main-res-label">Mana</span>
            <div className="main-res-bar main-res-bar--mana">
              <div
                className="main-res-bar__fill main-res-bar__fill--mp"
                style={{ width: `${account.maxMana > 0 ? (account.mana / account.maxMana) * 100 : 0}%` }}
              />
            </div>
            <span className="main-res-value">{account.mana.toLocaleString('de-DE')}/{account.maxMana.toLocaleString('de-DE')}</span>
          </div>
          {/* Tränke */}
          <div className="main-res-item">
            <span className="main-res-label">Tränke</span>
            <div className="main-res-bar" style={{ background: 'none' }}>
              <span style={{ fontSize: 18, letterSpacing: 4 }}>
                {Array.from({ length: energy.potions }).map((_, i) => <span key={i}>🧪</span>)}
                {energy.potions === 0 && <span style={{ fontSize: 11, color: '#666' }}>—</span>}
              </span>
            </div>
            <span className="main-res-value">{energy.potions}×</span>
          </div>
        </div>
      </div>

      {/* ── Team-Kampfkraft ── */}
      {deckStats && deckStats.power > 0 && (
        <div className="main-power">
          <span className="main-power__label">⚔ KAMPFKRAFT</span>
          <span className="main-power__value">{deckStats.power.toLocaleString('de-DE')}</span>
        </div>
      )}

      {/* ── Primärer Call-to-Action ── */}
      {onNavigate && (
        <button
          className={`main-cta ${energy.energy < 1 ? 'main-cta--empty' : ''}`}
          onClick={() => onNavigate('battle')}
        >
          <span className="main-cta__icon">🗼</span>
          <span className="main-cta__text">
            <span className="main-cta__title">{energy.energy < 1 ? 'TURM DER PRÜFUNG' : 'IN DEN TURM'}</span>
            <span className="main-cta__sub">
              Etage {towerFloor} · {energy.energy < 1 ? 'Keine Energie' : `${energy.energy}/${energyMax} ⚡`}
            </span>
          </span>
          <span className="main-cta__arrow">▶</span>
        </button>
      )}

      {/* ── Live-Ereignisse Banner ── */}
      <div className={`main-infobanner${feedEvents.length > 0 ? ' main-infobanner--live' : ''}`}>
        {feedEvents.length > 0 ? (
          <>
            <span className="main-infobanner__live-dot" />
            <span className="main-infobanner__text" key={feedIndex}>
              {ActivityFeedService.formatEvent(feedEvents[feedIndex % feedEvents.length])}
            </span>
          </>
        ) : !loggedIn ? (
          <>
            <span className="main-infobanner__icon">🔒</span>
            <span className="main-infobanner__text">Anmelden für Live-Ereignisse</span>
          </>
        ) : (
          <>
            <span className="main-infobanner__icon">📡</span>
            <span className="main-infobanner__text">Keine Ereignisse — ziehe SSR/MR oder fusioniere zu LR!</span>
          </>
        )}
      </div>

      {/* ── Scrollbarer Inhaltsbereich ── */}
      <div className="main-body">

      {/* ── Hauptkarte ── */}
      <div className="main-card">
        {/* Profil-Seite */}
        <div className="main-card__profile">
          <div className="main-profile-frame">
            {(() => {
              const profileCard = CardDatabase.getById(profileCardId);
              return (
                <div
                  className="main-profile-frame__card"
                  onClick={() => setDetailCard(profileCard ?? CardDatabase.getById('azazel') ?? null)}
                  style={{ cursor: 'pointer' }}
                >
                  <img
                    className="main-profile-frame__img"
                    src={profileCard?.image ?? `${B}assets/cards/azazel.webp`}
                    alt={profileCard?.name ?? 'Azazel'}
                  />
                  <div className="main-profile-frame__num">006.</div>
                  <div className="main-profile-frame__compass">✦</div>
                  <div className="main-profile-frame__overlay">
                    <div className="main-profile-frame__card-name">{profileCard?.name ?? 'Azazel'},</div>
                    <div className="main-profile-frame__card-title">{profileCard?.title ?? 'Richter der sterbenden Sonne'}</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Rechte Seite */}
        <div className="main-card__right">
          <button
            className="main-card__action-btn"
            onClick={() => onNavigate?.('deck')}
          >
            📋 Deck bauen
          </button>
          <button
            className="main-card__action-btn"
            onClick={() => onNavigate?.('quests')}
          >
            📜 Quests {questBadge > 0 && <span className="main-card__badge">{questBadge}</span>}
          </button>
          <button
            className="main-card__action-btn"
            onClick={() => onNavigate?.('achievements')}
          >
            🏆 Erfolge {achBadge > 0 && <span className="main-card__badge main-card__badge--gold">{achBadge}</span>}
          </button>
          <button
            className="main-card__action-btn"
            onClick={() => onNavigate?.('expedition')}
          >
            ⚔ Expeditionen {expBadge > 0 && <span className="main-card__badge main-card__badge--purple">{expBadge}</span>}
          </button>
          <button
            className="main-card__action-btn"
            onClick={() => onNavigate?.('season')}
            style={{ color: SeasonService.RANK_COLORS[seasonRank] }}
          >
            {SeasonService.RANK_ICONS[seasonRank]} Saison-Rang
          </button>
          <button
            className="main-card__action-btn main-card__action-btn--shop"
            onClick={() => onNavigate?.('shop')}
          >
            🛒 Laden
          </button>
          <button
            className={`main-card__action-btn ${spinBadge ? 'main-card__action-btn--spin' : ''}`}
            onClick={() => onNavigate?.('lucky_spin')}
          >
            🎰 Glücksrad {spinBadge && <span className="main-card__badge main-card__badge--gold">!</span>}
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
            <div className="main-card__divider" style={{ margin: '4px 0' }} />
            <div className="main-card__season-rank" style={{ color: SeasonService.RANK_COLORS[seasonRank] }}>
              <span className="main-card__season-icon">{SeasonService.RANK_ICONS[seasonRank]}</span>
              <span className="main-card__season-name">{seasonRank}</span>
              <span className="main-card__season-sp">{seasonState.sp} SP</span>
            </div>
            <div className="main-card__season-bar">
              {(() => {
                const { progress, nextRank } = SeasonService.progressToNext(seasonState.sp);
                return (
                  <>
                    <div className="main-card__season-bar-fill" style={{ width: `${progress * 100}%`, background: SeasonService.RANK_COLORS[seasonRank] }} />
                    {nextRank && <span className="main-card__season-next">{SeasonService.RANK_ICONS[nextRank]}</span>}
                  </>
                );
              })()}
            </div>
            <div className="main-card__season-days">Saison endet in {SeasonService.getDaysLeft()} Tagen</div>
          </div>
        </div>
      </div>

      {/* ── Tagesaufgaben-Widget ── */}
      <div className="main-daily-widget">
        <div className="main-daily-widget__title">⚡ Heute erledigen</div>
        <div className="main-daily-widget__items">
          <div className={`main-daily-item ${dailyChecks.login ? 'main-daily-item--done' : ''}`}>
            <span className="main-daily-item__check">{dailyChecks.login ? '✓' : '○'}</span>
            <span className="main-daily-item__label">Täglicher Login</span>
          </div>
          <div className={`main-daily-item ${dailyChecks.spin ? 'main-daily-item--done' : ''}`}
            onClick={() => onNavigate?.('lucky_spin')} style={{ cursor: 'pointer' }}>
            <span className="main-daily-item__check">{dailyChecks.spin ? '✓' : '○'}</span>
            <span className="main-daily-item__label">Glücksrad drehen</span>
          </div>
          <div className={`main-daily-item ${dailyChecks.firstWin ? 'main-daily-item--done' : ''}`}
            onClick={() => onNavigate?.('battle')} style={{ cursor: 'pointer' }}>
            <span className="main-daily-item__check">{dailyChecks.firstWin ? '✓' : '○'}</span>
            <span className="main-daily-item__label">Erster Sieg (+500 💎)</span>
          </div>
          <div className={`main-daily-item ${dailyChecks.dailyQuests >= dailyChecks.totalQuests ? 'main-daily-item--done' : ''}`}
            onClick={() => onNavigate?.('quests')} style={{ cursor: 'pointer' }}>
            <span className="main-daily-item__check">
              {dailyChecks.dailyQuests >= dailyChecks.totalQuests ? '✓' : `${dailyChecks.dailyQuests}/${dailyChecks.totalQuests}`}
            </span>
            <span className="main-daily-item__label">Tagesquests abgeschlossen</span>
          </div>
        </div>
      </div>

      {/* ── Nächster Erfolg-Prompt ── */}
      {nearestAch && nearestAch.pct > 0 && (
        <div
          className="main-next-ach"
          onClick={() => onNavigate?.('achievements')}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onNavigate?.('achievements')}
        >
          <div className="main-next-ach__header">
            <span className="main-next-ach__icon">🏆</span>
            <span className="main-next-ach__title">{nearestAch.def.title}</span>
            <span className="main-next-ach__reward">💎+{nearestAch.def.crystals}</span>
          </div>
          <div className="main-next-ach__bar">
            <div
              className="main-next-ach__fill"
              style={{ width: `${Math.round(nearestAch.pct * 100)}%` }}
            />
          </div>
          <div className="main-next-ach__progress">
            {nearestAch.current} / {nearestAch.target}
            {nearestAch.pct >= 0.8 && <span className="main-next-ach__almost"> · Fast geschafft!</span>}
          </div>
        </div>
      )}

      {/* ── Expeditions-Statusleiste ── */}
      {activeExps.length > 0 && (
        <div
          className="main-expeditions"
          onClick={() => onNavigate?.('expedition')}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onNavigate?.('expedition')}
        >
          <div className="main-expeditions__title">⚔ Expeditionen</div>
          <div className="main-expeditions__list">
            {activeExps.map(exp => {
              const done = Date.now() >= exp.endsAt;
              return (
                <div key={exp.cardUuid} className={`main-exp-item ${done ? 'main-exp-item--done' : ''}`}>
                  <span className="main-exp-item__card">{exp.cardName.split(' ')[0]}</span>
                  <span className="main-exp-item__timer">
                    {done ? '✓ Bereit!' : ExpeditionService.formatTimeLeft(exp.endsAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Fusionsbereit-Banner ── */}
      {fusionReady.length > 0 && (
        <div
          className="main-fusion-banner"
          onClick={() => onNavigate?.('deck')}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onNavigate?.('deck')}
        >
          <span className="main-fusion-banner__icon">⚗️</span>
          <div className="main-fusion-banner__text">
            <span className="main-fusion-banner__label">Fusion möglich!</span>
            <span className="main-fusion-banner__names">
              {fusionReady.join(', ')}{fusionReady.length === 3 ? ' …' : ''}
            </span>
          </div>
          <span className="main-fusion-banner__arrow">›</span>
        </div>
      )}

      {/* ── Sammlungsfortschritt ── */}
      <div className="main-collection" onClick={() => onNavigate?.('deck')}>
        <div className="main-collection__header">
          <span className="main-collection__title">📚 Sammlung</span>
          <span className="main-collection__fraction">
            {collectionStats.owned} / {collectionStats.total}
          </span>
        </div>
        <div className="main-collection__bar">
          <div
            className="main-collection__fill"
            style={{ width: `${collectionStats.total > 0 ? (collectionStats.owned / collectionStats.total) * 100 : 0}%` }}
          />
        </div>
        <div className="main-collection__sub">
          {collectionStats.owned === collectionStats.total
            ? '🌟 Vollständige Sammlung!'
            : `Noch ${collectionStats.total - collectionStats.owned} Karten zum Vervollständigen`}
        </div>
      </div>

      {/* ── 7-Tage Login-Streak-Kalender ── */}
      <div className="main-streak-calendar">
        <div className="main-streak-calendar__header">
          <span className="main-streak-calendar__title">🔥 Login-Streak</span>
          <span className="main-streak-calendar__day">Tag {streakDay}/7</span>
        </div>
        <div className="main-streak-calendar__days">
          {DailyLoginService.DAY_REWARDS.map(r => {
            const isPast    = r.day < streakDay;
            const isCurrent = r.day === streakDay;
            const isClaimed = isPast || (isCurrent && !dailyChecks.login);
            return (
              <div
                key={r.day}
                className={[
                  'main-streak-day',
                  isClaimed          ? 'main-streak-day--claimed'  : '',
                  isCurrent && dailyChecks.login === false
                                     ? 'main-streak-day--available' : '',
                  isCurrent && dailyChecks.login
                                     ? 'main-streak-day--today'   : '',
                  !isCurrent && !isClaimed ? 'main-streak-day--future' : '',
                ].join(' ')}
              >
                <div className="main-streak-day__num">
                  {isClaimed ? '✓' : `${r.day}`}
                </div>
                <div className="main-streak-day__icon">
                  {r.day === 7 ? '🎉' : r.crystals >= 500 ? '💎' : r.potions > 0 ? '🧪' : '💎'}
                </div>
                <div className="main-streak-day__val">
                  {r.day === 7 ? '1K' : r.crystals >= 1000 ? `${(r.crystals/1000).toFixed(1)}K` : `${r.crystals}`}
                </div>
              </div>
            );
          })}
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

      {/* ── Kartendetail-Modal ── */}
      <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />

      {/* ── Offline Einkommens-Toast ── */}
      {offlineResult && !loginReward && (
        <div className="offline-toast" onClick={() => setOfflineResult(null)}>
          <span className="offline-toast__icon">🌙</span>
          <div className="offline-toast__text">
            <span className="offline-toast__title">Willkommen zurück!</span>
            <span className="offline-toast__sub">
              +{offlineResult.crystals} 💎 in {offlineResult.hours}h verdient
            </span>
          </div>
          <span className="offline-toast__close">✕</span>
        </div>
      )}

      {/* ── Täglicher Login-Bonus Modal ── */}
      {loginReward && (
        <div className="login-bonus-overlay" onClick={() => setLoginReward(null)}>
          <div className="login-bonus-modal" onClick={e => e.stopPropagation()}>
            <div className="login-bonus-header">
              <div className="login-bonus-star">✦</div>
              <div className="login-bonus-title">Tägliche Belohnung</div>
              <div className="login-bonus-subtitle">Tag {loginReward.day} von 7</div>
            </div>
            <div className="login-bonus-dots">
              {DailyLoginService.DAY_REWARDS.map(r => (
                <div
                  key={r.day}
                  className={`login-bonus-dot ${r.day < loginReward.day ? 'login-bonus-dot--done' : r.day === loginReward.day ? 'login-bonus-dot--today' : ''}`}
                >
                  {r.day < loginReward.day ? '✓' : r.day === loginReward.day ? loginReward.day : r.day}
                </div>
              ))}
            </div>
            <div className="login-bonus-reward">
              {loginReward.crystals > 0 && (
                <div className="login-bonus-item">
                  <span className="login-bonus-item__icon">💎</span>
                  <span className="login-bonus-item__val">+{loginReward.crystals}</span>
                </div>
              )}
              {loginReward.potions > 0 && (
                <div className="login-bonus-item">
                  <span className="login-bonus-item__icon">🧪</span>
                  <span className="login-bonus-item__val">+{loginReward.potions}</span>
                </div>
              )}
            </div>
            <button className="login-bonus-close" onClick={() => setLoginReward(null)}>
              Einsammeln ✦
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default MainScreen;
