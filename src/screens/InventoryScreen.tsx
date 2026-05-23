import React, { useState, useMemo } from 'react';
import { SaveService } from '../services/SaveService';
import { EnergyService } from '../services/EnergyService';
import { CardDatabase } from '../services/CardDatabase';
import { AccountProgressionService } from '../services/AccountProgressionService';
import { RARITY_COLOR, rarityMajor } from '../types/Card';
import type { Rarity } from '../types/Card';
import type { CardInstance } from '../types/GachaTypes';
import './InventoryScreen.css';

interface Props { onBack: () => void; }

type SortKey = 'rarity' | 'name' | 'newest';
const RARITY_FILTERS: (Rarity | 'ALL')[] = ['ALL', 'N', 'R', 'SR', 'SSR', 'MR', 'LR'];
const RARITY_RANK: Record<string, number> = { N:0, R:1, SR:2, SSR:3, MR:4, LR:5 };

const InventoryScreen: React.FC<Props> = ({ onBack }) => {
  const [gs,      setGs]      = useState(() => SaveService.loadGachaState());
  const [energy,  setEnergy]  = useState(() => EnergyService.load());
  const [eMax,    setEMax]    = useState(() => EnergyService.getMax());
  const [search,  setSearch]  = useState('');
  const [rFilter, setRFilter] = useState<Rarity | 'ALL'>('ALL');
  const [sort,    setSort]    = useState<SortKey>('rarity');
  const [detail,  setDetail]  = useState<CardInstance | null>(null);
  const [toast,   setToast]   = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  }

  function refresh() {
    setGs(SaveService.loadGachaState());
    setEnergy(EnergyService.load());
    setEMax(EnergyService.getMax());
  }

  // ── Crystal cards ────────────────────────────────────────────
  function useCrystalCard(size: 'small' | 'medium' | 'large') {
    const stock = gs.crystalCards;
    if ((stock[size] ?? 0) <= 0) return;
    const xpMap = { small: 500, medium: 2_000, large: 5_000 };
    const newStock = { ...stock, [size]: stock[size] - 1 };
    const acct = SaveService.loadAccountState();
    const result = AccountProgressionService.addAccountXp(acct, xpMap[size]);
    SaveService.saveAccountState(result.newState);
    SaveService.saveGachaState({ ...gs, crystalCards: newStock });
    showToast(`+${xpMap[size].toLocaleString('de-DE')} XP erhalten!`);
    refresh();
  }

  // ── Energy potion ─────────────────────────────────────────────
  function usePotion() {
    if (energy.potions <= 0) return;
    const next = EnergyService.usePotion();
    setEnergy(next);
    showToast('Ausdauertrank verwendet! +1 Energie');
  }

  // ── Card list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return gs.inventory
      .filter(inst => {
        const card = CardDatabase.getById(inst.cardId);
        const nameMatch = !q || (card?.name ?? inst.cardId).toLowerCase().includes(q);
        const rarityMatch = rFilter === 'ALL' || rarityMajor(inst.rarity) === rFilter;
        return nameMatch && rarityMatch;
      })
      .sort((a, b) => {
        if (sort === 'rarity') {
          const diff = (RARITY_RANK[rarityMajor(b.rarity)] ?? 0) - (RARITY_RANK[rarityMajor(a.rarity)] ?? 0);
          if (diff !== 0) return diff;
          return (CardDatabase.getById(a.cardId)?.name ?? '').localeCompare(CardDatabase.getById(b.cardId)?.name ?? '');
        }
        if (sort === 'name') {
          return (CardDatabase.getById(a.cardId)?.name ?? '').localeCompare(CardDatabase.getById(b.cardId)?.name ?? '');
        }
        // newest: reverse array order (newest pulls at end of inventory)
        return gs.inventory.indexOf(b) - gs.inventory.indexOf(a);
      });
  }, [gs.inventory, search, rFilter, sort]);

  const stock = gs.crystalCards;
  const detailCard = detail ? CardDatabase.getById(detail.cardId) : null;

  return (
    <div className="inv-screen">
      {toast && <div className="inv-toast">{toast}</div>}

      <div className="inv-header">
        <button className="inv-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="inv-header__title">Inventar</h1>
        <span className="inv-header__count">{gs.inventory.length} Karten</span>
      </div>

      {/* ── Verbrauchsgegenstände ── */}
      <section className="inv-section">
        <div className="inv-section__title">VERBRAUCHSGEGENSTÄNDE</div>

        <div className="inv-consumables">
          {/* Ausdauertränke */}
          <div className="inv-consumable">
            <span className="inv-consumable__icon">🧪</span>
            <div className="inv-consumable__info">
              <span className="inv-consumable__name">Ausdauertrank</span>
              <span className="inv-consumable__desc">Stellt 1 Kampfenergie wieder her</span>
              <span className="inv-consumable__count">×{energy.potions} vorhanden</span>
            </div>
            <div className="inv-consumable__right">
              <span className="inv-consumable__energy">⚡ {energy.energy}/{eMax}</span>
              <button
                className={`inv-use-btn ${energy.potions <= 0 || energy.energy >= eMax ? 'inv-use-btn--disabled' : ''}`}
                disabled={energy.potions <= 0 || energy.energy >= eMax}
                onClick={usePotion}
              >
                Verwenden
              </button>
            </div>
          </div>

          {/* Kristallkarten */}
          {(['small', 'medium', 'large'] as const).map(size => {
            const labels = { small: 'Kristallkarte (Klein)', medium: 'Kristallkarte (Mittel)', large: 'Kristallkarte (Groß)' };
            const xpMap  = { small: 500, medium: 2_000, large: 5_000 };
            const count  = stock[size] ?? 0;
            return (
              <div key={size} className="inv-consumable">
                <span className="inv-consumable__icon">💎</span>
                <div className="inv-consumable__info">
                  <span className="inv-consumable__name">{labels[size]}</span>
                  <span className="inv-consumable__desc">+{xpMap[size].toLocaleString('de-DE')} Konto-XP</span>
                  <span className="inv-consumable__count">×{count} vorhanden</span>
                </div>
                <button
                  className={`inv-use-btn ${count <= 0 ? 'inv-use-btn--disabled' : ''}`}
                  disabled={count <= 0}
                  onClick={() => useCrystalCard(size)}
                >
                  Verwenden
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Kartenbestand ── */}
      <section className="inv-section">
        <div className="inv-section__title">KARTEN ({gs.inventory.length})</div>

        <div className="inv-filters">
          <input
            className="inv-search"
            type="text"
            placeholder="Karte suchen …"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="inv-rarity-row">
            {RARITY_FILTERS.map(r => (
              <button
                key={r}
                className={`inv-rarity-btn${rFilter === r ? ' inv-rarity-btn--active' : ''}`}
                style={r !== 'ALL' ? { color: RARITY_COLOR[r as Rarity] } : undefined}
                onClick={() => setRFilter(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="inv-sort-row">
            {(['rarity', 'name', 'newest'] as SortKey[]).map(s => (
              <button
                key={s}
                className={`inv-sort-btn${sort === s ? ' inv-sort-btn--active' : ''}`}
                onClick={() => setSort(s)}
              >
                {s === 'rarity' ? 'Rarität' : s === 'name' ? 'Name' : 'Neueste'}
              </button>
            ))}
          </div>
        </div>

        <div className="inv-card-grid">
          {filtered.length === 0 && (
            <p className="inv-empty">Keine Karten gefunden.</p>
          )}
          {filtered.map(inst => {
            const card = CardDatabase.getById(inst.cardId);
            const color = RARITY_COLOR[inst.rarity];
            return (
              <button
                key={inst.uuid}
                className="inv-card-chip"
                onClick={() => setDetail(inst)}
              >
                <img className="inv-card-chip__img" src={card?.image} alt={card?.name} />
                <span className="inv-card-chip__rarity" style={{ color }}>{rarityMajor(inst.rarity)}</span>
                <span className="inv-card-chip__name">{card?.name ?? inst.cardId}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Detail-Overlay ── */}
      {detail && detailCard && (
        <div className="inv-overlay" onClick={() => setDetail(null)}>
          <div className="inv-overlay__box" onClick={e => e.stopPropagation()}>
            <img className="inv-overlay__img" src={detailCard.image} alt={detailCard.name} />
            <div className="inv-overlay__info">
              <div className="inv-overlay__name" style={{ color: RARITY_COLOR[detail.rarity] }}>
                {detailCard.name}
              </div>
              <div className="inv-overlay__title">{detailCard.title}</div>
              <div className="inv-overlay__rarity">{detail.rarity} · {detailCard.element}</div>
              <div className="inv-overlay__stats">
                <span>ATK {detailCard.stats.atk.toLocaleString('de-DE')}</span>
                <span>DEF {detailCard.stats.def.toLocaleString('de-DE')}</span>
                <span>HP {detailCard.stats.hp.toLocaleString('de-DE')}</span>
                <span>MP {detailCard.stats.mpCost}</span>
              </div>
            </div>
            <button className="inv-overlay__close" onClick={() => setDetail(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryScreen;
