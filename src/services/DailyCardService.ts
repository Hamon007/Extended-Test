import { CardDatabase } from './CardDatabase';
import { SaveService } from './SaveService';
import type { Card } from '../types/Card';

const STORAGE_KEY = 'ci_daily_card';

interface DailyCardState {
  dateKey: string;   // YYYY-MM-DD UTC
  cardId: string;
}

function utcDateKey(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, '0');
  const d = String(n.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Simple seeded number [0,1)
function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10_000;
  return x - Math.floor(x);
}

function dateToSeed(dateKey: string): number {
  // YYYY-MM-DD → numeric seed
  return parseInt(dateKey.replace(/-/g, ''), 10);
}

class DailyCardServiceImpl {
  private cached: DailyCardState | null = null;

  private getState(): DailyCardState {
    const today = utcDateKey();

    // Use in-memory cache if still the same day
    if (this.cached && this.cached.dateKey === today) return this.cached;

    // Try localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DailyCardState;
        if (parsed.dateKey === today) {
          this.cached = parsed;
          return this.cached;
        }
      }
    } catch { /* ignore */ }

    // Select new card for today
    const all = CardDatabase.getAll();
    if (all.length === 0) {
      const state: DailyCardState = { dateKey: today, cardId: '' };
      this.cached = state;
      return state;
    }

    const seed = dateToSeed(today);
    const idx = Math.floor(seededRandom(seed) * all.length);
    const cardId = all[idx]?.id ?? all[0]!.id;

    const state: DailyCardState = { dateKey: today, cardId };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
    this.cached = state;
    return state;
  }

  /** Returns the featured card for today, or null if database is empty. */
  getCard(): Card | null {
    const { cardId } = this.getState();
    if (!cardId) return null;
    return CardDatabase.getById(cardId) ?? null;
  }

  /** Returns the date key for today's card (YYYY-MM-DD UTC). */
  getDateKey(): string {
    return this.getState().dateKey;
  }

  /** Returns true if the player owns at least one copy of today's card. */
  isOwned(): boolean {
    const { cardId } = this.getState();
    if (!cardId) return false;
    const inv = SaveService.loadGachaState().inventory;
    return inv.some(i => i.cardId === cardId);
  }

  /**
   * ATK multiplier bonus for battles today.
   * +5% if the daily card is in the player's inventory, 0% otherwise.
   */
  getAtkBonus(): number {
    return this.isOwned() ? 0.05 : 0;
  }

  /**
   * Returns how many ms remain until the next card rotation (UTC midnight).
   */
  msUntilNextCard(): number {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return Math.max(0, tomorrow.getTime() - now.getTime());
  }
}

export const DailyCardService = new DailyCardServiceImpl();
