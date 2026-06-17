import React, { useState, useEffect, useCallback } from 'react';
import { AuthService } from '../services/AuthService';
import { FriendService, otherSide, type Friendship } from '../services/FriendService';
import { AudioService } from '../services/AudioService';
import './FriendsScreen.css';

interface Props { onBack: () => void; }

type Tab = 'friends' | 'requests';

const FriendsScreen: React.FC<Props> = ({ onBack }) => {
  const [tab,         setTab]         = useState<Tab>('friends');
  const [friends,     setFriends]     = useState<Friendship[]>([]);
  const [requests,    setRequests]    = useState<Friendship[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [codeInput,   setCodeInput]   = useState('');
  const [addMsg,      setAddMsg]      = useState('');
  const [addErr,      setAddErr]      = useState('');
  const [sending,     setSending]     = useState(false);

  const myId = AuthService.user?.id ?? '';
  const isLoggedIn = AuthService.isLoggedIn;

  const load = useCallback(async () => {
    setLoading(true);
    const [f, r] = await Promise.all([
      FriendService.getFriends(),
      FriendService.getIncomingRequests(),
    ]);
    setFriends(f);
    setRequests(r);
    setLoading(false);
  }, []);

  useEffect(() => { if (isLoggedIn) load(); else setLoading(false); }, [load, isLoggedIn]);

  const handleAdd = async () => {
    if (codeInput.length < 8) return;
    setAddErr('');
    setAddMsg('');
    setSending(true);
    const err = await FriendService.sendRequest(codeInput);
    setSending(false);
    if (err) { setAddErr(err); return; }
    AudioService.tap();
    setAddMsg('Freundschaftsanfrage gesendet! ✓');
    setCodeInput('');
  };

  const handleAccept = async (id: string) => {
    AudioService.synergy();
    AudioService.vibrate([15, 20, 30]);
    await FriendService.acceptRequest(id);
    load();
  };

  const handleDecline = async (id: string) => {
    await FriendService.declineRequest(id);
    load();
  };

  const handleRemove = async (id: string) => {
    await FriendService.removeFriend(id);
    load();
  };

  return (
    <div className="friends-screen">
      <div className="friends-header">
        <button className="friends-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="friends-header__title">Freunde</h1>
        <div className="friends-header__spacer" />
      </div>

      {!isLoggedIn ? (
        <div className="friends-login-hint">
          <span>🔒</span>
          <p>Bitte anmelden um Freunde hinzuzufügen.</p>
        </div>
      ) : (
        <>
          {/* ── Freund hinzufügen ── */}
          <div className="friends-add">
            <p className="friends-add__label">Freund hinzufügen</p>
            <div className="friends-add__row">
              <input
                className="friends-add__input"
                placeholder="Freundescode (8 Zeichen)"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.toUpperCase())}
                maxLength={8}
              />
              <button
                className="friends-add__btn"
                disabled={codeInput.length < 8 || sending}
                onClick={handleAdd}
              >
                {sending ? '…' : '+ Hinzufügen'}
              </button>
            </div>
            {addErr && <p className="friends-add__error">{addErr}</p>}
            {addMsg && <p className="friends-add__success">{addMsg}</p>}
          </div>

          {/* ── Tabs ── */}
          <div className="friends-tabs">
            <button
              className={`friends-tab${tab === 'friends' ? ' friends-tab--active' : ''}`}
              onClick={() => setTab('friends')}
            >
              👥 Freunde {friends.length > 0 && <span className="friends-tab__count">{friends.length}</span>}
            </button>
            <button
              className={`friends-tab${tab === 'requests' ? ' friends-tab--active' : ''}`}
              onClick={() => setTab('requests')}
            >
              📩 Anfragen {requests.length > 0 && <span className="friends-tab__badge">{requests.length}</span>}
            </button>
          </div>

          {loading ? (
            <div className="friends-loading">Lade …</div>
          ) : tab === 'friends' ? (
            friends.length === 0 ? (
              <div className="friends-empty">
                <p>Noch keine Freunde.</p>
                <p className="friends-empty__hint">
                  Tausche deinen Freundescode im Profil und füge Spieler hinzu!
                </p>
              </div>
            ) : (
              <div className="friends-list">
                {friends.map(f => {
                  const other = otherSide(f, myId);
                  return (
                    <div key={f.id} className="friends-row">
                      <div className="friends-row__avatar">⚔️</div>
                      <div className="friends-row__info">
                        <span className="friends-row__name">{other.username}</span>
                        <span className="friends-row__code">{other.friendCode}</span>
                      </div>
                      <button
                        className="friends-row__remove"
                        onClick={() => handleRemove(f.id)}
                        title="Freundschaft beenden"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            requests.length === 0 ? (
              <div className="friends-empty">Keine ausstehenden Anfragen.</div>
            ) : (
              <div className="friends-list">
                {requests.map(r => (
                  <div key={r.id} className="friends-row">
                    <div className="friends-row__avatar">⚔️</div>
                    <div className="friends-row__info">
                      <span className="friends-row__name">{r.requester_username ?? '?'}</span>
                      <span className="friends-row__code">{r.requester_friend_code ?? ''}</span>
                    </div>
                    <div className="friends-row__actions">
                      <button className="friends-row__accept" onClick={() => handleAccept(r.id)}>✓</button>
                      <button className="friends-row__decline" onClick={() => handleDecline(r.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
};

export default FriendsScreen;
