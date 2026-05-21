import React, { useEffect, useState } from 'react';
import { CardDatabase }       from './services/CardDatabase';
import { EnemyDatabase }      from './services/EnemyDatabase';
import { SaveService }        from './services/SaveService';
import { ProgressionService } from './services/ProgressionService';
import CollectionScreen       from './screens/CollectionScreen';
import GachaScreen            from './screens/GachaScreen';
import DeckBuilderScreen      from './screens/DeckBuilderScreen';
import BattleScreen           from './screens/BattleScreen';
import './App.css';

type Tab = 'gacha' | 'deck' | 'battle' | 'collection';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'gacha',      icon: '🔮', label: 'BESCHWÖREN' },
  { id: 'deck',       icon: '⚔️',  label: 'DECK'       },
  { id: 'battle',     icon: '🔥',  label: 'KAMPF'      },
  { id: 'collection', icon: '🃏',  label: 'SAMMLUNG'   },
];

const App: React.FC = () => {
  const [ready,      setReady]      = useState(false);
  const [tab,        setTab]        = useState<Tab>('gacha');
  const [dailyToast, setDailyToast] = useState<number | null>(null);

  useEffect(() => {
    CardDatabase.init();
    EnemyDatabase.init();
    SaveService.updateLastLogin();

    // Daily Bonus prüfen und anwenden (lokale Gerätezeit)
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

  return (
    <div className="app">
      {/* Daily-Bonus-Toast */}
      {dailyToast !== null && (
        <div className="daily-toast" role="status">
          ☀️ Tages-Bonus! <strong>+{dailyToast} 💎</strong>
        </div>
      )}

      <div className="app-content">
        {tab === 'gacha'      && <GachaScreen />}
        {tab === 'deck'       && <DeckBuilderScreen />}
        {tab === 'battle'     && <BattleScreen />}
        {tab === 'collection' && <CollectionScreen />}
      </div>

      <nav className="app-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`app-nav__btn ${tab === t.id ? 'app-nav__btn--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="app-nav__icon">{t.icon}</span>
            <span className="app-nav__label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
