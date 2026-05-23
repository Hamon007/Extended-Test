import { supabase } from '../lib/supabase';
import { AuthService } from './AuthService';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  requester_username?: string;
  addressee_username?: string;
  requester_friend_code?: string;
  addressee_friend_code?: string;
}

/** Returns the other person's info from a friendship record. */
export function otherSide(f: Friendship, myId: string) {
  if (f.requester_id === myId) {
    return { username: f.addressee_username ?? '?', friendCode: f.addressee_friend_code ?? '' };
  }
  return { username: f.requester_username ?? '?', friendCode: f.requester_friend_code ?? '' };
}

export const FriendService = {
  async sendRequest(friendCode: string): Promise<string | null> {
    const userId = AuthService.user?.id;
    if (!supabase || !userId) return 'Nicht eingeloggt.';

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('friend_code', friendCode.trim().toUpperCase())
      .maybeSingle();

    if (!profile) return 'Kein Spieler mit diesem Code gefunden.';
    if (profile.user_id === userId) return 'Das bist du selbst.';

    // Check if friendship already exists in either direction
    const { data: existing } = await supabase
      .from('friendships')
      .select('id')
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${profile.user_id}),` +
        `and(requester_id.eq.${profile.user_id},addressee_id.eq.${userId})`
      )
      .maybeSingle();

    if (existing) return 'Bereits befreundet oder Anfrage ausstehend.';

    const { error } = await supabase.from('friendships').insert({
      requester_id: userId,
      addressee_id: profile.user_id,
    });
    return error ? error.message : null;
  },

  /** Returns all accepted friendships for the current user. */
  async getFriends(): Promise<Friendship[]> {
    const userId = AuthService.user?.id;
    if (!supabase || !userId) return [];
    const { data } = await supabase
      .from('friendships_with_profiles')
      .select('*')
      .eq('status', 'accepted');
    return (data ?? []) as Friendship[];
  },

  /** Returns pending friend requests addressed to the current user. */
  async getIncomingRequests(): Promise<Friendship[]> {
    const userId = AuthService.user?.id;
    if (!supabase || !userId) return [];
    const { data } = await supabase
      .from('friendships_with_profiles')
      .select('*')
      .eq('addressee_id', userId)
      .eq('status', 'pending');
    return (data ?? []) as Friendship[];
  },

  async acceptRequest(id: string): Promise<void> {
    if (!supabase) return;
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
  },

  async declineRequest(id: string): Promise<void> {
    if (!supabase) return;
    await supabase.from('friendships').delete().eq('id', id);
  },

  async removeFriend(id: string): Promise<void> {
    if (!supabase) return;
    await supabase.from('friendships').delete().eq('id', id);
  },
};
