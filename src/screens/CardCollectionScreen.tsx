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

// ── Hilfsfunktion: Sortierschlüssel ───────────────────────────

function sortKey(card: Card): number {
  // Karten mit Artwork zuerst (0), dann ohne (1)
  return hasArtwork(card.artwork_key) ? 0 : 1;
}

// ── Haupt-Komponente ──────────────────────────────────────────

const CardCollectionScreen: React.FC<CardCollectionScreenProps> = ({ onBack }) => {
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const allCards = useMemo(() => {
    return CardDatabase.getAll().slice().sort((a, b) => {
      const byArtwork = sortKey(a) - sortKey(b);
      if (byArtwork !== 0) return byArtwork;
      return a.name.localeCompare(b.name, 'de');
    });
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
        <span className="card-col-header__count">{allCards.length}</span>
      </div>

      {/* ── Toast bei Klick ── */}
      {selectedName && (
        <div className="card-col-toast" role="status">
          {selectedName}
        </div>
      )}

      {/* ── Karten-Grid ── */}
      {allCards.length > 0 ? (
        <div className="card-col-grid">
          {allCards.map(card => {
            const artwork = resolveArtwork(card.artwork_key);
            const fallback = TYPE_FALLBACK[card.type] ?? '⚔️';
            const rarityColor = RARITY_COLOR[card.rarity] ?? '#9e9e9e';

            return (
              <button
                key={card.id}
                className="card-col-item"
                onClick={() => handleCardClick(card)}
                style={{ '--rarity-color': rarityColor } as React.CSSProperties}
              >
                {/* Artwork oder Fallback */}
                <div className="card-col-item__img-wrap">
                  {artwork ? (
                    <img
                      className="card-col-item__img"
                      src={artwork}
                      alt={card.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className="card-col-item__fallback">{fallback}</div>
                  )}
                  <div
                    className="card-col-item__rarity-badge"
                    style={{ color: rarityColor, borderColor: rarityColor }}
                  >
                    {card.rarity}
                  </div>
                </div>

                {/* Name & Element */}
                <div className="card-col-item__info">
                  <div className="card-col-item__name">{card.name}</div>
                  <div className="card-col-item__element">{card.element}</div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="card-col-empty">
          <span>🔍</span>
          <p>Keine Karten gefunden.</p>
        </div>
      )}
    </div>
  );
};

export default CardCollectionScreen;
