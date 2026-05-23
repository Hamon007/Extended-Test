import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import {
  GuildNetworkService,
  type RealGuild,
  type GuildMemberEntry,
  type GuildApplication,
} from '../services/GuildNetworkService';
import { AuthService } from '../services/AuthService';
import './GuildScreen.css';

const DONATE_OPTIONS = [100, 500, 1_000] as const;

// ── Haupt-Screen ──────────────────────────────────────────────

const GuildScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const deck      = useDeckStore();
  const [state,   setState]   = useState(() => GuildService.load());
  const [toast,   setToast]   = useState<string | null>(null);
  const [attack,  setAttack]  = useState<BossAttackResult | null>(null);
  const [shaking, setShaking] = useState(false);
  const [activeTab, setActiveTab] = useState<'kampf' | 'gilde'>('kampf');

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

      {/* ── Tab-Leiste ── */}
      <div className="guild-tab-bar">
        <button
          className={`guild-tab-btn${activeTab === 'kampf' ? ' guild-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('kampf')}
        >
          ⚔ Kampf
        </button>
        <button
          className={`guild-tab-btn${activeTab === 'gilde' ? ' guild-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('gilde')}
        >
          🏰 Gilde
        </button>
      </div>

      {activeTab === 'kampf' ? (
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
      ) : (
        <GildeTab showToast={showToast} />
      )}
    </div>
  );
};

// ── Gilde-Tab ─────────────────────────────────────────────────

interface GildeTabProps {
  showToast: (msg: string) => void;
}

