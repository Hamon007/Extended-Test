// ─────────────────────────────────────────────────────────────────────────────
// TowerService.ts  –  Codex Immortalis
// Turm der Prüfung — Etagen-Verwaltung und Gegner-Auswahl
// ─────────────────────────────────────────────────────────────────────────────

import type { TacticalEnemyConfig } from '../types/TacticalBattleTypes';
import { ELITE_ARCHETYPES, BOSS_ARCHETYPES } from '../data/tacticalEnemies';
import { SaveService } from './SaveService';

const KEY = 'ci_tower_floor';

export const TowerService = {
  getFloor(): number {
    return parseInt(localStorage.getItem(KEY) ?? '1', 10);
  },
  setFloor(n: number): void {
    localStorage.setItem(KEY, String(n));
    void SaveService.uploadSave();
  },
  advanceFloor(): number {
    const next = TowerService.getFloor() + 1;
    TowerService.setFloor(next);
    return next;
  },
  isBossFloor(floor: number): boolean {
    return floor % 10 === 0;
  },
  getBossForFloor(floor: number): TacticalEnemyConfig | null {
    // Find boss with exact bossFloor match
    const bosses = BOSS_ARCHETYPES.filter(b => b.bossFloor === floor);
    if (bosses.length > 0) return bosses[0];
    // Repeat last boss for floors > 100
    if (floor > 100) return BOSS_ARCHETYPES[BOSS_ARCHETYPES.length - 1];
    // Find nearest boss floor
    const f = Math.floor(floor / 10) * 10;
    return BOSS_ARCHETYPES.find(b => b.bossFloor === f) ?? BOSS_ARCHETYPES[0];
  },
  /** Returns null for normal floor, TacticalEnemyConfig for elite or boss */
  getFloorEnemy(floor: number): TacticalEnemyConfig | null {
    if (TowerService.isBossFloor(floor)) {
      return TowerService.getBossForFloor(floor);
    }
    // Elite spawn chance
    const eliteChance = floor <= 50 ? 0.10 : floor <= 150 ? 0.15 : 0.20;
    if (Math.random() < eliteChance) {
      const idx = Math.floor(Math.random() * ELITE_ARCHETYPES.length);
      return ELITE_ARCHETYPES[idx];
    }
    return null;
  },
  getHighestFloor(): number {
    return parseInt(localStorage.getItem('ci_tower_highest_floor') ?? '1', 10);
  },
  updateHighestFloor(floor: number): void {
    const current = TowerService.getHighestFloor();
    if (floor > current) {
      localStorage.setItem('ci_tower_highest_floor', String(floor));
      void SaveService.uploadSave();
    }
  },
};
