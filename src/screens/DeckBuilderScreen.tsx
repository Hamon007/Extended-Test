import React, { useState, useMemo } from 'react';
import { useDeckStore } from '../hooks/useDeckStore';
import { DeckBuilder } from '../services/DeckBuilder';
import { CardDatabase } from '../services/CardDatabase';
import type { ResolvedSlot } from '../types/DeckTypes';
import type { CardInstance } from '../types/GachaTypes';
import { DECK_SIZE, MAX_MR_PER_DECK, MR_TIER } from '../types/DeckTypes';
import { RARITY_COLOR, ELEMENT_LABEL } from '../types/Card';
import './DeckBuilderScreen.css';

// ── Fehlertext ────────────────────────────────────────────────

const RULE_LABEL: Record<string, string> = {
  DECK_FULL:           'Deck ist voll (max. 5 Karten)',
  DUPLICATE_CARD_ID:   'Diese Karte ist bereits im Deck',
  MR_LIMIT_EXCEEDED:   `Max. ${MAX_MR_PER_DECK} MR-Karte pro Deck`,
  ALREADY_IN_DECK:     'Diese Instanz ist bereits im Deck',
};

// ── Inventar: einzigartige Karten mit erstem verfügbaren UUID ─

interface InventoryEntry {
  cardId:        string;
  firstUuid:     string;  // erste nicht-im-Deck-UUID
  rarity:        string;
  totalCount:    number;  // wie viele Instanzen dieser Karte im Inventar
  inDeckCount:   number;  // wie viele im Deck
}

function buildInventoryEntries(
  inventory: CardInstance[],
  deckUuids: string[],
): InventoryEntry[] {
  const deckSet = new Set(deckUuids);
  const byCard  = new Map<string, CardInstance[]>();

  for (const inst of inventory) {
    const list = byCard.get(inst.cardId) ?? [];
    list.push(inst);
    byCard.set(inst.cardId, list);
  }

  const entries: InventoryEntry[] = [];
  byCard.forEach((instances, cardId) => {
    const inDeck    = instances.filter(i => deckSet.has(i.uuid));
    const notInDeck = instances.filter(i => !deckSet.has(i.uuid));
    entries.push({
      cardId,
      firstUuid:   notInDeck[0]?.uuid ?? instances[0].uuid,
      rarity:      instances[0].rarity,
      totalCount:  instances.length,
      inDeckCount: inDeck.length,
    });
  });

  // Sortieren: MR-Tier zuerst, dann nach Seltenheit absteigend
  return entries.sort((a, b) => {
    const aIdx = Object.keys(RARITY_COLOR).indexOf(a.rarity);
    const bIdx = Object.keys(RARITY_COLOR).indexOf(b.rarity);
    return bIdx - aIdx;
  });
}

// ── Haupt-Screen ──────────────────────────────────────────────

