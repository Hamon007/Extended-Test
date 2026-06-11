/**
 * LeaderboardService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Generates a deterministic pool of NPC competitors ranked by
 * power score. The player's rank is derived from their live
 * power score vs. the NPC distribution.
 * ─────────────────────────────────────────────────────────────
 */

const NPC_NAMES = [
  'Ryusei','Kaito','Haruto','Sora','Takumi','Yuki','Riku','Nagi',
  'Ren','Shion','Akira','Hayate','Kazuya','Minato','Daichi','Souta',
  'Hikaru','Kenta','Yuma','Taiga','Asahi','Raito','Makoto','Hibiki',
  'Shin','Ryo','Jiro','Kei','Izumi','Touma','Shiro','Aoi',
  'Luna','Mei','Hana','Yua','Noa','Sakura','Akane','Rin',
  'Misaki','Ichika','Saya','Kana','Yui','Kotone','Hiro','Tenko',
  'Guren','Siegfried','Asteria','Ragna','Vael','Zephyr','Cain','Lyra',
  'Orpheus','Calyx','Seraph','Nexus','Dusk','Soleis','Valka','Miraen',
];

const TITLE_SUFFIXES = [
  '★★★', '★★', '★', 'MR', 'SSR', 'SR', 'MAX', 'Ω', 'α',
  '†', '∞', '', '', '', '',  // many without suffix (more natural)
];

export interface LeaderboardEntry {
  rank:       number;
  name:       string;
  title:      string;
  power:      number;
  isPlayer:   boolean;
  delta:      number;   // rank change this session (+ve = improved)
  avatar:     string;   // emoji avatar
}

const AVATARS = ['⚔','🔥','❄️','🌑','🔮','⚡','🌪️','💀','✦','🗡'];

// Seeded deterministic RNG
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate the NPC pool (1000 entries, spread over a power range)
function buildPool(weekSeed: number): { power: number; name: string; title: string; avatar: string }[] {
  const rng = mulberry32(weekSeed);
  const pool: { power: number; name: string; title: string; avatar: string }[] = [];

  // Distribution: mix of low/mid/high players
  for (let i = 0; i < 1000; i++) {
    const tier = rng(); // 0-1
    let power: number;
    if (tier < 0.40)      power = Math.round(5_000  + rng() * 20_000);   // casuals
    else if (tier < 0.72) power = Math.round(25_000 + rng() * 60_000);   // regulars
    else if (tier < 0.90) power = Math.round(85_000 + rng() * 120_000);  // dedicated
    else                  power = Math.round(205_000 + rng() * 200_000); // whales/endgame

    const nameIdx  = Math.floor(rng() * NPC_NAMES.length);
    const suffIdx  = Math.floor(rng() * TITLE_SUFFIXES.length);
    const avIdx    = Math.floor(rng() * AVATARS.length);

    pool.push({
      power,
      name:   NPC_NAMES[nameIdx]!,
      title:  TITLE_SUFFIXES[suffIdx]!,
      avatar: AVATARS[avIdx]!,
    });
  }

  return pool.sort((a, b) => b.power - a.power);
}

const DELTA_KEY = 'ci_leaderboard_delta';

function getWeekSeed(): number {
  const now = new Date();
  return now.getUTCFullYear() * 100 + Math.floor(
    (now.getUTCMonth() * 30 + now.getUTCDate()) / 7,
  );
}

function saveRankDelta(newRank: number): void {
  const prev = loadPrevRank();
  const delta = prev !== null ? (prev - newRank) : 0;
  localStorage.setItem(DELTA_KEY, JSON.stringify({ rank: newRank, delta }));
}

function loadPrevRank(): number | null {
  try {
    const raw = localStorage.getItem(DELTA_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { rank: number }).rank;
  } catch { return null; }
}

function loadDelta(): number {
  try {
    const raw = localStorage.getItem(DELTA_KEY);
    if (!raw) return 0;
    return (JSON.parse(raw) as { delta: number }).delta;
  } catch { return 0; }
}

// ── Public API ─────────────────────────────────────────────────

function getPlayerRank(playerPower: number): number {
  const pool = buildPool(getWeekSeed());
  const higher = pool.filter(n => n.power > playerPower).length;
  return higher + 1;
}

function getNearby(playerPower: number, spread = 2): LeaderboardEntry[] {
  const pool   = buildPool(getWeekSeed());
  const rank   = getPlayerRank(playerPower);
  const delta  = loadDelta();

  // Insert player at their rank
  const all = [
    ...pool.map((n, i) => ({ ...n, rank: i + 1, isPlayer: false, delta: 0 })),
  ];

  const playerEntry: typeof all[0] = {
    name:     'Du',
    title:    '',
    power:    playerPower,
    avatar:   '👑',
    rank,
    isPlayer: true,
    delta,
  };

  // Build a merged list around the player's rank
  const startRank = Math.max(1, rank - spread);
  const endRank   = rank + spread;

  const entries: LeaderboardEntry[] = [];

  for (let r = startRank; r <= endRank; r++) {
    if (r === rank) {
      entries.push(playerEntry);
    } else {
      const npc = all[r - 1];
      if (npc) entries.push({ ...npc, rank: r, isPlayer: false, delta: 0 });
    }
  }

  return entries;
}

function recordRank(playerPower: number): void {
  const rank = getPlayerRank(playerPower);
  saveRankDelta(rank);
}

export const LeaderboardService = {
  getPlayerRank,
  getNearby,
  recordRank,
  getTotalPlayers: () => 1001,
};
