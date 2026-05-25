import { CardDatabase } from './CardDatabase';
import { SaveService }   from './SaveService';
import { LevelSystem }   from './LevelSystem';

const DEV_KEY  = 'ci_dev_mode';
const PASSWORD = 'Osmanos';

export const DevModeService = {
  isEnabled(): boolean {
    return localStorage.getItem(DEV_KEY) === '1';
  },

  tryActivate(password: string): boolean {
    if (password === PASSWORD) {
      localStorage.setItem(DEV_KEY, '1');
      return true;
    }
    return false;
  },

  deactivate(): void {
    localStorage.removeItem(DEV_KEY);
  },

  /** Adds one instance of every card not yet owned. Dev mode only. */
  unlockAllCards(): number {
    if (!DevModeService.isEnabled()) return 0;
    const state     = SaveService.loadGachaState();
    const owned     = new Set(state.inventory.map(ci => ci.cardId));
    const allCards  = CardDatabase.getAll();
    let added       = 0;

    for (const card of allCards) {
      if (owned.has(card.id)) continue;
      state.inventory.push({
        uuid:      crypto.randomUUID(),
        cardId:    card.id,
        rarity:    card.rarity,
        pulledAt:  Date.now(),
        pullIndex: state.totalPulls + added,
        isNew:     false,
        level:     1,
        xp:        0,
      });
      added++;
    }

    if (added > 0) SaveService.saveGachaState(state);
    return added;
  },

  /** Sets every owned card to level 60. Dev mode only. */
  maxLevelAllCards(): number {
    if (!DevModeService.isEnabled()) return 0;
    const state = SaveService.loadGachaState();
    let changed = 0;
    for (const inst of state.inventory) {
      const cap = LevelSystem.levelCap(inst.rarity);
      if (inst.level < cap) {
        inst.level = cap;
        inst.xp    = 0;
        changed++;
      }
    }
    if (changed > 0) SaveService.saveGachaState(state);
    return changed;
  },

  /** Ensures every unique card has at least 4 copies. Dev mode only. */
  ensureFourDupes(): number {
    if (!DevModeService.isEnabled()) return 0;
    const state   = SaveService.loadGachaState();
    const counts  = new Map<string, number>();
    for (const inst of state.inventory) {
      counts.set(inst.cardId, (counts.get(inst.cardId) ?? 0) + 1);
    }
    let added = 0;
    for (const [cardId, count] of counts) {
      const missing = 4 - count;
      if (missing <= 0) continue;
      const template = state.inventory.find(i => i.cardId === cardId)!;
      for (let i = 0; i < missing; i++) {
        state.inventory.push({
          uuid:      crypto.randomUUID(),
          cardId:    template.cardId,
          rarity:    template.rarity,
          pulledAt:  Date.now(),
          pullIndex: state.totalPulls + added,
          isNew:     false,
          level:     template.level,
          xp:        template.xp,
        });
        added++;
      }
    }
    if (added > 0) SaveService.saveGachaState(state);
    return added;
  },
};
