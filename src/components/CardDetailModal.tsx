import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Card } from '../types/Card';
import { RARITY_COLOR, ELEMENT_LABEL, TYPE_LABEL } from '../types/Card';
import { CardDatabase } from '../services/CardDatabase';
import { CardBondService, BOND_NAMES, BOND_ICONS, BOND_THRESHOLDS, MAX_BOND } from '../services/CardBondService';
import { CardLoreService } from '../services/CardLoreService';
import './CardDetailModal.css';

interface Props {
  card:    Card | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

const CardDetailModal: React.FC<Props> = ({ card, onClose, onPrev, onNext }) => {
  const [imgError, setImgError] = useState(false);
  const [artFull,  setArtFull]  = useState(false);
  const touchStartX = useRef<number>(0);

  // Bild-Error zurücksetzen wenn neue Karte geöffnet wird (artFull bleibt — Galerie-Modus)
  useEffect(() => {
    setImgError(false);
  }, [card?.id]);

  // Tastatur: Escape schließt, Pfeiltasten navigieren
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowLeft'  && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);

  // Touch-Swipe: links = nächste, rechts = vorherige Karte
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) < 50) return;
    if (delta < 0 && onNext) onNext();
    if (delta > 0 && onPrev) onPrev();
  };

  if (!card) return null;

  const rarityColor  = RARITY_COLOR[card.rarity] ?? '#9e9e9e';
  const synergyCards = CardDatabase.getSynergies(card);

  return createPortal(
    <div
      className="detail-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Kartendetail: ${card.name}`}
    >
      <div
        className={`detail-modal${artFull ? ' detail-modal--art-full' : ''}`}
        style={{ '--rarity-color': rarityColor } as React.CSSProperties}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        {/* ── Schließen-Button ── */}
        <button className="detail-close" onClick={onClose} aria-label="Schließen">✕</button>

        {/* ── Navigations-Buttons ── */}
        {onPrev && (
          <button className="detail-nav detail-nav--prev" onClick={onPrev} aria-label="Vorherige Karte">‹</button>
        )}
        {onNext && (
          <button className="detail-nav detail-nav--next" onClick={onNext} aria-label="Nächste Karte">›</button>
        )}

        {/* ── Artwork ── */}
        <div className="detail-artwork">
          {!imgError ? (
            <img
              src={card.image}
              alt={card.name}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="detail-artwork__placeholder">
              <span>🌑</span>
              <p>{card.name}</p>
            </div>
          )}
          {!artFull && <div className="detail-artwork__gradient" />}

          {/* Vollansicht-Toggle */}
          <button
            className="detail-art-toggle"
            onClick={() => setArtFull(v => !v)}
            aria-label={artFull ? 'Details anzeigen' : 'Vollansicht'}
          >
            {artFull ? '⊟ Details' : '⛶ Vollansicht'}
          </button>
        </div>

        {/* ── Scrollbarer Inhalt (versteckt in Vollansicht) ── */}
        {!artFull && <div className="detail-body">

          {/* Kopfbereich */}
          <div className="detail-header">
            <div className="detail-meta-row">
              <span className="detail-rarity" style={{ color: rarityColor }}>{card.rarity}</span>
              <span className="detail-number">#{card.number}</span>
              {card.faction && (
                <span className="detail-faction">{card.factionLabel ?? card.faction}</span>
              )}
            </div>
            <h2 className="detail-name">{card.name}</h2>
            <p className="detail-title">{card.title}</p>
          </div>

          {/* Trennlinie */}
          <div className="detail-divider" style={{ borderColor: rarityColor }} />

          {/* Stats */}
          <div className="detail-stats-grid">
            <StatBox icon="⚔️" label="ATK"       value={card.stats.atk.toLocaleString()} />
            <StatBox icon="🛡️" label="DEF"       value={card.stats.def.toLocaleString()} />
            <StatBox icon="❤️" label="HP"        value={card.stats.hp.toLocaleString()} />
            <StatBox icon="💧" label="MP-Kosten" value={String(card.stats.mpCost)} />
            {card.stats.spd  && <StatBox icon="⚡" label="SPD"  value={String(card.stats.spd)} />}
            {card.stats.crit && <StatBox icon="🎯" label="KRIT" value={`${card.stats.crit}%`} />}
          </div>

          {/* Typ + Element */}
          <div className="detail-tags">
            <span className="detail-tag detail-tag--type">{TYPE_LABEL[card.type]}</span>
            <span className="detail-tag detail-tag--element">{ELEMENT_LABEL[card.element]}</span>
          </div>

          <div className="detail-divider" style={{ borderColor: rarityColor }} />

          {/* Skill */}
          {card.skills.length > 0 && (
            <section className="detail-section">
              <h3 className="detail-section__title">⚡ Fähigkeit</h3>
              {card.skills.map((sk, i) => (
                <div key={i} className="detail-skill">
                  <div className="detail-skill__header">
                    <span className="detail-skill__name">{sk.name}</span>
                    <span className="detail-skill__cost">💧{sk.mpCost} MP</span>
                    {sk.cooldown && (
                      <span className="detail-skill__cd">⏱ {sk.cooldown}R</span>
                    )}
                  </div>
                  <p className="detail-skill__desc">{sk.description}</p>
                </div>
              ))}
            </section>
          )}

          {/* Passive */}
          {card.passives.length > 0 && (
            <section className="detail-section">
              <h3 className="detail-section__title">✦ Passiv</h3>
              {card.passives.map((pa, i) => (
                <div key={i} className="detail-passive">
                  <span className="detail-passive__name">{pa.name}</span>
                  <p className="detail-passive__desc">{pa.description}</p>
                </div>
              ))}
            </section>
          )}

          {/* Combo-Tags */}
          {card.combos.length > 0 && (
            <section className="detail-section">
              <h3 className="detail-section__title">🔗 Combo-Tags</h3>
              <div className="detail-combo-list">
                {card.combos.map((co, i) => (
                  <div key={i} className="detail-combo">
                    <span className="detail-combo__tag">[{co.tag}]</span>
                    <span className="detail-combo__desc">{co.description}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Synergien */}
          {card.synergies.length > 0 && (
            <section className="detail-section">
              <h3 className="detail-section__title">🤝 Synergien</h3>
              <div className="detail-synergy-list">
                {card.synergies.map((syn, i) => {
                  const partner = synergyCards.find(c => c.id === syn.cardId);
                  return (
                    <div key={i} className="detail-synergy">
                      <div className="detail-synergy__partner">
                        {partner ? (
                          <>
                            <div className="detail-synergy__avatar">
                              <img
                                src={partner.image}
                                alt={partner.name}
                                onError={e => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                            <span className="detail-synergy__name">{partner.name}</span>
                          </>
                        ) : (
                          <span className="detail-synergy__name">{syn.cardId}</span>
                        )}
                      </div>
                      <p className="detail-synergy__desc">{syn.description}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Zitat */}
          <blockquote className="detail-quote">
            „{card.quote}"
          </blockquote>

          {/* Kartenband */}
          <BondSection cardId={card.id} />

          {/* Ökonomie-Info */}
          <div className="detail-economy">
            {card.globalLimit && (
              <span className="detail-economy__item detail-economy__item--limited">
                🌐 Global limitiert: {card.globalLimit.toLocaleString()}×
              </span>
            )}
            <span className={`detail-economy__item ${card.tradeable ? '' : 'detail-economy__item--locked'}`}>
              {card.tradeable ? '🔄 Handelbar' : '🔒 Nicht handelbar'}
            </span>
            {card.awakening && (
              <span className="detail-economy__item detail-economy__item--awakening">
                ✦ True Awakening verfügbar
              </span>
            )}
          </div>

        </div>}
      </div>
    </div>,
    document.body,
  );
};

// ── Kartenband-Sektion ────────────────────────────────────────

const BondSection: React.FC<{ cardId: string }> = ({ cardId }) => {
  const bond = CardBondService.getCardBond(cardId);
  const pct  = CardBondService.progressToNext(bond) * 100;
  const nextThreshold = bond.level < MAX_BOND ? BOND_THRESHOLDS[bond.level + 1] : BOND_THRESHOLDS[MAX_BOND];
  const atkBonus = Math.round((CardBondService.getAtkMultiplier(cardId) - 1) * 100);

  return (
    <section className="detail-section detail-bond">
      <h3 className="detail-section__title">
        {BOND_ICONS[bond.level] || '◇'} Kartenband
        {atkBonus > 0 && <span className="detail-bond__atk"> +{atkBonus}% ATK</span>}
      </h3>
      <div className="detail-bond__level">{BOND_NAMES[bond.level] || 'Unbekannt'} (Stufe {bond.level}/{MAX_BOND})</div>
      <div className="detail-bond__bar-wrap">
        <div className="detail-bond__bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="detail-bond__info">
        {bond.battles} Kämpfe
        {bond.level < MAX_BOND && <> · Nächste Stufe bei {nextThreshold}</>}
      </div>
      <div className="detail-bond__stars">
        {Array.from({ length: MAX_BOND }).map((_, i) => (
          <span key={i} className={`detail-bond__star ${i < bond.level ? 'detail-bond__star--filled' : ''}`}>
            {i < bond.level ? BOND_ICONS[i + 1] : '◇'}
          </span>
        ))}
      </div>

      {/* Lore — unlocked at bond level 2 */}
      {CardLoreService.isUnlocked(bond.level) ? (
        <div className="detail-bond__lore">
          <div className="detail-bond__lore-title">📖 Verborgene Geschichte</div>
          <div className="detail-bond__lore-text">
            {CardLoreService.getLore(cardId) ?? CardLoreService.getFallback()}
          </div>
        </div>
      ) : (
        <div className="detail-bond__lore-locked">
          🔒 Geschichte enthüllt sich auf Bandstufe {CardLoreService.LORE_UNLOCK_BOND_LEVEL}
        </div>
      )}
    </section>
  );
};

// ── Hilfkomponente ────────────────────────────────────────────

interface StatBoxProps {
  icon:  string;
  label: string;
  value: string;
}

const StatBox: React.FC<StatBoxProps> = ({ icon, label, value }) => (
  <div className="stat-box">
    <span className="stat-box__icon">{icon}</span>
    <span className="stat-box__label">{label}</span>
    <span className="stat-box__value">{value}</span>
  </div>
);

export default CardDetailModal;
