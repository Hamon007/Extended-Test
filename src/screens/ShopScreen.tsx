import React, { useState, useCallback } from 'react';
import { SaveService } from '../services/SaveService';
import { ShopService, type ShopItem } from '../services/ShopService';
import './ShopScreen.css';

interface ShopScreenProps {
  onBack: () => void;
}

const ShopScreen: React.FC<ShopScreenProps> = ({ onBack }) => {
  const [crystals, setCrystals] = useState(() => SaveService.loadGachaState().crystals);
  const [toast,    setToast]    = useState('');

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

        {/* Daily Offers */}
        <div className="shop-section-header">
          <span className="shop-section-title">Tagesangebote</span>
          <span className="shop-section-sub">Erneuert sich täglich</span>
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
