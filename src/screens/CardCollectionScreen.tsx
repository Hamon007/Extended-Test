import React, { useState, useMemo, useEffect } from 'react';
import { CardDatabase } from '../services/CardDatabase';
import { SaveService } from '../services/SaveService';
import { CollectionMilestoneService } from '../services/CollectionMilestoneService';
import { RARITY_COLOR, RARITY_MAJORS, rarityMajor } from '../types/Card';
import type { Card, Rarity } from '../types/Card';
import CardDetailModal from '../components/CardDetailModal';
import './CardCollectionScreen.css';

interface CardCollectionScreenProps {
  onBack: () => void;
}

const TYPE_FALLBACK: Record<string, string> = {
  attacker:     '⚔️',
  vanguard:     '🛡️',
  support:      '💫',
  combo_builder:'🔗',
};

type SortKey = 'name' | 'rarity' | 'atk' | 'def' | 'hp';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name',   label: 'Name' },
  { key: 'rarity', label: 'Seltenheit' },
  { key: 'atk',    label: 'ATK' },
  { key: 'def',    label: 'DEF' },
  { key: 'hp',     label: 'HP' },
];

function sortCards(cards: Card[], sort: SortKey): Card[] {
  return [...cards].sort((a, b) => {
    switch (sort) {
      case 'name':   return a.name.localeCompare(b.name, 'de');
      case 'rarity': return RARITY_MAJORS.indexOf(rarityMajor(b.rarity)) - RARITY_MAJORS.indexOf(rarityMajor(a.rarity));
      case 'atk':    return b.stats.atk - a.stats.atk;
      case 'def':    return b.stats.def - a.stats.def;
      case 'hp':     return b.stats.hp  - a.stats.hp;
      default:       return 0;
    }
  });
}

// ── Haupt-Komponente ──────────────────────────────────────────

