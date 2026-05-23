import { supabase } from '../lib/supabase';
import { AuthService } from './AuthService';
import type { CardInstance, GachaState } from '../types/GachaTypes';

export interface TradeRecord {
  id:               string;
  from_user_id:     string;
  to_user_id:       string;
  offered_card:     CardInstance;
  wanted_card_id:   string;
  wanted_card_name: string;
  status:           'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
  accepted_card:    CardInstance | null;
  created_at:       string;
  from_username?:   string;
  to_username?:     string;
}

async function findByFriendCode(code: string): Promise<{ user_id: string; username: string } | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('profiles')
    .select('user_id, username')
    .eq('friend_code', code.trim().toUpperCase())
    .maybeSingle();
  return data ?? null;
}

async function sendOffer(
  toUserId: string,
  offeredCard: CardInstance,
  wantedCardId: string,
  wantedCardName: string,
): Promise<string | null> {
  if (!supabase || !AuthService.isLoggedIn) return 'Nicht eingeloggt.';
  if (toUserId === AuthService.user!.id) return 'Du kannst nicht mit dir selbst handeln.';
  const { error } = await supabase.from('trades').insert({
    from_user_id: AuthService.user!.id,
    to_user_id:   toUserId,
    offered_card: offeredCard,
    wanted_card_id:   wantedCardId,
    wanted_card_name: wantedCardName,
  });
  return error ? error.message : null;
}

async function getIncoming(): Promise<TradeRecord[]> {
  if (!supabase || !AuthService.isLoggedIn) return [];
  const { data } = await supabase
    .from('trades_with_profiles')
    .select('*')
    .eq('to_user_id', AuthService.user!.id)
    .in('status', ['pending'])
    .order('created_at', { ascending: false });
  return (data ?? []) as TradeRecord[];
}

async function getOutgoing(): Promise<TradeRecord[]> {
  if (!supabase || !AuthService.isLoggedIn) return [];
  const { data } = await supabase
    .from('trades_with_profiles')
    .select('*')
    .eq('from_user_id', AuthService.user!.id)
    .in('status', ['pending', 'accepted', 'completed', 'rejected'])
    .order('created_at', { ascending: false });
  return (data ?? []) as TradeRecord[];
}

async function acceptTrade(trade: TradeRecord, acceptedCard: CardInstance): Promise<string | null> {
  if (!supabase || !AuthService.isLoggedIn) return 'Nicht eingeloggt.';
  const { error } = await supabase
    .from('trades')
    .update({ status: 'accepted', accepted_card: acceptedCard })
    .eq('id', trade.id)
    .eq('to_user_id', AuthService.user!.id);
  return error ? error.message : null;
}

async function rejectTrade(tradeId: string): Promise<string | null> {
  if (!supabase || !AuthService.isLoggedIn) return 'Nicht eingeloggt.';
  const { error } = await supabase
    .from('trades')
    .update({ status: 'rejected' })
    .eq('id', tradeId)
    .eq('to_user_id', AuthService.user!.id);
  return error ? error.message : null;
}

async function cancelTrade(tradeId: string): Promise<string | null> {
  if (!supabase || !AuthService.isLoggedIn) return 'Nicht eingeloggt.';
  const { error } = await supabase
    .from('trades')
    .update({ status: 'cancelled' })
    .eq('id', tradeId)
    .eq('from_user_id', AuthService.user!.id);
  return error ? error.message : null;
}

/**
 * Called on app startup. Finds accepted trades where current user is the sender,
 * applies the card swap to their GachaState, marks trades completed.
 * Returns the updated GachaState (or original if nothing to process).
 */
async function processAcceptedTrades(state: GachaState): Promise<{ state: GachaState; processed: number }> {
  if (!supabase || !AuthService.isLoggedIn) return { state, processed: 0 };
  const userId = AuthService.user!.id;

  const { data: trades } = await supabase
    .from('trades')
    .select('*')
    .eq('from_user_id', userId)
    .eq('status', 'accepted');

  if (!trades || trades.length === 0) return { state, processed: 0 };

  let newInventory = [...state.inventory];
  const completedIds: string[] = [];

  for (const trade of trades as TradeRecord[]) {
    if (!trade.accepted_card) continue;
    // Remove offered card from sender's inventory
    newInventory = newInventory.filter(i => i.uuid !== trade.offered_card.uuid);
    // Add received card
    newInventory.push(trade.accepted_card);
    completedIds.push(trade.id);
  }

  // Mark all as completed
  if (completedIds.length > 0) {
    await supabase
      .from('trades')
      .update({ status: 'completed' })
      .in('id', completedIds)
      .eq('from_user_id', userId);
  }

  return {
    state: { ...state, inventory: newInventory },
    processed: completedIds.length,
  };
}

export const TradeService = {
  findByFriendCode,
  sendOffer,
  getIncoming,
  getOutgoing,
  acceptTrade,
  rejectTrade,
  cancelTrade,
  processAcceptedTrades,
};
