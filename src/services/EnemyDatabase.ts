/**
 * EnemyDatabase.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Lädt und validiert Gegner aus enemies.json.
 * Singleton, analog zu CardDatabase.
 * ─────────────────────────────────────────────────────────────
 */

import type { EnemyData } from '../types/BattleTypes';
import rawData from '../data/enemies.json';

function isValidEnemy(raw: unknown): raw is EnemyData {
  if (!raw || typeof raw !== 'object') return false;
  const e = raw as Record<string, unknown>;
  return (
    typeof e.id     === 'string' && e.id.length > 0 &&
    typeof e.name   === 'string' &&
    typeof e.stats  === 'object' && e.stats !== null &&
    Array.isArray(e.cards)
  );
}

class EnemyDatabaseService {
  private enemies: EnemyData[] = [];
  private byId:    Map<string, EnemyData> = new Map();
  private ready    = false;

  init(): void {
    if (this.ready) return;
    const raw = (rawData as { enemies: unknown[] }).enemies;
    for (const entry of raw) {
      if (isValidEnemy(entry)) {
        this.enemies.push(entry);
        this.byId.set(entry.id, entry);
      } else {
        console.warn('[EnemyDatabase] Ungültiger Gegner übersprungen:', entry);
      }
    }
    this.ready = true;
    console.log(`[EnemyDatabase] ${this.enemies.length} Gegner geladen.`);
  }

  getAll():                   EnemyData[]            { return [...this.enemies]; }
  getById(id: string):        EnemyData | undefined  { return this.byId.get(id); }
  getByTier(tier: number):    EnemyData[]            { return this.enemies.filter(e => e.tier === tier); }
  getFirst():                 EnemyData | undefined  { return this.enemies[0]; }
  count():                    number                  { return this.enemies.length; }
}

export const EnemyDatabase = new EnemyDatabaseService();
