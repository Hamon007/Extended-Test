import { supabase } from '../lib/supabase';
import { AuthService } from './AuthService';

export interface RealGuild {
  id: string;
  name: string;
  tag: string;
  emblem: string;
  description: string;
  leader_id: string;
  leader_username?: string;
  is_open: boolean;
  member_count?: number;
  created_at: string;
}

export interface GuildMemberEntry {
  id: string;
  guild_id: string;
  user_id: string;
  role: 'leader' | 'officer' | 'member';
  joined_at: string;
  username?: string;
}

export interface GuildApplication {
  id: string;
  guild_id: string;
  user_id: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  username?: string;
}

export const GuildNetworkService = {
  async getMyMembership(): Promise<{ guild_id: string; role: string } | null> {
    const userId = AuthService.user?.id;
    if (!supabase || !userId) return null;
    const { data } = await supabase
      .from('guild_members')
      .select('guild_id, role')
      .eq('user_id', userId)
      .maybeSingle();
    return data ?? null;
  },

  async getGuildById(id: string): Promise<RealGuild | null> {
    if (!supabase) return null;
    const { data } = await supabase
      .from('guilds')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!data) return null;
    const { count } = await supabase.from('guild_members').select('*', { count: 'exact', head: true }).eq('guild_id', id);
    return { ...data, member_count: count ?? 0 } as RealGuild;
  },

  async searchGuilds(query: string): Promise<RealGuild[]> {
    if (!supabase) return [];
    let q = supabase.from('guilds').select('*').limit(30);
    if (query.trim()) q = q.or(`name.ilike.%${query.trim()}%,tag.ilike.%${query.trim()}%`);
    const { data } = await q;
    return (data ?? []) as RealGuild[];
  },

  async createGuild(name: string, tag: string, emblem: string, description: string, isOpen: boolean): Promise<string | null> {
    const userId = AuthService.user?.id;
    if (!supabase || !userId) return 'Nicht eingeloggt.';
    // Block if already in a guild
    const existing = await GuildNetworkService.getMyMembership();
    if (existing) return 'Du bist bereits Mitglied einer Gilde.';
    const { data, error } = await supabase.from('guilds').insert({
      name: name.trim(), tag: tag.trim().toUpperCase(), emblem, description: description.trim(),
      leader_id: userId, is_open: isOpen,
    }).select('id').single();
    if (error) return error.message;
    await supabase.from('guild_members').insert({ guild_id: data.id, user_id: userId, role: 'leader' });
    return null;
  },

  async applyToGuild(guildId: string, message: string): Promise<string | null> {
    const userId = AuthService.user?.id;
    if (!supabase || !userId) return 'Nicht eingeloggt.';
    const existing = await GuildNetworkService.getMyMembership();
    if (existing) return 'Du bist bereits Mitglied einer Gilde.';
    const { error } = await supabase.from('guild_applications').insert({
      guild_id: guildId, user_id: userId, message: message.trim(),
    });
    if (error) {
      if (error.code === '23505') return 'Du hast dich bereits beworben.';
      return error.message;
    }
    return null;
  },

  async leaveGuild(guildId: string): Promise<string | null> {
    const userId = AuthService.user?.id;
    if (!supabase || !userId) return 'Nicht eingeloggt.';
    const { error } = await supabase.from('guild_members').delete()
      .eq('guild_id', guildId).eq('user_id', userId);
    return error ? error.message : null;
  },

  async getGuildMembers(guildId: string): Promise<GuildMemberEntry[]> {
    if (!supabase) return [];
    const { data } = await supabase
      .from('guild_members_with_profiles')
      .select('*')
      .eq('guild_id', guildId)
      .order('role');
    return (data ?? []) as GuildMemberEntry[];
  },

  async getPendingApplications(guildId: string): Promise<GuildApplication[]> {
    if (!supabase) return [];
    const { data } = await supabase
      .from('guild_applications_with_profiles')
      .select('*')
      .eq('guild_id', guildId)
      .eq('status', 'pending')
      .order('created_at');
    return (data ?? []) as GuildApplication[];
  },

  async acceptApplication(appId: string, userId: string, guildId: string): Promise<void> {
    if (!supabase) return;
    await supabase.from('guild_members').insert({ guild_id: guildId, user_id: userId, role: 'member' });
    await supabase.from('guild_applications').update({ status: 'accepted' }).eq('id', appId);
  },

  async rejectApplication(appId: string): Promise<void> {
    if (!supabase) return;
    await supabase.from('guild_applications').update({ status: 'rejected' }).eq('id', appId);
  },
};
