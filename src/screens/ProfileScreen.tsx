import React, { useEffect, useState, useMemo } from 'react';
import { AuthService } from '../services/AuthService';
import { ProfileService, type Profile, canChangeUsername, nextChangeDate } from '../services/ProfileService';
import { SaveService } from '../services/SaveService';
import { CardDatabase } from '../services/CardDatabase';
import { rarityMajor, RARITY_COLOR, type Rarity } from '../types/Card';
import type { CardInstance } from '../types/GachaTypes';
import './ProfileScreen.css';

interface ProfileScreenProps {
  onBack: () => void;
}

const RARITY_MAJORS = ['N', 'R', 'SR', 'SSR', 'MR', 'LR'] as const;

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack }) => {
  const [profile,        setProfile]        = useState<Profile | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [editing,        setEditing]        = useState(false);
  const [nameInput,      setNameInput]      = useState('');
  const [nameError,      setNameError]      = useState('');
  const [nameSaving,     setNameSaving]     = useState(false);
  const [copied,         setCopied]         = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(() => localStorage.getItem('ci_profile_card_id') ?? '');

  const isLoggedIn = AuthService.isLoggedIn;

  // Stats from local save
  const gacha   = useMemo(() => SaveService.loadGachaState(),  []);
  const account = useMemo(() => SaveService.loadAccountState(), []);
  const totalCards  = CardDatabase.count();
  const uniqueOwned = new Set(gacha.inventory.map(i => i.cardId)).size;

  const rarityCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inst of gacha.inventory) {
      const major = rarityMajor(inst.rarity);
      counts[major] = (counts[major] ?? 0) + 1;
    }
    return counts;
  }, [gacha]);

  const uniqueCardInstances = useMemo(() => {
    const seen = new Map<string, CardInstance>();
    for (const inst of gacha.inventory) {
      if (!seen.has(inst.cardId)) {
        seen.set(inst.cardId, inst);
      }
    }
    return Array.from(seen.values());
  }, [gacha]);

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    ProfileService.getOrCreate().then(p => {
      setProfile(p);
      setLoading(false);
    });
  }, [isLoggedIn]);

  const handleCopy = () => {
    if (!profile) return;
    navigator.clipboard?.writeText(profile.friend_code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditSave = async () => {
    setNameError('');
    setNameSaving(true);
    const err = await ProfileService.updateUsername(nameInput);
    setNameSaving(false);
    if (err) { setNameError(err); return; }
    setProfile(p => p ? { ...p, username: nameInput.trim(), username_changed_at: new Date().toISOString() } : p);
    setEditing(false);
  };

  const memberSince = profile
    ? new Date(profile.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  return (
    <div className="profile-screen">
      <div className="profile-header">
        <button className="profile-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="profile-header__title">Profil</h1>
        <div className="profile-header__spacer" />
      </div>

      <div className="profile-body">
        {!isLoggedIn ? (
          <div className="profile-login-hint">
            <span className="profile-login-hint__icon">🔒</span>
            <p>Bitte melde dich über den <strong>Titelscreen → 👤 Konto</strong> an, um dein Profil zu sehen.</p>
          </div>
        ) : loading ? (
          <div className="profile-loading">Lade Profil …</div>
        ) : (
          <>
            {/* ── Profilkarte ── */}
            <div className="profile-card">
              <div className="profile-card__avatar">⚔️</div>

              {/* Name */}
              {editing ? (
                <div className="profile-card__edit">
                  <input
                    className="profile-card__name-input"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    maxLength={20}
                    autoFocus
                  />
                  {nameError && <p className="profile-card__name-error">{nameError}</p>}
                  <div className="profile-card__edit-btns">
                    <button className="profile-card__btn profile-card__btn--ghost"
                      onClick={() => { setEditing(false); setNameError(''); }}>
                      Abbrechen
                    </button>
                    <button className="profile-card__btn" onClick={handleEditSave} disabled={nameSaving}>
                      {nameSaving ? '…' : 'Speichern'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="profile-card__name-row">
                  <span className="profile-card__name">{profile?.username ?? '—'}</span>
                  {profile && canChangeUsername(profile.username_changed_at) ? (
                    <button className="profile-card__edit-btn"
                      onClick={() => { setNameInput(profile.username); setEditing(true); }}>
                      ✏️
                    </button>
                  ) : (
                    <span className="profile-card__name-locked"
                      title={`Änderbar ab ${nextChangeDate(profile?.username_changed_at ?? null)}`}>
                      🔒
                    </span>
                  )}
                </div>
              )}

              {/* Freundescode */}
              <div className="profile-card__code-row">
                <span className="profile-card__code-label">Freundescode</span>
                <button className="profile-card__code" onClick={handleCopy}>
                  {profile?.friend_code ?? '—'}
                  <span className="profile-card__code-copy">{copied ? '✓' : '⧉'}</span>
                </button>
              </div>

              <div className="profile-card__member">Mitglied seit {memberSince}</div>
            </div>

            {/* ── Statistiken ── */}
            <div className="profile-section-title">Statistiken</div>
            <div className="profile-stats">
              <div className="profile-stat">
                <span className="profile-stat__val">{account.level}</span>
                <span className="profile-stat__label">Account-Level</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat__val">{gacha.totalPulls}</span>
                <span className="profile-stat__label">Gesamtzüge</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat__val">{uniqueOwned}<span className="profile-stat__sub">/{totalCards}</span></span>
                <span className="profile-stat__label">Karten</span>
              </div>
            </div>

            {/* ── Seltenheits-Verteilung ── */}
            <div className="profile-section-title">Sammlung nach Seltenheit</div>
            <div className="profile-rarities">
              {RARITY_MAJORS.map(r => {
                const count = rarityCount[r] ?? 0;
                const color = RARITY_COLOR[r as Rarity];
                return (
                  <div key={r} className="profile-rarity">
                    <span className="profile-rarity__label" style={{ color }}>{r}</span>
                    <div className="profile-rarity__bar-bg">
                      <div
                        className="profile-rarity__bar"
                        style={{
                          width: gacha.inventory.length > 0 ? `${(count / gacha.inventory.length) * 100}%` : '0%',
                          background: color,
                        }}
                      />
                    </div>
                    <span className="profile-rarity__count">{count}</span>
                  </div>
                );
              })}
            </div>

            {/* ── Profilkarte Auswahl ── */}
            {uniqueCardInstances.length > 0 && (
              <div className="profile-card-section">
                <div className="profile-section-title">Profilkarte</div>
                <div className="profile-card-grid">
                  {uniqueCardInstances.map(inst => {
                    const card = CardDatabase.getById(inst.cardId);
                    const rarityColor = RARITY_COLOR[inst.rarity as Rarity];
                    const isSelected = inst.cardId === selectedCardId;
                    return (
                      <button
                        key={inst.cardId}
                        className={`profile-card-chip${isSelected ? ' profile-card-chip--selected' : ''}`}
                        onClick={() => {
                          localStorage.setItem('ci_profile_card_id', inst.cardId);
                          void SaveService.uploadSave();
                          setSelectedCardId(inst.cardId);
                        }}
                      >
                        {card?.image ? (
                          <img className="profile-card-chip__img" src={card.image} alt={card.name} />
                        ) : (
                          <div className="profile-card-chip__placeholder">🌑</div>
                        )}
                        <span className="profile-card-chip__rarity" style={{ color: rarityColor }}>
                          {inst.rarity}
                        </span>
                        <span className="profile-card-chip__name">{card?.name ?? inst.cardId}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileScreen;
