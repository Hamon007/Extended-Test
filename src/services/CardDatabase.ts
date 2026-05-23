/**
 * CardDatabase.ts
 * ─────────────────────────────────────────────────────────────
 * Singleton-Service zum Laden, Validieren und Abfragen der
 * Kartendaten aus cards.json.
 *
 * Bewusst kein async/fetch – Daten sind statisch via Vite-Import.
 * Für spätere Server-Anbindung: init() durch fetch() ersetzen.
 * ─────────────────────────────────────────────────────────────
 */

import type { Card, Rarity, Element, CardType } from '../types/Card';
import rawData from '../data/cards.json';
import { resolveArtwork } from './ArtworkMapper';

// ── Validierung ───────────────────────────────────────────────

function isValidCard(raw: unknown): raw is Card {
  if (!raw || typeof raw !== 'object') return false;
  const c = raw as Record<string, unknown>;
  return (
    typeof c.id     === 'string' && c.id.length > 0 &&
    typeof c.name   === 'string' && c.name.length > 0 &&
    typeof c.rarity === 'string' &&
    typeof c.element=== 'string' &&
    typeof c.type   === 'string' &&
    c.stats !== null && typeof c.stats === 'object' &&
    typeof c.image  === 'string'
  );
}

// ── Filter-Interface ──────────────────────────────────────────

export interface CardFilter {
  rarity?:  Rarity;
  element?: Element;
  type?:    CardType;
  search?:  string;   // Volltextsuche über Name + Titel
}

// ── Service ───────────────────────────────────────────────────

class CardDatabaseService {
  private cards: Card[] = [];
  private byId:  Map<string, Card> = new Map();
  private ready  = false;

  /** Muss einmalig beim App-Start aufgerufen werden. */
  init(): void {
    if (this.ready) return;

    const raw = (rawData as { cards: unknown[] }).cards;
    const valid: Card[] = [];
    const invalid: unknown[] = [];

    const base = import.meta.env.BASE_URL;
    for (const entry of raw) {
      if (isValidCard(entry)) {
        const card = { ...(entry as Card & { artwork_key?: string }) };
        // Prefer artwork_key resolution (already BASE_URL-aware via ArtworkMapper)
        if (card.artwork_key) {
          card.image = resolveArtwork(card.artwork_key);
        } else if (card.image && card.image.startsWith('/') && !card.image.startsWith(base)) {
          // Fix hardcoded absolute paths from cards.json (e.g. /assets/cards/azazel.webp)
          card.image = base + card.image.replace(/^\//, '');
        }
        valid.push(card);
        this.byId.set(card.id, card);
      } else {
        invalid.push(entry);
      }
    }

    this.cards = valid;
    this.ready = true;

    if (invalid.length > 0) {
      console.warn(
        `[CardDatabase] ${invalid.length} ungültige Karte(n) übersprungen:`,
        invalid
      );
    }
    console.log(`[CardDatabase] ${this.cards.length} Karten geladen.`);
  }

  // ── Abfragen ────────────────────────────────────────────────

  getAll(): Card[] {
    return [...this.cards];
  }

  getById(id: string): Card | undefined {
    return this.byId.get(id);
  }

  /** Gibt alle Karten zurück, gefiltert nach optionalen Kriterien. */
  filter(f: CardFilter): Card[] {
    return this.cards.filter(c => {
      if (f.rarity  && c.rarity  !== f.rarity)  return false;
      if (f.element && c.element !== f.element)  return false;
      if (f.type    && c.type    !== f.type)     return false;
      if (f.search) {
        const q = f.search.toLowerCase();
        const hit =
          c.name.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }

  getByRarity(r: Rarity):   Card[] { return this.filter({ rarity:  r }); }
  getByElement(e: Element):  Card[] { return this.filter({ element: e }); }
  getByType(t: CardType):    Card[] { return this.filter({ type:    t }); }

  /** Alle Synergien einer Karte als aufgelöste Card-Objekte. */
  getSynergies(card: Card): Card[] {
    return card.synergies
      .map(s => this.byId.get(s.cardId))
      .filter((c): c is Card => c !== undefined);
  }

  count(): number { return this.cards.length; }

  isReady(): boolean { return this.ready; }
}

// Singleton-Export
export const CardDatabase = new CardDatabaseService();
