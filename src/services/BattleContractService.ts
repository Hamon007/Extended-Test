/**
 * BattleContractService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Before each tower battle, activate a random one-battle contract.
 * Players earn bonus crystals by meeting the contract condition.
 * Contracts reset every battle — they're optional, per-battle
 * micro-goals that add strategy without punishing failure.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

export type ContractType =
  | 'no_damage'     // win without taking any HP damage
  | 'speed'         // win within 4 rounds
  | 'combo_5'       // achieve max combo ×5 at least once
  | 'high_hp'       // finish with ≥ 75% HP
  | 'clutch'        // win with < 25% HP (thrill seeker)
  | 'big_damage';   // deal 10000+ total damage

export interface BattleContract {
  type:     ContractType;
  label:    string;
  hint:     string;
  icon:     string;
  crystals: number;
}

const CONTRACTS: BattleContract[] = [
  { type: 'no_damage',  label: 'Unberührt',          hint: 'Gewinne ohne HP-Verlust',         icon: '💎', crystals: 80  },
  { type: 'speed',      label: 'Blitzsieg',           hint: 'Gewinne in max. 4 Runden',        icon: '⚡', crystals: 70  },
  { type: 'combo_5',    label: 'Meister-Kombo',       hint: 'Erziele eine Kombo ×5',           icon: '🌪', crystals: 90  },
  { type: 'high_hp',    label: 'Dominanz',            hint: 'Beende mit ≥ 75% HP',             icon: '🛡', crystals: 65  },
  { type: 'clutch',     label: 'Auf Messers Schneide', hint: 'Gewinne mit < 25% HP',           icon: '🔥', crystals: 120 },
  { type: 'big_damage', label: 'Vernichtung',         hint: 'Teile 10.000+ Gesamtschaden aus', icon: '💥', crystals: 75  },
];

const KEY = 'ci_battle_contract';

interface ContractState {
  contract:  BattleContract;
  battleId:  number; // each battle gets an incremented ID
  completed: boolean;
}

function loadState(): ContractState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ContractState) : null;
  } catch { return null; }
}

function saveState(st: ContractState): void {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ }
}

let _currentBattleId = 0;

/** Call when starting a new battle. Returns the active contract for this battle. */
function startBattle(): BattleContract {
  _currentBattleId += 1;
  const idx = Math.floor(Math.random() * CONTRACTS.length);
  const contract = CONTRACTS[idx]!;
  saveState({ contract, battleId: _currentBattleId, completed: false });
  return contract;
}

/** Get the currently active contract (null if no battle started). */
function getActive(): BattleContract | null {
  const st = loadState();
  return st?.completed === false ? st.contract : null;
}

interface ContractResult {
  met:       boolean;
  contract:  BattleContract;
  crystals:  number;
}

/**
 * Evaluate the contract after a battle.
 * Returns result and applies crystal reward if met.
 */
function evaluate(params: {
  won:         boolean;
  playerHpPct: number;   // 0-1
  roundsElapsed: number;
  maxCombo:    number;
  totalDamage: number;
}): ContractResult | null {
  const st = loadState();
  if (!st || st.completed) return null;

  const c = st.contract;
  let met = false;

  if (params.won) {
    switch (c.type) {
      case 'no_damage':  met = params.playerHpPct >= 1.0; break;
      case 'speed':      met = params.roundsElapsed <= 4 && params.roundsElapsed > 0; break;
      case 'combo_5':    met = params.maxCombo >= 5; break;
      case 'high_hp':    met = params.playerHpPct >= 0.75; break;
      case 'clutch':     met = params.playerHpPct > 0 && params.playerHpPct < 0.25; break;
      case 'big_damage': met = params.totalDamage >= 10_000; break;
    }
  }

  st.completed = true;
  saveState(st);

  if (met) {
    const gs = SaveService.loadGachaState();
    SaveService.saveGachaState({ ...gs, crystals: gs.crystals + c.crystals });
  }

  return { met, contract: c, crystals: met ? c.crystals : 0 };
}

/** Clear the current contract (e.g., on defeat — contract resets for next battle). */
function clear(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export const BattleContractService = {
  startBattle,
  getActive,
  evaluate,
  clear,
  CONTRACTS,
};
