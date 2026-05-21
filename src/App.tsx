import React, { useEffect, useState } from 'react';
import { CardDatabase }           from './services/CardDatabase';
import { EnemyDatabase }          from './services/EnemyDatabase';
import { SaveService }            from './services/SaveService';
import { ProgressionService }     from './services/ProgressionService';
import TitleScreen                from './screens/TitleScreen';
import MainScreen                 from './screens/MainScreen';
import GachaScreen                from './screens/GachaScreen';
import DeckBuilderScreen          from './screens/DeckBuilderScreen';
import BattleScreen               from './screens/BattleScreen';
import CollectionScreen           from './screens/CollectionScreen';
import MenuScreen                 from './screens/MenuScreen';
import CardCollectionScreen       from './screens/CardCollectionScreen';
import './App.css';

// ── Screen-Typen ──────────────────────────────────────────────

type Screen =
  | 'title'
  | 'main'
  | 'gacha'
  | 'deck'
  | 'battle'
  | 'collection'
  | 'menu'
  | 'cardCollection'
  | 'placeholder';

// Screens without bottom nav
const NO_NAV_SCREENS: Screen[] = ['title'];

// ── Placeholder-Screen ────────────────────────────────────────

interface PlaceholderProps {
  label: string;
  onBack: () => void;
}

const PlaceholderScreen: React.FC<PlaceholderProps> = ({ label, onBack }) => (
  <div style={{
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-deep)', color: 'var(--text)',
    gap: '20px',
  }}>
    <p style={{ fontFamily: "'Cinzel', serif", fontSize: '1rem', color: 'var(--gold)' }}>
      {label}
    </p>
    <p style={{ fontFamily: "'EB Garamond', serif", fontSize: '0.85rem', opacity: 0.6 }}>
      Kommt bald!
    </p>
    <button
      onClick={onBack}
      style={{
        fontFamily: "'Cinzel', serif",
        fontSize: '0.7rem',
        letterSpacing: '0.1em',
        color: 'var(--gold)',
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: '2px',
        padding: '8px 20px',
        cursor: 'pointer',
      }}
    >
      ← Zurück
    </button>
  </div>
);

// ── App ───────────────────────────────────────────────────────

const App: React.FC = () => {
  const [ready,            setReady]            = useState(false);
  const [stack,            setStack]            = useState<Screen[]>(['title']);
  const [placeholderLabel, setPlaceholderLabel] = useState('');
  const [dailyToast,       setDailyToast]       = useState<number | null>(null);

  const screen = stack[stack.length - 1];
  const showNav = !NO_NAV_SCREENS.includes(screen);

  useEffect(() => {
    CardDatabase.init();
    EnemyDatabase.init();
    SaveService.updateLastLogin();

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
      case 'guild':    setPlaceholderLabel('🏰 Gilde'); goTo('placeholder'); break;
      case 'quest':    setPlaceholderLabel('🚩 Quest'); goTo('placeholder'); break;
      case 'sacrifice':setPlaceholderLabel('⚗️ Opfern'); goTo('placeholder'); break;
    }
  };

  const handleMenuNav = (target: string) => {
    if (target === 'cardCollection') goTo('cardCollection');
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="app">
      {dailyToast !== null && screen === 'main' && (
        <div className="daily-toast" role="status">
          ☀️ Tages-Bonus! <strong>+{dailyToast} 💎</strong>
        </div>
      )}

      <div className="app-content">
        {screen === 'title' && (
          <TitleScreen onEnter={() => goTo('main')} />
        )}
        {screen === 'main' && (
          <MainScreen onBack={goBack} />
        )}
        {screen === 'gacha' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <GachaScreen />
            </div>
          </div>
        )}
        {screen === 'deck' && (
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, width: '100%', height: '100%' }}>
            <DeckBuilderScreen />
          </div>
        )}
        {screen === 'battle'     && <BattleScreen />}
        {screen === 'collection' && <CollectionScreen />}
        {screen === 'menu' && (
          <MenuScreen onNav={handleMenuNav} onBack={goBack} />
        )}
        {screen === 'cardCollection' && (
          <CardCollectionScreen onBack={goBack} />
        )}
        {screen === 'placeholder' && (
          <PlaceholderScreen label={placeholderLabel} onBack={goBack} />
        )}
      </div>

      {/* ── Globale Bottom-Navigation ── */}
      {showNav && (
        <nav className="app-nav">
          <button className={`app-nav__btn${screen === 'placeholder' && placeholderLabel.includes('Gilde') ? ' app-nav__btn--active' : ''}`}
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
          <button className={`app-nav__btn${screen === 'placeholder' && placeholderLabel.includes('Quest') ? ' app-nav__btn--active' : ''}`}
            onClick={() => navTo('quest')}>
            <span className="app-nav__icon">🚩</span>
            <span className="app-nav__label">Quest</span>
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
