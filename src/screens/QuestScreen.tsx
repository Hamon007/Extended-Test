import React, { useState, useEffect } from 'react';
import { QuestService } from '../services/QuestService';
import { AccountProgressionService } from '../services/AccountProgressionService';
import { SaveService } from '../services/SaveService';
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

  // Total available (unclaimed + incomplete) crystals
  const pendingCrystals = list
    .filter(q => !q.progress.claimed)
    .reduce((sum, q) => sum + q.def.crystalReward, 0);
  const claimableCount = list.filter(q => q.progress.completed && !q.progress.claimed).length;

  function handleClaim(questId: string) {
    const reward = QuestService.claimReward(questId);
    if (!reward) return;
    const acct   = SaveService.loadAccountState();
    const result = AccountProgressionService.addAccountXp(acct, reward.xp);
    SaveService.saveAccountState(result.newState);
    showToast(`+${reward.crystals} 💎 · +${reward.xp.toLocaleString('de-DE')} XP`);
    refresh();
  }

  return (
    <div className="quest-screen">
      {toast && <div className="quest-toast">{toast}</div>}

      <div className="quest-header">
        <button className="quest-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="quest-header__title">Aufgaben</h1>
        <div />
      </div>

      <div className="quest-tabs">
        <button
          className={`quest-tab ${tab === 'daily' ? 'quest-tab--active' : ''}`}
          onClick={() => { setTab('daily'); setResetMs(msUntilMidnightUtc()); }}
        >
          Täglich
        </button>
        <button
          className={`quest-tab ${tab === 'weekly' ? 'quest-tab--active' : ''}`}
          onClick={() => { setTab('weekly'); setResetMs(msUntilNextMonday()); }}
        >
          Wöchentlich
        </button>
      </div>

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
        <div className="quest-reset-bar__timer">
          ↺ {formatHMS(resetMs)}
        </div>
      </div>

      <div className="quest-list">
        {list.map(({ def, progress }) => {
          const pct = Math.min(100, (progress.current / def.target) * 100);
          return (
            <div
              key={def.id}
              className={`quest-card ${progress.completed ? 'quest-card--done' : ''} ${progress.claimed ? 'quest-card--claimed' : ''}`}
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