const DeckBuilderScreen: React.FC = () => {
  const store = useDeckStore();
  const { deck, resolved, validation, inventory, isDirty, addCard, removeCard, saveDeck, resetDeck } = store;

  const [renaming,  setRenaming]  = useState(false);
  const [nameInput, setNameInput] = useState(deck.name);
  const [toast,     setToast]     = useState<string | null>(null);

  const inventoryEntries = useMemo(
    () => buildInventoryEntries(inventory, deck.uuids),
    [inventory, deck.uuids]
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  function handleAddCard(entry: InventoryEntry) {
    const inst = inventory.find(i => i.uuid === entry.firstUuid);
    if (!inst) return;

    // Prüfe ob die UUID schon im Deck (alle Instanzen dieser Karte)
    const deckHasCardId = resolved.some(
      s => s.instance?.cardId === entry.cardId
    );
    if (deckHasCardId) {
      showToast(RULE_LABEL.DUPLICATE_CARD_ID);
      return;
    }

    // Prüfe ob noch ein UUID dieser Karte verfügbar ist
    const deckSet = new Set(deck.uuids);
    const available = inventory.find(
      i => i.cardId === entry.cardId && !deckSet.has(i.uuid)
    );
    if (!available) {
      showToast('Keine freie Instanz verfügbar');
      return;
    }

    const ok = addCard(available.uuid, available.cardId, available.rarity);
    if (!ok) {
      const preview = DeckBuilder.previewAdd(
        available.uuid, available.cardId, available.rarity, deck, inventory
      );
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
          <span className="db-mp-total">⚡ {validation.totalMP} MP Gesamt</span>
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

        {inventoryEntries.length === 0 ? (
          <EmptyInventory />
        ) : (
          <div className="db-inventory-grid">
            {inventoryEntries.map(entry => (
              <InventoryCard
                key={entry.cardId}
                entry={entry}
                deckUuids={deck.uuids}
                inventory={inventory}
                deckResolved={resolved}
                validation={validation}
                onAdd={() => handleAddCard(entry)}
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
    msgs.push(`Deck unvollständig (${validation.isComplete ? 0 : DECK_SIZE} Slots benötigt)`);
  }
  if (validation.missingCount > 0) {
    msgs.push(`${validation.missingCount} Karte(n) nicht im Inventar`);
  }
  validation.errors.forEach(e => msgs.push(RULE_LABEL[e] ?? e));

  if (msgs.length === 0 && !validation.isComplete) {
    msgs.push('Deck unvollständig');
  }

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
  entry:        InventoryEntry;
  deckUuids:    string[];
  inventory:    CardInstance[];
  deckResolved: ResolvedSlot[];
  validation:   ReturnType<typeof DeckBuilder.validateDeck>;
  onAdd:        () => void;
}

const InventoryCard: React.FC<InventoryCardProps> = ({
  entry, deckUuids, inventory, deckResolved, onAdd,
}) => {
  const [imgErr, setImgErr] = useState(false);
  const card = CardDatabase.getById(entry.cardId);
  const rc   = RARITY_COLOR[entry.rarity as keyof typeof RARITY_COLOR] ?? '#9e9e9e';

  // Ist diese Karte (per card_id) bereits im Deck?
  const alreadyInDeck = deckResolved.some(s => s.instance?.cardId === entry.cardId);

  // Würde Hinzufügen eine Regel verletzen?
  const deckSet   = new Set(deckUuids);
  const available = inventory.find(i => i.cardId === entry.cardId && !deckSet.has(i.uuid));

  let blocked   = alreadyInDeck;
  let blockTip  = '';

  if (!blocked && !available) {
    blocked  = true;
    blockTip = 'Keine freie Instanz';
  }

  if (!blocked && available) {
    const preview = DeckBuilder.previewAdd(
      available.uuid, available.cardId, available.rarity,
      { id: 'deck_main', name: '', uuids: deckUuids, savedAt: 0 },
      inventory
    );
    if (preview.blocked) {
      blocked  = true;
      blockTip = RULE_LABEL[preview.reason ?? 'DECK_FULL'];
    }
  }

  if (alreadyInDeck) blockTip = 'Im Deck';

  const isMR = (MR_TIER as readonly string[]).includes(entry.rarity);

  return (
    <div
      className={`inv-card ${blocked ? 'inv-card--blocked' : 'inv-card--available'} ${alreadyInDeck ? 'inv-card--in-deck' : ''}`}
      style={{ '--rc': rc } as React.CSSProperties}
      onClick={blocked ? undefined : onAdd}
      title={blockTip || card?.name}
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

      {/* Badges */}
      <div
        className="inv-card__rarity"
        style={{ color: rc }}
      >
        {entry.rarity}
      </div>

      {isMR && (
        <div className="inv-card__mr-badge" title="MR-Tier — max. 1 pro Deck">MR</div>
      )}

      {entry.totalCount > 1 && (
        <div className="inv-card__count">×{entry.totalCount}</div>
      )}

      {alreadyInDeck && (
        <div className="inv-card__in-deck-badge">✓</div>
      )}

      {/* Block-Overlay */}
      {blocked && !alreadyInDeck && (
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
