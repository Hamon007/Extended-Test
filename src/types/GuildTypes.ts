// ─────────────────────────────────────────────────────────────────────────────
// GuildTypes.ts  –  Codex Immortalis Gilden-System
// ─────────────────────────────────────────────────────────────────────────────

export type GuildRole = 'leader' | 'officer' | 'member';

export interface GuildMember {
  id:                  string;
  name:                string;
  role:                GuildRole;
  weeklyContribution:  number;   // Kristall-Spenden dieser Woche
  isPlayer:            boolean;
}

// ── Persistierter State (localStorage) ───────────────────────────────────────

export interface GuildSaveState {
  playerWeeklyContribution: number;    // Spenden des Spielers in dieser Woche
  lastWeekKey:              string;    // "YYYY-WNN" — Wochenschlüssel für Reset
  bossCurrentHp:            number;
  bossAttacksLeft:          number;    // verbleibende Angriffe auf Boss diese Woche
  bossResetKey:             string;    // Wochenschlüssel für Boss-Reset
  bossCleared:              boolean;   // Boss diese Woche besiegt?
  guildXp:                  number;    // kumuliertes Gilden-XP
}

// ── Ergebnis eines Boss-Angriffs ──────────────────────────────────────────────

export interface BossAttackResult {
  damage:       number;
  hpAfter:      number;
  cleared:      boolean;
  crystalsWon:  number;  // > 0 wenn cleared
  potionsWon:   number;
}
