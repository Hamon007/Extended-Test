import React, { useState, useEffect, useMemo } from 'react';
import { QuestService } from '../services/QuestService';
import { AccountProgressionService } from '../services/AccountProgressionService';
import { SaveService } from '../services/SaveService';
import { AudioService } from '../services/AudioService';
import './QuestScreen.css';

interface Props { onBack: () => void; }

function msUntilMidnightUtc(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return tomorrow.getTime() - now.getTime();
}

function msUntilNextMonday(): number {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon
  const daysUntilMonday = day === 0 ? 1 : (8 - day) % 7 || 7;
  const nextMon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
  return nextMon.getTime() - now.getTime();
}

function formatHMS(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

const QuestScreen: React.FC<Props> = ({ onBack }) => {
  const [tab, setTab]   = useState<'daily' | 'weekly'>('daily');
  const [toast, setToast] = useState('');
  const [, setTick] = useState(0);
  const [resetMs, setResetMs] = useState(() =>
    tab === 'daily' ? msUntilMidnightUtc() : msUntilNextMonday()
  );

  useEffect(() => {
    const id = setInterval(() => {
      setResetMs(tab === 'daily' ? msUntilMidnightUtc() : msUntilNextMonday());
    }, 1000);
    return () => clearInterval(id);
  }, [tab]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }

  function refresh() { setTick(t => t + 1); }

  const daily  = QuestService.getDailyQuests();
  const weekly = QuestService.getWeeklyQuests();
  const list   = tab === 'daily' ? daily : weekly;

  // Tab badges: claimable count per tab
  const dailyClaimable  = useMemo(() => daily.filter(q => q.progress.completed && !q.progress.claimed).length, [daily]);
  const weeklyClaimable = useMemo(() => weekly.filter(q => q.progress.completed && !q.progress.claimed).length, [weekly]);

  // Total available (unclaimed + incomplete) crystals
  const pendingCrystals = list
    .filter(q => !q.progress.claimed)
    .reduce((sum, q) => sum + q.def.crystalReward, 0);
  const claimableCount  = list.filter(q => q.progress.completed && !q.progress.claimed).length;
  const claimedTotal    = list.filter(q => q.progress.claimed).reduce((s, q) => s + q.def.crystalReward, 0);
  const claimedXpTotal  = list.filter(q => q.progress.claimed).reduce((s, q) => s + q.def.xpReward, 0);
  const allDone         = list.length > 0 && list.every(q => q.progress.claimed);

  // Urgency: daily < 2h, weekly < 12h
  const incompleteCount = list.filter(q => !q.progress.claimed && !q.progress.completed).length;
  const isUrgentTimer = tab === 'daily'
    ? resetMs < 2 * 3600_000 && incompleteCount > 0
    : resetMs < 12 * 3600_000 && incompleteCount > 0;

  const [claimAnim, setClaimAnim] = useState(false);
  const [claimBurst, setClaimBurst] = useState<{ crystals: number; xp: number } | null>(null);
  const [accountLevelUp, setAccountLevelUp] = useState<number | null>(null);

  function triggerLevelUp(newLevel: number) {
    setAccountLevelUp(newLevel);
    setTimeout(() => setAccountLevelUp(null), 3000);
  }

  function handleClaim(questId: string) {
    const reward = QuestService.claimReward(questId);
    if (!reward) return;
    const acct   = SaveService.loadAccountState();
    const result = AccountProgressionService.addAccountXp(acct, reward.xp);
    SaveService.saveAccountState(result.newState);
    if (result.leveledUp) {
      triggerLevelUp(result.newLevel);
      showToast(`+${reward.crystals} 💎 · LEVEL UP! Lv.${result.newLevel} ⭐`);
    } else {
      AudioService.reward();
      AudioService.vibrate([15, 20]);
      showToast(`+${reward.crystals} 💎 · +${reward.xp.toLocaleString('de-DE')} XP`);
    }
    refresh();
  }

  function handleClaimAll() {
    const claimable = list.filter(q => q.progress.completed && !q.progress.claimed);
    if (claimable.length === 0) return;
    let totalCrystals = 0;
    let totalXp = 0;
    for (const q of claimable) {
      const reward = QuestService.claimReward(q.def.id);
      if (reward) { totalCrystals += reward.crystals; totalXp += reward.xp; }
    }
    if (totalCrystals > 0 || totalXp > 0) {
      const acct = SaveService.loadAccountState();
      const result = AccountProgressionService.addAccountXp(acct, totalXp);
      SaveService.saveAccountState(result.newState);
      if (result.leveledUp) triggerLevelUp(result.newLevel);
      AudioService.super();
      AudioService.vibrate([20, 30, 40, 30]);
      showToast(`ALLE ABGEHOLT! +${totalCrystals.toLocaleString('de-DE')} 💎${result.leveledUp ? ` · LEVEL UP! Lv.${result.newLevel} ⭐` : ` · +${totalXp.toLocaleString('de-DE')} XP`}`);
      setClaimAnim(true);
      setTimeout(() => setClaimAnim(false), 800);
      setClaimBurst({ crystals: totalCrystals, xp: totalXp });
      setTimeout(() => setClaimBurst(null), 2200);
    }
    refresh();
  }

  return (
    <div className="quest-screen">

      {/* Claim-All Crystal Burst */}
      {claimBurst !== null && (
        <div className="quest-claim-burst" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className={`quest-burst-particle quest-burst-particle--${i % 4}`} style={{ '--i': i } as React.CSSProperties} />
          ))}
          <div className="quest-claim-burst__inner">
            <div className="quest-claim-burst__icon">✦</div>
            <div className="quest-claim-burst__amount">+{claimBurst.crystals.toLocaleString('de-DE')} 💎</div>
            <div className="quest-claim-burst__xp">+{claimBurst.xp.toLocaleString('de-DE')} XP</div>
          </div>
        </div>
      )}

      {/* Account Level-Up Banner */}
      {accountLevelUp !== null && (
        <div className="quest-levelup-banner" aria-live="assertive">
          <div className="quest-levelup-banner__icon">⭐</div>
          <div className="quest-levelup-banner__text">
            <div className="quest-levelup-banner__eyebrow">LEVEL UP!</div>
            <div className="quest-levelup-banner__level">Lv. {accountLevelUp}</div>
          </div>
        </div>
      )}

      {toast && <div className="quest-toast">{toast}</div>}

      <div className="quest-header">
        <button className="quest-header__back" onClick={() => { AudioService.tap(); onBack(); }}>← Zurück</button>
        <h1 className="quest-header__title">Aufgaben</h1>
        <div />
      </div>

      <div className="quest-tabs">
        <button
          className={`quest-tab ${tab === 'daily' ? 'quest-tab--active' : ''}`}
          onClick={() => { AudioService.tap(); setTab('daily'); setResetMs(msUntilMidnightUtc()); }}
        >
          Täglich
          {dailyClaimable > 0 && (
            <span className="quest-tab__badge">{dailyClaimable}</span>
          )}
        </button>
        <button
          className={`quest-tab ${tab === 'weekly' ? 'quest-tab--active' : ''}`}
          onClick={() => { AudioService.tap(); setTab('weekly'); setResetMs(msUntilNextMonday()); }}
        >
          Wöchentlich
          {weeklyClaimable > 0 && (
            <span className="quest-tab__badge">{weeklyClaimable}</span>
          )}
        </button>
      </div>

      {/* Urgency banner */}
      {isUrgentTimer && (
        <div className="quest-urgency">
          <span className="quest-urgency__icon">⏰</span>
          <span className="quest-urgency__text">
            {incompleteCount} Aufgabe{incompleteCount !== 1 ? 'n' : ''} unfertig —
            Reset in <strong>{formatHMS(resetMs)}</strong>!
          </span>
        </div>
      )}

      {/* Quest reset countdown + reward summary */}
      <div className="quest-reset-bar">
        <div className="quest-reset-bar__rewards">
          {claimableCount > 0 ? (
            <span className="quest-reset-bar__claimable">
              ✦ {claimableCount} abholbar · 💎 {pendingCrystals.toLocaleString('de-DE')} verfügbar
            </span>
          ) : (
            <span className="quest-reset-bar__pending">
              💎 {pendingCrystals.toLocaleString('de-DE')} noch zu verdienen
            </span>
          )}
        </div>
        <div className={`quest-reset-bar__timer${isUrgentTimer ? ' quest-reset-bar__timer--urgent' : ''}`}>
          ↺ {formatHMS(resetMs)}
        </div>
      </div>

      {/* All-complete celebration */}
      {allDone && (
        <div className="quest-all-done">
          <div className="quest-all-done__icon">🎉</div>
          <div className="quest-all-done__title">
            {tab === 'daily' ? 'Alle Tagesquests erledigt!' : 'Alle Wochenquests erledigt!'}
          </div>
          <div className="quest-all-done__crystals">
            +{claimedTotal.toLocaleString('de-DE')} 💎 · +{claimedXpTotal.toLocaleString('de-DE')} XP verdient
          </div>
          <div className="quest-all-done__hint">
            ↺ Neue Quests in {formatHMS(resetMs)}
          </div>
        </div>
      )}

      {/* Claim All button */}
      {claimableCount > 0 && !allDone && (
        <button
          className={`quest-claim-all${claimAnim ? ' quest-claim-all--anim' : ''}`}
          onClick={handleClaimAll}
        >
          <span className="quest-claim-all__icon">💎</span>
          <span className="quest-claim-all__label">ALLE ABHOLEN ({claimableCount})</span>
          <span className="quest-claim-all__reward">+{list.filter(q => q.progress.completed && !q.progress.claimed).reduce((s, q) => s + q.def.crystalReward, 0).toLocaleString('de-DE')} 💎</span>
        </button>
      )}

      <div className="quest-list">
        {list.map(({ def, progress }) => {
          const pct = Math.min(100, (progress.current / def.target) * 100);
          const isNearComplete = !progress.completed && pct >= 75;
          return (
            <div
              key={def.id}
              className={`quest-card ${progress.completed ? 'quest-card--done' : ''} ${progress.claimed ? 'quest-card--claimed' : ''} ${isNearComplete ? 'quest-card--near' : ''}`}
            >
              <div className="quest-card__body">
                <div className="quest-card__title">{def.title}</div>
                <div className="quest-card__desc">{def.description}</div>
                <div className="quest-card__bar-wrap">
                  <div className="quest-card__bar">
                    <div className="quest-card__bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="quest-card__bar-label">
                    {progress.current}/{def.target}
                  </span>
                </div>
                {isNearComplete && (
                  <div className="quest-card__near-hint">
                    ⚡ Noch {def.target - progress.current} {def.target - progress.current === 1 ? 'Mal' : '×'} bis fertig!
                  </div>
                )}
                <div className="quest-card__rewards">
                  <span>💎 {def.crystalReward}</span>
                  <span>✦ {def.xpReward.toLocaleString('de-DE')} XP</span>
                </div>
              </div>
              <div className="quest-card__action">
                {progress.claimed ? (
                  <span className="quest-card__done-label">✓ Erhalten</span>
                ) : progress.completed ? (
                  <button className="quest-claim-btn" onClick={() => handleClaim(def.id)}>
                    Abholen
                  </button>
                ) : (
                  <div className="quest-card__progress-label">{Math.round(pct)}%</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="quest-hint">
        <span>🗼</span>
        <p>Kämpfe im Turm der Prüfung, um Aufgaben voranzutreiben.</p>
      </div>
    </div>
  );
};

export default QuestScreen;
