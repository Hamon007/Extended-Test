import React, { useState, useCallback, useEffect } from 'react';
import { SaveService } from '../services/SaveService';
import { ShopService, type ShopItem } from '../services/ShopService';
import { FlashSaleService, type FlashSale } from '../services/FlashSaleService';
import { PULL_COST_SINGLE, PULL_COST_MULTI } from '../config/GameConfig';
import { AudioService } from '../services/AudioService';
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
  const [crystals,       setCrystals]       = useState(() => SaveService.loadGachaState().crystals);
  const [toast,          setToast]          = useState('');
  const [purchaseBurst,  setPurchaseBurst]  = useState<ShopItem | null>(null);
  const [resetMs,        setResetMs]        = useState(() => msUntilMidnightUtc());
  const [flashSale,  setFlashSale]  = useState<FlashSale>(() => FlashSaleService.getCurrent());
  const [flashMs,    setFlashMs]    = useState(() => FlashSaleService.msUntilEnd());

  useEffect(() => {
    const id = setInterval(() => {
      setResetMs(msUntilMidnightUtc());
      const ms = FlashSaleService.msUntilEnd();
      setFlashMs(ms);
      if (ms <= 0) setFlashSale(FlashSaleService.getCurrent()); // rotate
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const dailyOffers  = ShopService.getDailyOffers();
  const fixedItems   = ShopService.SHOP_ITEMS.filter(i => !i.rotating);

  // Pull goal: progress toward the next 10-pull
  const pullGoalPct    = Math.min(1, crystals / PULL_COST_MULTI);
  const crystalsNeeded = Math.max(0, PULL_COST_MULTI - crystals);

  // Mark cheapest daily offer as today's tip
  const cheapestDailyId = dailyOffers.length > 0
    ? [...dailyOffers].sort((a, b) => a.cost - b.cost)[0]!.id
    : null;

  const handleBuy = useCallback((item: ShopItem) => {
    const result = ShopService.purchase(item);
    if (!result.ok) {
      setToast(`❌ ${result.reason}`);
    } else {
      AudioService.reward();
      AudioService.vibrate([15, 25, 20]);
      setCrystals(SaveService.loadGachaState().crystals);
      setToast(`✓ ${item.name} gekauft!`);
      setPurchaseBurst(item);
      setTimeout(() => setPurchaseBurst(null), 1600);
    }
    setTimeout(() => setToast(''), 2500);
  }, []);

  const ItemCard: React.FC<{ item: ShopItem; isTip?: boolean }> = ({ item, isTip }) => {
    const boughtToday = ShopService.getBoughtToday(item.id);
    const { ok, reason } = ShopService.canBuy(item);
    return (
      <div className={`shop-item ${!ok ? 'shop-item--disabled' : ''} ${isTip ? 'shop-item--tip' : ''}`}>
        <div className="shop-item__icon">{item.icon}</div>
        <div className="shop-item__info">
          <div className="shop-item__name-row">
            <div className="shop-item__name">{item.name}</div>
            {isTip && <span className="shop-item__tip-badge">TIPP</span>}
          </div>
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

      {/* Purchase burst */}
      {purchaseBurst && (
        <div className="shop-purchase-burst" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`shop-purchase-particle shop-purchase-particle--${i % 4}`} style={{ '--i': i } as React.CSSProperties} />
          ))}
          <div className="shop-purchase-burst__card">
            <div className="shop-purchase-burst__icon">{purchaseBurst.icon}</div>
            <div className="shop-purchase-burst__name">{purchaseBurst.name}</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="shop-header">
        <button className="shop-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="shop-header__title">✦ LADEN ✦</h1>
        <div className="shop-header__crystals">💎 {crystals.toLocaleString('de-DE')}</div>
      </div>

      {/* Toast */}
      {toast && <div className="shop-toast">{toast}</div>}

      <div className="shop-body">

        {/* ── Flash Sale ── */}
        <div className={`shop-flash-sale ${flashMs < 600_000 ? 'shop-flash-sale--urgent' : ''}`}>
          <div className="shop-flash-sale__header">
            <span className="shop-flash-sale__badge">⚡ BLITZANGEBOT</span>
            <span className="shop-flash-sale__timer">⏰ {formatHMS(flashMs)}</span>
          </div>
          <div className="shop-flash-sale__body">
            <span className="shop-flash-sale__icon">{flashSale.icon}</span>
            <div className="shop-flash-sale__info">
              <div className="shop-flash-sale__name">{flashSale.name}</div>
              <div className="shop-flash-sale__prices">
                <span className="shop-flash-sale__original">💎 {flashSale.original.toLocaleString('de-DE')}</span>
                <span className="shop-flash-sale__arrow">→</span>
                <span className="shop-flash-sale__sale">💎 {flashSale.sale.toLocaleString('de-DE')}</span>
                <span className="shop-flash-sale__discount">-{flashSale.discount}%</span>
              </div>
            </div>
            <button
              className="shop-flash-sale__btn"
              disabled={crystals < flashSale.sale}
              onClick={() => {
                const item = ShopService.SHOP_ITEMS.find(i => i.id === flashSale.itemId);
                if (!item) return;
                // Apply flash discount: override cost temporarily
                const discountedItem: ShopItem = { ...item, cost: flashSale.sale };
                const result = ShopService.purchase(discountedItem);
                if (!result.ok) {
                  setToast(`❌ ${result.reason}`);
                } else {
                  setCrystals(SaveService.loadGachaState().crystals);
                  setToast(`⚡ Blitzangebot: ${flashSale.name} gekauft!`);
                }
                setTimeout(() => setToast(''), 2500);
              }}
            >
              {crystals >= flashSale.sale ? 'Kaufen' : '—'}
            </button>
          </div>
        </div>

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

        {/* Pull Goal Tracker */}
        <div className="shop-pull-goal">
          <div className="shop-pull-goal__header">
            <span className="shop-pull-goal__label">
              {pullGoalPct >= 1
                ? '✦ Jetzt 10× ziehen!'
                : pullGoalPct >= 0.8
                  ? `Fast bereit — noch 💎 ${crystalsNeeded.toLocaleString('de-DE')} bis 10×`
                  : `10× Ziehziel — noch 💎 ${crystalsNeeded.toLocaleString('de-DE')}`}
            </span>
            <span className="shop-pull-goal__pct">{Math.round(pullGoalPct * 100)}%</span>
          </div>
          <div className="shop-pull-goal__bar-track">
            <div
              className={`shop-pull-goal__bar-fill ${pullGoalPct >= 1 ? 'shop-pull-goal__bar-fill--ready' : pullGoalPct >= 0.8 ? 'shop-pull-goal__bar-fill--near' : ''}`}
              style={{ width: `${Math.round(pullGoalPct * 100)}%` }}
            />
          </div>
        </div>

        {/* Daily Offers */}
        <div className="shop-section-header">
          <span className="shop-section-title">Tagesangebote</span>
          <span className="shop-section-sub shop-section-sub--timer">↺ {formatHMS(resetMs)}</span>
        </div>
        <div className="shop-daily-badge">📅 {ShopService.todayISO()}</div>
        <div className="shop-items">
          {dailyOffers.map(item => (
            <ItemCard key={item.id} item={item} isTip={item.id === cheapestDailyId} />
          ))}
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
