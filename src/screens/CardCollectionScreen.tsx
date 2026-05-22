import React, { useState, useMemo } from 'react';
import { CardDatabase } from '../services/CardDatabase';
import { SaveService } from '../services/SaveService';
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

// ── Haupt-Komponente ──────────────────────────────────────────

const CardCollectionScreen: React.FC<CardCollectionScreenProps> = ({ onBack }) => {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [rarityFilter, setRarityFilter] = useState<Rarity | ''>('');

  // Eigene Karten aus Inventar laden
  const ownedMap = useMemo(() => {
    const inventory = SaveService.loadGachaState().inventory;
    const map = new Map<string, number>();
    for (const inst of inventory) {
      map.set(inst.cardId, (map.get(inst.cardId) ?? 0) + 1);
    }
    return map;
  }, []);

  // Flache sortierte Liste aller gefilterten Karten — Grundlage für Swipe-Navigation
  const allCards = useMemo(() => {
    const filtered = CardDatabase.getAll().slice()
      .filter(c => rarityFilter === '' || rarityMajor(c.rarity) === rarityFilter)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return [
      ...filtered.filter(c => !!c.image),
      ...filtered.filter(c => !c.image),
    ];
  }, [rarityFilter]);

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

  return (
    <div className="card-col-screen">

      {/* ── Header ── */}
      <div className="card-col-header">
        <button className="card-col-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="card-col-header__title">Kartensammlung</h1>
        <span className="card-col-header__count">{ownedUnique} / {totalCards}</span>
      </div>

      {/* ── Seltenheits-Filter ── */}
      <div className="card-col-filter">
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
