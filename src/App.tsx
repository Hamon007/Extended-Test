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
import { getInitialScreenStack, type Screen } from './navigation';
import './App.css';

// ── Screen-Typen ──────────────────────────────────────────────

// Screens without bottom nav
const NO_NAV_SCREENS: Screen[] = ['title'];

// ── App ───────────────────────────────────────────────────────

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
    void AuthService.init();

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
    }
  };

  const handleMenuNav = (target: string) => {
    if (target === 'cardCollection') goTo('cardCollection');
    if (target === 'deck') goTo('deck');
    if (target === 'fusion') goTo('fusion');
    if (target === 'training') goTo('training');
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
      </div>

      {/* ── Globale Bottom-Navigation ── */}
      {showNav && (
        <nav className="app-nav">
          <button className={`app-nav__btn${screen === 'guild' ? ' app-nav__btn--active' : ''}`}
            onClick={() => navTo('guild')}>
            <span className="app-nav__icon">🏰</span>
            <span className="app-nav__label">Gilde</span>
          </button>
          <button className={`app-nav__btn${screen === 'gacha' ? ' app-nav__btn--active' : ''}`}
            onClick={() => navTo('gacha')}>
            <span className="app-nav__icon">🔮</span>
            <span className="app-nav__label">Beschwören</span>
          </button>
          <button className={`app-nav__btn${screen === 'main' ? ' app-nav__btn--active' : ''}`}
            onClick={() => { setStack(['title', 'main']); }}>
            <span className="app-nav__icon">🏠</span>
            <span className="app-nav__label">Heim</span>
          </button>
          <button className={`app-nav__btn${screen === 'battle' ? ' app-nav__btn--active' : ''}`}
            onClick={() => navTo('battle')}>
            <span className="app-nav__icon">⚔️</span>
            <span className="app-nav__label">Kampf</span>
          </button>
          <button className={`app-nav__btn${screen === 'menu' || screen === 'cardCollection' ? ' app-nav__btn--active' : ''}`}
            onClick={() => navTo('menu')}>
            <span className="app-nav__icon">☰</span>
            <span className="app-nav__label">Menü</span>
          </button>
        </nav>
      )}
    </div>
  );
};

export default App;
