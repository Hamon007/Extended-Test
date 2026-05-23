/**
 * GameConfig.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * ZENTRALE BALANCING-DATEI.
 * Alle Spielkonstanten an einem Ort — hier tunen, nirgendwo sonst.
 *
 * Sektionen:
 *   Battle · Combo · Deck · Gacha · Economy · Energy
 *   Level · Fusion · Awakening · Guild
 * ─────────────────────────────────────────────────────────────
 */

// ── Battle ────────────────────────────────────────────────────

export const MAX_ROUNDS      = 10;
export const PLAYER_HP_BASE  = 50_000;   // Gesamt-HP des Spielers
export const PLAYER_MP_MAX   = 120;
export const PLAYER_MP_REGEN = 45;       // MP-Regen pro Runde
export const PLAYER_MP_START = 120;      // MP zu Beginn des Kampfes
export const HAND_LIMIT      = 5;        // max. Karten gleichzeitig in der Hand (Rest wird nachgezogen)

export const ENEMY_TURN_DELAY_MS = 800;  // Pause vor Gegnerzug (UX)
export const ROUND_END_DELAY_MS  = 600;  // Pause nach Gegnerzug
export const ACCOUNT_CONSOLATION_XP = 10; // Trost-XP bei Niederlage

// ── Combo ─────────────────────────────────────────────────────

export const COMBO_WINDOW_MS   = 1_500;  // Basis-Fenster in ms
export const SYNERGY_BONUS_MS  = 300;    // Fenster-Verlängerung bei Synergy-Tag
export const MAX_COMBO         = 5;
export const COMBO_BREAK_DUR_MS = 700;   // Dauer der Break-Animation
export const COMBO_TICK_MS      = 50;    // Timer-Auflösung

/** Schaden-Multiplikatoren je Combo-Stufe (Index = Combo-Count, 0 = ungenutzt) */
export const COMBO_MULTIPLIERS = [0, 1.0, 1.3, 1.7, 2.2, 3.0] as const;

export const SYNERGY_DAMAGE_BONUS = 0.15;  // +15 % additiv auf Gesamtmultiplikator
export const ELEMENT_ADV_BONUS    = 0.20;  // +20 % additiv

// ── Deck ──────────────────────────────────────────────────────

export const DECK_SIZE     = 10;
export const MAX_DECK_COST = 800;  // max. Gesamt-MP im Deck

// ── Gacha ─────────────────────────────────────────────────────

export const PULL_COST_SINGLE  = 100;
export const PULL_COST_MULTI   = 1_000;
export const MULTI_PULL_COUNT  = 10;
export const PITY_THRESHOLD    = 100;       // Pull 100 garantiert SSR
export const STARTING_CRYSTALS = 999_999;   // Alpha: unbegrenzt

// ── Economy / Belohnungen ─────────────────────────────────────

export const DAILY_BONUS_CRYSTALS     = 200;   // Tages-Login-Bonus
export const DEFEAT_CONSOLATION       = 10;    // Kristalle bei Niederlage
export const POTION_DROP_CHANCE       = 0.35;  // Chance auf Trank bei Sieg
export const CRYSTAL_CARD_DROP_CHANCE = 0.10;  // Chance auf kleine Kristallkarte bei Sieg

/** Startkonto Kristallkarten (neue Spieler) */
export const STARTING_CRYSTAL_CARDS = { small: 3, medium: 1, large: 0 } as const;

// ── Energie ───────────────────────────────────────────────────

export const MAX_BATTLE_ENERGY = 5;
export const ENERGY_PER_BATTLE = 1;
export const STARTING_POTIONS  = 3;
export const POTION_RESTORE    = 1;

// ── Level-System ──────────────────────────────────────────────

/** Maximales Level je Hauptstufe */
export const LEVEL_CAP_BY_MAJOR: Record<string, number> = {
  N: 20, R: 30, SR: 40, SSR: 50, MR: 60, LR: 70,
};

/** XP, die eine Kristallkarte gewährt */
export const CRYSTAL_CARD_XP = {
  small:  500,
  medium: 2_000,
  large:  5_000,
} as const;

export const XP_PER_LEVEL_FACTOR    = 100;    // xpToNext(L) = L × 100
export const LEVEL_ATK_BONUS_PER_LV = 0.005;  // +0,5 % ATK je Level über 1
export const LEVEL_DEF_BONUS_PER_LV = 0.005;  // +0,5 % DEF je Level über 1
export const LEVEL_HP_BONUS_PER_LV  = 0.003;  // +0,3 % HP  je Level über 1

/** Basis-XP beim Opfern einer Karte nach Hauptstufe */
export const SACRIFICE_XP_BASE: Record<string, number> = {
  N:   300,
  R:   600,
  SR:  1_200,
  SSR: 2_500,
  MR:  5_000,
  LR:  10_000,
};

export const SACRIFICE_XP_PER_LEVEL = 50;  // Bonus-XP pro Level über 1

// ── Fusion ────────────────────────────────────────────────────

export const DUPLICATES_PER_STEP = 1;  // Duplikate je Fusionsschritt

/** Kristallkosten je Fusionsschritt nach Hauptstufe der Trägerkarte */
export const STEP_CRYSTAL_COST: Record<string, number> = {
  N:    50,
  R:    150,
  SR:   400,
  SSR:  1_000,
  MR:   3_000,
  LR:   8_000,
};

export const FUSION_ATK_PER_RANK    = 0.12;  // +12 % ATK je Unterstufe über Basis
export const FUSION_DEF_PER_RANK    = 0.12;  // +12 % DEF
export const FUSION_HP_PER_RANK     = 0.10;  // +10 % HP
export const FUSION_MP_CUT_PER_RANK = 0.06;  // −6 % MP-Kosten
export const FUSION_CRIT_PER_RANK   = 1;     // +1 % Krit (falls vorhanden)

// ── Awakening ─────────────────────────────────────────────────

export const AWAKENING_CRYSTAL_COST = 25_000;

// ── Gilde ─────────────────────────────────────────────────────

export const GUILD_NAME                    = 'Codex Immortalis';
export const GUILD_BOSS_MAX_HP             = 30_000;
export const GUILD_BOSS_ATTACKS            = 5;       // Angriffe pro Woche
export const GUILD_BOSS_REWARD_CRYSTALS    = 2_000;
export const GUILD_BOSS_REWARD_POTIONS     = 2;
export const GUILD_XP_PER_CRYSTAL         = 1;       // 1 Kristall = 1 Gildenpunkt
export const GUILD_LEVEL_THRESHOLDS        = [0, 5_000, 15_000, 40_000, 100_000] as const;
export const GUILD_BOSS_BASE_DAMAGE        = 2_000;   // Grundschaden unabhängig von ATK
export const GUILD_BOSS_ATK_FACTOR_MIN     = 0.08;   // ATK-Multiplikator Minimum
export const GUILD_BOSS_ATK_FACTOR_VARIANCE = 0.06;  // Zufallsanteil auf ATK-Multiplikator
