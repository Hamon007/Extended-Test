import React, { useState, useMemo } from 'react';
import { CardDatabase } from '../services/CardDatabase';
import { SaveService } from '../services/SaveService';
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

// ── Kartendetail-Overlay ──────────────────────────────────────

const CardDetail: React.FC<{ card: Card; onClose: () => void }> = ({ card, onClose }) => {
  const rarityColor = RARITY_COLOR[card.rarity] ?? '#9e9e9e';
  const stats = card.stats as { atk?: number; def?: number; mpCost?: number };

  return (
    <div className="card-detail-backdrop" onClick={onClose}>
      <div className="card-detail" onClick={e => e.stopPropagation()}>

        {card.image ? (
          <div className="card-detail__frame" style={{ borderColor: rarityColor }}>
            <div className="card-detail__frame-number">
              {card.number ? `${card.number}.` : ''}
            </div>
            <div className="card-detail__frame-compass">✦</div>
            <img className="card-detail__frame-img" src={card.image} alt={card.name} />
          </div>
        ) : (
          <div className="card-detail__no-img">
            <span>{TYPE_FALLBACK[card.type] ?? '⚔️'}</span>
          </div>
        )}

        <div className="card-detail__name">{card.name.toUpperCase()}</div>
        {(card as { title?: string }).title && (
          <div className="card-detail__subtitle">{(card as { title?: string }).title}</div>
        )}

        {(card as { quote?: string }).quote && (
          <div className="card-detail__quote-box">
            „{(card as { quote?: string }).quote}"
          </div>
        )}

        <div className="card-detail__stats">
          {[
            { label: 'Seltenheit', value: card.rarity, color: rarityColor },
            { label: 'Nummer',     value: card.number ? `#${card.number}` : '—' },
            { label: 'ATK',        value: stats.atk ? stats.atk.toLocaleString('de-DE') : '—' },
            { label: 'DEF',        value: stats.def ? stats.def.toLocaleString('de-DE') : '—' },
            { label: 'MP-Kosten',  value: stats.mpCost ?? '—' },
          ].map(row => (
            <div key={row.label} className="card-detail__stat-row">
              <span className="card-detail__stat-label">{row.label.toUpperCase()}</span>
              <span className="card-detail__stat-value" style={row.color ? { color: row.color } : undefined}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <button className="card-detail__back" onClick={onClose}>◄ Zurück</button>
      </div>
    </div>
  );
};

// ── Haupt-Komponente ──────────────────────────────────────────

const CardCollectionScreen: React.FC<CardCollectionScreenProps> = ({ onBack }) => {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  // Eigene Karten aus Inventar laden
  const ownedMap = useMemo(() => {
    const inventory = SaveService.loadGachaState().inventory;
    const map = new Map<string, number>();
    for (const inst of inventory) {
      map.set(inst.cardId, (map.get(inst.cardId) ?? 0) + 1);
    }
    return map;
  }, []);

  const { withArtwork, withoutArtwork } = useMemo(() => {
    const all = CardDatabase.getAll().slice().sort((a, b) =>
      a.name.localeCompare(b.name, 'de')
    );
    return {
      withArtwork:    all.filter(c => !!c.image),
      withoutArtwork: all.filter(c => !c.image),
    };
  }, []);

  const totalCards = withArtwork.length + withoutArtwork.length;
  const ownedUnique = ownedMap.size;

  return (
    <div className="card-col-screen">

      {/* ── Header ── */}
      <div className="card-col-header">
        <button className="card-col-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="card-col-header__title">Kartensammlung</h1>
        <span className="card-col-header__count">{ownedUnique} / {totalCards}</span>
      </div>

      {/* ── Scrollbarer Bereich ── */}
      <div className="card-col-scroll">

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

      {selectedCard && (
        <CardDetail card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
};

export default CardCollectionScreen;
