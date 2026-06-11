/**
 * FlashSaleService.ts – Codex Immortalis
 * Rotates a discounted "Blitzangebot" every 4 hours (UTC-slotted).
 * Sale items are a subset of ShopItems at 35-50% discount.
 * Seeded deterministically so all players see the same offer.
 */

import type { ShopItemId } from './ShopService';

export interface FlashSale {
  itemId:    ShopItemId;
  name:      string;
  icon:      string;
  original:  number; // original crystal cost
  sale:      number; // discounted price
  discount:  number; // percent off (e.g. 40 = 40% off)
  slotKey:   string; // YYYY-MM-DD-HH slot identifier
  endsAtMs:  number; // UTC ms when sale expires
}

const SLOT_HOURS = 4; // sale rotates every 4 hours

// Candidate sales — item definitions with discount levels
const CANDIDATES: Array<{
  itemId:   ShopItemId;
  name:     string;
  icon:     string;
  base:     number;
  discount: number;
}> = [
  { itemId: 'potion_3',       name: '3× Tränke-Bündel',   icon: '🫧', base: 380,  discount: 40 },
  { itemId: 'energy_refill',  name: 'Volle Ausdauer',      icon: '⚡', base: 500,  discount: 35 },
  { itemId: 'season_sp_30',   name: 'SP-Kristall',         icon: '🏅', base: 200,  discount: 50 },
  { itemId: 'account_xp_2000',name: 'Erfahrungsstein',     icon: '✦',  base: 300,  discount: 45 },
  { itemId: 'mana_pack',      name: 'Mana-Kristall',       icon: '💜', base: 250,  discount: 40 },
  { itemId: 'mega_sp_pack',   name: 'Mega SP-Paket',       icon: '🎖️', base: 800,  discount: 35 },
  { itemId: 'xp_boost_5000',  name: 'XP-Boost',           icon: '⭐', base: 600,  discount: 45 },
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 42) * 99999;
  return x - Math.floor(x);
}

function currentSlotKey(): string {
  const now = new Date();
  const y   = now.getUTCFullYear();
  const m   = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d   = String(now.getUTCDate()).padStart(2, '0');
  const slot = Math.floor(now.getUTCHours() / SLOT_HOURS); // 0-5
  return `${y}-${m}-${d}-${slot}`;
}

function slotEndMs(): number {
  const now   = new Date();
  const slot  = Math.floor(now.getUTCHours() / SLOT_HOURS);
  const nextSlotHour = (slot + 1) * SLOT_HOURS;
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), nextSlotHour));
  return end.getTime();
}

function pickCandidate(slotKey: string) {
  const seed = parseInt(slotKey.replace(/-/g, ''), 10);
  const idx  = Math.floor(seededRandom(seed) * CANDIDATES.length);
  return CANDIDATES[idx]!;
}

export const FlashSaleService = {
  getCurrent(): FlashSale {
    const slotKey = currentSlotKey();
    const c       = pickCandidate(slotKey);
    const sale    = Math.max(1, Math.round(c.base * (1 - c.discount / 100)));
    return {
      itemId:   c.itemId,
      name:     c.name,
      icon:     c.icon,
      original: c.base,
      sale,
      discount: c.discount,
      slotKey,
      endsAtMs: slotEndMs(),
    };
  },

  msUntilEnd(): number {
    return Math.max(0, slotEndMs() - Date.now());
  },
};
