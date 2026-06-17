import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { SaveService } from '../services/SaveService';
import { CardDatabase } from '../services/CardDatabase';
import { ExpeditionService, type ActiveExpedition, type ExpeditionDef } from '../services/ExpeditionService';
import { QuestService } from '../services/QuestService';
import { AchievementService } from '../services/AchievementService';
import { AudioService } from '../services/AudioService';
import { RARITY_COLOR } from '../types/Card';
import './ExpeditionScreen.css';

interface Props {
  onBack: () => void;
}

const ExpeditionScreen: React.FC<Props> = ({ onBack }) => {
  const [active,      setActive]      = useState<ActiveExpedition[]>(() => ExpeditionService.getActive());
  const [toast,       setToast]       = useState<string | null>(null);
  const [selectedExp, setSelectedExp] = useState<ExpeditionDef | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [tick,        setTick]        = useState(0);
  const [expeditionBurst, setExpeditionBurst] = useState<{
    cardName: string; crystals: number; potions: number; crystalCards: number;
  } | null>(null);

  // 1-second tick for countdown updates
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const inventory = useMemo(() => SaveService.loadGachaState().inventory, []);
  const expeditionedUuids = useMemo(() => ExpeditionService.getExpeditionedCardUuids(), [active]);

  // Cards not on expedition, sorted by rarity
  const availableCards = useMemo(() => {
    const rarityOrder = ['LR', 'MR', 'SSR', 'SR', 'R', 'N'];
    return inventory
      .filter(inst => !expeditionedUuids.has(inst.uuid))
      .sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity));
  }, [inventory, expeditionedUuids]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleCollect = (exp: ActiveExpedition) => {
    const reward = ExpeditionService.collectReward(exp.cardUuid);
    if (!reward) return;
    const parts = [`💎 +${reward.crystals.toLocaleString('de-DE')}`];
    if (reward.potions > 0) parts.push(`🧪 +${reward.potions}`);
    if (reward.crystalCards > 0) parts.push(`💎Karte +${reward.crystalCards}`);
    showToast(`${exp.cardName} kehrt zurück! ${parts.join(' · ')}`);
    AudioService.reward();
    AudioService.vibrate([15, 20, 30]);
    setExpeditionBurst({ cardName: exp.cardName, crystals: reward.crystals, potions: reward.potions, crystalCards: reward.crystalCards });
    setTimeout(() => setExpeditionBurst(null), 2200);
    QuestService.recordEvent('complete_expedition');
    AchievementService.recordProgress('expedition_first');
    AchievementService.recordProgress('expedition_master');
    setActive(ExpeditionService.getActive());
  };

  const handleStart = () => {
    if (!selectedExp || !selectedCard) return;
    const inst = inventory.find(i => i.uuid === selectedCard);
    if (!inst) return;
    const card = CardDatabase.getById(inst.cardId);
    const ok = ExpeditionService.startExpedition(
      selectedExp.id,
      inst.uuid,
      inst.cardId,
      card?.name ?? inst.cardId,
    );
    if (!ok) { showToast('Expedition konnte nicht gestartet werden.'); return; }
    showToast(`${card?.name ?? inst.cardId} wurde auf Expedition geschickt!`);
    setActive(ExpeditionService.getActive());
    setSelectedExp(null);
    setSelectedCard(null);
  };

  // Quick-fill: auto-send best available cards to all empty expedition slots
  const handleQuickFill = useCallback(() => {
    const rarityOrder = ['LR', 'MR', 'SSR', 'SR', 'R', 'N'];
    // Pick the highest-reward expedition def (most crystals)
    const bestDef = [...ExpeditionService.EXPEDITION_DEFS].sort(
      (a, b) => b.rewards.crystalsMax - a.rewards.crystalsMax,
    )[0];
    if (!bestDef) return;

    let filled = 0;
    const usedUuids = new Set(ExpeditionService.getExpeditionedCardUuids());
    const sorted = [...inventory]
      .filter(i => !usedUuids.has(i.uuid))
      .sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity));

    for (const inst of sorted) {
      if (ExpeditionService.getActive().length >= ExpeditionService.MAX_EXPEDITIONS) break;
      const card = CardDatabase.getById(inst.cardId);
      const ok = ExpeditionService.startExpedition(
        bestDef.id, inst.uuid, inst.cardId, card?.name ?? inst.cardId,
      );
      if (ok) {
        usedUuids.add(inst.uuid);
        filled++;
      }
    }

    if (filled > 0) {
      showToast(`⚡ ${filled} Expedition${filled > 1 ? 'en' : ''} gestartet!`);
      setActive(ExpeditionService.getActive());
    } else {
      showToast('Keine Karten verfügbar.');
    }
  }, [inventory, showToast]);

  const slotsUsed = active.length;

  const pendingCrystals = useMemo(() => {
    return active.reduce((sum, exp) => {
      const def = ExpeditionService.EXPEDITION_DEFS.find(d => d.id === exp.expeditionId);
      if (!def) return sum;
      return sum + Math.round((def.rewards.crystalsMin + def.rewards.crystalsMax) / 2);
    }, 0);
  }, [active]);

  return (
    <div className="exp-screen">
      {toast && <div className="exp-toast">{toast}</div>}

      {expeditionBurst && (
        <div className="exp-return-burst" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className={`exp-return-particle exp-return-particle--${i % 5}`} style={{ '--i': i } as React.CSSProperties} />
          ))}
          <div className="exp-return-burst__inner">
            <div className="exp-return-burst__icon">⚔</div>
            <div className="exp-return-burst__hero">{expeditionBurst.cardName}</div>
            <div className="exp-return-burst__label">ZURÜCKGEKEHRT!</div>
            <div className="exp-return-burst__rewards">
              💎 +{expeditionBurst.crystals.toLocaleString('de-DE')}
              {expeditionBurst.potions > 0 && ` · 🧪 +${expeditionBurst.potions}`}
              {expeditionBurst.crystalCards > 0 && ` · 💎Karte`}
            </div>
          </div>
        </div>
      )}

      <div className="exp-header">
        <button className="exp-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="exp-header__title">⚔ Expeditionen</h1>
        <span className="exp-header__slots">{slotsUsed}/{ExpeditionService.MAX_EXPEDITIONS}</span>
        {slotsUsed < ExpeditionService.MAX_EXPEDITIONS && availableCards.length > 0 && (
          <button className="exp-quickfill-btn" onClick={handleQuickFill} title="Alle freien Slots automatisch füllen">
            ⚡ Auto
          </button>
        )}
      </div>

      <div className="exp-scroll">

        {/* Active expeditions */}
        {active.length > 0 && (
          <section className="exp-section">
            <h2 className="exp-section__title">Aktive Expeditionen</h2>
            {pendingCrystals > 0 && (
              <div className="exp-pending-chip">
                <span className="exp-pending-chip__icon">💎</span>
                <span className="exp-pending-chip__text">
                  ~{pendingCrystals.toLocaleString('de-DE')} Kristalle unterwegs
                </span>
                {active.filter(e => Date.now() >= e.endsAt).length > 0 && (
                  <span className="exp-pending-chip__ready">
                    · {active.filter(e => Date.now() >= e.endsAt).length} bereit!
                  </span>
                )}
              </div>
            )}
            {active.map(exp => {
              const def  = ExpeditionService.EXPEDITION_DEFS.find(d => d.id === exp.expeditionId);
              const done = Date.now() >= exp.endsAt;
              const soon = !done && exp.endsAt - Date.now() < 15 * 60 * 1000;
              const card = CardDatabase.getById(exp.cardId);
              const rc   = card ? (RARITY_COLOR[card.rarity as keyof typeof RARITY_COLOR] ?? '#c9a84c') : '#c9a84c';
              return (
                <div key={exp.cardUuid} className={`exp-active-card ${done ? 'exp-active-card--done' : soon ? 'exp-active-card--soon' : ''}`}>
                  <div className="exp-active-card__icon">{def?.icon ?? '⚔'}</div>
                  <div className="exp-active-card__info">
                    <div className="exp-active-card__name" style={{ color: rc }}>{exp.cardName}</div>
                    <div className="exp-active-card__dest">{def?.name ?? exp.expeditionId}</div>
                    {def && (
                      <div className="exp-active-card__progress-track">
                        <div
                          className={`exp-active-card__progress-fill${done ? ' exp-active-card__progress-fill--done' : ''}`}
                          style={{ width: `${Math.min(100, ((Date.now() - exp.startedAt) / def.durationMs) * 100)}%` }}
                        />
                      </div>
                    )}
                    <div className={`exp-active-card__time ${done ? 'exp-active-card__time--done' : ''}`}>
                      {/* tick forces re-render every second */}
                      {tick >= 0 && ExpeditionService.formatTimeLeft(exp.endsAt)}
                    </div>
                  </div>
                  {done ? (
                    <button className="exp-collect-btn" onClick={() => handleCollect(exp)}>
                      Sammeln!
                    </button>
                  ) : (
                    <button
                      className="exp-cancel-btn"
                      onClick={() => {
                        ExpeditionService.cancelExpedition(exp.cardUuid);
                        setActive(ExpeditionService.getActive());
                      }}
                    >
                      Abbruch
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* New expedition: choose type */}
        {slotsUsed < ExpeditionService.MAX_EXPEDITIONS && (
          <section className="exp-section">
            <h2 className="exp-section__title">Neue Expedition senden</h2>

            <div className="exp-defs">
              {ExpeditionService.EXPEDITION_DEFS.map(def => {
                const hours = def.durationMs / 3_600_000;
                const isSelected = selectedExp?.id === def.id;
                return (
                  <button
                    key={def.id}
                    className={`exp-def-card ${isSelected ? 'exp-def-card--selected' : ''}`}
                    onClick={() => setSelectedExp(isSelected ? null : def)}
                  >
                    <span className="exp-def-card__icon">{def.icon}</span>
                    <div className="exp-def-card__info">
                      <div className="exp-def-card__name">{def.name}</div>
                      <div className="exp-def-card__desc">{def.description}</div>
                      <div className="exp-def-card__rewards">
                        💎 {def.rewards.crystalsMin}–{def.rewards.crystalsMax}
                        {def.rewards.potionChance && ' · 🧪'}
                        {def.rewards.crystalCardChance && ' · 💎Karte'}
                      </div>
                    </div>
                    <div className="exp-def-card__duration">{hours}h</div>
                  </button>
                );
              })}
            </div>

            {/* Select card for expedition */}
            {selectedExp && (
              <>
                <h3 className="exp-card-select-title">Karte auswählen</h3>
                {availableCards.length === 0 && (
                  <div className="exp-no-cards">Keine verfügbaren Karten (alle auf Expedition).</div>
                )}
                <div className="exp-card-grid">
                  {availableCards.slice(0, 20).map(inst => {
                    const card = CardDatabase.getById(inst.cardId);
                    const rc   = RARITY_COLOR[inst.rarity as keyof typeof RARITY_COLOR] ?? '#9e9e9e';
                    const isOk = !selectedExp.requiredRarity ||
                      selectedExp.requiredRarity.some(r => inst.rarity.startsWith(r));
                    const isSelected = selectedCard === inst.uuid;
                    return (
                      <button
                        key={inst.uuid}
                        className={`exp-card-chip
                          ${isSelected ? 'exp-card-chip--selected' : ''}
                          ${!isOk ? 'exp-card-chip--disabled' : ''}
                        `}
                        disabled={!isOk}
                        onClick={() => setSelectedCard(isSelected ? null : inst.uuid)}
                        style={{ '--rc': rc } as React.CSSProperties}
                      >
                        {card?.image ? (
                          <img className="exp-card-chip__img" src={card.image} alt={card.name} />
                        ) : (
                          <span className="exp-card-chip__placeholder">🌑</span>
                        )}
                        <span className="exp-card-chip__rarity" style={{ color: rc }}>{inst.rarity}</span>
                        <span className="exp-card-chip__name">{card?.name ?? inst.cardId}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  className={`exp-start-btn ${(!selectedCard) ? 'exp-start-btn--disabled' : ''}`}
                  disabled={!selectedCard}
                  onClick={handleStart}
                >
                  ⚔ Expedition starten
                </button>
              </>
            )}
          </section>
        )}

        {slotsUsed >= ExpeditionService.MAX_EXPEDITIONS && (
          <div className="exp-full">
            Alle {ExpeditionService.MAX_EXPEDITIONS} Expeditionsplätze belegt. Warte auf Rückkehr.
          </div>
        )}

      </div>
    </div>
  );
};

export default ExpeditionScreen;
