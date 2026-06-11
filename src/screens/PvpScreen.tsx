import React, { useState, useEffect, useCallback } from 'react';
import { PvpService, PVP_RANK_TIERS, type PvpOpponent, rankLabel, rankColor } from '../services/PvpService';
import { PvpHistoryService, type PvpMatchRecord } from '../services/PvpHistoryService';
import { AudioService } from '../services/AudioService';
import './PvpScreen.css';

interface Props {
  onBack:        () => void;
  onStartBattle: () => void;
}

// ── Rang-Icon ─────────────────────────────────────────────────

function RankBadge({ rating }: { rating: number }) {
  const label = rankLabel(rating);
  const color = rankColor(rating);
  const icon =
    rating >= 2000 ? '🔥' :
    rating >= 1000 ? '💎' :
    rating >= 500  ? '🪙' :
    rating >= 200  ? '⚜️' :
    rating >= 50   ? '🛡' : '⚔️';

  return (
    <span className="pvp-rank-badge" style={{ borderColor: color, color }}>
      {icon} {label}
    </span>
  );
}

// ── Gegner-Zeile ──────────────────────────────────────────────

function OpponentRow({
  opponent,
  rank,
  myRating,
  onChallenge,
  loading,
}: {
  opponent:    PvpOpponent;
  rank:        number;
  myRating:    number;
  onChallenge: (o: PvpOpponent) => void;
  loading:     boolean;
}) {
  const ratio = opponent.pvpWins + opponent.pvpLosses > 0
    ? Math.round((opponent.pvpWins / (opponent.pvpWins + opponent.pvpLosses)) * 100)
    : 0;

  const ratingDiff = opponent.rating - myRating;
  const strength =
    ratingDiff >  300 ? { label: '▲▲ Dominant',  cls: 'pvp-strength--hard'  } :
    ratingDiff >   80 ? { label: '▲ Stärker',     cls: 'pvp-strength--hard'  } :
    ratingDiff < -300 ? { label: '▼▼ Leichtsieg', cls: 'pvp-strength--easy'  } :
    ratingDiff <  -80 ? { label: '▼ Schwächer',   cls: 'pvp-strength--easy'  } :
                        { label: '= Ebenbürtig',   cls: 'pvp-strength--even'  };

  return (
    <div className="pvp-row">
      <div className="pvp-row__rank">#{rank}</div>

      <div className="pvp-row__info">
        <div className="pvp-row__name">{opponent.displayName}</div>
        <div className="pvp-row__meta">
          Lv.{opponent.accountLevel} · {opponent.pvpWins}S {opponent.pvpLosses}N
          {opponent.pvpWins + opponent.pvpLosses > 0 && ` · ${ratio}% WR`}
        </div>
        <div className="pvp-row__strength-row">
          <span className={`pvp-strength ${strength.cls}`}>{strength.label}</span>
          <span className="pvp-row__delta">+100 / -20 Pkt.</span>
        </div>
      </div>

      <div className="pvp-row__right">
        <RankBadge rating={opponent.rating} />
        <button
          className="pvp-row__btn"
          onClick={() => onChallenge(opponent)}
          disabled={loading}
        >
          ⚔ Angreifen
        </button>
      </div>
    </div>
  );
}

// ── Haupt-Screen ──────────────────────────────────────────────

