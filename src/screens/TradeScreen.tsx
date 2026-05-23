import React, { useState, useEffect, useCallback } from 'react';
import { AuthService } from '../services/AuthService';
import { TradeService, type Trade, type TradeOffer } from '../services/TradeService';
import { SaveService } from '../services/SaveService';
import { CardDatabase } from '../services/CardDatabase';
import type { CardInstance } from '../types/GachaTypes';
import type { Card } from '../types/Card';
import { RARITY_COLOR, rarityMajor } from '../types/Card';
import './TradeScreen.css';

interface Props { onBack: () => void; }

type Tab  = 'market' | 'mine';
type Step = 'list' | 'new-offer' | 'new-want' | 'new-confirm';

const TradeScreen: React.FC<Props> = ({ onBack }) => {
  const [tab,          setTab]          = useState<Tab>('market');
  const [step,         setStep]         = useState<Step>('list');
  const [market,       setMarket]       = useState<Trade[]>([]);
  const [myListings,   setMyListings]   = useState<Trade[]>([]);
  const [myOffers,     setMyOffers]     = useState<TradeOffer[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [msg,          setMsg]          = useState('');

  // New listing state
  const [offerCard,    setOfferCard]    = useState<CardInstance | null>(null);
  const [wantCard,     setWantCard]     = useState<Card | null>(null);
  const [allowOffers,  setAllowOffers]  = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  // Accept overlay
  const [acceptTrade,  setAcceptTrade]  = useState<Trade | null>(null);
  const [acceptCard,   setAcceptCard]   = useState<CardInstance | null>(null);
  const [accepting,    setAccepting]    = useState(false);

  // Counter-offer overlay
  const [counterTrade, setCounterTrade] = useState<Trade | null>(null);
  const [counterCard,  setCounterCard]  = useState<CardInstance | null>(null);
  const [countering,   setCountering]   = useState(false);

  const gachaState  = SaveService.loadGachaState();
  const myInventory = gachaState.inventory;
  const allCards    = CardDatabase.getAll();
  const isLoggedIn  = AuthService.isLoggedIn;

  const load = useCallback(async () => {
    setLoading(true);
    const [mk, ml, mo] = await Promise.all([
      TradeService.getMarketplace(),
      TradeService.getMyListings(),
      TradeService.getOffersOnMyListings(),
    ]);
    setMarket(mk);
    setMyListings(ml);
    setMyOffers(mo);
    setLoading(false);
  }, []);

  useEffect(() => { if (isLoggedIn) load(); else setLoading(false); }, [load, isLoggedIn]);

  // ── New listing flow ─────────────────────────────────────────

  const resetNew = () => {
    setOfferCard(null);
    setWantCard(null);
    setAllowOffers(false);
  };

  const handleSubmit = async () => {
    if (!offerCard || !wantCard) return;
    setSubmitting(true);
    const err = await TradeService.listTrade(offerCard, wantCard.id, wantCard.name, allowOffers);
    setSubmitting(false);
    if (err) { setMsg('Fehler: ' + err); return; }

    // Remove the offered card from local save immediately
    const newInv = myInventory.filter(c => c.uuid !== offerCard.uuid);
    SaveService.saveGachaState({ ...gachaState, inventory: newInv });

    setMsg('Inserat aufgegeben! ✓');
    setStep('list');
    resetNew();
    load();
  };

  // ── Accept flow ──────────────────────────────────────────────

  const handleAccept = async () => {
    if (!acceptTrade || !acceptCard) return;
    setAccepting(true);
    const err = await TradeService.acceptListing(acceptTrade, acceptCard);
    if (err) { setMsg('Fehler: ' + err); setAccepting(false); return; }

    // Immediately apply swap for acceptor: remove given card, add received card
    const newInv = myInventory
      .filter(c => c.uuid !== acceptCard.uuid)
      .concat({ ...acceptTrade.offered_card });
    SaveService.saveGachaState({ ...gachaState, inventory: newInv });

    setAccepting(false);
    setAcceptTrade(null);
    setAcceptCard(null);
    setMsg('Handel abgeschlossen! ✓');
    load();
  };

  // ── Counter-offer flow ───────────────────────────────────────

  const handleCounterOffer = async () => {
    if (!counterTrade || !counterCard) return;
    setCountering(true);
    const err = await TradeService.makeCounterOffer(counterTrade.id, counterCard);
    setCountering(false);
    if (err) { setMsg('Fehler: ' + err); return; }
    setCounterTrade(null);
    setCounterCard(null);
    setMsg('Gegenangebot gesendet! ✓');
  };

  // ── Poster accepting a counter-offer ────────────────────────

  const handleAcceptOffer = async (offer: TradeOffer, trade: Trade) => {
    const err = await TradeService.acceptOffer(offer, trade);
    if (err) { setMsg('Fehler: ' + err); return; }

    // Apply swap for poster: remove offered_card, add offer's card
    const newInv = myInventory
      .filter(c => c.uuid !== trade.offered_card.uuid)
      .concat({ ...offer.offered_card });
    SaveService.saveGachaState({ ...gachaState, inventory: newInv });

    setMsg('Gegenangebot angenommen! ✓');
    load();
  };

  // ── Render helpers ───────────────────────────────────────────

  const CardChip: React.FC<{
    inst: CardInstance;
    selected?: boolean;
    onClick?: () => void;
  }> = ({ inst, selected, onClick }) => {
    const card  = CardDatabase.getById(inst.cardId);
    const color = RARITY_COLOR[inst.rarity];
    return (
      <button
        className={`trade-card-chip${selected ? ' trade-card-chip--selected' : ''}`}
        onClick={onClick}
      >
        <img className="trade-card-chip__img" src={card?.image} alt={card?.name ?? inst.cardId} />
        <span className="trade-card-chip__rarity" style={{ color }}>{rarityMajor(inst.rarity)}</span>
        <span className="trade-card-chip__name">{card?.name ?? inst.cardId}</span>
      </button>
    );
  };

  const CatalogChip: React.FC<{
    card: Card;
    selected?: boolean;
    onClick?: () => void;
  }> = ({ card, selected, onClick }) => {
    const color = RARITY_COLOR[card.rarity];
    return (
      <button
        className={`trade-card-chip${selected ? ' trade-card-chip--selected' : ''}`}
        onClick={onClick}
      >
        <img className="trade-card-chip__img" src={card.image} alt={card.name} />
        <span className="trade-card-chip__rarity" style={{ color }}>{rarityMajor(card.rarity)}</span>
        <span className="trade-card-chip__name">{card.name}</span>
      </button>
    );
  };

  const TradeCardPair: React.FC<{ trade: Trade }> = ({ trade }) => {
    const offered = CardDatabase.getById(trade.offered_card.cardId);
    const wanted  = CardDatabase.getById(trade.wanted_card_id);
    return (
      <div className="trade-row__cards">
        <div className="trade-row__card-box">
          <img src={offered?.image} alt={offered?.name} className="trade-row__img" />
          <span className="trade-row__card-name">{offered?.name ?? '?'}</span>
          <span className="trade-row__rarity" style={{ color: RARITY_COLOR[trade.offered_card.rarity] }}>
            {rarityMajor(trade.offered_card.rarity)}
          </span>
        </div>
        <span className="trade-row__arrow">⇌</span>
        <div className="trade-row__card-box">
          <img src={wanted?.image} alt={trade.wanted_card_name} className="trade-row__img" />
          <span className="trade-row__card-name">{trade.wanted_card_name}</span>
          <span className="trade-row__rarity" style={{ color: 'var(--gold-dark)' }}>gesucht</span>
        </div>
      </div>
    );
  };

  // ── Market listing row ────────────────────────────────────────

  const MarketRow: React.FC<{ trade: Trade }> = ({ trade }) => {
    const hasWanted = myInventory.some(c => c.cardId === trade.wanted_card_id);
    return (
      <div className="trade-row">
        <TradeCardPair trade={trade} />
        <div className="trade-row__meta">
          <span className="trade-row__player">Von: {trade.poster_username ?? '?'}</span>
          {trade.allow_offers && (
            <span className="trade-row__allow-badge">Angebote ✓</span>
          )}
        </div>
        <div className="trade-row__actions">
          {hasWanted && (
            <button className="trade-row__btn trade-row__btn--accept"
              onClick={() => { setAcceptTrade(trade); setAcceptCard(null); }}>
              Annehmen
            </button>
          )}
          {trade.allow_offers && (
            <button className="trade-row__btn trade-row__btn--offer"
              onClick={() => { setCounterTrade(trade); setCounterCard(null); }}>
              Angebot machen
            </button>
          )}
          {!hasWanted && !trade.allow_offers && (
            <span className="trade-row__no-action">Karte nicht vorhanden</span>
          )}
        </div>
      </div>
    );
  };

  // ── My listing row ────────────────────────────────────────────

  const MyListingRow: React.FC<{ trade: Trade }> = ({ trade }) => {
    const pendingOffers = myOffers.filter(o => o.trade_id === trade.id);
    const statusLabel: Record<string, string> = {
      open: 'Offen', completed: 'Abgeschlossen', cancelled: 'Storniert',
    };
    return (
      <div className="trade-row">
        <TradeCardPair trade={trade} />
        <div className="trade-row__meta">
          <span className={`trade-row__status trade-row__status--${trade.status}`}>
            {statusLabel[trade.status] ?? trade.status}
          </span>
          {trade.allow_offers && trade.status === 'open' && (
            <span className="trade-row__allow-badge">Angebote erlaubt</span>
          )}
        </div>

        {trade.status === 'open' && pendingOffers.length > 0 && (
          <div className="trade-offers-section">
            <p className="trade-offers-label">Gegenangebote ({pendingOffers.length})</p>
            {pendingOffers.map(offer => {
              const oCard = CardDatabase.getById(offer.offered_card.cardId);
              return (
                <div key={offer.id} className="trade-offer-row">
                  <img src={oCard?.image} alt={oCard?.name} className="trade-offer-row__img" />
                  <div className="trade-offer-row__info">
                    <span className="trade-offer-row__name">{oCard?.name ?? '?'}</span>
                    <span className="trade-offer-row__by">von {offer.from_username ?? '?'}</span>
                  </div>
                  <div className="trade-offer-row__btns">
                    <button className="trade-row__btn trade-row__btn--accept"
                      onClick={() => handleAcceptOffer(offer, trade)}>
                      ✓
                    </button>
                    <button className="trade-row__btn trade-row__btn--reject"
                      onClick={() => { TradeService.rejectOffer(offer.id); load(); }}>
                      ✗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {trade.status === 'open' && (
          <button className="trade-row__btn trade-row__btn--cancel"
            onClick={() => { TradeService.cancelListing(trade.id).then(load); }}>
            Stornieren
          </button>
        )}
      </div>
    );
  };

  // ── Main render ──────────────────────────────────────────────

  return (
    <div className="trade-screen">
      <div className="trade-header">
        <button className="trade-header__back"
          onClick={step === 'list' ? onBack : () => { setStep('list'); resetNew(); }}>
          ← {step === 'list' ? 'Zurück' : 'Abbrechen'}
        </button>
        <h1 className="trade-header__title">Handelsmarkt</h1>
        <div className="trade-header__spacer" />
      </div>

      {!isLoggedIn ? (
        <div className="trade-login-hint">
          <span>🔒</span>
          <p>Bitte anmelden um zu handeln.</p>
        </div>
      ) : step !== 'list' ? (
        /* ── New listing wizard ──────────────────────────────── */
        step === 'new-offer' ? (
          <div className="trade-form">
            <p className="trade-form__label">Welche Karte bietest du an?</p>
            <p className="trade-form__sublabel">Wähle aus deinem Inventar:</p>
            <div className="trade-picker-grid">
              {myInventory.length === 0 && (
                <p style={{ color: 'var(--gold-dark)', gridColumn: '1/-1', textAlign: 'center' }}>
                  Keine Karten im Inventar.
                </p>
              )}
              {myInventory.map(i => (
                <CardChip key={i.uuid} inst={i}
                  selected={offerCard?.uuid === i.uuid}
                  onClick={() => setOfferCard(i)} />
              ))}
            </div>
            <button className="trade-btn" disabled={!offerCard}
              onClick={() => setStep('new-want')}>
              Weiter →
            </button>
          </div>
        ) : step === 'new-want' ? (
          <div className="trade-form">
            <p className="trade-form__label">Was möchtest du im Tausch?</p>
            <p className="trade-form__sublabel">Wähle aus dem gesamten Katalog:</p>
            <div className="trade-picker-grid">
              {allCards.map(c => (
                <CatalogChip key={c.id} card={c}
                  selected={wantCard?.id === c.id}
                  onClick={() => setWantCard(c)} />
              ))}
            </div>
            <button className="trade-btn" disabled={!wantCard}
              onClick={() => setStep('new-confirm')}>
              Weiter →
            </button>
          </div>
        ) : (
          <div className="trade-form">
            <p className="trade-form__label">Inserat bestätigen</p>
            <div className="trade-confirm">
              <div className="trade-confirm__side">
                <p className="trade-confirm__role">Du gibst</p>
                {offerCard && <CardChip inst={offerCard} />}
              </div>
              <span className="trade-confirm__arrow">⇌</span>
              <div className="trade-confirm__side">
                <p className="trade-confirm__role">Du bekommst</p>
                {wantCard && <CatalogChip card={wantCard} />}
              </div>
            </div>

            <label className="trade-toggle">
              <span className="trade-toggle__label">Angebote erlauben</span>
              <span className="trade-toggle__hint">
                Andere Spieler dürfen dir alternative Karten anbieten
              </span>
              <div
                className={`trade-toggle__switch${allowOffers ? ' trade-toggle__switch--on' : ''}`}
                onClick={() => setAllowOffers(v => !v)}
                role="switch"
                aria-checked={allowOffers}
              >
                <div className="trade-toggle__knob" />
              </div>
            </label>

            <button className="trade-btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '…' : 'Inserat aufgeben'}
            </button>
          </div>
        )
      ) : (
        /* ── List view ───────────────────────────────────────── */
        <>
          {msg && <div className="trade-msg">{msg}</div>}

          <button className="trade-new-btn"
            onClick={() => { setMsg(''); setStep('new-offer'); }}>
            + Neues Inserat
          </button>

          <div className="trade-tabs">
            <button className={`trade-tab${tab === 'market' ? ' trade-tab--active' : ''}`}
              onClick={() => setTab('market')}>
              🌐 Marktplatz {market.length > 0 && <span className="trade-tab__badge">{market.length}</span>}
            </button>
            <button className={`trade-tab${tab === 'mine' ? ' trade-tab--active' : ''}`}
              onClick={() => setTab('mine')}>
              📋 Meine Inserate
              {myOffers.length > 0 && <span className="trade-tab__badge">{myOffers.length}</span>}
            </button>
          </div>

          {loading ? (
            <div className="trade-loading">Lade …</div>
          ) : tab === 'market' ? (
            market.length === 0
              ? <div className="trade-empty">Keine offenen Inserate im Marktplatz.</div>
              : market.map(t => <MarketRow key={t.id} trade={t} />)
          ) : (
            myListings.length === 0
              ? <div className="trade-empty">Du hast noch keine Inserate aufgegeben.</div>
              : myListings.map(t => <MyListingRow key={t.id} trade={t} />)
          )}

          {/* ── Accept overlay ──────────────────────────────── */}
          {acceptTrade && (
            <div className="trade-overlay">
              <div className="trade-overlay__box">
                <h3 className="trade-overlay__title">Annehmen</h3>
                <p className="trade-overlay__hint">
                  Gewünscht: <strong>{acceptTrade.wanted_card_name}</strong>
                </p>
                <div className="trade-overlay__grid">
                  {myInventory
                    .filter(c => c.cardId === acceptTrade.wanted_card_id)
                    .map(c => (
                      <CardChip key={c.uuid} inst={c}
                        selected={acceptCard?.uuid === c.uuid}
                        onClick={() => setAcceptCard(c)} />
                    ))}
                  {myInventory.filter(c => c.cardId === acceptTrade.wanted_card_id).length === 0 && (
                    <p className="trade-overlay__no-match">
                      Du besitzt „{acceptTrade.wanted_card_name}" nicht.
                    </p>
                  )}
                </div>
                <div className="trade-overlay__btns">
                  <button className="trade-btn trade-btn--ghost"
                    onClick={() => { setAcceptTrade(null); setAcceptCard(null); }}>
                    Abbrechen
                  </button>
                  <button className="trade-btn" onClick={handleAccept}
                    disabled={!acceptCard || accepting}>
                    {accepting ? '…' : 'Bestätigen'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Counter-offer overlay ────────────────────────── */}
          {counterTrade && (
            <div className="trade-overlay">
              <div className="trade-overlay__box">
                <h3 className="trade-overlay__title">Gegenangebot machen</h3>
                <p className="trade-overlay__hint">
                  Für: <strong>{CardDatabase.getById(counterTrade.offered_card.cardId)?.name ?? '?'}</strong>
                  {' '}(von {counterTrade.poster_username ?? '?'})
                </p>
                <p className="trade-overlay__hint" style={{ marginTop: 0 }}>
                  Wähle die Karte, die du anbietest:
                </p>
                <div className="trade-overlay__grid">
                  {myInventory.map(c => (
                    <CardChip key={c.uuid} inst={c}
                      selected={counterCard?.uuid === c.uuid}
                      onClick={() => setCounterCard(c)} />
                  ))}
                  {myInventory.length === 0 && (
                    <p className="trade-overlay__no-match">Keine Karten im Inventar.</p>
                  )}
                </div>
                <div className="trade-overlay__btns">
                  <button className="trade-btn trade-btn--ghost"
                    onClick={() => { setCounterTrade(null); setCounterCard(null); }}>
                    Abbrechen
                  </button>
                  <button className="trade-btn" onClick={handleCounterOffer}
                    disabled={!counterCard || countering}>
                    {countering ? '…' : 'Angebot senden'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TradeScreen;
