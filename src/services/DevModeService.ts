import { CardDatabase } from './CardDatabase';
import { SaveService }   from './SaveService';

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
};
