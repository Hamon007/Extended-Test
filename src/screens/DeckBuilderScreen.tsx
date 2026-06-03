import React, { useState, useMemo } from 'react';
import { useDeckStore } from '../hooks/useDeckStore';
import { DeckBuilder } from '../services/DeckBuilder';
import { CardDatabase } from '../services/CardDatabase';
import type { ResolvedSlot, Deck } from '../types/DeckTypes';
import type { CardInstance } from '../types/GachaTypes';
import { DECK_SIZE, MAX_DECK_COST } from '../types/DeckTypes';
import { RARITY_COLOR, RARITY_ORDER, RARITY_MAJORS, rarityMajor } from '../types/Card';
import type { Rarity } from '../types/Card';
import { AchievementService } from '../services/AchievementService';
import { CardMasteryService } from '../services/CardMasteryService';
import './DeckBuilderScreen.css';

type SortKey = 'rarity' | 'name' | 'atk' | 'hp' | 'mp';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'rarity', label: 'Seltenheit' },
  { key: 'name',   label: 'Name' },
  { key: 'atk',    label: 'ATK' },
  { key: 'hp',     label: 'HP' },
  { key: 'mp',     label: 'MP' },
];

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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  function handleAddCard(uuid: string, cardId: string, rarity: Rarity) {
    const ok = addCard(uuid, cardId, rarity);
    if (!ok) {
      const preview = DeckBuilder.previewAdd(uuid, cardId, rarity, deck, inventory);
      showToast(RULE_LABEL[preview.reason ?? 'DECK_FULL']);
    }
  }

  function handleSave() {
    saveDeck();
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
          <span className={`db-mp-total ${validation.isOverBudget ? 'db-mp-total--over' : ''}`}>
            💧 {validation.totalMP} / {MAX_DECK_COST} MP
          </span>
        </div>
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
      className="db-slot"
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
}

const InventoryCard: React.FC<InventoryCardProps> = ({
  instance, deck, inventory, onAdd,
}) => {
  const [imgErr, setImgErr] = useState(false);
  const card    = CardDatabase.getById(instance.cardId);
  const rc      = RARITY_COLOR[instance.rarity] ?? '#9e9e9e';
  const inDeck  = deck.uuids.includes(instance.uuid);
  const mastery = CardMasteryService.getMasteryInfo(instance.cardId);

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
        {mastery.level > 0 && (
          <div className="inv-card__mastery" title={`Meisterschaft Stufe ${mastery.level} · +${mastery.atkBonus} ATK`}>
            {'★'.repeat(mastery.level)}
          </div>
        )}
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
