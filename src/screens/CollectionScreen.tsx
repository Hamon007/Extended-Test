import React, { useState, useMemo, useCallback } from 'react';
import type { Card, Rarity, Element, CardType } from '../types/Card';
import { RARITY_ORDER, ELEMENT_LABEL, TYPE_LABEL, RARITY_COLOR } from '../types/Card';
import { CardDatabase } from '../services/CardDatabase';
import { SaveService } from '../services/SaveService';
import CardThumbnail from '../components/CardThumbnail';
import CardDetailModal from '../components/CardDetailModal';
import './CollectionScreen.css';

const ELEMENT_COLORS: Record<string, string> = {
  fire: '#ff5500', ice: '#00aaff', water: '#0066ff', lightning: '#ffff00',
  wind: '#00ddaa', earth: '#44aa22', light: '#ffee00', dark: '#9900ff',
  void: '#cc00ff', death: '#888888', chaos: '#ff0044',
};
const ELEMENT_ICONS: Record<string, string> = {
  fire: '🔥', ice: '❄️', water: '💧', lightning: '⚡', wind: '🌪️',
  earth: '🌿', light: '☀️', dark: '🌑', void: '🔮', death: '💀', chaos: '🔱',
};

// ── Filter-State ──────────────────────────────────────────────

interface FilterState {
  rarity:  Rarity  | '';
  element: Element | '';
  type:    CardType| '';
  search:  string;
  sort:    'number' | 'name' | 'rarity' | 'atk' | 'def' | 'hp';
}

const DEFAULT_FILTER: FilterState = {
  rarity: '', element: '', type: '', search: '', sort: 'number',
};

// ── Sortierlogik ──────────────────────────────────────────────

function sortCards(cards: Card[], sort: FilterState['sort']): Card[] {
  return [...cards].sort((a, b) => {
    switch (sort) {
      case 'number': return a.number.localeCompare(b.number);
      case 'name':   return a.name.localeCompare(b.name, 'de');
      case 'rarity':
        return RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
      case 'atk': return b.stats.atk - a.stats.atk;
      case 'def': return b.stats.def - a.stats.def;
      case 'hp':  return b.stats.hp  - a.stats.hp;
      default:    return 0;
    }
  });
}

// ── Hauptkomponente ───────────────────────────────────────────

interface CollectionScreenProps {
  onNavigate?: (screen: string) => void;
}