const CardCollectionScreen: React.FC<CardCollectionScreenProps> = ({ onBack }) => {
  const [selectedCard,    setSelectedCard]    = useState<Card | null>(null);
  const [rarityFilter,    setRarityFilter]    = useState<Rarity | ''>('');
  const [sortKey,         setSortKey]         = useState<SortKey>('name');
  const [milestoneToast,  setMilestoneToast]  = useState<string | null>(null);

  // Eigene Karten aus Inventar laden
  const ownedMap = useMemo(() => {
    const inventory = SaveService.loadGachaState().inventory;
    const map = new Map<string, number>();
    for (const inst of inventory) {
      map.set(inst.cardId, (map.get(inst.cardId) ?? 0) + 1);
    }
    return map;
  }, []);

  // Meilenstein-Check beim Öffnen der Sammlung
  useEffect(() => {
    const results = CollectionMilestoneService.checkAndClaim(ownedMap.size);
    if (results.length > 0) {
      const best = results[results.length - 1];
      setMilestoneToast(`${best.milestone.icon} ${best.milestone.label} — +${best.milestone.crystals.toLocaleString('de-DE')} 💎`);
      setTimeout(() => setMilestoneToast(null), 4000);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Flache sortierte Liste aller gefilterten Karten — Grundlage für Swipe-Navigation
  const allCards = useMemo(() => {
    const filtered = CardDatabase.getAll()
      .filter(c => rarityFilter === '' || rarityMajor(c.rarity) === rarityFilter);
    const sorted = sortCards(filtered, sortKey);
    return [
      ...sorted.filter(c => !!c.image),
      ...sorted.filter(c => !c.image),
    ];
  }, [rarityFilter, sortKey]);

  const withArtwork    = allCards.filter(c => !!c.image);
  const withoutArtwork = allCards.filter(c => !c.image);

  const selectedIndex = selectedCard
    ? allCards.findIndex(c => c.id === selectedCard.id)
    : -1;

  const handlePrev = selectedIndex > 0
    ? () => setSelectedCard(allCards[selectedIndex - 1])
    : undefined;

  const handleNext = selectedIndex < allCards.length - 1
    ? () => setSelectedCard(allCards[selectedIndex + 1])
    : undefined;

  const totalCards  = CardDatabase.count();
  const ownedUnique = ownedMap.size;
  const visibleCount = allCards.length;

  const { next: nextMilestone } = CollectionMilestoneService.getProgress();
  const collectionPct = totalCards > 0 ? (ownedUnique / totalCards) * 100 : 0;

  return (
    <div className="card-col-screen">

      {/* ── Meilenstein-Toast ── */}
      {milestoneToast && (
        <div className="card-col-milestone-toast" role="status">
          {milestoneToast}
        </div>
      )}

      {/* ── Header ── */}
      <div className="card-col-header">
        <button className="card-col-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="card-col-header__title">Kartensammlung</h1>
        <span className="card-col-header__count">{ownedUnique} / {totalCards}</span>
      </div>

      {/* ── Sammlungs-Fortschritt ── */}
      <div className="card-col-progress">
        <div className="card-col-progress__bar-wrap">
          <div className="card-col-progress__bar" style={{ width: `${collectionPct}%` }} />
        </div>
        <div className="card-col-progress__info">
          <span>{collectionPct.toFixed(0)}% gesammelt</span>
          {nextMilestone && (
            <span className="card-col-progress__next">
              Nächster Meilenstein: {nextMilestone.uniqueCards} Karten → +{nextMilestone.crystals.toLocaleString()} 💎
            </span>
          )}
        </div>
      </div>

      {/* ── Filter & Sortierung ── */}
      <div className="card-col-filter">
        <span className="card-col-filter__label">SELTENHEIT</span>
        <button
          className={`card-col-filter__chip ${rarityFilter === '' ? 'card-col-filter__chip--active' : ''}`}
          onClick={() => setRarityFilter('')}
        >
          Alle
        </button>
        {RARITY_MAJORS.map(r => (
          <button
            key={r}
            className={`card-col-filter__chip ${rarityFilter === r ? 'card-col-filter__chip--active' : ''}`}
            style={rarityFilter === r ? { color: RARITY_COLOR[r], borderColor: RARITY_COLOR[r] } : undefined}
            onClick={() => setRarityFilter(r)}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="card-col-filter card-col-filter--sort">
        <span className="card-col-filter__label">SORTIERUNG</span>
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            className={`card-col-filter__chip ${sortKey === key ? 'card-col-filter__chip--active' : ''}`}
            onClick={() => setSortKey(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Scrollbarer Bereich ── */}
      <div className="card-col-scroll">

        {visibleCount === 0 && (
          <div className="card-col-empty">
            <span>🔍</span>
            <p>Keine Karten in dieser Seltenheitsstufe.</p>
          </div>
        )}

        {withArtwork.length > 0 && (
          <div className="card-col-grid">
            {withArtwork.map(card => {
              const rarityColor = RARITY_COLOR[card.rarity] ?? '#9e9e9e';
              const ownedCount  = ownedMap.get(card.id) ?? 0;
              const isOwned     = ownedCount > 0;
              return (
                <button
                  key={card.id}
                  className={`card-col-item ${!isOwned ? 'card-col-item--unowned' : ''}`}
                  onClick={() => setSelectedCard(card)}
                  style={{ '--rarity-color': rarityColor } as React.CSSProperties}
                >
                  <div className="card-col-item__img-wrap">
                    <img className="card-col-item__img" src={card.image} alt={card.name} loading="lazy" />
                    <div className="card-col-item__rarity-badge" style={{ color: rarityColor, borderColor: rarityColor }}>
                      {card.rarity}
                    </div>
                    {!isOwned && (
                      <div className="card-col-item__unowned-overlay">
                        <span className="card-col-item__lock-icon">🔒</span>
                      </div>
                    )}
                    {isOwned && ownedCount > 1 && (
                      <div className="card-col-item__owned-count">×{ownedCount}</div>
                    )}
                  </div>
                  <div className="card-col-item__info">
                    <div className="card-col-item__name">{card.name}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {withoutArtwork.length > 0 && (
          <>
            <div className="card-col-section-title">Weitere Karten ({withoutArtwork.length})</div>
            <div className="card-col-list">
              {withoutArtwork.map(card => {
                const rarityColor = RARITY_COLOR[card.rarity] ?? '#9e9e9e';
                const fallback    = TYPE_FALLBACK[card.type] ?? '⚔️';
                const isOwned     = (ownedMap.get(card.id) ?? 0) > 0;
                const ownedCount  = ownedMap.get(card.id) ?? 0;
                return (
                  <button
                    key={card.id}
                    className={`card-col-list-item ${!isOwned ? 'card-col-list-item--unowned' : ''}`}
                    onClick={() => setSelectedCard(card)}
                  >
                    <span className="card-col-list-item__icon">{isOwned ? fallback : '🔒'}</span>
                    <span className="card-col-list-item__name">{card.name}</span>
                    <span className="card-col-list-item__rarity" style={{ color: rarityColor }}>{card.rarity}</span>
                    {isOwned && ownedCount > 1 && (
                      <span className="card-col-list-item__count">×{ownedCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

      </div>

      {/* Vollständiges Kartendetail inkl. Fähigkeiten & Synergien — Swipe-Navigation */}
      <CardDetailModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </div>
  );
};

export default CardCollectionScreen;