const GildeTab: React.FC<GildeTabProps> = ({ showToast }) => {
  const isLoggedIn = AuthService.isLoggedIn;
  const [membership, setMembership] = useState<{ guild_id: string; role: string } | null>(null);
  const [myGuild, setMyGuild] = useState<RealGuild | null>(null);
  const [members, setMembers] = useState<GuildMemberEntry[]>([]);
  const [applications, setApplications] = useState<GuildApplication[]>([]);
  const [guildList, setGuildList] = useState<RealGuild[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [appliedGuilds, setAppliedGuilds] = useState<Set<string>>(new Set());

  // Create form state
  const [createName, setCreateName] = useState('');
  const [createTag, setCreateTag] = useState('');
  const [createEmblem, setCreateEmblem] = useState('🏰');
  const [createDesc, setCreateDesc] = useState('');
  const [createOpen, setCreateOpen] = useState(true);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadGuildData = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    const mem = await GuildNetworkService.getMyMembership();
    setMembership(mem);
    if (mem) {
      const [guild, memberList, apps] = await Promise.all([
        GuildNetworkService.getGuildById(mem.guild_id),
        GuildNetworkService.getGuildMembers(mem.guild_id),
        mem.role === 'leader' ? GuildNetworkService.getPendingApplications(mem.guild_id) : Promise.resolve([]),
      ]);
      setMyGuild(guild);
      setMembers(memberList);
      setApplications(apps);
    } else {
      const list = await GuildNetworkService.searchGuilds('');
      setGuildList(list);
    }
    setLoading(false);
  }, [isLoggedIn]);

  useEffect(() => {
    loadGuildData();
  }, [loadGuildData]);

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    const list = await GuildNetworkService.searchGuilds(q);
    setGuildList(list);
  }, []);

  const handleApply = useCallback(async (guildId: string) => {
    const err = await GuildNetworkService.applyToGuild(guildId, '');
    if (err) {
      showToast(err);
    } else {
      setAppliedGuilds(prev => new Set(prev).add(guildId));
      showToast('Bewerbung gesendet!');
    }
  }, [showToast]);

  const handleLeave = useCallback(async () => {
    if (!membership) return;
    const err = await GuildNetworkService.leaveGuild(membership.guild_id);
    if (err) {
      showToast(err);
    } else {
      showToast('Gilde verlassen.');
      setMembership(null);
      setMyGuild(null);
      setMembers([]);
      const list = await GuildNetworkService.searchGuilds('');
      setGuildList(list);
    }
  }, [membership, showToast]);

  const handleCreate = useCallback(async () => {
    setCreateError('');
    if (!createName.trim()) { setCreateError('Name fehlt.'); return; }
    if (!createTag.trim())  { setCreateError('Tag fehlt.'); return; }
    setCreating(true);
    const err = await GuildNetworkService.createGuild(createName, createTag, createEmblem, createDesc, createOpen);
    setCreating(false);
    if (err) {
      setCreateError(err);
    } else {
      showToast('Gilde gegründet!');
      setShowCreateForm(false);
      await loadGuildData();
    }
  }, [createName, createTag, createEmblem, createDesc, createOpen, showToast, loadGuildData]);

  const handleAccept = useCallback(async (app: GuildApplication) => {
    if (!membership) return;
    await GuildNetworkService.acceptApplication(app.id, app.user_id, membership.guild_id);
    showToast(`${app.username ?? 'Mitglied'} aufgenommen.`);
    setApplications(prev => prev.filter(a => a.id !== app.id));
  }, [membership, showToast]);

  const handleReject = useCallback(async (appId: string) => {
    await GuildNetworkService.rejectApplication(appId);
    setApplications(prev => prev.filter(a => a.id !== appId));
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="guild-content">
        <div className="guild-login-hint">
          <span>🔒</span>
          <p>Bitte melde dich an, um Gilden beizutreten oder zu gründen.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="guild-content">
        <div className="guild-loading">Lade Gildendaten …</div>
      </div>
    );
  }

  // ── In einer Gilde ──
  if (membership && myGuild) {
    return (
      <div className="guild-content">
        {/* Guild Info Card */}
        <div className="guild-my-info">
          <div className="guild-my-info__emblem">{myGuild.emblem}</div>
          <div className="guild-my-info__details">
            <div className="guild-my-info__name">{myGuild.name} <span className="guild-my-info__tag">[{myGuild.tag}]</span></div>
            <div className="guild-my-info__meta">
              {myGuild.member_count ?? 0} Mitglieder · Anführer: {myGuild.leader_username ?? '—'}
            </div>
            {myGuild.description && (
              <div className="guild-my-info__desc">{myGuild.description}</div>
            )}
          </div>
        </div>

        {/* Members List */}
        <section className="guild-section">
          <div className="guild-section__title">MITGLIEDER ({members.length})</div>
          <div className="guild-members-list">
            {members.map(m => (
              <div key={m.id} className="guild-member">
                <div className="guild-member__left">
                  <span className="guild-member__role">
                    {m.role === 'leader' ? '👑' : m.role === 'officer' ? '⭐' : '·'}
                  </span>
                  <span className="guild-member__name">{m.username ?? m.user_id}</span>
                </div>
                <span className="guild-member__contrib">{m.role}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Pending Applications (leader only) */}
        {membership.role === 'leader' && applications.length > 0 && (
          <section className="guild-section guild-apps-section">
            <div className="guild-section__title">BEWERBUNGEN ({applications.length})</div>
            {applications.map(app => (
              <div key={app.id} className="guild-app-row">
                <span className="guild-app-row__name">{app.username ?? app.user_id}</span>
                {app.message && <span className="guild-app-row__msg">„{app.message}"</span>}
                <div className="guild-app-row__btns">
                  <button className="guild-app-row__accept" onClick={() => handleAccept(app)}>✓ Aufnehmen</button>
                  <button className="guild-app-row__reject" onClick={() => handleReject(app.id)}>✕ Ablehnen</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Leave Button */}
        <button className="guild-leave-btn" onClick={handleLeave}>
          Gilde verlassen
        </button>
      </div>
    );
  }

  // ── Nicht in einer Gilde ──
  return (
    <div className="guild-content">
      {/* Search */}
      <div className="guild-search-bar">
        <input
          type="text"
          placeholder="Gilde suchen …"
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          className="guild-search-input"
        />
      </div>

      {/* Guild List */}
      <div className="guild-list">
        {guildList.length === 0 && (
          <div className="guild-list-empty">Keine Gilden gefunden.</div>
        )}
        {guildList.map(g => (
          <div key={g.id} className="guild-list-row">
            <div className="guild-list-row__emblem">{g.emblem}</div>
            <div className="guild-list-row__info">
              <div className="guild-list-row__name">
                {g.name} <span className="guild-list-row__tag">[{g.tag}]</span>
              </div>
              <div className="guild-list-row__meta">
                {g.member_count ?? 0}/{g.max_members} Mitglieder
                {!g.is_open && ' · Geschlossen'}
              </div>
            </div>
            {g.is_open ? (
              <button
                className={`guild-list-row__apply-btn${appliedGuilds.has(g.id) ? ' guild-list-row__apply-btn--applied' : ''}`}
                disabled={appliedGuilds.has(g.id)}
                onClick={() => handleApply(g.id)}
              >
                {appliedGuilds.has(g.id) ? 'Beworben' : 'Bewerben'}
              </button>
            ) : (
              <span className="guild-list-row__closed">Geschlossen</span>
            )}
          </div>
        ))}
      </div>

      {/* Create Guild */}
      {!showCreateForm ? (
        <button className="guild-create-btn" onClick={() => setShowCreateForm(true)}>
          🏰 Gilde gründen
        </button>
      ) : (
        <div className="guild-create-form">
          <div className="guild-section__title">GILDE GRÜNDEN</div>
          <input
            className="guild-create-input"
            placeholder="Gildenname *"
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            maxLength={40}
          />
          <input
            className="guild-create-input"
            placeholder="Tag (max 4 Zeichen) *"
            value={createTag}
            onChange={e => setCreateTag(e.target.value.toUpperCase())}
            maxLength={4}
          />
          <input
            className="guild-create-input"
            placeholder="Emblem (Emoji)"
            value={createEmblem}
            onChange={e => setCreateEmblem(e.target.value)}
            maxLength={8}
          />
          <textarea
            className="guild-create-textarea"
            placeholder="Beschreibung (optional)"
            value={createDesc}
            onChange={e => setCreateDesc(e.target.value)}
            maxLength={200}
            rows={3}
          />
          <label className="guild-create-toggle">
            <input
              type="checkbox"
              checked={createOpen}
              onChange={e => setCreateOpen(e.target.checked)}
            />
            <span>Offen (jeder kann sich bewerben)</span>
          </label>
          {createError && <div className="guild-create-error">{createError}</div>}
          <div className="guild-create-actions">
            <button className="guild-create-cancel" onClick={() => setShowCreateForm(false)}>Abbrechen</button>
            <button className="guild-create-submit" onClick={handleCreate} disabled={creating}>
              {creating ? '…' : 'Gründen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuildScreen;
