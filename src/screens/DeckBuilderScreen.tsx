import React, { useState, useMemo } from 'react';
import { useDeckStore } from '../hooks/useDeckStore';
import { DeckBuilder } from '../services/DeckBuilder';
import { CardDatabase } from '../services/CardDatabase';
import type { ResolvedSlot, Deck } from '../types/DeckTypes';
import type { CardInstance } from '../types/GachaTypes';
import { DECK_SIZE, MAX_DECK_COST } from '../types/DeckTypes';
import { RARITY_COLOR, RARITY_ORDER, RARITY_MAJORS, rarityMajor, ELEMENT_LABEL } from '../types/Card';
import type { Rarity } from '../types/Card';
import './DeckBuilderScreen.css';

// ── Fehlertext ────────────────────────────────────────────────

const RULE_LABEL: Record<string, string> = {
  DECK_FULL:       `Deck ist voll (max. ${DECK_SIZE} Karten)`,
  COST_EXCEEDED:   `Deck-Budget überschritten (max. ${MAX_DECK_COST} MP)`,
  ALREADY_IN_DECK: 'Diese Instanz ist bereits im Deck',
};

// ── Inventar: jede Karten-Instanz wird einzeln aufgeführt ─────

interface InventoryEntry {
  uuid:   string;
  cardId: string;
  rarity: Rarity;
  inDeck: boolean;
}

function buildInventoryEntries(
  inventory: CardInstance[],
  deckUuids: string[],
): InventoryEntry[] {
  const deckSet = new Set(deckUuids);

  // Eine Karte pro Instanz — nie gruppieren, damit jede Karte einzeln anklickbar ist.
  return inventory
    .map(inst => ({
      uuid:   inst.uuid,
      cardId: inst.cardId,
      rarity: inst.rarity as Rarity,
      inDeck: deckSet.has(inst.uuid),
    }))
    .sort((a, b) => {
      // nach Seltenheit absteigend, dann nach Karten-ID stabil
      const r = RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
      return r !== 0 ? r : a.cardId.localeCompare(b.cardId);
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

  const allEntries = useMemo(
    () => buildInventoryEntries(inventory, deck.uuids),
    [inventory, deck.uuids]
  );

  const inventoryEntries = useMemo(
    () => rarityFilter === ''
      ? allEntries
      : allEntries.filter(e => rarityMajor(e.rarity) === rarityFilter),
    [allEntries, rarityFilter]
  );

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

        {allEntries.length === 0 ? (
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
                entry={entry}
                deck={deck}
                inventory={inventory}
                onAdd={handleAddCard}
                onRemove={removeCard}
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
  entry:     InventoryEntry;
  deck:      Deck;
  inventory: CardInstance[];
  onAdd:     (uuid: string, cardId: string, rarity: Rarity) => void;
  onRemove:  (uuid: string) => void;
}

const InventoryCard: React.FC<InventoryCardProps> = ({
  entry, deck, inventory, onAdd, onRemove,
}) => {
  const [imgErr, setImgErr] = useState(false);
  const card = CardDatabase.getById(entry.cardId);
  const rc   = RARITY_COLOR[entry.rarity] ?? '#9e9e9e';

  // Budget-/Voll-Prüfung nur für noch nicht eingesetzte Instanzen.
  let addBlocked = false;
  let blockTip   = '';
  if (!entry.inDeck) {
    const preview = DeckBuilder.previewAdd(entry.uuid, entry.cardId, entry.rarity, deck, inventory);
    if (preview.blocked) {
      addBlocked = true;
      blockTip   = RULE_LABEL[preview.reason ?? 'DECK_FULL'];
    }
  }

  // In-Deck-Karten sind immer anklickbar (zum Entfernen), freie nur wenn nicht blockiert.
  const clickable = entry.inDeck || !addBlocked;

  const handleClick = () => {
    if (entry.inDeck) onRemove(entry.uuid);
    else if (!addBlocked) onAdd(entry.uuid, entry.cardId, entry.rarity);
  };

  return (
    <div
      className={`inv-card ${entry.inDeck ? 'inv-card--in-deck' : addBlocked ? 'inv-card--blocked' : 'inv-card--available'}`}
      style={{ '--rc': rc } as React.CSSProperties}
      onClick={clickable ? handleClick : undefined}
      title={entry.inDeck
        ? `${card?.name ?? entry.cardId} — Tippen zum Entfernen`
        : (blockTip || card?.name)}
    >
      {/* Artwork */}
      <div className="inv-card__art">
        {card && !imgErr ? (
          <img
            src={card.image}
            alt={card.name}
            onError={() => setImgErr(true)}
            loading="lazy"
          />
        ) : (
          <div className="inv-card__placeholder">🌑</div>
        )}
        <div className="inv-card__gradient" />
      </div>

      {/* Rarity badge */}
      <div className="inv-card__rarity" style={{ color: rc }}>
        {entry.rarity}
      </div>

      {/* Im-Deck-Markierung */}
      {entry.inDeck && (
        <div className="inv-card__in-deck-badge">✓</div>
      )}

      {/* Block-Overlay (nur wenn Karte nicht hinzugefügt werden kann) */}
      {addBlocked && (
        <div className="inv-card__block-overlay">
          <span>{blockTip}</span>
        </div>
      )}

      {/* Footer */}
      <div className="inv-card__footer">
        <span className="inv-card__name">{card?.name ?? entry.cardId}</span>
        <span className="inv-card__element">
          {card ? ELEMENT_LABEL[card.element] : ''}
        </span>
        <span className="inv-card__mp">💧{card?.stats.mpCost ?? '?'}</span>
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
