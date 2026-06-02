import React, { useEffect, useState } from 'react';
import { CardDatabase }           from './services/CardDatabase';
import { EnemyDatabase }          from './services/EnemyDatabase';
import { SaveService }            from './services/SaveService';
import { AuthService }            from './services/AuthService';
import { ProgressionService }     from './services/ProgressionService';
import AuthModal                  from './components/AuthModal';
import TitleScreen                from './screens/TitleScreen';
import MainScreen                 from './screens/MainScreen';
import GachaScreen                from './screens/GachaScreen';
import DeckBuilderScreen          from './screens/DeckBuilderScreen';
import FusionScreen               from './screens/FusionScreen';
import BattleScreen               from './screens/BattleScreen';
import CollectionScreen           from './screens/CollectionScreen';
import MenuScreen                 from './screens/MenuScreen';
import CardCollectionScreen       from './screens/CardCollectionScreen';
import GuildScreen                from './screens/GuildScreen';
import CardTrainingScreen         from './screens/CardTrainingScreen';
import ProfileScreen              from './screens/ProfileScreen';
import TradeScreen               from './screens/TradeScreen';
import FriendsScreen             from './screens/FriendsScreen';
import InventoryScreen           from './screens/InventoryScreen';
import QuestScreen               from './screens/QuestScreen';
import SettingsScreen            from './screens/SettingsScreen';
import PvpScreen                 from './screens/PvpScreen';
import AchievementScreen         from './screens/AchievementScreen';
import ExpeditionScreen          from './screens/ExpeditionScreen';
import SeasonScreen              from './screens/SeasonScreen';
import ShopScreen               from './screens/ShopScreen';
import LuckySpinScreen          from './screens/LuckySpinScreen';
import LoginStreakPopup           from './components/LoginStreakPopup';
import AchievementToast, { showAchievementToast } from './components/AchievementToast';
import { DevModeService }        from './services/DevModeService';
import { TradeService }          from './services/TradeService';
import { AudioService }          from './services/AudioService';
import { LoginStreakService, type StreakCheckResult } from './services/LoginStreakService';
import type { StreakState }      from './services/LoginStreakService';
import { AchievementService, registerToastFn } from './services/AchievementService';
import { getInitialScreenStack, type Screen } from './navigation';
import './App.css';

// ── Screen-Typen ──────────────────────────────────────────────

// Screens without bottom nav
const NO_NAV_SCREENS: Screen[] = ['title'];

// ── App ───────────────────────────────────────────────────────

const B = import.meta.env.BASE_URL;

const NAV_ITEMS = [
  { key: 'guild',  img: `${B}assets/nav/nav-1-stronghold.png`, label: 'Festung',    action: 'guild'  },
  { key: 'gacha',  img: `${B}assets/nav/nav-2-conjure.png`,    label: 'Beschwören', action: 'gacha'  },
  { key: 'battle', img: `${B}assets/nav/nav-3-quest.png`,      label: 'Turm',       action: 'battle' },
  { key: 'fusion', img: `${B}assets/nav/nav-4-sacrifice.png`,  label: 'Fusion',     action: 'fusion' },
  { key: 'menu',   img: `${B}assets/nav/nav-5-menu.png`,       label: 'Menü',       action: 'menu'   },
] as const;

