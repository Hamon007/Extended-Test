const KEY = 'ci_pvp_history';
const MAX  = 10;

export interface PvpMatchRecord {
  opponentName: string;
  result:       'win' | 'loss';
  timestamp:    number;
}

function load(): PvpMatchRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PvpMatchRecord[]) : [];
  } catch { return []; }
}

function record(entry: Omit<PvpMatchRecord, 'timestamp'>): void {
  const history = load();
  history.unshift({ ...entry, timestamp: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(history.slice(0, MAX)));
}

function getAll(): PvpMatchRecord[] {
  return load();
}

export const PvpHistoryService = { record, getAll };
