import React, { useState, useMemo } from 'react';
import { SaveService } from '../services/SaveService';
import { EnergyService } from '../services/EnergyService';
import { CardDatabase } from '../services/CardDatabase';
import { FusionSystem } from '../services/FusionSystem';
import { CardMasteryService } from '../services/CardMasteryService';
import { CardBondService, BOND_NAMES, BOND_ICONS } from '../services/CardBondService';
import { AccountProgressionService } from '../services/AccountProgressionService';
import { RARITY_COLOR, rarityMajor } from '../types/Card';
import type { Rarity } from '../types/Card';
import type { CardInstance } from '../types/GachaTypes';
import './InventoryScreen.css';

interface Props { onBack: () => void; onNavigate?: (screen: string) => void; }

type SortKey = 'rarity' | 'name' | 'newest' | 'level' | 'power';
const RARITY_FILTERS: (Rarity | 'ALL')[] = ['ALL', 'N', 'R', 'SR', 'SSR', 'MR', 'LR'];
const RARITY_RANK: Record<string, number> = { N:0, R:1, SR:2, SSR:3, MR:4, LR:5 };

function cardPower(inst: CardInstance): number {
  const card = CardDatabase.getById(inst.cardId);
  if (!card) return 0;
  const stats = FusionSystem.getEffectiveStats(card, inst.rarity, inst.level ?? 1);
  return stats.atk + CardMasteryService.getAtkBonus(inst.cardId);
}

