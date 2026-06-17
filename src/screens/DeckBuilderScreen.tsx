import React, { useState, useMemo } from 'react';
import { useDeckStore } from '../hooks/useDeckStore';
import { DeckBuilder } from '../services/DeckBuilder';
import { CardDatabase } from '../services/CardDatabase';
import { FusionSystem } from '../services/FusionSystem';
import { FormationService } from '../services/FormationService';
import type { ResolvedSlot, Deck } from '../types/DeckTypes';
import type { CardInstance } from '../types/GachaTypes';
import { DECK_SIZE, MAX_DECK_COST } from '../types/DeckTypes';
import { RARITY_COLOR, RARITY_ORDER, RARITY_MAJORS, rarityMajor } from '../types/Card';
import type { Rarity } from '../types/Card';
import { AchievementService } from '../services/AchievementService';
import { CardMasteryService } from '../services/CardMasteryService';
import { CardBondService, BOND_ICONS, BOND_NAMES, BOND_ATK_BONUS } from '../services/CardBondService';
import { getBlessedElement, ELEMENT_LABELS, ELEMENT_COLORS } from '../services/DailyElementService';
import { DailyDuoService } from '../services/DailyDuoService';
import { getSurgeElement, msRemaining as surgeMs, SURGE_ELEMENT_NAMES, SURGE_ELEMENT_ICONS, SURGE_ELEMENT_COLORS } from '../services/HourSurgeService';
import { AudioService } from '../services/AudioService';
import './DeckBuilderScreen.css';

type SortKey = 'rarity' | 'name' | 'atk' | 'hp' | 'mp';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'rarity', label: 'Seltenheit' },
  { key: 'name',   label: 'Name' },
  { key: 'atk',    label: 'ATK' },
  { key: 'hp',     label: 'HP' },
  { key: 'mp',     label: 'MP' },
];

// ── Elemente ─────────────────────────────────────────────────

const ELEM_ICON: Record<string, string> = {
  fire: '🔥', ice: '❄️', water: '💧', lightning: '⚡', wind: '🌪️',
  earth: '🌿', light: '☀️', dark: '🌑', void: '🔮', death: '💀', chaos: '🔱',
};

// ── Fehlertext ────────────────────────────────────────────────

const RULE_LABEL: Record<string, string> = {
  DECK_FULL:       `Deck ist voll (max. ${DECK_SIZE} Karten)`,
  COST_EXCEEDED:   `Deck-Budget überschritten (max. ${MAX_DECK_COST} MP)`,
  ALREADY_IN_DECK: 'Diese Instanz ist bereits im Deck',
};

// Deck selection stays instance-based so duplicate owned cards remain visible.

function sortInventory(entries: CardInstance[], sort: SortKey): CardInstance[] {
  return [...entries].sort((a, b) => {
    const ca = CardDatabase.getById(a.cardId);
    const cb = CardDatabase.getById(b.cardId);
    switch (sort) {
      case 'rarity': {
        const r = RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
        return r !== 0 ? r : a.cardId.localeCompare(b.cardId);
      }
      case 'name': return (ca?.name ?? a.cardId).localeCompare(cb?.name ?? b.cardId, 'de');
      case 'atk':  return (cb?.stats.atk ?? 0) - (ca?.stats.atk ?? 0);
      case 'hp':   return (cb?.stats.hp  ?? 0) - (ca?.stats.hp  ?? 0);
      case 'mp':   return (ca?.stats.mpCost ?? 0) - (cb?.stats.mpCost ?? 0);
      default:     return 0;
    }
  });
}

// ── Haupt-Screen ──────────────────────────────────────────────

