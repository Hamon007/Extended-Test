import React, { useState, useEffect, useCallback } from 'react';
import { AuthService } from '../services/AuthService';
import { TradeService, type TradeRecord } from '../services/TradeService';
import { SaveService } from '../services/SaveService';
import { CardDatabase } from '../services/CardDatabase';
import type { CardInstance } from '../types/GachaTypes';
import type { Card } from '../types/Card';
import { RARITY_COLOR, rarityMajor } from '../types/Card';
import './TradeScreen.css';

interface TradeScreenProps { onBack: () => void; }

type Tab = 'incoming' | 'outgoing';
type Step = 'list' | 'new-code' | 'new-offer' | 'new-want' | 'new-confirm';

const TradeScreen: React.FC<TradeScreenProps> = ({ onBack }) => {
  const [tab,        setTab]        = useState<Tab>('incoming');
  const [incoming,   setIncoming]   = useState<TradeRecord[]>([]);
  const [outgoing,   setOutgoing]   = useState<TradeRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [step,       setStep]       = useState<Step>('list');
  const [msg,        setMsg]        = useState('');

  // New trade state
  const [codeInput,  setCodeInput]  = useState('');
  const [foundUser,  setFoundUser]  = useState<{ user_id: string; username: string } | null>(null);
  const [codeErr,    setCodeErr]    = useState('');
  const [searching,  setSearching]  = useState(false);
  const [offerCard,  setOfferCard]  = useState<CardInstance | null>(null);
  const [wantCard,   setWantCard]   = useState<Card | null>(null);
  const [sending,    setSending]    = useState(false);

  // Accept state
  const [acceptingTrade, setAcceptingTrade] = useState<TradeRecord | null>(null);
  const [acceptCard,     setAcceptCard]     = useState<CardInstance | null>(null);
  const [accepting,      setAccepting]      = useState(false);

  const gachaState = SaveService.loadGachaState();
  const myInventory = gachaState.inventory;
  const allCards    = CardDatabase.getAll();

  const load = useCallback(async () => {
    setLoading(true);
    const [inc, out] = await Promise.all([TradeService.getIncoming(), TradeService.getOutgoing()]);
    setIncoming(inc);
    setOutgoing(out);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── New trade flow ─────────────────────────────────────────────

  const handleFindUser = async () => {
    setCodeErr('');
    setSearching(true);
    const user = await TradeService.findByFriendCode(codeInput);
    setSearching(false);
    if (!user) { setCodeErr('Kein Spieler mit diesem Code gefunden.'); return; }
    if (user.user_id === AuthService.user?.id) { setCodeErr('Das bist du selbst.'); return; }
    setFoundUser(user);
    setStep('new-offer');
  };

  const handleSend = async () => {
    if (!offerCard || !wantCard || !foundUser) return;
    setSending(true);
    const err = await TradeService.sendOffer(foundUser.user_id, offerCard, wantCard.id, wantCard.name);
    setSending(false);
    if (err) { setMsg('Fehler: ' + err); return; }
    setMsg('Angebot gesendet!');
    setStep('list');
    resetNew();
    load();
  };

  const resetNew = () => {
    setCodeInput(''); setFoundUser(null); setCodeErr('');
    setOfferCard(null); setWantCard(null);
  };

  // ── Accept flow ────────────────────────────────────────────────

  const handleAccept = async () => {
    if (!acceptingTrade || !acceptCard) return;
    setAccepting(true);
    const err = await TradeService.acceptTrade(acceptingTrade, acceptCard);
    if (err) { setMsg('Fehler: ' + err); setAccepting(false); return; }

    // Apply to local save: remove given card, add received card
    const newInventory = myInventory
      .filter(i => i.uuid !== acceptCard.uuid)
      .concat(acceptingTrade.offered_card);
    const newState = { ...gachaState, inventory: newInventory };
    SaveService.saveGachaState(newState);

    setAccepting(false);
    setAcceptingTrade(null);
    setAcceptCard(null);
    setMsg('Handel abgeschlossen! ✓');
    load();
  };

  const handleReject = async (id: string) => {
    await TradeService.rejectTrade(id);
    load();
  };

  const handleCancel = async (id: string) => {
    await TradeService.cancelTrade(id);
    load();
  };

  // ── Render helpers ─────────────────────────────────────────────

  const CardChip: React.FC<{ inst: CardInstance; selected?: boolean; onClick?: () => void }> = ({ inst, selected, onClick }) => {
    const card = CardDatabase.getById(inst.cardId);
    const color = RARITY_COLOR[inst.rarity];
    return (
      <button className={`trade-card-chip ${selected ? 'trade-card-chip--selected' : ''}`} onClick={onClick}>
        <img className="trade-card-chip__img" src={card?.image} alt={card?.name ?? inst.cardId} />
        <span className="trade-card-chip__rarity" style={{ color }}>{rarityMajor(inst.rarity)}</span>
        <span className="trade-card-chip__name">{card?.name ?? inst.cardId}</span>
      </button>
    );
  };

  const WantChip: React.FC<{ card: Card; selected?: boolean; onClick?: () => void }> = ({ card, selected, onClick }) => {
    const color = RARITY_COLOR[card.rarity];
    return (
      <button className={`trade-card-chip ${selected ? 'trade-card-chip--selected' : ''}`} onClick={onClick}>
        <img className="trade-card-chip__img" src={card.image} alt={card.name} />
        <span className="trade-card-chip__rarity" style={{ color }}>{rarityMajor(card.rarity)}</span>
        <span className="trade-card-chip__name">{card.name}</span>
      </button>
    );
  };

  const TradeRow: React.FC<{ trade: TradeRecord; isIncoming: boolean }> = ({ trade, isIncoming }) => {
    const offeredCard = CardDatabase.getById(trade.offered_card.cardId);
    const wantedCard  = CardDatabase.getById(trade.wanted_card_id);
    const statusLabel: Record<string, string> = {
      pending: 'Ausstehend', accepted: 'Angenommen',
      rejected: 'Abgelehnt', cancelled: 'Storniert', completed: 'Abgeschlossen',
    };
    return (
      <div className="trade-row">
        <div className="trade-row__cards">
          <div className="trade-row__card-box">
            <img src={offeredCard?.image} alt={offeredCard?.name} className="trade-row__img" />
            <span className="trade-row__card-name">{offeredCard?.name ?? '?'}</span>
            <span className="trade-row__rarity" style={{ color: RARITY_COLOR[trade.offered_card.rarity] }}>
              {rarityMajor(trade.offered_card.rarity)}
            </span>
          </div>
          <span className="trade-row__arrow">⇌</span>
          <div className="trade-row__card-box">
            <img src={wantedCard?.image} alt={wantedCard?.name} className="trade-row__img" />
            <span className="trade-row__card-name">{trade.wanted_card_name}</span>
          </div>
        </div>
        <div className="trade-row__meta">
          <span className="trade-row__player">
            {isIncoming ? `Von: ${trade.from_username ?? '?'}` : `An: ${trade.to_username ?? '?'}`}
          </span>
          <span className={`trade-row__status trade-row__status--${trade.status}`}>
            {statusLabel[trade.status] ?? trade.status}
          </span>
        </div>
        {isIncoming && trade.status === 'pending' && (
          <div className="trade-row__actions">
            <button className="trade-row__btn trade-row__btn--accept"
              onClick={() => { setAcceptingTrade(trade); setAcceptCard(null); }}>
              Annehmen
            </button>
            <button className="trade-row__btn trade-row__btn--reject"
              onClick={() => handleReject(trade.id)}>
              Ablehnen
            </button>
          </div>
        )}
        {!isIncoming && trade.status === 'pending' && (
          <button className="trade-row__btn trade-row__btn--cancel"
            onClick={() => handleCancel(trade.id)}>
            Stornieren
          </button>
        )}
      </div>
    );
  };

  const isLoggedIn = AuthService.isLoggedIn;

  return (
    <div className="trade-screen">
      <div className="trade-header">
        <button className="trade-header__back" onClick={step === 'list' ? onBack : () => { setStep('list'); resetNew(); }}>
          ← {step === 'list' ? 'Zurück' : 'Abbrechen'}
        </button>
        <h1 className="trade-header__title">Handel</h1>
        <div className="trade-header__spacer" />
      </div>

      {!isLoggedIn ? (
        <div className="trade-login-hint">
          <span>🔒</span>
          <p>Bitte anmelden um zu handeln.</p>
        </div>
      ) : step === 'list' ? (
        <>
          {msg && <div className="trade-msg">{msg}</div>}

          <button className="trade-new-btn" onClick={() => { setStep('new-code'); setMsg(''); }}>
            + Neues Angebot
          </button>

          <div className="trade-tabs">
            <button className={`trade-tab ${tab === 'incoming' ? 'trade-tab--active' : ''}`}
              onClick={() => setTab('incoming')}>
              Eingehend {incoming.length > 0 && <span className="trade-tab__badge">{incoming.length}</span>}
            </button>
            <button className={`trade-tab ${tab === 'outgoing' ? 'trade-tab--active' : ''}`}
              onClick={() => setTab('outgoing')}>
              Ausgehend
            </button>
          </div>

          {loading ? (
            <div className="trade-loading">Lade …</div>
          ) : tab === 'incoming' ? (
            incoming.length === 0
              ? <div className="trade-empty">Keine eingehenden Angebote.</div>
              : incoming.map(t => <TradeRow key={t.id} trade={t} isIncoming={true} />)
          ) : (
            outgoing.length === 0
              ? <div className="trade-empty">Keine ausgehenden Angebote.</div>
              : outgoing.map(t => <TradeRow key={t.id} trade={t} isIncoming={false} />)
          )}

          {/* Accept picker overlay */}
          {acceptingTrade && (
            <div className="trade-overlay">
              <div className="trade-overlay__box">
                <h3 className="trade-overlay__title">Welche Karte gibst du?</h3>
                <p className="trade-overlay__hint">
                  Gewünscht: <strong>{acceptingTrade.wanted_card_name}</strong>
                </p>
                <div className="trade-overlay__grid">
                  {myInventory
                    .filter(i => i.cardId === acceptingTrade.wanted_card_id)
                    .map(i => (
                      <CardChip key={i.uuid} inst={i}
                        selected={acceptCard?.uuid === i.uuid}
                        onClick={() => setAcceptCard(i)} />
                    ))}
                  {myInventory.filter(i => i.cardId === acceptingTrade.wanted_card_id).length === 0 && (
                    <p className="trade-overlay__no-match">
                      Du besitzt "{acceptingTrade.wanted_card_name}" nicht.
                    </p>
                  )}
                </div>
                <div className="trade-overlay__btns">
                  <button className="trade-btn trade-btn--ghost"
                    onClick={() => { setAcceptingTrade(null); setAcceptCard(null); }}>
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
        </>
      ) : step === 'new-code' ? (
        <div className="trade-form">
          <p className="trade-form__label">Freundescode des Empfängers</p>
          <input className="trade-form__input" placeholder="z.B. AB3K7X2P"
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            maxLength={8} />
          {codeErr && <p className="trade-form__error">{codeErr}</p>}
          <button className="trade-btn" onClick={handleFindUser}
            disabled={codeInput.length < 8 || searching}>
            {searching ? '…' : 'Spieler finden'}
          </button>
        </div>
      ) : step === 'new-offer' ? (
        <div className="trade-form">
          <p className="trade-form__label">
            Karte für <strong>{foundUser?.username}</strong> anbieten
          </p>
          <p className="trade-form__sublabel">Wähle eine Karte aus deinem Inventar:</p>
          <div className="trade-picker-grid">
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
          <p className="trade-form__sublabel">Wähle eine Karte aus dem gesamten Katalog:</p>
          <div className="trade-picker-grid">
            {allCards.map(c => (
              <WantChip key={c.id} card={c}
                selected={wantCard?.id === c.id}
                onClick={() => setWantCard(c)} />
            ))}
          </div>
          <button className="trade-btn" disabled={!wantCard}
            onClick={() => setStep('new-confirm')}>
            Weiter →
          </button>
        </div>
      ) : step === 'new-confirm' ? (
        <div className="trade-form">
          <p className="trade-form__label">Angebot bestätigen</p>
          <div className="trade-confirm">
            <div className="trade-confirm__side">
              <p className="trade-confirm__role">Du gibst</p>
              {offerCard && <CardChip inst={offerCard} />}
            </div>
            <span className="trade-confirm__arrow">⇌</span>
            <div className="trade-confirm__side">
              <p className="trade-confirm__role">Du bekommst</p>
              {wantCard && <WantChip card={wantCard} />}
            </div>
          </div>
          <p className="trade-confirm__to">An: <strong>{foundUser?.username}</strong></p>
          <button className="trade-btn" onClick={handleSend} disabled={sending}>
            {sending ? '…' : 'Angebot senden'}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default TradeScreen;