const InventoryScreen: React.FC<Props> = ({ onBack, onNavigate }) => {
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
        if (sort === 'level') return (b.level ?? 1) - (a.level ?? 1);
        if (sort === 'power') return cardPower(b) - cardPower(a);
        // newest: reverse array order (newest pulls at end of inventory)
        return gs.inventory.indexOf(b) - gs.inventory.indexOf(a);
      });
  }, [gs.inventory, search, rFilter, sort]);

  const stock = gs.crystalCards;
  const detailCard = detail ? CardDatabase.getById(detail.cardId) : null;

  const topPower = useMemo(() =>
    [...gs.inventory]
      .sort((a, b) => cardPower(b) - cardPower(a))
      .slice(0, 5),
    [gs.inventory],
  );

  const fusionReadyIds = useMemo(() => {
    const groups = FusionSystem.buildGroups(gs.inventory);
    return new Set(groups.filter(g => g.canFuse).map(g => g.cardId));
  }, [gs.inventory]);

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

        {/* Top 5 Power strip */}
        {topPower.length > 0 && (
          <div className="inv-top-power">
            <div className="inv-top-power__label">⚔ STÄRKSTE KARTEN</div>
            <div className="inv-top-power__row">
              {topPower.map((inst, rank) => {
                const card  = CardDatabase.getById(inst.cardId);
                const color = RARITY_COLOR[inst.rarity];
                const pw    = cardPower(inst);
                return (
                  <button key={inst.uuid} className="inv-top-card" onClick={() => setDetail(inst)}>
                    <div className="inv-top-card__rank">#{rank + 1}</div>
                    <img className="inv-top-card__img" src={card?.image} alt={card?.name} />
                    <div className="inv-top-card__rarity" style={{ color }}>{rarityMajor(inst.rarity)}</div>
                    <div className="inv-top-card__pw">⚔{pw.toLocaleString('de-DE')}</div>
                    <div className="inv-top-card__name">{card?.name ?? inst.cardId}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
            {(['rarity', 'name', 'newest', 'level', 'power'] as SortKey[]).map(s => (
              <button
                key={s}
                className={`inv-sort-btn${sort === s ? ' inv-sort-btn--active' : ''}`}
                onClick={() => setSort(s)}
              >
                {s === 'rarity' ? 'Rarität' : s === 'name' ? 'Name' : s === 'newest' ? 'Neueste' : s === 'level' ? 'Level' : '⚔ Power'}
              </button>
            ))}
          </div>
        </div>

        {fusionReadyIds.size > 0 && (
          <button
            className="inv-fusion-banner"
            onClick={() => onNavigate?.('fusion')}
          >
            <span className="inv-fusion-banner__icon">⚗</span>
            <span className="inv-fusion-banner__text">
              {fusionReadyIds.size} Karte{fusionReadyIds.size !== 1 ? 'n' : ''} fusionsbereit!
            </span>
            <span className="inv-fusion-banner__arrow">›</span>
          </button>
        )}

        <div className="inv-card-grid">
          {filtered.length === 0 && (
            <p className="inv-empty">Keine Karten gefunden.</p>
          )}
          {filtered.map(inst => {
            const card = CardDatabase.getById(inst.cardId);
            const color = RARITY_COLOR[inst.rarity];
            const lv = inst.level ?? 1;
            const pw = cardPower(inst);
            const masteryLv = CardMasteryService.getMasteryInfo(inst.cardId).level;
            const isFuseable = fusionReadyIds.has(inst.cardId);
            return (
              <button
                key={inst.uuid}
                className={`inv-card-chip${isFuseable ? ' inv-card-chip--fuseable' : ''}`}
                onClick={() => setDetail(inst)}
              >
                <div className="inv-card-chip__img-wrap">
                  <img className="inv-card-chip__img" src={card?.image} alt={card?.name} />
                  {lv > 1 && <span className="inv-card-chip__level">Lv.{lv}</span>}
                  {masteryLv > 0 && (
                    <span className="inv-card-chip__mastery">{'★'.repeat(Math.min(masteryLv, 3))}</span>
                  )}
                  {isFuseable && <span className="inv-card-chip__fusion">⚗</span>}
                </div>
                <span className="inv-card-chip__rarity" style={{ color }}>{rarityMajor(inst.rarity)}</span>
                <span className="inv-card-chip__name">{card?.name ?? inst.cardId}</span>
                {pw > 0 && <span className="inv-card-chip__power">⚔{pw.toLocaleString('de-DE')}</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Detail-Overlay ── */}
      {detail && detailCard && (() => {
        const eff = FusionSystem.getEffectiveStats(detailCard, detail.rarity, detail.level ?? 1);
        const atkBonus = CardMasteryService.getAtkBonus(detail.cardId);
        const effAtk = eff.atk + atkBonus;
        const lv = detail.level ?? 1;
        const mastery = CardMasteryService.getMasteryInfo(detail.cardId);
        const bond    = CardBondService.getCardBond(detail.cardId);
        return (
          <div className="inv-overlay" onClick={() => setDetail(null)}>
            <div className="inv-overlay__box" onClick={e => e.stopPropagation()}>
              <img className="inv-overlay__img" src={detailCard.image} alt={detailCard.name} />
              <div className="inv-overlay__info">
                <div className="inv-overlay__name" style={{ color: RARITY_COLOR[detail.rarity] }}>
                  {detailCard.name}
                </div>
                <div className="inv-overlay__title">{detailCard.title}</div>
                <div className="inv-overlay__rarity">{detail.rarity} · {detailCard.element}</div>
                <div className="inv-overlay__level-row">
                  <span className="inv-overlay__lv">Lv. {lv}</span>
                  {mastery.level > 0 && (
                    <span className="inv-overlay__mastery" title={`Meisterschaft +${atkBonus} ATK`}>
                      {'★'.repeat(mastery.level)}
                    </span>
                  )}
                  {bond.level > 0 && (
                    <span className="inv-overlay__bond" title={`Band: ${BOND_NAMES[bond.level]}`}>
                      {BOND_ICONS[bond.level]} {BOND_NAMES[bond.level]}
                    </span>
                  )}
                </div>
                <div className="inv-overlay__stats">
                  <div className="inv-overlay__stat-row">
                    <span className="inv-overlay__stat-label">⚔ ATK</span>
                    <span className="inv-overlay__stat-eff">{effAtk.toLocaleString('de-DE')}</span>
                    {effAtk > detailCard.stats.atk && (
                      <span className="inv-overlay__stat-base">(+{(effAtk - detailCard.stats.atk).toLocaleString('de-DE')})</span>
                    )}
                  </div>
                  <div className="inv-overlay__stat-row">
                    <span className="inv-overlay__stat-label">🛡 DEF</span>
                    <span className="inv-overlay__stat-eff">{eff.def.toLocaleString('de-DE')}</span>
                    {eff.def > detailCard.stats.def && (
                      <span className="inv-overlay__stat-base">(+{(eff.def - detailCard.stats.def).toLocaleString('de-DE')})</span>
                    )}
                  </div>
                  <div className="inv-overlay__stat-row">
                    <span className="inv-overlay__stat-label">♥ HP</span>
                    <span className="inv-overlay__stat-eff">{eff.hp.toLocaleString('de-DE')}</span>
                    {eff.hp > detailCard.stats.hp && (
                      <span className="inv-overlay__stat-base">(+{(eff.hp - detailCard.stats.hp).toLocaleString('de-DE')})</span>
                    )}
                  </div>
                  <div className="inv-overlay__stat-row">
                    <span className="inv-overlay__stat-label">💧 MP</span>
                    <span className="inv-overlay__stat-eff">{detailCard.stats.mpCost}</span>
                  </div>
                </div>
              </div>
              <button className="inv-overlay__close" onClick={() => setDetail(null)}>✕</button>
              {onNavigate && (
                <div className="inv-overlay__actions">
                  <button
                    className="inv-overlay__action-btn inv-overlay__action-btn--train"
                    onClick={() => { setDetail(null); onNavigate('training'); }}
                  >
                    ⚔ Trainieren
                  </button>
                  <button
                    className="inv-overlay__action-btn inv-overlay__action-btn--fusion"
                    onClick={() => { setDetail(null); onNavigate('fusion'); }}
                  >
                    🔮 Fusion
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default InventoryScreen;
