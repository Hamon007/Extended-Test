import React, { useState, useCallback, useMemo } from 'react';
import { useDeckStore } from '../hooks/useDeckStore';
import { SaveService }  from '../services/SaveService';
import {
  GuildService,
  GUILD_NAME,
  GUILD_BOSS_MAX_HP,
  GUILD_BOSS_ATTACKS,
  GUILD_BOSS_REWARD_CRYSTALS,
  GUILD_BOSS_REWARD_POTIONS,
  WEEKLY_GOAL,
  NPC_TOTAL_CONTRIBUTION,
  guildLevel,
  xpForNextLevel,
} from '../services/GuildService';
import type { BossAttackResult } from '../types/GuildTypes';
import './GuildScreen.css';

const DONATE_OPTIONS = [100, 500, 1_000] as const;

// ── Haupt-Screen ──────────────────────────────────────────────

const GuildScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const deck      = useDeckStore();
  const [state,   setState]   = useState(() => GuildService.load());
  const [toast,   setToast]   = useState<string | null>(null);
  const [attack,  setAttack]  = useState<BossAttackResult | null>(null);
  const [shaking, setShaking] = useState(false);

  const crystals   = SaveService.loadGachaState().crystals;
  const lvl        = guildLevel(state.guildXp);
  const lvlProg    = xpForNextLevel(state.guildXp);
  const members    = useMemo(
    () => GuildService.getMembersWithPlayer(state.playerWeeklyContribution),
    [state.playerWeeklyContribution],
  );
  const totalContrib = NPC_TOTAL_CONTRIBUTION + state.playerWeeklyContribution;
  const weeklyPct    = Math.min(100, (totalContrib / WEEKLY_GOAL) * 100);
  const bossHpPct    = (state.bossCurrentHp / GUILD_BOSS_MAX_HP) * 100;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  const handleDonate = useCallback((amount: number) => {
    const ok = GuildService.donate(amount);
    if (!ok) {
      showToast('Zu wenig Kristalle');
      return;
    }
    setState(GuildService.load());
    showToast(`+${amount} 💎 gespendet!`);
  }, []);

  const handleAttack = useCallback(() => {
    const inventory = SaveService.loadGachaState().inventory;
    const result    = GuildService.attackBoss(deck.deck.uuids, inventory);
    if (!result) {
      showToast(state.bossCleared ? 'Boss bereits besiegt!' : 'Keine Angriffe mehr übrig');
      return;
    }
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
    setAttack(result);
    setState(GuildService.load());
    if (result.cleared) {
      showToast(`✦ BOSS BESIEGT! +${GUILD_BOSS_REWARD_CRYSTALS} 💎 +${GUILD_BOSS_REWARD_POTIONS} 🧪`);
    }
  }, [deck.deck.uuids, state.bossCleared]);

  return (
    <div className="guild-screen">
      {toast && <div className="guild-toast">{toast}</div>}

      {/* ── Header ── */}
      <div className="guild-header">
        <button className="guild-back" onClick={onBack}>◀</button>
        <div className="guild-header__center">
          <div className="guild-header__name">{GUILD_NAME}</div>
          <div className="guild-header__level">Stufe {lvl}</div>
        </div>
        <div className="guild-header__crystals">💎 {crystals.toLocaleString('de-DE')}</div>
      </div>

      <div className="guild-content">

        {/* ── Gildenfortschritt ── */}
        <section className="guild-section">
          <div className="guild-section__title">GILDENFORTSCHRITT</div>
          <div className="guild-progress-row">
            <span className="guild-progress-label">Stufe {lvl} → {lvl + 1}</span>
            <span className="guild-progress-xp">{lvlProg.current.toLocaleString('de-DE')} / {lvlProg.needed.toLocaleString('de-DE')} XP</span>
          </div>
          <div className="guild-bar">
            <div className="guild-bar__fill guild-bar__fill--xp" style={{ width: `${lvlProg.pct}%` }} />
          </div>

          <div className="guild-progress-row" style={{ marginTop: 10 }}>
            <span className="guild-progress-label">Wochenziel</span>
            <span className="guild-progress-xp">{totalContrib.toLocaleString('de-DE')} / {WEEKLY_GOAL.toLocaleString('de-DE')} 💎</span>
          </div>
          <div className="guild-bar">
            <div className="guild-bar__fill guild-bar__fill--week" style={{ width: `${weeklyPct}%` }} />
          </div>
        </section>

        {/* ── Guild-Boss ── */}
        <section className="guild-section">
          <div className="guild-section__title">GILDENBOSS</div>

          <div className={`guild-boss-card ${shaking ? 'guild-boss-card--shake' : ''} ${state.bossCleared ? 'guild-boss-card--cleared' : ''}`}>
            <div className="guild-boss__portrait">
              {state.bossCleared ? '☠️' : '👹'}
            </div>
            <div className="guild-boss__info">
              <div className="guild-boss__name">
                {state.bossCleared ? 'Besiegt!' : 'Dämon der Finsternis'}
              </div>
              <div className="guild-boss__hp-row">
                <span className="guild-boss__hp-label">
                  {state.bossCurrentHp.toLocaleString('de-DE')} / {GUILD_BOSS_MAX_HP.toLocaleString('de-DE')} HP
                </span>
                <span className="guild-boss__attacks">
                  ⚔ {state.bossAttacksLeft}/{GUILD_BOSS_ATTACKS} Angriffe
                </span>
              </div>
              <div className="guild-bar guild-bar--boss">
                <div
                  className="guild-bar__fill guild-bar__fill--boss"
                  style={{ width: `${bossHpPct}%` }}
                />
              </div>
              {attack && (
                <div className="guild-boss__last-hit">
                  Letzter Treffer: -{attack.damage.toLocaleString('de-DE')} Schaden
                </div>
              )}
            </div>
          </div>

          {state.bossCleared ? (
            <div className="guild-boss__clear-msg">
              ✦ Wochenziel erfüllt! Belohnungen wurden gewährt.
            </div>
          ) : (
            <button
              className={`guild-attack-btn ${state.bossAttacksLeft <= 0 ? 'guild-attack-btn--disabled' : ''}`}
              disabled={state.bossAttacksLeft <= 0}
              onClick={handleAttack}
            >
              {state.bossAttacksLeft <= 0
                ? '✕ Keine Angriffe mehr (Reset: Montag)'
                : `⚔ Boss angreifen (+${GUILD_BOSS_REWARD_CRYSTALS} 💎 bei Sieg)`}
            </button>
          )}

          {state.bossAttacksLeft > 0 && !state.bossCleared && (
            <div className="guild-boss__hint">
              Deck-Stärke bestimmt den Schaden. Reward: +{GUILD_BOSS_REWARD_CRYSTALS} 💎 & +{GUILD_BOSS_REWARD_POTIONS} 🧪 bei Sieg.
            </div>
          )}
        </section>

        {/* ── Spenden ── */}
        <section className="guild-section">
          <div className="guild-section__title">SPENDEN</div>
          <div className="guild-donate-info">
            Dein Beitrag diese Woche:{' '}
            <strong>{state.playerWeeklyContribution.toLocaleString('de-DE')} 💎</strong>
          </div>
          <div className="guild-donate-btns">
            {DONATE_OPTIONS.map(amt => (
              <button
                key={amt}
                className={`guild-donate-btn ${crystals < amt ? 'guild-donate-btn--disabled' : ''}`}
                disabled={crystals < amt}
                onClick={() => handleDonate(amt)}
              >
                +{amt} 💎
              </button>
            ))}
          </div>
        </section>

        {/* ── Mitglieder ── */}
        <section className="guild-section">
          <div className="guild-section__title">MITGLIEDER ({members.length})</div>
          <div className="guild-members-list">
            {members.map(m => (
              <div
                key={m.id}
                className={`guild-member ${m.isPlayer ? 'guild-member--player' : ''}`}
              >
                <div className="guild-member__left">
                  <span className="guild-member__role">
                    {m.role === 'leader' ? '👑' : m.role === 'officer' ? '⭐' : '·'}
                  </span>
                  <span className="guild-member__name">{m.name}</span>
                  {m.isPlayer && <span className="guild-member__you">Du</span>}
                </div>
                <span className="guild-member__contrib">
                  {m.weeklyContribution.toLocaleString('de-DE')} 💎
                </span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};

export default GuildScreen;
