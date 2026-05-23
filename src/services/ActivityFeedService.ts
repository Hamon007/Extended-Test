import { supabase } from '../lib/supabase';
import { AuthService } from './AuthService';

export type FeedEventType = 'pull_ssr' | 'pull_mr' | 'fusion_lr' | 'level_cap' | 'awaken';

export interface FeedEvent {
  id: string;
  user_id: string;
  username?: string;
  type: FeedEventType;
  payload: Record<string, unknown>;
  created_at: string;
}

/** Fire-and-forget: post a global activity event. No-op if not logged in. */
function post(type: FeedEventType, payload: Record<string, unknown>): void {
  const userId = AuthService.user?.id;
  if (!supabase || !userId) return;
  void supabase.from('activity_feed').insert({ user_id: userId, type, payload });
}

/**
 * Fetch recent events. Tries the view (with username) first;
 * falls back to the raw table if the view doesn't exist yet.
 */
async function getRecent(limit = 20): Promise<FeedEvent[]> {
  if (!supabase) return [];

  // Primary: view with joined username
  const { data, error } = await supabase
    .from('activity_feed_with_profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!error) return (data ?? []) as FeedEvent[];

  // Fallback: raw table (no username, still shows events)
  const { data: raw } = await supabase
    .from('activity_feed')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (raw ?? []) as FeedEvent[];
}

/**
 * Subscribe to new inserts via Supabase Realtime.
 * Returns an unsubscribe function.
 */
function subscribeToNew(onNew: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('activity_feed_live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_feed' }, onNew)
    .subscribe();
  return () => { void supabase!.removeChannel(channel); };
}

export function formatEvent(evt: FeedEvent): string {
  const name = evt.username ?? 'Unbekannt';
  const p = evt.payload as Record<string, string | number>;
  switch (evt.type) {
    case 'pull_ssr':  return `⭐ ${name} hat ${p.cardName} (SSR) beschworen!`;
    case 'pull_mr':   return `✨ ${name} hat ${p.cardName} (MR) beschworen!`;
    case 'fusion_lr': return `🌟 ${name} hat ${p.cardName} zu LR fusioniert!`;
    case 'level_cap': return `🏆 ${name} hat Level ${p.level} erreicht!`;
    case 'awaken':    return `💫 ${name} hat ${p.fromName} zu ${p.toName} erweckt!`;
    default:          return '';
  }
}

export const ActivityFeedService = { post, getRecent, subscribeToNew, formatEvent };
