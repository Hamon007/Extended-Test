/**
 * useDeckStore.ts
 * ─────────────────────────────────────────────────────────────
 * React-Hook: verbindet Deck-State, DeckBuilder-Logik
 * und SaveService. Lädt Inventar aus GachaState.
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useMemo } from 'react';
import type { Deck, DeckValidation, ResolvedSlot } from '../types/DeckTypes';
import type { CardInstance } from '../types/GachaTypes';
import type { Rarity } from '../types/Card';
import { DeckBuilder } from '../services/DeckBuilder';
import { SaveService } from '../services/SaveService';

export interface DeckStore {
  deck:        Deck;
  resolved:    ResolvedSlot[];
  validation:  DeckValidation;
  inventory:   CardInstance[];
  isDirty:     boolean;      // ungespeicherte Änderungen
  lastSaved:   number;       // Timestamp letzter Speicherung (0 = nie)
  addCard:     (uuid: string, cardId: string, rarity: Rarity) => boolean;
  removeCard:  (uuid: string) => void;
  saveDeck:    () => void;
  resetDeck:   () => void;
  renameDeck:  (name: string) => void;
}

export function useDeckStore(): DeckStore {
  // Inventar aus GachaState (Quelle der Wahrheit für Instanzen)
  const [inventory] = useState<CardInstance[]>(
    () => SaveService.loadGachaState().inventory
  );

  const [deck,      setDeck]      = useState<Deck>(() => SaveService.loadDeck());
  const [isDirty,   setIsDirty]   = useState(false);
  const [lastSaved, setLastSaved] = useState(() => SaveService.loadDeck().savedAt);

  // Aufgelöste Slots (memo: nur wenn deck oder inventory sich ändern)
  const resolved = useMemo(
    () => DeckBuilder.resolveSlots(deck, inventory),
    [deck, inventory]
  );

  // Vollständige Validierung (memo)
  const validation = useMemo<DeckValidation>(
    () => DeckBuilder.validateDeck(deck, inventory),
    [deck, inventory]
  );

  const addCard = useCallback((uuid: string, cardId: string, rarity: Rarity): boolean => {
    const result = DeckBuilder.canAdd(uuid, cardId, rarity, deck, inventory);
    if (!result.ok) return false;
    setDeck(result.deck);
    setIsDirty(true);
    return true;
  }, [deck, inventory]);

  const removeCard = useCallback((uuid: string) => {
    setDeck(prev => DeckBuilder.removeCard(uuid, prev));
    setIsDirty(true);
  }, []);

  const saveDeck = useCallback(() => {
    const toSave = { ...deck, savedAt: Date.now() };
    SaveService.saveDeck(toSave);
    setDeck(toSave);
    setLastSaved(toSave.savedAt);
    setIsDirty(false);
  }, [deck]);

  const resetDeck = useCallback(() => {
    const empty = DeckBuilder.createEmptyDeck(deck.name);
    setDeck(empty);
    setIsDirty(true);
  }, [deck.name]);

  const renameDeck = useCallback((name: string) => {
    setDeck(prev => ({ ...prev, name }));
    setIsDirty(true);
  }, []);

  return {
    deck, resolved, validation, inventory,
    isDirty, lastSaved,
    addCard, removeCard, saveDeck, resetDeck, renameDeck,
  };
}