const CollectionScreen: React.FC<CollectionScreenProps> = ({ onNavigate }) => {
  const [filter,       setFilter]       = useState<FilterState>(DEFAULT_FILTER);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [filtersOpen,  setFiltersOpen]  = useState(false);

  // Owned-Karten: cardId → Anzahl der Kopien
  const ownedMap = useMemo(() => {
    const inv = SaveService.loadGachaState().inventory;
    const m = new Map<string, number>();
    for (const inst of inv) m.set(inst.cardId, (m.get(inst.cardId) ?? 0) + 1);
    return m;
  }, []);

  // Rarity completion stats
  const rarityStats = useMemo(() => {
    const all = CardDatabase.getAll();
    const byRarity: Record<string, { total: number; owned: number }> = {};
    for (const card of all) {
      const r = card.rarity;
      if (!byRarity[r]) byRarity[r] = { total: 0, owned: 0 };
      byRarity[r]!.total++;
      if (ownedMap.has(card.id)) byRarity[r]!.owned++;
    }
    return RARITY_ORDER
      .filter(r => byRarity[r])
      .map(r => [r, byRarity[r]!] as [string, { total: number; owned: number }]);
  }, [ownedMap]);

  // "Almost complete" rarity tiers (missing ≤ 2 cards, not already done)
  const almostComplete = useMemo(() => {
    return rarityStats
      .filter(([, { total, owned }]) => {
        const missing = total - owned;
        return missing > 0 && missing <= 2 && total > 0;
      })
      .map(([rarity, { total, owned }]) => {
        const missing = total - owned;
        const allCards = CardDatabase.getAll().filter(c => c.rarity === rarity);
        const missingCards = allCards.filter(c => !ownedMap.has(c.id));
        return { rarity, total, owned, missing, missingCards };
      });
  }, [rarityStats, ownedMap]);

  // Element completion stats
  const elementStats = useMemo(() => {
    const all = CardDatabase.getAll();
    const byElem: Record<string, { total: number; owned: number }> = {};
    for (const card of all) {
      if (!card.element) continue;
      if (!byElem[card.element]) byElem[card.element] = { total: 0, owned: 0 };
      byElem[card.element]!.total++;
      if (ownedMap.has(card.id)) byElem[card.element]!.owned++;
    }
    return Object.entries(byElem)
      .sort((a, b) => (b[1].owned / b[1].total) - (a[1].owned / a[1].total));
  }, [ownedMap]);

  // Gefilterte + sortierte Karten
  const visibleCards = useMemo(() => {
    const filtered = CardDatabase.filter({
      rarity:  filter.rarity  || undefined,
      element: filter.element || undefined,
      type:    filter.type    || undefined,
      search:  filter.search  || undefined,
    });
    return sortCards(filtered, filter.sort);
  }, [filter]);

  const handleCardClick = useCallback((card: Card) => {
    setSelectedCard(card);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedCard(null);
  }, []);

  const selectedIndex = selectedCard
    ? visibleCards.findIndex(c => c.id === selectedCard.id)
    : -1;

  const handlePrev = selectedIndex > 0
    ? () => setSelectedCard(visibleCards[selectedIndex - 1])
    : undefined;

  const handleNext = selectedIndex < visibleCards.length - 1
    ? () => setSelectedCard(visibleCards[selectedIndex + 1])
    : undefined;

  const resetFilters = () => setFilter(DEFAULT_FILTER);

  const activeFilterCount = [
    filter.rarity, filter.element, filter.type, filter.search,
  ].filter(Boolean).length;

  return (
    <div className="collection-screen">

      {/* ── Top Bar ── */}
      <div className="collection-topbar">
        <div className="collection-topbar__left">
          <h1 className="collection-topbar__title">◆ KARTENSAMMLUNG ◆</h1>
          <span className="collection-topbar__count">
            {visibleCards.length} / {CardDatabase.count()} Karten
          </span>
          <span className="collection-topbar__owned">
            ✓ {ownedMap.size} besessen
          </span>
        </div>
        <div className="collection-topbar__right">
          <button
            className={`collection-filter-btn ${activeFilterCount > 0 ? 'collection-filter-btn--active' : ''}`}
            onClick={() => setFiltersOpen(v => !v)}
            aria-expanded={filtersOpen}
          >
            ⚙ Filter
            {activeFilterCount > 0 && (
              <span className="collection-filter-btn__badge">{activeFilterCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Filter-Panel (ausklappbar) ── */}
      {filtersOpen && (
        <div className="collection-filters">

          {/* Suchfeld */}
          <div className="filter-row">
            <label className="filter-label">SUCHE</label>
            <input
              className="filter-input"
              type="text"
              placeholder="Name oder Titel …"
              value={filter.search}
              onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
            />
          </div>

          {/* Seltenheit */}
          <div className="filter-row">
            <label className="filter-label">SELTENHEIT</label>
            <div className="filter-chips">
              {(['', ...RARITY_ORDER] as (Rarity | '')[]).map(r => (
                <button
                  key={r}
                  className={`filter-chip ${filter.rarity === r ? 'filter-chip--active' : ''}`}
                  onClick={() => setFilter(f => ({ ...f, rarity: r }))}
                >
                  {r || 'Alle'}
                </button>
              ))}
            </div>
          </div>

          {/* Element */}
          <div className="filter-row">
            <label className="filter-label">ELEMENT</label>
            <div className="filter-chips">
              <button
                className={`filter-chip ${filter.element === '' ? 'filter-chip--active' : ''}`}
                onClick={() => setFilter(f => ({ ...f, element: '' }))}
              >
                Alle
              </button>
              {(Object.keys(ELEMENT_LABEL) as Element[]).map(el => (
                <button
                  key={el}
                  className={`filter-chip ${filter.element === el ? 'filter-chip--active' : ''}`}
                  onClick={() => setFilter(f => ({ ...f, element: el }))}
                >
                  {ELEMENT_LABEL[el]}
                </button>
              ))}
            </div>
          </div>

          {/* Typ */}
          <div className="filter-row">
            <label className="filter-label">TYP</label>
            <div className="filter-chips">
              <button
                className={`filter-chip ${filter.type === '' ? 'filter-chip--active' : ''}`}
                onClick={() => setFilter(f => ({ ...f, type: '' }))}
              >
                Alle
              </button>
              {(Object.keys(TYPE_LABEL) as CardType[]).map(t => (
                <button
                  key={t}
                  className={`filter-chip ${filter.type === t ? 'filter-chip--active' : ''}`}
                  onClick={() => setFilter(f => ({ ...f, type: t }))}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Sortierung */}
          <div className="filter-row">
            <label className="filter-label">SORTIERUNG</label>
            <div className="filter-chips">
              {([
                ['number', 'Nummer'],
                ['rarity', 'Seltenheit'],
                ['name',   'Name'],
                ['atk',    'ATK'],
                ['def',    'DEF'],
                ['hp',     'HP'],
              ] as [FilterState['sort'], string][]).map(([val, label]) => (
                <button
                  key={val}
                  className={`filter-chip ${filter.sort === val ? 'filter-chip--active' : ''}`}
                  onClick={() => setFilter(f => ({ ...f, sort: val }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Zurücksetzen */}
          {activeFilterCount > 0 && (
            <button className="filter-reset" onClick={resetFilters}>
              ✕ Filter zurücksetzen
            </button>
          )}
        </div>
      )}

      {/* ── Seltenheits-Abschluss ── */}
      {!filtersOpen && rarityStats.length > 0 && (
        <div className="collection-rarity-progress">
          {rarityStats.map(([r, { total, owned }]) => {
            const pct   = total > 0 ? (owned / total) * 100 : 0;
            const color = RARITY_COLOR[r as Rarity] ?? '#9e9e9e';
            const done  = owned === total;
            return (
              <button
                key={r}
                className={`collection-rarity-row ${done ? 'collection-rarity-row--done' : ''}`}
                onClick={() => setFilter(f => ({ ...f, rarity: f.rarity === r ? '' : r as Rarity }))}
                title={`${r}: ${owned}/${total} besessen`}
              >
                <span className="collection-rarity-row__label" style={{ color }}>
                  {done ? '✓' : r}
                </span>
                <div className="collection-rarity-row__bar-track">
                  <div
                    className="collection-rarity-row__bar-fill"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                <span className="collection-rarity-row__frac" style={{ color }}>
                  {owned}<span className="collection-rarity-row__total">/{total}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Fast-Komplett-Banner ── */}
      {!filtersOpen && almostComplete.length > 0 && (
        <div className="collection-almost-complete">
          {almostComplete.map(({ rarity, total, owned, missing, missingCards }) => {
            const color = RARITY_COLOR[rarity as Rarity] ?? '#9e9e9e';
            return (
              <div
                key={rarity}
                className="collection-almost-row"
                style={{ '--ac': color } as React.CSSProperties}
              >
                <div className="collection-almost-row__left">
                  <span className="collection-almost-row__fire">🔥</span>
                  <div className="collection-almost-row__text">
                    <span className="collection-almost-row__title" style={{ color }}>
                      FAST KOMPLETT — {rarity}!
                    </span>
                    <span className="collection-almost-row__sub">
                      {owned}/{total} · noch {missing} Karte{missing > 1 ? 'n' : ''}: {missingCards.map(c => c.name).join(', ')}
                    </span>
                  </div>
                </div>
                {onNavigate && (
                  <button
                    className="collection-almost-row__cta"
                    onClick={() => onNavigate('gacha')}
                  >
                    ✨ Ziehen
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Element-Abschluss-Leisten ── */}
      {!filtersOpen && elementStats.length > 0 && (
        <div className="collection-elem-progress">
          {elementStats.map(([elem, { total, owned }]) => {
            const pct = total > 0 ? (owned / total) * 100 : 0;
            const color = ELEMENT_COLORS[elem] ?? '#888';
            const icon  = ELEMENT_ICONS[elem] ?? '◆';
            return (
              <button
                key={elem}
                className="collection-elem-row"
                onClick={() => setFilter(f => ({ ...f, element: f.element === elem ? '' : elem as Element }))}
                title={`${elem}: ${owned}/${total} besessen`}
              >
                <span className="collection-elem-row__icon">{icon}</span>
                <div className="collection-elem-row__bar-track">
                  <div
                    className="collection-elem-row__bar-fill"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                <span className="collection-elem-row__frac" style={{ color }}>
                  {owned}<span className="collection-elem-row__total">/{total}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Karten-Grid ── */}
      {visibleCards.length > 0 ? (
        <div className="collection-grid">
          {visibleCards.map(card => (
            <CardThumbnail
              key={card.id}
              card={card}
              onClick={handleCardClick}
              owned={ownedMap.has(card.id)}
              copiesOwned={ownedMap.get(card.id)}
            />
          ))}
        </div>
      ) : (
        <div className="collection-empty">
          <span className="collection-empty__icon">🔍</span>
          <p className="collection-empty__text">Keine Karten gefunden.</p>
          <button className="filter-reset" onClick={resetFilters}>
            Filter zurücksetzen
          </button>
        </div>
      )}

      {/* ── Detailansicht ── */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          onClose={handleCloseDetail}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      )}
    </div>
  );
};

export default CollectionScreen;
