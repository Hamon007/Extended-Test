import React, { useState } from 'react';
import type { Card } from '../types/Card';
import { RARITY_COLOR, ELEMENT_LABEL } from '../types/Card';
import './CardThumbnail.css';

const HIGH_RARITY_SET = new Set(['SSR', 'SSR+', 'MR', 'MR+', 'LR', 'LR+']);

interface Props {
  card:         Card;
  onClick:      (card: Card) => void;
  owned?:       boolean;
  copiesOwned?: number;
}

/** Einzelne Karte im Grid. Lädt Artwork mit Placeholder-Fallback. */
const CardThumbnail: React.FC<Props> = ({ card, onClick, owned, copiesOwned }) => {
  const [imgError, setImgError] = useState(false);

  const rarityColor = RARITY_COLOR[card.rarity] ?? '#9e9e9e';
  const isHighRarity = HIGH_RARITY_SET.has(card.rarity);

  return (
    <div
      className={`card-thumb${owned ? ' card-thumb--owned' : ' card-thumb--missing'}`}
      style={{ '--rarity-color': rarityColor } as React.CSSProperties}
      onClick={() => onClick(card)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(card)}
      aria-label={`${card.name} – ${card.rarity}${owned ? ' (besessen)' : ''}`}
    >
      {/* Artwork oder Placeholder */}
      <div className="card-thumb__art">
        {!imgError ? (
          <img
            src={card.image}
            alt={card.name}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="card-thumb__placeholder">
            <span className="card-thumb__placeholder-icon">🌑</span>
            <span className="card-thumb__placeholder-text">{card.name}</span>
          </div>
        )}
      </div>

      {/* Rarity-Badge */}
      <div className="card-thumb__rarity" style={{ color: rarityColor }}>
        {card.rarity}
      </div>

      {/* Nummer */}
      <div className="card-thumb__number">#{card.number}</div>

      {/* Locked overlay for unowned cards */}
      {!owned && (
        <div className="card-thumb__locked-overlay" />
      )}

      {/* Missing high-rarity lure badge */}
      {!owned && isHighRarity && (
        <div className="card-thumb__missing-badge" style={{ color: rarityColor, borderColor: rarityColor }}>
          ✨ Nicht besessen
        </div>
      )}

      {/* Besitz-Badge */}
      {owned && (
        <div className="card-thumb__owned-badge">
          {copiesOwned && copiesOwned > 1 ? `×${copiesOwned}` : '✓'}
        </div>
      )}

      {/* Footer mit Name + Stats */}
      <div className="card-thumb__footer">
        <div className="card-thumb__name">{card.name}</div>
        <div className="card-thumb__element">{ELEMENT_LABEL[card.element]}</div>
        <div className="card-thumb__stats">
          <span title="ATK">⚔ {card.stats.atk.toLocaleString()}</span>
          <span title="HP">❤ {card.stats.hp.toLocaleString()}</span>
          <span title="MP-Kosten">💧 {card.stats.mpCost}</span>
        </div>
      </div>
    </div>
  );
};

export default CardThumbnail;
