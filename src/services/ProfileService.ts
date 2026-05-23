import { supabase } from '../lib/supabase';
import { AuthService } from './AuthService';

export interface Profile {
  user_id:             string;
  username:            string;
  friend_code:         string;
  username_changed_at: string | null;
  created_at:          string;
}

function generateFriendCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

export function canChangeUsername(lastChanged: string | null): boolean {
  if (!lastChanged) return true;
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return new Date(lastChanged) < sixMonthsAgo;
}

export function nextChangeDate(lastChanged: string | null): string {
  if (!lastChanged) return '';
  const d = new Date(lastChanged);
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function getOrCreate(): Promise<Profile | null> {
  if (!supabase || !AuthService.isLoggedIn) return null;
  const userId = AuthService.user!.id;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) { console.warn('[ProfileService] Ladefehler:', error.message); return null; }
  if (data) return data as Profile;

  // First visit — create profile
  const { data: created, error: insertErr } = await supabase
    .from('profiles')
    .insert({ user_id: userId, username: 'Spieler', friend_code: generateFriendCode() })
    .select()
    .single();

  if (insertErr) { console.warn('[ProfileService] Erstellfehler:', insertErr.message); return null; }
  return created as Profile;
}

async function updateUsername(newName: string): Promise<string | null> {
  if (!supabase || !AuthService.isLoggedIn) return 'Nicht eingeloggt.';

  const trimmed = newName.trim();
  if (trimmed.length < 3 || trimmed.length > 20) return 'Name muss 3–20 Zeichen lang sein.';

  const profile = await getOrCreate();
  if (!profile) return 'Profil nicht gefunden.';
  if (!canChangeUsername(profile.username_changed_at))
    return `Nächste Änderung erst ab ${nextChangeDate(profile.username_changed_at)}.`;

  const { error } = await supabase
    .from('profiles')
    .update({ username: trimmed, username_changed_at: new Date().toISOString() })
    .eq('user_id', AuthService.user!.id);

  return error ? error.message : null;
}

export const ProfileService = { getOrCreate, updateUsername, canChangeUsername, nextChangeDate };
