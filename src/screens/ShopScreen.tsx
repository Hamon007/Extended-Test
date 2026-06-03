import React, { useState, useCallback, useEffect } from 'react';
import { SaveService } from '../services/SaveService';
import { ShopService, type ShopItem } from '../services/ShopService';
import { PULL_COST_SINGLE, PULL_COST_MULTI } from '../config/GameConfig';
import './ShopScreen.css';

function msUntilMidnightUtc(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return midnight.getTime() - now.getTime();
}

function formatHMS(ms: number): string {
  const s  = Math.max(0, Math.floor(ms / 1000));
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
}

interface ShopScreenProps {
  onBack: () => void;
}

const ShopScreen: React.FC<ShopScreenProps> = ({ onBack }) => {
  const [crystals, setCrystals] = useState(() => SaveService.loadGachaState().crystals);
  const [toast,    setToast]    = useState('');
  const [resetMs,  setResetMs]  = useState(() => msUntilMidnightUtc());

  useEffect(() => {
    const id = setInterval(() => setResetMs(msUntilMidnightUtc()), 1000);
    return () => clearInterval(id);
  }, []);

  const dailyOffers  = ShopService.getDailyOffers();
  const fixedItems   = ShopService.SHOP_ITEMS.filter(i => !i.rotating);

  const handleBuy = useCallback((item: ShopItem) => {
    const result = ShopService.purchase(item);
    if (!result.ok) {
      setToast(`❌ ${result.reason}`);
    } else {
      setCrystals(SaveService.loadGachaState().crystals);
      setToast(`✓ ${item.name} gekauft!`);
    }
    setTimeout(() => setToast(''), 2500);
  }, []);

  const ItemCard: React.FC<{ item: ShopItem }> = ({ item }) => {
    const boughtToday = ShopService.getBoughtToday(item.id);
    const { ok, reason } = ShopService.canBuy(item);
    return (
      <div className={`shop-item ${!ok ? 'shop-item--disabled' : ''}`}>
        <div className="shop-item__icon">{item.icon}</div>
        <div className="shop-item__info">
          <div className="shop-item__name">{item.name}</div>
          <div className="shop-item__desc">{item.description}</div>
          {boughtToday > 0 && (
            <div className="shop-item__bought">{boughtToday}/{item.maxPerDay} heute</div>
          )}
        </div>
        <button
          className="shop-item__buy"
          disabled={!ok}
          onClick={() => handleBuy(item)}
          title={!ok ? reason : undefined}
        >
          <span className="shop-item__cost">💎 {item.cost.toLocaleString('de-DE')}</span>
          <span className="shop-item__label">{ok ? 'Kaufen' : '—'}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="shop-screen">

      {/* Header */}
      <div className="shop-header">
        <button className="shop-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="shop-header__title">✦ LADEN ✦</h1>
        <div className="shop-header__crystals">💎 {crystals.toLocaleString('de-DE')}</div>
      </div>

      {/* Toast */}
      {toast && <div className="shop-toast">{toast}</div>}

      <div className="shop-body">

        {/* Pull Affordability Widget */}
        <div className="shop-pull-power">
          <div className="shop-pull-power__title">💎 Ziehkraft</div>
          <div className="shop-pull-power__row">
            <span className="shop-pull-power__label">Einzel (💎{PULL_COST_SINGLE})</span>
            <span className="shop-pull-power__val">{Math.floor(crystals / PULL_COST_SINGLE)}×</span>
          </div>
          <div className="shop-pull-power__row">
            <span className="shop-pull-power__label">10× (💎{PULL_COST_MULTI.toLocaleString('de-DE')})</span>
            <span className="shop-pull-power__val">{Math.floor(crystals / PULL_COST_MULTI)}×10</span>
          </div>
        </div>

        {/* Daily Offers */}
        <div className="shop-section-header">
          <span className="shop-section-title">Tagesangebote</span>
          <span className="shop-section-sub shop-section-sub--timer">↺ {formatHMS(resetMs)}</span>
        </div>
        <div className="shop-daily-badge">📅 {ShopService.todayISO()}</div>
        <div className="shop-items">
          {dailyOffers.map(item => <ItemCard key={item.id} item={item} />)}
        </div>

        {/* Fixed Items */}
        <div className="shop-section-header" style={{ marginTop: 16 }}>
          <span className="shop-section-title">Dauerangebote</span>
          <span className="shop-section-sub">Immer verfügbar</span>
        </div>
        <div className="shop-items">
          {fixedItems.map(item => <ItemCard key={item.id} item={item} />)}
        </div>

        <div className="shop-footer">
          ─────── ✦ Codex Immortalis Shop ✦ ───────
          <br/>Kristalle durch Kämpfe, Quests und tägliche Belohnungen verdienen.
        </div>
      </div>
    </div>
  );
};

export default ShopScreen;
