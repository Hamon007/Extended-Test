/**
 * EventService.ts – Codex Immortalis
 * Limited-time events that give bonus rewards and themed content.
 * Events are date-ranged and deterministic for all players.
 */

export interface GameEvent {
  id:          string;
  name:        string;
  subtitle:    string;
  icon:        string;
  color:       string; // CSS color for theming
  startIso:    string; // YYYY-MM-DD UTC
  endIso:      string; // YYYY-MM-DD UTC (inclusive)
  crystalMult: number; // multiplier applied to victory crystals
  xpMult:      number;
  bannerDesc:  string; // one-line description for banner
}

const EVENTS: GameEvent[] = [
  {
    id:          'summer_festival_2026',
    name:        'Sommerfest der Ewigen',
    subtitle:    'Die Unsterblichen feiern — und du auch',
    icon:        '🌟',
    color:       '#ffd060',
    startIso:    '2026-06-11',
    endIso:      '2026-06-21',
    crystalMult: 1.5,
    xpMult:      1.25,
    bannerDesc:  '+50% Kristalle & +25% XP auf alle Siege',
  },
  {
    id:          'shadow_awakening_2026',
    name:        'Erwachen der Schatten',
    subtitle:    'Dunkle Mächte regen sich',
    icon:        '🌑',
    color:       '#b060ff',
    startIso:    '2026-07-01',
    endIso:      '2026-07-07',
    crystalMult: 2.0,
    xpMult:      1.5,
    bannerDesc:  '2× Kristalle & 1.5× XP – nur 7 Tage!',
  },
];

function utcDateStr(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, '0');
  const d = String(n.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function msUntilEventEnd(event: GameEvent): number {
  const end = new Date(event.endIso + 'T23:59:59Z');
  return Math.max(0, end.getTime() - Date.now());
}

function daysLeft(event: GameEvent): number {
  return Math.ceil(msUntilEventEnd(event) / 86_400_000);
}

class EventServiceImpl {
  getActive(): GameEvent | null {
    const today = utcDateStr();
    return EVENTS.find(e => e.startIso <= today && today <= e.endIso) ?? null;
  }

  getAll(): GameEvent[] {
    return EVENTS;
  }

  isActive(): boolean {
    return this.getActive() !== null;
  }

  getCrystalMult(): number {
    return this.getActive()?.crystalMult ?? 1.0;
  }

  getXpMult(): number {
    return this.getActive()?.xpMult ?? 1.0;
  }

  getDaysLeft(): number {
    const ev = this.getActive();
    return ev ? daysLeft(ev) : 0;
  }

  getMsLeft(): number {
    const ev = this.getActive();
    return ev ? msUntilEventEnd(ev) : 0;
  }
}

export const EventService = new EventServiceImpl();
