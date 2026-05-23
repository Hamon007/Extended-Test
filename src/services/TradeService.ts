import { supabase } from '../lib/supabase';
import { AuthService } from './AuthService';
import type { CardInstance, GachaState } from '../types/GachaTypes';

export interface Trade {
  id: string;
  poster_user_id: string;
  poster_username?: string;
  offered_card: CardInstance;
  wanted_card_id: string;
  wanted_card_name: string;
  allow_offers: boolean;
  status: 'open' | 'completed' | 'cancelled';
  completed_with_user_id: string | null;
  accepted_card: CardInstance | null;
  created_at: string;
  updated_at: string;
}

export interface TradeOffer {
  id: string;
  trade_id: string;
  from_user_id: string;
  from_username?: string;
  offered_card: CardInstance;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

const PROCESSED_KEY = 'ci_processed_trades_v2';

function getProcessed(): Set<string> {
  try {
    const raw = localStorage.getItem(PROCESSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function markProcessed(id: string): void {
  const set = getProcessed();
  set.add(id);
  localStorage.setItem(PROCESSED_KEY, JSON.stringify([...set]));
}

export const TradeService = {
  /** Post a new global listing */
  async listTrade(
    offeredCard: CardInstance,
    wantedCardId: string,
    wantedCardName: string,
    allowOffers: boolean,
  ): Promise<string | null> {
    const userId = AuthService.user?.id;
    if (!supabase || !userId) return 'Nicht eingeloggt.';
    const { error } = await supabase.from('trades').insert({
      poster_user_id: userId,
      offered_card: offeredCard,
      wanted_card_id: wantedCardId,
      wanted_card_name: wantedCardName,
      allow_offers: allowOffers,
    });
    return error ? error.message : null;
  },

  /** All open listings from other players */
  async getMarketplace(): Promise<Trade[]> {
    const userId = AuthService.user?.id;
    if (!supabase || !userId) return [];
    const { data } = await supabase
      .from('trades_with_profiles')
      .select('*')
      .eq('status', 'open')
      .neq('poster_user_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []) as Trade[];
  },

  /** My own listings (all statuses) */
  async getMyListings(): Promise<Trade[]> {
    const userId = AuthService.user?.id;
    if (!supabase || !userId) return [];
    const { data } = await supabase
      .from('trades_with_profiles')
      .select('*')
      .eq('poster_user_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []) as Trade[];
  },

  /** Direct accept: I have the exact wanted card */
  async acceptListing(trade: Trade, myCard: CardInstance): Promise<string | null> {
    const userId = AuthService.user?.id;
    if (!supabase || !userId) return 'Nicht eingeloggt.';
    const { error } = await supabase
      .from('trades')
      .update({
        status: 'completed',
        completed_with_user_id: userId,
        accepted_card: myCard,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trade.id)
      .eq('status', 'open');
    return error ? error.message : null;
  },

  /** Submit a counter-offer (alternative card) */
  async makeCounterOffer(tradeId: string, myCard: CardInstance): Promise<string | null> {
    const userId = AuthService.user?.id;
    if (!supabase || !userId) return 'Nicht eingeloggt.';
    const { error } = await supabase.from('trade_offers').insert({
      trade_id: tradeId,
      from_user_id: userId,
      offered_card: myCard,
    });
    return error ? error.message : null;
  },

  /** All pending counter-offers on my open listings */
  async getOffersOnMyListings(): Promise<TradeOffer[]> {
    const userId = AuthService.user?.id;
    if (!supabase || !userId) return [];
    const { data: myTrades } = await supabase
      .from('trades')
      .select('id')
      .eq('poster_user_id', userId)
      .eq('status', 'open');
    if (!myTrades?.length) return [];
    const { data } = await supabase
      .from('trade_offers_with_profiles')
      .select('*')
      .in('trade_id', myTrades.map(t => t.id))
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    return (data ?? []) as TradeOffer[];
  },

  /** Poster accepts a counter-offer */
  async acceptOffer(offer: TradeOffer, trade: Trade): Promise<string | null> {
    if (!supabase) return 'Nicht verbunden.';
    const { error } = await supabase.from('trades').update({
      status: 'completed',
      completed_with_user_id: offer.from_user_id,
      accepted_card: offer.offered_card,
      updated_at: new Date().toISOString(),
    }).eq('id', trade.id);
    if (error) return error.message;
    await supabase.from('trade_offers').update({ status: 'accepted' }).eq('id', offer.id);
    await supabase.from('trade_offers').update({ status: 'rejected' })
      .eq('trade_id', trade.id).neq('id', offer.id);
    return null;
  },

  async rejectOffer(offerId: string): Promise<void> {
    if (!supabase) return;
    await supabase.from('trade_offers').update({ status: 'rejected' }).eq('id', offerId);
  },

  async cancelListing(tradeId: string): Promise<string | null> {
    if (!supabase) return 'Nicht verbunden.';
    const { error } = await supabase.from('trades').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('id', tradeId);
    return error ? error.message : null;
  },

  /**
   * Called on startup: applies pending card swaps from completed trades.
   * – As poster: offered_card left inventory, accepted_card entered
   * – As offer-maker: own offered_card left, original offered_card entered
   */
  async processCompletedListings(state: GachaState): Promise<{ state: GachaState; processed: number }> {
    const userId = AuthService.user?.id;
    if (!supabase || !userId) return { state, processed: 0 };

    const processed = getProcessed();
    const inventory = [...state.inventory];
    let count = 0;

    const { data: completedAsPosted } = await supabase
      .from('trades')
      .select('*')
      .eq('poster_user_id', userId)
      .eq('status', 'completed');

    for (const t of (completedAsPosted ?? []) as Trade[]) {
      const key = `posted_${t.id}`;
      if (processed.has(key)) continue;
      const idx = inventory.findIndex(c => c.uuid === t.offered_card.uuid);
      if (idx !== -1) inventory.splice(idx, 1);
      if (t.accepted_card) inventory.push({ ...t.accepted_card });
      markProcessed(key);
      count++;
    }

    const { data: acceptedOffers } = await supabase
      .from('trade_offers')
      .select('*, trades(*)')
      .eq('from_user_id', userId)
      .eq('status', 'accepted');

    for (const o of (acceptedOffers ?? []) as (TradeOffer & { trades: Trade })[]) {
      const key = `offer_${o.id}`;
      if (processed.has(key)) continue;
      const idx = inventory.findIndex(c => c.uuid === o.offered_card.uuid);
      if (idx !== -1) inventory.splice(idx, 1);
      if (o.trades?.offered_card) inventory.push({ ...o.trades.offered_card });
      markProcessed(key);
      count++;
    }

    return { state: { ...state, inventory }, processed: count };
  },
};