const PvpScreen: React.FC<Props> = ({ onBack, onStartBattle }) => {
  const [opponents, setOpponents] = useState<PvpOpponent[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [attacking, setAttacking] = useState(false);
  const [toast,     setToast]     = useState('');
  const [history]                 = useState<PvpMatchRecord[]>(() => PvpHistoryService.getAll());

  const myRecord = PvpService.getMyRecord();
  const myRating = PvpService.getMyRating();

  const tierIdx   = PVP_RANK_TIERS.findIndex((_t, i) =>
    i === PVP_RANK_TIERS.length - 1 || PVP_RANK_TIERS[i + 1]!.min > myRating
  );
  const curTier   = PVP_RANK_TIERS[tierIdx]!;
  const nextTier  = PVP_RANK_TIERS[tierIdx + 1] ?? null;
  const tierPct   = nextTier
    ? Math.min(1, (myRating - curTier.min) / (nextTier.min - curTier.min))
    : 1;

  // Consecutive PvP win streak from history (history is newest-first)
  const pvpStreak = history.reduce((streak, match) => {
    if (streak === -1) return -1; // stopped counting
    if (match.result === 'win') return streak + 1;
    return -1; // first loss breaks streak
  }, 0);
  const pvpStreakCount = pvpStreak === -1 ? 0 : pvpStreak;

  // Today's W/L from history timestamps
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayMatches = history.filter(m => m.timestamp >= todayStart.getTime());
  const todayWins   = todayMatches.filter(m => m.result === 'win').length;
  const todayLosses = todayMatches.filter(m => m.result === 'loss').length;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await PvpService.fetchLeaderboard();
      setOpponents(list);
      if (list.length === 0) setError('Keine Gegner gefunden. Bitte melde dich an und stelle ein Deck auf, um hier zu erscheinen.');
    } catch {
      setError('Rangliste konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleChallenge = useCallback((opponent: PvpOpponent) => {
    if (attacking) return;
    setAttacking(true);

    const enemy = PvpService.buildEnemyFromOpponent(opponent);
    PvpService.setPendingBattle(enemy, opponent);

    AudioService.super();
    AudioService.vibrate([30, 40, 60]);

    setToast(`⚔ Herausforderung an ${opponent.displayName}!`);
    setTimeout(() => {
      setToast('');
      onStartBattle();
    }, 900);
  }, [attacking, onStartBattle]);

  return (
    <div className="pvp-screen">

      {/* ── Header ── */}
      <div className="pvp-header">
        <button className="pvp-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="pvp-header__title">⚔ PvP Rangliste</h1>
        <button className="pvp-header__refresh" onClick={load} disabled={loading}>↺</button>
      </div>

      {/* ── Eigene Bilanz ── */}
      <div className="pvp-my-record">
        <span className="pvp-my-record__label">Meine Bilanz</span>
        <span className="pvp-my-record__wins">✔ {myRecord.wins} Siege</span>
        <span className="pvp-my-record__losses">✘ {myRecord.losses} Niederlagen</span>
        {pvpStreakCount >= 2 && (
          <span className={`pvp-streak-chip ${pvpStreakCount >= 5 ? 'pvp-streak-chip--hot' : ''}`}>
            🔥 {pvpStreakCount}× Siegesserie
          </span>
        )}
        <RankBadge rating={myRating} />
        {todayMatches.length > 0 && (
          <span className={`pvp-today-chip ${todayWins > todayLosses ? 'pvp-today-chip--winning' : todayLosses > todayWins ? 'pvp-today-chip--losing' : ''}`}>
            Heute: {todayWins}S/{todayLosses}N
          </span>
        )}
      </div>

      {/* ── Rating progress bar ── */}
      <div className="pvp-rating-bar">
        <div className="pvp-rating-bar__labels">
          <span style={{ color: curTier.color }}>{curTier.label}</span>
          <span className="pvp-rating-bar__pts">{myRating.toLocaleString('de-DE')} Pkt.</span>
          {nextTier ? (
            <span style={{ color: nextTier.color }}>{nextTier.label}</span>
          ) : (
            <span style={{ color: curTier.color }}>MAX</span>
          )}
        </div>
        <div className="pvp-rating-bar__track">
          <div
            className="pvp-rating-bar__fill"
            style={{ width: `${tierPct * 100}%`, background: curTier.color }}
          />
        </div>
        {nextTier && (
          <div className="pvp-rating-bar__hint">
            {(nextTier.min - myRating).toLocaleString('de-DE')} Pkt. bis {nextTier.label}
          </div>
        )}
      </div>

      {/* ── Match History ── */}
      {history.length > 0 && (
        <div className="pvp-history">
          <div className="pvp-history__title">Letzte Kämpfe</div>
          <div className="pvp-history__list">
            {history.map((m, i) => {
              const ago = Math.round((Date.now() - m.timestamp) / 60000);
              const agoLabel = ago < 60
                ? `${ago}m`
                : ago < 1440
                  ? `${Math.floor(ago / 60)}h`
                  : `${Math.floor(ago / 1440)}T`;
              return (
                <div key={i} className={`pvp-history-row pvp-history-row--${m.result}`}>
                  <span className={`pvp-history-row__badge pvp-history-row__badge--${m.result}`}>
                    {m.result === 'win' ? 'S' : 'N'}
                  </span>
                  <span className="pvp-history-row__name">{m.opponentName}</span>
                  <span className="pvp-history-row__ago">{agoLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Promotion Banner ── */}
      {nextTier && (nextTier.min - myRating) <= 200 && (
        <div className={`pvp-promo-banner ${(nextTier.min - myRating) <= 100 ? 'pvp-promo-banner--imminent' : ''}`}>
          <div className="pvp-promo-banner__icon">
            {(nextTier.min - myRating) <= 100 ? '🏆' : '⚡'}
          </div>
          <div className="pvp-promo-banner__text">
            <div className="pvp-promo-banner__title" style={{ color: nextTier.color }}>
              {(nextTier.min - myRating) <= 100
                ? `AUFSTIEG: 1 SIEG BIS ${nextTier.label.toUpperCase()}!`
                : `2 SIEGE BIS ${nextTier.label.toUpperCase()}!`}
            </div>
            <div className="pvp-promo-banner__sub">
              Fehlen: {nextTier.min - myRating} Pkt. · Sieg = +100 Pkt.
            </div>
          </div>
          <div className="pvp-promo-banner__badge" style={{ color: nextTier.color, borderColor: nextTier.color }}>
            {nextTier.label}
          </div>
        </div>
      )}

      {/* ── Hinweistext ── */}
      <p className="pvp-info">
        Greife das gespeicherte Deck eines anderen Spielers an.
        Die KI spielt seine Karten — du entscheidest die Taktik!
      </p>

      {/* ── Inhalt ── */}
      {loading && (
        <div className="pvp-loading">
          <span className="pvp-loading__icon">⚔</span>
          <p>Lade Rangliste …</p>
        </div>
      )}

      {!loading && error && (
        <div className="pvp-error">{error}</div>
      )}

      {!loading && !error && (
        <div className="pvp-list">
          {opponents.map((opp, i) => (
            <OpponentRow
              key={opp.userId}
              opponent={opp}
              rank={i + 1}
              myRating={myRating}
              onChallenge={handleChallenge}
              loading={attacking}
            />
          ))}
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="pvp-toast" role="status">{toast}</div>
      )}
    </div>
  );
};

export default PvpScreen;