const DeckBuilderScreen: React.FC = () => {
  const store = useDeckStore();
  const { deck, resolved, validation, inventory, isDirty, addCard, removeCard, saveDeck, resetDeck } = store;

  const [renaming,     setRenaming]     = useState(false);
  const [nameInput,    setNameInput]    = useState(deck.name);
  const [toast,        setToast]        = useState<string | null>(null);
  const [rarityFilter, setRarityFilter] = useState<Rarity | ''>('');
  const [sortKey,      setSortKey]      = useState<SortKey>('rarity');

  const inventoryEntries = useMemo(() => {
    const filtered = rarityFilter === ''
      ? inventory
      : inventory.filter(e => rarityMajor(e.rarity) === rarityFilter);
    return sortInventory(filtered, sortKey);
  }, [inventory, rarityFilter, sortKey]);

  // Daily Duo
  const dailyDuo = useMemo(() => DailyDuoService.getDailyDuo(), []);
  const duoIds   = useMemo(() => dailyDuo ? new Set([dailyDuo[0].id, dailyDuo[1].id]) : new Set<string>(), [dailyDuo]);
  const deckCardIds = useMemo(() => deck.uuids.map(uuid => inventory.find(i => i.uuid === uuid)?.cardId ?? ''), [deck.uuids, inventory]);
  const duoInDeck   = dailyDuo
    ? (deckCardIds.includes(dailyDuo[0].id) ? 1 : 0) + (deckCardIds.includes(dailyDuo[1].id) ? 1 : 0)
    : 0;

  // Deck total ATK power (effective stats incl. level + mastery)
  const deckPower = useMemo(() => {
    const invMap = new Map(inventory.map(i => [i.uuid, i]));
    return deck.uuids.reduce((sum, uuid) => {
      const inst = invMap.get(uuid);
      if (!inst) return sum;
      const card = CardDatabase.getById(inst.cardId);
      if (!card) return sum;
      const stats = FusionSystem.getEffectiveStats(card, inst.rarity, inst.level);
      return sum + stats.atk + CardMasteryService.getAtkBonus(inst.cardId);
    }, 0);
  }, [deck.uuids, inventory]);

  // Weakest card in deck by effective ATK (only if deck has 3+ cards)
  const weakestCard = useMemo(() => {
    if (deck.uuids.length < 3) return null;
    const invMap = new Map(inventory.map(i => [i.uuid, i]));
    let weakest: { name: string; atk: number; uuid: string } | null = null;
    for (const uuid of deck.uuids) {
      const inst = invMap.get(uuid);
      if (!inst) continue;
      const card = CardDatabase.getById(inst.cardId);
      if (!card) continue;
      const stats = FusionSystem.getEffectiveStats(card, inst.rarity, inst.level);
      const atk = stats.atk + CardMasteryService.getAtkBonus(inst.cardId);
      if (!weakest || atk < weakest.atk) weakest = { name: card.name, atk, uuid };
    }
    return weakest;
  }, [deck.uuids, inventory]);

  // Element distribution of current deck
  const deckElementDist = useMemo(() => {
    const invMap = new Map(inventory.map(i => [i.uuid, i]));
    const counts: Record<string, number> = {};
    for (const uuid of deck.uuids) {
      const inst = invMap.get(uuid);
      const card = inst ? CardDatabase.getById(inst.cardId) : null;
      if (!card?.element) continue;
      counts[card.element] = (counts[card.element] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [deck.uuids, inventory]);

  // Formation bonuses from current deck (tag-based synergies)
  const formationResult = useMemo(() => {
    const invMap = new Map(inventory.map(i => [i.uuid, i]));
    const deckCards = deck.uuids
      .map(uuid => invMap.get(uuid))
      .filter((inst): inst is CardInstance => inst !== undefined)
      .map(inst => CardDatabase.getById(inst.cardId))
      .filter((card): card is NonNullable<typeof card> => card !== null);
    return FormationService.compute(deckCards);
  }, [deck.uuids, inventory]);

  // Daily Blessing integration
  const blessedElement = useMemo(() => getBlessedElement(), []);
  const blessedLabel   = ELEMENT_LABELS[blessedElement] ?? blessedElement;
  const blessedColor   = ELEMENT_COLORS[blessedElement] ?? '#888888';
  const blessingCount  = useMemo(() => {
    const invMap = new Map(inventory.map(i => [i.uuid, i]));
    return deck.uuids.filter(uuid => {
      const inst = invMap.get(uuid);
      return inst ? CardDatabase.getById(inst.cardId)?.element === blessedElement : false;
    }).length;
  }, [deck.uuids, inventory, blessedElement]);

  // Hour Surge integration
  const surgeElement = useMemo(() => getSurgeElement(), []);
  const surgeColor   = SURGE_ELEMENT_COLORS[surgeElement] ?? '#888';
  const surgeIcon    = SURGE_ELEMENT_ICONS[surgeElement] ?? '⚡';
  const surgeName    = SURGE_ELEMENT_NAMES[surgeElement] ?? surgeElement;
  const surgeMinutes = Math.ceil(surgeMs() / 60000);
  const surgeCount   = useMemo(() => {
    const invMap = new Map(inventory.map(i => [i.uuid, i]));
    return deck.uuids.filter(uuid => {
      const inst = invMap.get(uuid);
      return inst ? CardDatabase.getById(inst.cardId)?.element === surgeElement : false;
    }).length;
  }, [deck.uuids, inventory, surgeElement]);

  // Near-formations: tags that need 1-2 more cards to activate (count === 2)
  const nearFormations = useMemo(() => {
    const invMap = new Map(inventory.map(i => [i.uuid, i]));
    const deckCards = deck.uuids
      .map(uuid => invMap.get(uuid))
      .filter((inst): inst is CardInstance => inst !== undefined)
      .map(inst => CardDatabase.getById(inst.cardId))
      .filter((card): card is NonNullable<typeof card> => card !== null);
    const tagCounts = new Map<string, number>();
    const tagLabels = new Map<string, string>();
    for (const card of deckCards) {
      const seen = new Set<string>();
      for (const combo of card.combos ?? []) {
        if (seen.has(combo.tag)) continue;
        seen.add(combo.tag);
        tagCounts.set(combo.tag, (tagCounts.get(combo.tag) ?? 0) + 1);
        tagLabels.set(combo.tag, combo.tag);
      }
    }
    // Return tags with exactly 2 cards (1 more needed to activate +15% bonus)
    return Array.from(tagCounts.entries())
      .filter(([, count]) => count === 2)
      .map(([tag]) => tag);
  }, [deck.uuids, inventory]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  function handleAutoOptimize() {
    // Rank all inventory cards by (effective ATK + mastery bonus), pick top DECK_SIZE unique
    const scored = inventory.map(inst => {
      const card = CardDatabase.getById(inst.cardId);
      if (!card) return { inst, score: 0 };
      const stats = FusionSystem.getEffectiveStats(card, inst.rarity, inst.level);
      return { inst, score: stats.atk + CardMasteryService.getAtkBonus(inst.cardId) };
    }).sort((a, b) => b.score - a.score);

    resetDeck();
    let added = 0;
    for (const { inst } of scored) {
      if (added >= DECK_SIZE) break;
      const ok = addCard(inst.uuid, inst.cardId, inst.rarity);
      if (ok) added++;
    }
    showToast(`⚡ Optimiert: ${added} stärkste Karten ausgewählt`);
  }

  function handleAddCard(uuid: string, cardId: string, rarity: Rarity) {
    const ok = addCard(uuid, cardId, rarity);
    if (!ok) {
      const preview = DeckBuilder.previewAdd(uuid, cardId, rarity, deck, inventory);
      showToast(RULE_LABEL[preview.reason ?? 'DECK_FULL']);
    } else {
      AudioService.tap();
    }
  }

  function handleSave() {
    saveDeck();
    AudioService.synergy();
    AudioService.vibrate([15, 20, 25]);
    showToast('✓ Deck gespeichert');
    if (deck.uuids.length >= DECK_SIZE) AchievementService.recordProgress('deck_complete');
  }

  function handleRename() {
    if (renaming && nameInput.trim()) {
      store.renameDeck(nameInput.trim());
    }
    setRenaming(v => !v);
  }

  return (
    <div className="deckbuilder">

      {/* Toast */}
      {toast && <div className="db-toast">{toast}</div>}

      {/* ── Header ── */}
      <div className="db-header">
        <div className="db-header__left">
          {renaming ? (
            <input
              className="db-name-input"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={handleRename}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              autoFocus
              maxLength={24}
            />
          ) : (
            <button className="db-name-btn" onClick={handleRename}>
              <span className="db-header__title">{deck.name}</span>
              <span className="db-name-edit">✎</span>
            </button>
          )}
        </div>
        <div className="db-header__right">
          <button
            className="db-optimize-btn"
            onClick={handleAutoOptimize}
            title="Deck automatisch mit stärksten Karten füllen"
          >
            ⚡ Best
          </button>
          <button
            className={`db-save-btn ${isDirty ? 'db-save-btn--dirty' : ''}`}
            onClick={handleSave}
          >
            {isDirty ? '● Speichern' : '✓ Gespeichert'}
          </button>
          <button className="db-reset-btn" onClick={() => { resetDeck(); showToast('Deck geleert'); }}>
            ✕
          </button>
        </div>
      </div>

      {/* ── Validation-Banner ── */}
      <ValidationBanner validation={validation} />

      {/* ── Deck-Slots ── */}
      <div className="db-slots-section">
        <div className="db-slots-header">
          <span className="db-slots-label">DECK</span>
          <span className="db-slots-count">{deck.uuids.length} / {DECK_SIZE}</span>
          {deckPower > 0 && (
            <span className="db-power-chip">⚔ {deckPower.toLocaleString('de-DE')}</span>
          )}
          <span className={`db-mp-total ${validation.isOverBudget ? 'db-mp-total--over' : ''}`}>
            💧 {validation.totalMP} / {MAX_DECK_COST} MP
          </span>
        </div>
        {/* Daily Element Blessing indicator */}
        <div
          className={`db-blessing-bar${blessingCount >= 3 ? ' db-blessing-bar--synergy' : blessingCount >= 1 ? ' db-blessing-bar--active' : ''}`}
          style={{ '--bless-color': blessedColor } as React.CSSProperties}
        >
          <span className="db-blessing-bar__icon">{blessedLabel.split(' ')[0]}</span>
          <span className="db-blessing-bar__label">
            TAGESSEGEN: {blessedLabel.split(' ').slice(1).join(' ')}
          </span>
          <span className="db-blessing-bar__count">
            {blessingCount >= 3
              ? `✦ SYNERGIE! +${(blessingCount - 2) * 100} 💎`
              : blessingCount >= 1
                ? `${blessingCount}/3 → Synergie-Bonus`
                : `0/3 · +100 💎/Karte ab 3`}
          </span>
        </div>

        {/* Hour Surge indicator */}
        <div
          className={`db-surge-bar${surgeCount >= 1 ? ' db-surge-bar--active' : ''}`}
          style={{ '--surge-color': surgeColor } as React.CSSProperties}
        >
          <span className="db-surge-bar__icon">{surgeIcon}</span>
          <span className="db-surge-bar__label">SURGE: {surgeName.toUpperCase()}</span>
          <span className="db-surge-bar__count">
            {surgeCount >= 1
              ? `${surgeCount}× → +50% 💎 aktiv!`
              : `0 Karten · Tausche für +50% 💎`}
          </span>
          <span className="db-surge-bar__timer">{surgeMinutes}min</span>
        </div>

        {/* Element distribution */}
        {deckElementDist.length > 0 && (
          <div className="db-elem-dist">
            {deckElementDist.map(([elem, count]) => (
              <span
                key={elem}
                className={`db-elem-chip${count >= 3 ? ' db-elem-chip--active' : count === 2 ? ' db-elem-chip--near' : ''}${elem === blessedElement ? ' db-elem-chip--blessed' : ''}`}
              >
                {ELEM_ICON[elem] ?? '◆'}{elem} ×{count}
                {count >= 3 && <span className="db-elem-chip__bonus">✦</span>}
                {count === 2 && <span className="db-elem-chip__need">+1!</span>}
                {elem === blessedElement && <span className="db-elem-chip__bless">☀</span>}
              </span>
            ))}
          </div>
        )}

        {/* Formation bonuses */}
        {(formationResult.bonuses.length > 0 || nearFormations.length > 0) && (
          <div className="db-formations">
            {formationResult.bonuses.length > 0 && (
              <div className="db-formations__active">
                {formationResult.bonuses.map(b => (
                  <span key={b.tag} className="db-formation-chip db-formation-chip--active">
                    ⚡ {b.label} ×{b.count} → +{Math.round(b.damageBoost * 100)}% ATK
                  </span>
                ))}
              </div>
            )}
            {nearFormations.length > 0 && formationResult.bonuses.length === 0 && (
              <div className="db-formations__near">
                {nearFormations.slice(0, 2).map(tag => (
                  <span key={tag} className="db-formation-chip db-formation-chip--near">
                    ◐ {tag}-Formation +1 → +15% ATK
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="db-slots-row">
          {/* Belegte Slots */}
          {resolved.map(slot => (
            <DeckSlot key={slot.uuid} slot={slot} onRemove={removeCard} />
          ))}
          {/* Leere Slots */}
          {Array.from({ length: DECK_SIZE - resolved.length }).map((_, i) => (
            <div key={`empty-${i}`} className="db-slot db-slot--empty">
              <span className="db-slot__empty-icon">+</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Daily Duo Chip ── */}
      {dailyDuo && (
        <div className={`db-duo-chip${duoInDeck >= 2 ? ' db-duo-chip--active' : ''}`}>
          <span className="db-duo-chip__icon">💞</span>
          <div className="db-duo-chip__body">
            <span className="db-duo-chip__title">TAGES-DUO</span>
            <span className="db-duo-chip__cards">
              <span className={deckCardIds.includes(dailyDuo[0].id) ? 'db-duo-chip__card--in' : 'db-duo-chip__card--out'}>
                {deckCardIds.includes(dailyDuo[0].id) ? '✓' : '○'} {dailyDuo[0].name}
              </span>
              {' + '}
              <span className={deckCardIds.includes(dailyDuo[1].id) ? 'db-duo-chip__card--in' : 'db-duo-chip__card--out'}>
                {deckCardIds.includes(dailyDuo[1].id) ? '✓' : '○'} {dailyDuo[1].name}
              </span>
            </span>
          </div>
          <span className="db-duo-chip__reward">
            {duoInDeck >= 2 ? '✓ +100 💎/Sieg' : `${duoInDeck}/2 · +100 💎`}
          </span>
        </div>
      )}

      {/* ── Deck-Tipp: Schwächste Karte ── */}
      {weakestCard && (
        <div className="db-weak-hint">
          <span className="db-weak-hint__icon">⚠</span>
          <span className="db-weak-hint__text">
            Schwächste Karte: <strong>{weakestCard.name}</strong>
            <span className="db-weak-hint__atk"> · ⚔ {weakestCard.atk.toLocaleString('de-DE')}</span>
            <span className="db-weak-hint__sub"> — ersetzen oder trainieren?</span>
          </span>
        </div>
      )}

      {/* ── Inventar ── */}
      <div className="db-inventory-section">
        <div className="db-inventory-header">
          <span className="db-slots-label">INVENTAR</span>
          <span className="db-slots-count">{inventoryEntries.length} Karten</span>
          {(() => {
            const uniqueOwned = new Set(inventory.map(i => i.cardId)).size;
            const total = CardDatabase.count();
            const pct = total > 0 ? Math.round((uniqueOwned / total) * 100) : 0;
            return (
              <span className="db-collection-pct" title={`${uniqueOwned} von ${total} einzigartigen Karten`}>
                📚 {uniqueOwned}/{total} ({pct}%)
              </span>
            );
          })()}
        </div>

        {/* Seltenheits-Filter */}
        <div className="db-filter">
          <button
            className={`db-filter__chip ${rarityFilter === '' ? 'db-filter__chip--active' : ''}`}
            onClick={() => setRarityFilter('')}
          >
            Alle
          </button>
          {RARITY_MAJORS.map(r => (
            <button
              key={r}
              className={`db-filter__chip ${rarityFilter === r ? 'db-filter__chip--active' : ''}`}
              style={rarityFilter === r ? { color: RARITY_COLOR[r], borderColor: RARITY_COLOR[r] } : undefined}
              onClick={() => setRarityFilter(r)}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Sortierung */}
        <div className="db-filter db-filter--sort">
          {SORT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              className={`db-filter__chip ${sortKey === key ? 'db-filter__chip--active' : ''}`}
              onClick={() => setSortKey(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {inventory.length === 0 ? (
          <EmptyInventory />
        ) : inventoryEntries.length === 0 ? (
          <div className="db-empty">
            <span className="db-empty__icon">🔍</span>
            <p className="db-empty__text">Keine Karten in dieser Seltenheitsstufe.</p>
          </div>
        ) : (
          <div className="db-inventory-grid">
            {inventoryEntries.map(entry => (
              <InventoryCard
                key={entry.uuid}
                instance={entry}
                deck={deck}
                inventory={inventory}
                onAdd={handleAddCard}
                isDuo={duoIds.has(entry.cardId)}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

// ── Validation-Banner ─────────────────────────────────────────

interface ValidationBannerProps {
  validation: ReturnType<typeof DeckBuilder.validateDeck>;
}

const ValidationBanner: React.FC<ValidationBannerProps> = ({ validation }) => {
  if (validation.isValid) {
    return (
      <div className="db-banner db-banner--ok">
        ✓ Deck vollständig und regelkonform
      </div>
    );
  }

  const msgs: string[] = [];
  if (!validation.isComplete) {
    msgs.push(`Deck unvollständig (${DECK_SIZE} Karten benötigt)`);
  }
  if (validation.missingCount > 0) {
    msgs.push(`${validation.missingCount} Karte(n) nicht im Inventar`);
  }
  validation.errors.forEach(e => msgs.push(RULE_LABEL[e] ?? e));

  return (
    <div className="db-banner db-banner--warn">
      {msgs.length > 0 ? msgs.join(' · ') : 'Deck unvollständig'}
    </div>
  );
};

// ── Deck-Slot ─────────────────────────────────────────────────

interface DeckSlotProps {
  slot:     ResolvedSlot;
  onRemove: (uuid: string) => void;
}

const DeckSlot: React.FC<DeckSlotProps> = ({ slot, onRemove }) => {
  const [imgErr, setImgErr] = useState(false);
  const rc = RARITY_COLOR[slot.instance?.rarity ?? 'N'] ?? '#9e9e9e';

  // Bond data for this card
  const bondData = slot.instance ? CardBondService.getCardBond(slot.instance.cardId) : null;
  const bondPct  = bondData ? CardBondService.progressToNext(bondData) : 0;
  const hasBond  = bondData !== null && bondData.level > 0;
  const bondAtk  = hasBond ? BOND_ATK_BONUS[bondData.level] ?? 0 : 0;

  if (slot.missing) {
    return (
      <div className="db-slot db-slot--missing" onClick={() => onRemove(slot.uuid)}>
        <span className="db-slot__missing-icon">⚠</span>
        <span className="db-slot__missing-text">Fehlt</span>
      </div>
    );
  }

  return (
    <div
      className={`db-slot${hasBond ? ' db-slot--bonded' : ''}`}
      style={{ '--rc': rc } as React.CSSProperties}
      onClick={() => onRemove(slot.uuid)}
      title={`${slot.card?.name ?? slot.instance?.cardId} — Tippen zum Entfernen`}
    >
      {slot.card && !imgErr ? (
        <img
          className="db-slot__art"
          src={slot.card.image}
          alt={slot.card.name}
          onError={() => setImgErr(true)}
        />
      ) : (
        <div className="db-slot__placeholder">🌑</div>
      )}
      <div className="db-slot__gradient" />
      {/* Bond level indicator */}
      {bondData && (bondData.level > 0 || bondData.battles > 0) && (
        <div className="db-slot__bond" title={`Bond: ${BOND_NAMES[bondData.level] || 'Keines'} (${bondData.battles} Kämpfe)`}>
          <span className="db-slot__bond-icon">{BOND_ICONS[bondData.level] || '○'}</span>
          {hasBond && <span className="db-slot__bond-atk">+{Math.round(bondAtk * 100)}%</span>}
          <div className="db-slot__bond-bar">
            <div className="db-slot__bond-fill" style={{ width: `${Math.round(bondPct * 100)}%` }} />
          </div>
        </div>
      )}
      <div className="db-slot__footer">
        <span className="db-slot__rarity" style={{ color: rc }}>
          {slot.instance?.rarity}
        </span>
        <span className="db-slot__name">{slot.card?.name ?? '???'}</span>
        <span className="db-slot__mp">💧{slot.card?.stats.mpCost ?? '?'}</span>
      </div>
      <div className="db-slot__remove">✕</div>
    </div>
  );
};

// ── Inventar-Karte ────────────────────────────────────────────

interface InventoryCardProps {
  instance:  CardInstance;
  deck:      Deck;
  inventory: CardInstance[];
  onAdd:     (uuid: string, cardId: string, rarity: Rarity) => void;
  isDuo?:    boolean;
}

const InventoryCard: React.FC<InventoryCardProps> = ({
  instance, deck, inventory, onAdd, isDuo,
}) => {
  const [imgErr, setImgErr] = useState(false);
  const card    = CardDatabase.getById(instance.cardId);
  const rc      = RARITY_COLOR[instance.rarity] ?? '#9e9e9e';
  const inDeck  = deck.uuids.includes(instance.uuid);
  const mastery = CardMasteryService.getMasteryInfo(instance.cardId);
  const effStats = card ? FusionSystem.getEffectiveStats(card, instance.rarity, instance.level) : null;
  const effAtk   = effStats ? effStats.atk + CardMasteryService.getAtkBonus(instance.cardId) : null;

  let addBlocked = false;
  let blockTip   = '';
  if (!inDeck) {
    const preview = DeckBuilder.previewAdd(instance.uuid, instance.cardId, instance.rarity as Rarity, deck, inventory);
    if (preview.blocked) {
      addBlocked = true;
      blockTip   = RULE_LABEL[preview.reason ?? 'DECK_FULL'];
    }
  }

  const clickable = !inDeck && !addBlocked;

  const majorRarity = instance.rarity.replace(/\+/g, '');
  const shimmerClass = majorRarity === 'LR' ? 'inv-card--lr-shimmer'
    : majorRarity === 'MR'  ? 'inv-card--mr-shimmer'
    : majorRarity === 'SSR' ? 'inv-card--ssr-shimmer'
    : '';

  return (
    <div
      className={`inv-card ${inDeck ? 'inv-card--in-deck' : addBlocked ? 'inv-card--blocked' : 'inv-card--available'} ${shimmerClass}`}
      style={{ '--rc': rc } as React.CSSProperties}
      onClick={clickable ? () => onAdd(instance.uuid, instance.cardId, instance.rarity as Rarity) : undefined}
    >
      <div className="inv-card__img-wrap">
        {card && !imgErr ? (
          <img
            className="inv-card__img"
            src={card.image}
            alt={card.name}
            onError={() => setImgErr(true)}
            loading="lazy"
          />
        ) : (
          <div className="inv-card__fallback">🌑</div>
        )}
        <div className="inv-card__rarity" style={{ color: rc }}>{instance.rarity}</div>
        {card?.element && (
          <div className="inv-card__element" title={card.element}>
            {ELEM_ICON[card.element] ?? '◆'}
          </div>
        )}
        {mastery.level > 0 && (
          <div className="inv-card__mastery" title={`Meisterschaft Stufe ${mastery.level} · +${mastery.atkBonus} ATK`}>
            {'★'.repeat(mastery.level)}
          </div>
        )}
        {isDuo && <div className="inv-card__duo-badge">💞 DUO</div>}
        {inDeck && <div className="inv-card__in-deck-badge">Im Deck</div>}
        {addBlocked && (
          <div className="inv-card__block-overlay">
            <span>{blockTip}</span>
          </div>
        )}
      </div>
      <div className="inv-card__info">
        <div className="inv-card__name">{card?.name ?? instance.cardId}</div>
        <div className="inv-card__sub">Lv.{instance.level ?? 1} · 💧{card?.stats.mpCost ?? '?'}</div>
        {effAtk !== null && (
          <div className="inv-card__atk">⚔ {effAtk.toLocaleString('de-DE')}</div>
        )}
      </div>
    </div>
  );
};

// ── Leeres Inventar ───────────────────────────────────────────

const EmptyInventory: React.FC = () => (
  <div className="db-empty">
    <span className="db-empty__icon">🔮</span>
    <p className="db-empty__text">Noch keine Karten im Inventar.</p>
    <p className="db-empty__hint">Besuche den Beschwörungsbereich um Karten zu ziehen.</p>
  </div>
);

export default DeckBuilderScreen;
