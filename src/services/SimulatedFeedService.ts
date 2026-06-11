/**
 * SimulatedFeedService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Generates convincing NPC activity entries when the player
 * isn't logged in or there are no real feed events.
 * Uses deterministic time-seeded randomness so entries feel
 * real-time but don't require a backend.
 * ─────────────────────────────────────────────────────────────
 */

const NAMES = [
  'Ryusei','Kaito','Haruto','Sora','Takumi','Yuki','Riku','Nagi',
  'Ren','Shion','Akira','Hayate','Kazuya','Minato','Daichi','Souta',
  'Guren','Siegfried','Asteria','Ragna','Vael','Zephyr','Cain','Lyra',
  'Luna','Mei','Hana','Yua','Noa','Sakura','Akane','Rin','Misaki',
  'Orpheus','Calyx','Seraph','Nexus','Dusk','Soleis','Valka','Miraen',
];

const CARD_NAMES = [
  'Azazel', 'Azgaroth', 'Satan', 'Seraphina', 'Malachar',
  'Veldris', 'Zorathon', 'Nyx', 'Lysander', 'Crestfallen',
  'Emberlord', 'Frostbane', 'Stormcaller', 'Shadowveil',
];

function seeded(seed: number): number {
  let s = seed;
  s ^= s << 13; s ^= s >> 7; s ^= s << 17;
  return ((s >>> 0) / 0xFFFFFFFF);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.floor(seeded(seed) * arr.length)]!;
}

type SimEntry = string;

function generate(count = 10): SimEntry[] {
  const now   = Math.floor(Date.now() / 30_000); // changes every 30 seconds
  const seed0 = now * 7919;
  const events: SimEntry[] = [];

  for (let i = 0; i < count; i++) {
    const s      = seed0 + i * 1373;
    const name   = pick(NAMES, s);
    const card   = pick(CARD_NAMES, s + 7);
    const floor  = Math.floor(seeded(s + 11) * 80) + 10;
    const rarity = seeded(s + 3) < 0.15 ? 'MR' : seeded(s + 3) < 0.45 ? 'SSR' : 'SR';
    const type   = Math.floor(seeded(s + 5) * 5);

    switch (type) {
      case 0: events.push(`⭐ ${name} hat ${card} (${rarity}) beschworen!`); break;
      case 1: events.push(`🗼 ${name} hat Etage ${floor} bezwungen!`); break;
      case 2: events.push(`💫 ${name} hat ein LR-Awakening abgeschlossen!`); break;
      case 3: events.push(`🔥 ${name} ist auf 5× Siegesserie!`); break;
      case 4: events.push(`🏆 ${name} erreichte Saison-Rang ${pick(['Veteran','Elite','Champion','Meister'], s + 9)}!`); break;
    }
  }

  return events;
}

export const SimulatedFeedService = { generate };