const App: React.FC = () => {
  const [ready,            setReady]            = useState(false);
  const [stack,            setStack]            = useState<Screen[]>(
    () => getInitialScreenStack(window.location.search),
  );
  const [dailyToast,       setDailyToast]       = useState<number | null>(null);
  const [authOpen,         setAuthOpen]         = useState(false);
  const [streakResult,     setStreakResult]      = useState<StreakCheckResult | null>(null);
  const [streakState,      setStreakState]       = useState<StreakState>(() => LoginStreakService.getState());

  const screen = stack[stack.length - 1];
  const showNav = !NO_NAV_SCREENS.includes(screen);

  useEffect(() => {
    CardDatabase.init();
    EnemyDatabase.init();
    SaveService.updateLastLogin();
    registerToastFn(showAchievementToast);

    let syncDone = false;

    const runSync = async () => {
      if (syncDone) return;
      syncDone = true;
      const wasNewer = await SaveService.downloadSave();
      if (wasNewer) { window.location.reload(); return; }
      const gs = SaveService.loadGachaState();
      const { state, processed } = await TradeService.processCompletedListings(gs);
      if (processed > 0) SaveService.saveGachaState(state);
    };

    // Sync on startup if already logged in
    AuthService.init().then(() => {
      if (AuthService.isLoggedIn) void runSync();
    });

    // Sync when user logs in mid-session via AuthModal (only fires for new logins)
    let prevLoggedIn = AuthService.isLoggedIn;
    const unsub = AuthService.subscribe(user => {
      const nowLoggedIn = user !== null;
      if (!prevLoggedIn && nowLoggedIn) void runSync();
      prevLoggedIn = nowLoggedIn;
    });

    const bonus = ProgressionService.checkAndApplyDailyBonus();
    if (bonus.granted) {
      setDailyToast(bonus.crystals);
      setTimeout(() => setDailyToast(null), 3500);
    }

    // Login-Streak prüfen (gibt Belohnung + zeigt Popup)
    const streak = LoginStreakService.checkAndClaim();
    if (streak) {
      setStreakState(LoginStreakService.getState());
      // Streak achievements
      if (streak.newStreak >= 7)  AchievementService.recordProgress('streak_7');
      if (streak.newStreak >= 30) AchievementService.recordProgress('streak_30');
      // Kurze Verzögerung, damit die App erst lädt
      setTimeout(() => {
        setStreakResult(streak);
        AudioService.synergy();
        AudioService.vibrate([10, 20, 40, 20]);
      }, 800);
    }

    // Audio beim ersten User-Tap freischalten (Browser-Vorgabe)
    const unlockAudio = () => AudioService.unlock();
    window.addEventListener('pointerdown', unlockAudio, { once: true });

    setReady(true);
    return () => {
      unsub();
      window.removeEventListener('pointerdown', unlockAudio);
    };
  }, []);

  if (!ready) {
    return (
      <div className="app-loading">
        <span className="app-loading__icon">⚔️</span>
        <p className="app-loading__text">Lade Kartendaten …</p>
      </div>
    );
  }

  // ── Navigation ────────────────────────────────────────────────

  const goTo = (next: Screen) => {
    setStack(prev => [...prev, next]);
  };

  const goBack = () => {
    setStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
  };

  // Universelles Tap-Feedback: jeder Button im React-Baum (inkl. Portale)
  const handleRootTap = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest('button, [role="button"]');
    if (el && !(el as HTMLButtonElement).disabled) AudioService.tap();
  };

  const navTo = (target: string) => {
    switch (target) {
      case 'gacha':    goTo('gacha'); break;
      case 'menu':     goTo('menu'); break;
      case 'battle':   goTo('battle'); break;
      case 'guild':    goTo('guild'); break;
      case 'quests':   goTo('quests'); break;
      case 'fusion':   goTo('fusion'); break;
      case 'deck':     goTo('deck'); break;
      case 'pvp':           goTo('pvp'); break;
      case 'achievements':  goTo('achievements'); break;
      case 'expedition':    goTo('expedition'); break;
      case 'season':        goTo('season'); break;
      case 'shop':          goTo('shop'); break;
      case 'lucky_spin':    goTo('lucky_spin'); break;
    }
  };

  const handleMenuNav = (target: string) => {
    if (target === 'main')        { setStack(['title', 'main']); return; }
    if (target === 'cardCollection') goTo('cardCollection');
    if (target === 'deck') goTo('deck');
    if (target === 'fusion') goTo('fusion');
    if (target === 'training') goTo('training');
    if (target === 'profile') goTo('profile');
    if (target === 'trade')     goTo('trade');
    if (target === 'friends')   goTo('friends');
    if (target === 'inventory') goTo('inventory');
    if (target === 'quests')    goTo('quests');
    if (target === 'settings')  goTo('settings');
    if (target === 'pvp')          goTo('pvp');
    if (target === 'achievements') goTo('achievements');
    if (target === 'expedition')   goTo('expedition');
    if (target === 'season')       goTo('season');
    if (target === 'shop')         goTo('shop');
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="app" onClickCapture={handleRootTap}>
      <AchievementToast />
      {dailyToast !== null && screen === 'main' && (
        <div className="daily-toast" role="status">
          ☀️ Tages-Bonus! <strong>+{dailyToast} 💎</strong>
        </div>
      )}

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      {streakResult && (
        <LoginStreakPopup
          result={streakResult}
          streakState={streakState}
          onClose={() => setStreakResult(null)}
        />
      )}

      <div className="app-content">
       <div className="app-screen-fade" key={screen}>
        {screen === 'title' && (
          <TitleScreen onEnter={() => goTo('main')} onAccountPress={() => setAuthOpen(true)} />
        )}
        {screen === 'main' && (
          <MainScreen onBack={goBack} onNavigate={navTo} />
        )}
        {screen === 'gacha' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <GachaScreen />
          </div>
        )}
        {screen === 'deck' && (
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, width: '100%', height: '100%' }}>
            <DeckBuilderScreen />
          </div>
        )}
        {screen === 'fusion' && (
          <FusionScreen onBack={goBack} />
        )}
        {screen === 'battle'     && <BattleScreen />}
        {screen === 'guild'      && <GuildScreen onBack={goBack} />}
        {screen === 'training'   && <CardTrainingScreen onBack={goBack} />}
        {screen === 'collection' && <CollectionScreen />}
        {screen === 'menu' && (
          <MenuScreen onNav={handleMenuNav} onBack={goBack} />
        )}
        {screen === 'cardCollection' && (
          <CardCollectionScreen onBack={goBack} />
        )}
        {screen === 'profile' && (
          <ProfileScreen onBack={goBack} />
        )}
        {screen === 'trade' && (
          <TradeScreen onBack={goBack} />
        )}
        {screen === 'friends' && (
          <FriendsScreen onBack={goBack} />
        )}
        {screen === 'inventory' && (
          <InventoryScreen onBack={goBack} />
        )}
        {screen === 'quests' && (
          <QuestScreen onBack={goBack} />
        )}
        {screen === 'settings' && (
          <SettingsScreen onBack={goBack} />
        )}
        {screen === 'pvp' && (
          <PvpScreen onBack={goBack} onStartBattle={() => goTo('battle')} />
        )}
        {screen === 'achievements' && (
          <AchievementScreen onBack={goBack} />
        )}
        {screen === 'expedition' && (
          <ExpeditionScreen onBack={goBack} />
        )}
        {screen === 'season' && (
          <SeasonScreen onBack={goBack} />
        )}
        {screen === 'shop' && (
          <ShopScreen onBack={goBack} />
        )}
        {screen === 'lucky_spin' && (
          <LuckySpinScreen onBack={goBack} />
        )}
       </div>
      </div>

      {/* ── Dev-Modus-Badge ── */}
      {DevModeService.isEnabled() && (
        <div className="app-dev-badge">DEV</div>
      )}

      {/* ── Globale Bottom-Navigation ── */}
      {showNav && (
        <nav className="app-nav">
          {NAV_ITEMS.map(item => {
            const isActive =
              item.key === 'menu'
                ? screen === 'menu' || screen === 'cardCollection'
                : screen === item.key;
            return (
              <button
                key={item.key}
                className={`app-nav__btn${isActive ? ' app-nav__btn--active' : ''}`}
                onClick={() => navTo(item.action)}
              >
                <img
                  src={item.img}
                  alt={item.label}
                  className="app-nav__img"
                  draggable={false}
                />
                <span className="app-nav__label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};

export default App;
