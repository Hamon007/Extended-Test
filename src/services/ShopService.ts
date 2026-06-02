/**
 * ShopService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Crystal shop with:
 *   - Fixed items always available
 *   - 3 daily rotating offers (seeded by calendar day)
 * Purchases apply effects immediately via the relevant services.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService }     from './SaveService';
import { EnergyService }   from './EnergyService';
import { SeasonService }   from './SeasonService';
import { AccountProgressionService } from './AccountProgressionService';
import { QuestService } from './QuestService';
import { AchievementService } from './AchievementService';

const PURCHASE_KEY = 'ci_shop_purchases';

export type ShopItemId =
  | 'potion_1'
  | 'potion_3'
  | 'energy_refill'
  | 'season_sp_30'
  | 'account_xp_2000'
  | 'mana_pack'
  | 'mega_sp_pack'
  | 'xp_boost_5000';

export interface ShopItem {
  id:          ShopItemId;
  name:        string;
  description: string;
  icon:        string;
  cost:        number;
  maxPerDay:   number;  // how many times per day a player can buy
  rotating:    boolean; // true = in daily rotation pool
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id:         'potion_1',
    name:       'Energie-Trank',
    description: '+1 Ausdauer sofort',
    icon:       '🧪',
    cost:       150,
    maxPerDay:  5,
    rotating:   false,
  },
  {
    id:         'energy_refill',
    name:       'Volle Ausdauer',
    description: 'Füllt Ausdauer komplett auf',
    icon:       '⚡',
    cost:       500,
    maxPerDay:  2,
    rotating:   false,
  },
  {
    id:         'potion_3',
    name:       '3× Tränke-Bündel',
    description: '+3 Energie-Tränke',
    icon:       '🫧',
    cost:       380,
    maxPerDay:  3,
    rotating:   true,
  },
  {
    id:         'season_sp_30',
    name:       'SP-Kristall',
    description: '+30 Saison-Punkte',
    icon:       '🏅',
    cost:       200,
    maxPerDay:  10,
    rotating:   true,
  },
  {
    id:         'account_xp_2000',
    name:       'Erfahrungsstein',
    description: '+2.000 Account-XP',
    icon:       '📿',
    cost:       250,
    maxPerDay:  5,
    rotating:   true,
  },
  {
    id:         'mana_pack',
    name:       'Mana-Kristall',
    description: '+500 Mana',
    icon:       '🔮',
    cost:       180,
    maxPerDay:  5,
    rotating:   true,
  },
  {
    id:         'mega_sp_pack',
    name:       'Wöchentlicher SP-Schub',
    description: '+150 Saison-Punkte — einmal täglich',
    icon:       '🌟',
    cost:       800,
    maxPerDay:  1,
    rotating:   true,
  },
  {
    id:         'xp_boost_5000',
    name:       'Großer Erfahrungsstein',
    description: '+5.000 Account-XP',
    icon:       '💎',
    cost:       600,
    maxPerDay:  3,
    rotating:   true,
  },
];

// ── Daily Rotation ──────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dailySeed(): number {
  const s = todayISO().replace(/-/g, '');
  return parseInt(s, 10);
}

export function getDailyOffers(): ShopItem[] {
  const pool = SHOP_ITEMS.filter(i => i.rotating);
  const seed  = dailySeed();
  // deterministic shuffle using seed
  const shuffled = [...pool].sort((a, b) => {
    const ha = (seed * a.id.charCodeAt(0) * 31) % 997;
    const hb = (seed * b.id.charCodeAt(0) * 31) % 997;
    return ha - hb;
  });
  return shuffled.slice(0, 3);
}

// ── Purchase Tracking ───────────────────────────────────────────

interface PurchaseRecord {
  date:   string;  // YYYY-MM-DD
  counts: Record<ShopItemId, number>;
}

function loadRecord(): PurchaseRecord {
  try {
    const raw = localStorage.getItem(PURCHASE_KEY);
    if (!raw) return { date: todayISO(), counts: {} as Record<ShopItemId, number> };
    const rec = JSON.parse(raw) as PurchaseRecord;
    // Reset counts on new day
    if (rec.date !== todayISO()) {
      return { date: todayISO(), counts: {} as Record<ShopItemId, number> };
    }
    return rec;
  } catch {
    return { date: todayISO(), counts: {} as Record<ShopItemId, number> };
  }
}

function saveRecord(rec: PurchaseRecord): void {
  try { localStorage.setItem(PURCHASE_KEY, JSON.stringify(rec)); } catch { /* ignore */ }
}

function getBoughtToday(id: ShopItemId): number {
  return loadRecord().counts[id] ?? 0;
}

function canBuy(item: ShopItem): { ok: boolean; reason?: string } {
  const gs = SaveService.loadGachaState();
  if (gs.crystals < item.cost) return { ok: false, reason: 'Zu wenig Kristalle' };
  const bought = getBoughtToday(item.id);
  if (bought >= item.maxPerDay) return { ok: false, reason: `Tages-Limit erreicht (${item.maxPerDay}×)` };
  return { ok: true };
}

function purchase(item: ShopItem): { ok: boolean; reason?: string } {
  const check = canBuy(item);
  if (!check.ok) return check;

  // Deduct crystals
  const gs = SaveService.loadGachaState();
  SaveService.saveGachaState({ ...gs, crystals: gs.crystals - item.cost });

  // Apply effect
  applyEffect(item.id);

  // Quest + achievement tracking
  QuestService.recordEvent('shop_purchase');
  AchievementService.recordProgress('shop_first');
  AchievementService.recordProgress('shop_regular');

  // Track purchase
  const rec = loadRecord();
  rec.counts[item.id] = (rec.counts[item.id] ?? 0) + 1;
  saveRecord(rec);

  return { ok: true };
}

function applyEffect(id: ShopItemId): void {
  switch (id) {
    case 'potion_1':
      EnergyService.addPotions(1);
      break;
    case 'potion_3':
      EnergyService.addPotions(3);
      break;
    case 'energy_refill': {
      const e = EnergyService.load();
      const max = EnergyService.getMax();
      // Add enough potions to refill, then use them
      const needed = Math.max(0, max - e.energy);
      if (needed > 0) EnergyService.addPotions(needed);
      // Use all potions up to max
      for (let i = 0; i < needed; i++) EnergyService.usePotion();
      break;
    }
    case 'season_sp_30':
      SeasonService.addSp(30);
      break;
    case 'mega_sp_pack':
      SeasonService.addSp(150);
      break;
    case 'account_xp_2000': {
      const acc2k = SaveService.loadAccountState();
      const res2k = AccountProgressionService.addAccountXp(acc2k, 2000);
      SaveService.saveAccountState(res2k.newState);
      break;
    }
    case 'xp_boost_5000': {
      const acc5k = SaveService.loadAccountState();
      const res5k = AccountProgressionService.addAccountXp(acc5k, 5000);
      SaveService.saveAccountState(res5k.newState);
      break;
    }
    case 'mana_pack': {
      const acc = SaveService.loadAccountState();
      const newMana = Math.min(acc.maxMana, acc.mana + 500);
      SaveService.saveAccountState({ ...acc, mana: newMana });
      break;
    }
  }
}

export const ShopService = {
  SHOP_ITEMS,
  getDailyOffers,
  getBoughtToday,
  canBuy,
  purchase,
  todayISO,
};
