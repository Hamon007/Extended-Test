import React, { useState, useMemo } from 'react';
import { CardDatabase } from '../services/CardDatabase';
import { resolveArtwork, hasArtwork } from '../services/ArtworkMapper';
import { RARITY_COLOR } from '../types/Card';
import type { Card } from '../types/Card';
import './CardCollectionScreen.css';

// ── Typen ─────────────────────────────────────────────────────

interface CardCollectionScreenProps {
  onBack: () => void;
}

// ── Emoji-Fallback je CardType ─────────────────────────────────

const TYPE_FALLBACK: Record<string, string> = {
  attacker:     '⚔️',
  vanguard:     '🛡️',
  support:      '💫',
  combo_builder:'🔗',
};

// ── Haupt-Komponente ──────────────────────────────────────────

const CardCollectionScreen: React.FC<CardCollectionScreenProps> = ({ onBack }) => {
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const { withArtwork, withoutArtwork } = useMemo(() => {
    const all = CardDatabase.getAll().slice().sort((a, b) =>
      a.name.localeCompare(b.name, 'de')
    );
    return {
      withArtwork:    all.filter(c => hasArtwork(c.artwork_key)),
      withoutArtwork: all.filter(c => !hasArtwork(c.artwork_key)),
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

      {/* ── Karten MIT Artwork ── */}
      <div className="card-col-grid">
        {withArtwork.map(card => {
          const artwork = resolveArtwork(card.artwork_key);
          const rarityColor = RARITY_COLOR[card.rarity] ?? '#9e9e9e';
          return (
            <button
              key={card.id}
              className="card-col-item"
              onClick={() => handleCardClick(card)}
              style={{ '--rarity-color': rarityColor } as React.CSSProperties}
            >
              <div className="card-col-item__img-wrap">
                <img className="card-col-item__img" src={artwork} alt={card.name} loading="lazy" />
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
    </div>
  );
};

export default CardCollectionScreen;
