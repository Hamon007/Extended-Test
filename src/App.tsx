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
import { DevModeService }        from './services/DevModeService';
import { TradeService }          from './services/TradeService';
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

  const screen = stack[stack.length - 1];
  const showNav = !NO_NAV_SCREENS.includes(screen);

  useEffect(() => {
    CardDatabase.init();
    EnemyDatabase.init();
    SaveService.updateLastLogin();

    // Init auth, sync cloud save, then apply pending trade card swaps
    AuthService.init().then(async () => {
      if (AuthService.isLoggedIn) {
        const wasNewer = await SaveService.downloadSave();
        if (wasNewer) { window.location.reload(); return; }
        const gs = SaveService.loadGachaState();
        const { state, processed } = await TradeService.processCompletedListings(gs);
        if (processed > 0) SaveService.saveGachaState(state);
      }
    });

    const bonus = ProgressionService.checkAndApplyDailyBonus();
    if (bonus.granted) {
      setDailyToast(bonus.crystals);
      setTimeout(() => setDailyToast(null), 3500);
    }

    setReady(true);
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

  const navTo = (target: string) => {
    switch (target) {
      case 'gacha':    goTo('gacha'); break;
      case 'menu':     goTo('menu'); break;
      case 'battle':   goTo('battle'); break;
      case 'guild':    goTo('guild'); break;
      case 'quests':   goTo('quests'); break;
      case 'fusion':   goTo('fusion'); break;
    }
  };

  const handleMenuNav = (target: string) => {
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
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="app">
      {dailyToast !== null && screen === 'main' && (
        <div className="daily-toast" role="status">
          ☀️ Tages-Bonus! <strong>+{dailyToast} 💎</strong>
        </div>
      )}

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      <div className="app-content">
        {screen === 'title' && (
          <TitleScreen onEnter={() => goTo('main')} onAccountPress={() => setAuthOpen(true)} />
        )}
        {screen === 'main' && (
          <MainScreen onBack={goBack} />
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
