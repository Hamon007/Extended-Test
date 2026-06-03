import React, { useState, useCallback } from 'react';
import { AchievementService, type AchievementDef, type AchievementProgress } from '../services/AchievementService';
import { AudioService } from '../services/AudioService';
import './AchievementScreen.css';

interface Props {
  onBack: () => void;
}

type Category = 'all' | 'combat' | 'collection' | 'progression' | 'social';

const CATEGORY_LABELS: Record<Category, string> = {
  all:         'Alle',
  combat:      '⚔ Kampf',
  collection:  '📦 Sammlung',
  progression: '📈 Fortschritt',
  social:      '👥 Sozial',
};

// ── Achievement-Karte ─────────────────────────────────────────

function AchievementCard({
  def,
  progress,
  onClaim,
}: {
  def:      AchievementDef;
  progress: AchievementProgress;
  onClaim:  (id: AchievementDef['id']) => void;
}) {
  const isHidden    = def.hidden && !progress.unlocked;
  const pct         = def.targetValue
    ? Math.min(100, Math.round((progress.current / def.targetValue) * 100))
    : progress.unlocked ? 100 : 0;
  const claimable   = progress.unlocked && !progress.claimed;

  if (isHidden) {
    return (
      <div className="ach-card ach-card--hidden">
        <div className="ach-card__icon">🔒</div>
        <div className="ach-card__body">
          <div className="ach-card__title">???</div>
          <div className="ach-card__desc">Verstecktes Achievement</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`ach-card ${progress.claimed ? 'ach-card--claimed' : ''} ${claimable ? 'ach-card--claimable' : ''} ${!progress.unlocked ? 'ach-card--locked' : ''}`}>
      <div className="ach-card__icon">{def.icon}</div>
      <div className="ach-card__body">
        <div className="ach-card__title">{def.title}</div>
        <div className="ach-card__desc">{def.description}</div>
        {def.targetValue && !progress.claimed && (
          <div className="ach-card__progress">
            <div className="ach-card__progress-bar">
              <div
                className={`ach-card__progress-fill ${pct >= 80 ? 'ach-card__progress-fill--near' : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="ach-card__progress-label">
              {progress.current}/{def.targetValue}
            </span>
          </div>
        )}
      </div>
      <div className="ach-card__reward">
        {progress.claimed ? (
          <span className="ach-card__done">✓</span>
        ) : claimable ? (
          <button
            className="ach-card__claim-btn"
            onClick={() => onClaim(def.id)}
          >
            +{def.crystals}💎
          </button>
        ) : (
          <span className="ach-card__crystal">{def.crystals}💎</span>
        )}
      </div>
    </div>
  );
}

// ── Haupt-Screen ──────────────────────────────────────────────

const AchievementScreen: React.FC<Props> = ({ onBack }) => {
  const [category, setCategory] = useState<Category>('all');
  const [items,    setItems]    = useState(() => AchievementService.getAll());
  const [toast,    setToast]    = useState('');

  const unclaimable = items.filter(({ progress }) => progress.unlocked && !progress.claimed).length;
  const totalCrystalsLeft = items
    .filter(({ progress }) => progress.unlocked && !progress.claimed)
    .reduce((s, { def }) => s + def.crystals, 0);

  const refresh = () => setItems(AchievementService.getAll());

  const handleClaim = useCallback((id: AchievementDef['id']) => {
    const crystals = AchievementService.claim(id);
    if (crystals > 0) {
      AudioService.reward();
      AudioService.vibrate([10, 20, 30]);
      setToast(`+${crystals} 💎 erhalten!`);
      setTimeout(() => setToast(''), 2000);
      refresh();
    }
  }, []);

  const handleClaimAll = useCallback(() => {
    const total = AchievementService.claimAll();
    if (total > 0) {
      AudioService.super();
      AudioService.vibrate([20, 30, 40, 30]);
      setToast(`+${total} 💎 erhalten!`);
      setTimeout(() => setToast(''), 2500);
      refresh();
    }
  }, []);

  const filtered = category === 'all'
    ? items
    : items.filter(({ def }) => def.category === category);

  const stats = {
    unlocked: items.filter(({ progress }) => progress.unlocked).length,
    total:    items.length,
    claimed:  items.filter(({ progress }) => progress.claimed).length,
  };

  // Achievements >= 50% but not yet unlocked, sorted by progress desc
  const nearlyDone = items
    .filter(({ def, progress }) =>
      !progress.unlocked && def.targetValue && progress.current > 0 &&
      (progress.current / def.targetValue) >= 0.5
    )
    .sort((a, b) => {
      const pa = a.progress.current / (a.def.targetValue ?? 1);
      const pb = b.progress.current / (b.def.targetValue ?? 1);
      return pb - pa;
    })
    .slice(0, 3);

  return (
    <div className="ach-screen">

      {/* Header */}
      <div className="ach-header">
        <button className="ach-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="ach-header__title">🏆 Achievements</h1>
        <div className="ach-header__count">{stats.unlocked}/{stats.total}</div>
      </div>

      {/* Statistik-Zeile */}
      <div className="ach-stats">
        <div className="ach-stats__bar">
          <div className="ach-stats__bar-fill" style={{ width: `${(stats.claimed / stats.total) * 100}%` }} />
        </div>
        <span className="ach-stats__label">{stats.claimed} abgeholt · {stats.unlocked - stats.claimed} ausstehend</span>
      </div>

      {/* Claim All */}
      {unclaimable > 0 && (
        <button className="ach-claim-all" onClick={handleClaimAll}>
          ✦ Alle abholen — +{totalCrystalsLeft} 💎
        </button>
      )}

      {/* "Fast geschafft" section */}
      {nearlyDone.length > 0 && (
        <div className="ach-nearly">
          <div className="ach-nearly__title">⚡ Fast geschafft</div>
          {nearlyDone.map(({ def, progress }) => {
            const pct = Math.min(100, Math.round((progress.current / def.targetValue!) * 100));
            return (
              <div key={def.id} className="ach-nearly-row">
                <span className="ach-nearly-row__icon">{def.icon}</span>
                <div className="ach-nearly-row__body">
                  <div className="ach-nearly-row__name">{def.title}</div>
                  <div className="ach-nearly-row__bar-wrap">
                    <div className="ach-nearly-row__bar">
                      <div className="ach-nearly-row__fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="ach-nearly-row__pct">{pct}%</span>
                  </div>
                  <div className="ach-nearly-row__counts">
                    {progress.current}/{def.targetValue} · 💎 {def.crystals}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Kategorie-Tabs */}
      <div className="ach-tabs">
        {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
          <button
            key={cat}
            className={`ach-tab ${category === cat ? 'ach-tab--active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="ach-list">
        {filtered.map(({ def, progress }) => (
          <AchievementCard
            key={def.id}
            def={def}
            progress={progress}
            onClaim={handleClaim}
          />
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className="ach-toast" role="status">{toast}</div>
      )}

    </div>
  );
};

export default AchievementScreen;
