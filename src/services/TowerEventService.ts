// Zufalls-Ereignisse bevor man eine Turm-Etage betritt.

import { SaveService } from './SaveService';
import { EnergyService } from './EnergyService';

export type TowerEventKind =
  | 'merchant'
  | 'treasure'
  | 'stranger'
  | 'cursed';

export interface TowerEvent {
  kind:        TowerEventKind;
  title:       string;
  description: string;
  icon:        string;
}

const EVENTS: TowerEvent[] = [
  {
    kind: 'merchant',
    icon: '🛒',
    title: 'Wandernder Händler',
    description: 'Ein verhüllter Händler steht auf der Treppe. Er bietet dir seine Waren an.',
  },
  {
    kind: 'treasure',
    icon: '💰',
    title: 'Versteckter Schatz',
    description: 'Eine vergessene Truhe lehnt an der Wand. Niemand sonst hat sie bemerkt.',
  },
  {
    kind: 'stranger',
    icon: '🎭',
    title: 'Mysteriöser Fremder',
    description: 'Ein Schemen fordert dich zum Kampf — wenn du gewinnst, dreifache Belohnung.',
  },
  {
    kind: 'cursed',
    icon: '☠',
    title: 'Verfluchte Etage',
    description: 'Ein böser Bann liegt auf dieser Etage. Der Gegner ist stärker, aber die Belohnung üppiger.',
  },
];

export const TowerEventService = {
  /** Würfelt mit ~22% Gesamt-Chance ein Ereignis aus, sonst null. */
  rollEvent(): TowerEvent | null {
    const r = Math.random();
    if (r < 0.08) return EVENTS[0];   // merchant
    if (r < 0.14) return EVENTS[1];   // treasure
    if (r < 0.17) return EVENTS[2];   // stranger
    if (r < 0.22) return EVENTS[3];   // cursed
    return null;
  },

  /** Schatz-Ereignis: gibt Belohnung direkt aus und gibt Klartext zurück. */
  claimTreasure(): string {
    const crystals = 150 + Math.floor(Math.random() * 400);
    const gs = SaveService.loadGachaState();
    SaveService.saveGachaState({ ...gs, crystals: gs.crystals + crystals });
    const gotPotion = Math.random() < 0.5;
    if (gotPotion) EnergyService.addPotions(1);
    return gotPotion
      ? `+${crystals} 💎 · +1 🧪 Ausdauertrank`
      : `+${crystals} 💎`;
  },

  /** Händler: Spieler wählt eine von drei Optionen. */
  acceptMerchant(option: 'crystals' | 'potions' | 'small_crystal_card'): string {
    const gs = SaveService.loadGachaState();
    switch (option) {
      case 'crystals':
        SaveService.saveGachaState({ ...gs, crystals: gs.crystals + 300 });
        return '+300 💎';
      case 'potions':
        EnergyService.addPotions(3);
        return '+3 🧪 Ausdauertränke';
      case 'small_crystal_card':
        SaveService.saveGachaState({
          ...gs,
          crystalCards: { ...gs.crystalCards, small: gs.crystalCards.small + 1 },
        });
        return '+1 💎 Kristallkarte (Klein)';
    }
  },
};
