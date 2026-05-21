import React, { useState, useMemo } from 'react';
import { CardDatabase } from '../services/CardDatabase';
import { RARITY_COLOR } from '../types/Card';
import type { Card } from '../types/Card';
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

const CardCollectionScreen: React.FC<CardCollectionScreenProps> = ({ onBack }) => {
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const { withArtwork, withoutArtwork } = useMemo(() => {
    const all = CardDatabase.getAll().slice().sort((a, b) =>
      a.name.localeCompare(b.name, 'de')
    );
    return {
      withArtwork:    all.filter(c => !!c.image),
      withoutArtwork: all.filter(c => !c.image),
    };
  }, []);

  const handleCardClick = (card: Card) => {
    setSelectedName(card.name);
    setTimeout(() => setSelectedName(null), 2000);
  };

  return (
    <div className="card-col-screen">

      {/* ── Header ── */}
      <div className="card-col-header">
        <button className="card-col-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="card-col-header__title">Kartensammlung</h1>
        <span className="card-col-header__count">{withArtwork.length + withoutArtwork.length}</span>
      </div>

      {/* ── Toast bei Klick ── */}
      {selectedName && (
        <div className="card-col-toast" role="status">
          {selectedName}
        </div>
      )}

      {/* ── Scrollbarer Bereich ── */}
      <div className="card-col-scroll">

        {/* ── Karten MIT Artwork (Grid) ── */}
        {withArtwork.length > 0 && (
          <div className="card-col-grid">
            {withArtwork.map(card => {
              const rarityColor = RARITY_COLOR[card.rarity] ?? '#9e9e9e';
              return (
                <button
                  key={card.id}
                  className="card-col-item"
                  onClick={() => handleCardClick(card)}
                  style={{ '--rarity-color': rarityColor } as React.CSSProperties}
                >
                  <div className="card-col-item__img-wrap">
                    <img className="card-col-item__img" src={card.image} alt={card.name} loading="lazy" />
                    <div className="card-col-item__rarity-badge" style={{ color: rarityColor, borderColor: rarityColor }}>
                      {card.rarity}
                    </div>
                  </div>
                  <div className="card-col-item__info">
                    <div className="card-col-item__name">{card.name}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Karten OHNE Artwork (kompakt) ── */}
        {withoutArtwork.length > 0 && (
          <>
            <div className="card-col-section-title">Weitere Karten ({withoutArtwork.length})</div>
            <div className="card-col-list">
              {withoutArtwork.map(card => {
                const rarityColor = RARITY_COLOR[card.rarity] ?? '#9e9e9e';
                const fallback = TYPE_FALLBACK[card.type] ?? '⚔️';
                return (
                  <button key={card.id} className="card-col-list-item" onClick={() => handleCardClick(card)}>
                    <span className="card-col-list-item__icon">{fallback}</span>
                    <span className="card-col-list-item__name">{card.name}</span>
                    <span className="card-col-list-item__rarity" style={{ color: rarityColor }}>{card.rarity}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

      </div>{/* end card-col-scroll */}
    </div>
  );
};

export default CardCollectionScreen;
