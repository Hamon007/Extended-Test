import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useBattleStore }       from '../hooks/useBattleStore';
import { useTacticalStore }     from '../hooks/useTacticalStore';
import { useComboStore }        from '../hooks/useComboStore';
import { useDeckStore }         from '../hooks/useDeckStore';
import { useEnergyStore }       from '../hooks/useEnergyStore';
import { EnemyDatabase }        from '../services/EnemyDatabase';
import { TowerService }         from '../services/TowerService';
import { SaveService }          from '../services/SaveService';
import { ComboSystem }          from '../services/ComboSystem';
import { ProgressionService }   from '../services/ProgressionService';
import { QuestService }         from '../services/QuestService';
import ComboDisplay             from '../components/ComboDisplay';
import VictoryScreen            from './VictoryScreen';
import DefeatScreen             from './DefeatScreen';
import type { BattleCard, BattleState, EnemyData } from '../types/BattleTypes';
import type { DamagePopup }     from '../types/ComboTypes';
import type { RewardDetails }   from '../types/ProgressionTypes';
import type { TacticalBattleState, TacticalEnemyConfig } from '../types/TacticalBattleTypes';
import { MAX_ROUNDS }           from '../types/BattleTypes';
import { DECK_SIZE }            from '../types/DeckTypes';
import { RARITY_COLOR }         from '../types/Card';
import './BattleScreen.css';

// ── Haupt-Screen ──────────────────────────────────────────────

const BattleScreen: React.FC = () => {
  const battle = useBattleStore();
  const deck   = useDeckStore();
  const energy = useEnergyStore();

  const [rewardDetails,  setRewardDetails]  = useState<RewardDetails | null>(null);
  const [tacticalConfig, setTacticalConfig] = useState<TacticalEnemyConfig | null>(null);
  const [isTowerMode,    setIsTowerMode]    = useState(false);
  const [towerFloor,     setTowerFloor]     = useState(() => TowerService.getFloor());
  const highestFloor = TowerService.getHighestFloor();
  const rewardApplied = useRef(false);

  const inventory     = useMemo(() => SaveService.loadGachaState().inventory, []);
  const deckInstances = useMemo(() => {
    const invMap = new Map(inventory.map(i => [i.uuid, i]));
    return deck.deck.uuids
      .map(uuid => invMap.get(uuid))
      .filter((i): i is NonNullable<typeof i> => i !== undefined);
  }, [deck.deck.uuids, inventory]);

  const deckComplete = deckInstances.length === DECK_SIZE;

  // Belohnungen einmalig anwenden wenn Battle endet
  useEffect(() => {
    if (!battle.state?.result || rewardApplied.current) return;
    rewardApplied.current = true;
    const details = ProgressionService.applyRewards(
      battle.state.result,
      battle.state.enemyData,
    );
    setRewardDetails(details);

    // Aufgaben-Fortschritt
    if (battle.state.result.outcome === 'victory') {
      QuestService.recordEvent('win_battles');
      if (isTowerMode) {
        QuestService.recordEvent('reach_floor', 1, { floor: towerFloor });
        if (tacticalConfig) {
          if (TowerService.isBossFloor(towerFloor)) QuestService.recordEvent('defeat_boss');
          else QuestService.recordEvent('defeat_elite');
        }
      }
    }
  }, [battle.state?.result]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContinue = useCallback(() => {
    if (rewardDetails?.isVictory && isTowerMode) {
      const next = TowerService.advanceFloor();
      TowerService.updateHighestFloor(next);
      setTowerFloor(next);
    }
    battle.resetBattle();
    setRewardDetails(null);
    setTacticalConfig(null);
    setIsTowerMode(false);
    rewardApplied.current = false;
    energy.refresh();
  }, [battle, energy, rewardDetails, isTowerMode]);

  // ── Victory / Defeat Screens ──────────────────────────────
  if (rewardDetails) {
    return rewardDetails.isVictory ? (
      <VictoryScreen details={rewardDetails} onContinue={handleContinue} />
    ) : (
      <DefeatScreen details={rewardDetails} onReturnToSelect={handleContinue} />
    );
  }

  // ── Laufender Kampf ───────────────────────────────────────
  if (battle.state) {
    return <BattleArena state={battle.state} battle={battle} tacticalConfig={tacticalConfig} />;
  }

  // ── Turm-Start ────────────────────────────────────────────
  const noEnergy = energy.energy < 1;

  const handleTowerStart = () => {
    if (!deckComplete) return;
    if (!energy.consume()) return;
    setIsTowerMode(true);

    const tactEnemy = TowerService.getFloorEnemy(towerFloor);
    if (tactEnemy) {
      setTacticalConfig(tactEnemy);
      const base = EnemyDatabase.getFirst() ?? EnemyDatabase.getAll()[0];
      if (!base) return;
      const scaledEnemy: EnemyData = {
        ...base,
        id:    tactEnemy.id,
        name:  tactEnemy.name,
        title: tactEnemy.title,
        stats: {
          hp:      Math.round(base.stats.hp      * (1 + towerFloor * 0.15)),
          mpMax:   base.stats.mpMax,
          mpRegen: base.stats.mpRegen,
        },
        cards: base.cards.map(c => ({
          ...c,
          atk: Math.round(c.atk * (1 + towerFloor * 0.1)),
        })),
        rewardXp:       Math.round(base.rewardXp      * (1 + towerFloor * 0.2)),
        rewardCrystals: Math.round(base.rewardCrystals * (1 + towerFloor * 0.2)),
      };
      battle.startBattle(deckInstances, scaledEnemy);
    } else {
      setTacticalConfig(null);
      const all = EnemyDatabase.getAll();
      const random = all[Math.floor(Math.random() * all.length)];
      if (random) battle.startBattle(deckInstances, random);
    }
  };

  const isBoss = TowerService.isBossFloor(towerFloor);

  return (
    <div className="battle-screen--select">
      <div className="battle-select-header">
        <h1 className="battle-select-title">🗼 TURM DER PRÜFUNG</h1>
      </div>

      {/* Etagen-Info */}
      <div className="battle-tower-floor-banner">
        <div className="battle-tower-floor-banner__floor">
          <span className="battle-tower-floor-banner__num">{towerFloor}</span>
          <span className="battle-tower-floor-banner__label">ETAGE</span>
        </div>
        <div className="battle-tower-floor-banner__info">
          <div className="battle-tower-floor-banner__type">
            {isBoss ? '⚔ BOSS-ETAGE' : towerFloor % 5 === 0 ? '⚡ ELITE-ETAGE' : '◆ NORMAL-ETAGE'}
          </div>
          <div className="battle-tower-floor-banner__highest">Höchste erreicht: {highestFloor}</div>
          <div className="battle-tower-floor-banner__hint">
            {isBoss
              ? 'Ein mächtiger Wächter versperrt den Weg. Taktik ist alles.'
              : 'Steige höher. Werde stärker. Bezwinge den Turm.'}
          </div>
        </div>
      </div>

      {/* Energie / Ausdauertränke */}
      <div className="battle-energy">
        <div className="battle-energy__pips" aria-label={`Energie ${energy.energy} von ${energy.max}`}>
          {Array.from({ length: energy.max }).map((_, i) => (
            <span key={i} className={`battle-energy__pip ${i < energy.energy ? 'battle-energy__pip--full' : ''}`}>
              ⚡
            </span>
          ))}
        </div>
        <div className="battle-energy__meta">
          <span className="battle-energy__count">{energy.energy}/{energy.max} Kämpfe</span>
          <button
            className="battle-energy__potion"
            onClick={energy.usePotion}
            disabled={energy.potions < 1 || energy.energy >= energy.max}
            title="Ausdauertrank nutzen (+1 Energie)"
          >
            🧪 ×{energy.potions}
          </button>
        </div>
      </div>

      <div className={`battle-deck-status ${deckComplete ? 'battle-deck-status--ok' : 'battle-deck-status--warn'}`}>
        {deckComplete
          ? `✓ Deck bereit (${deckInstances.length}/${DECK_SIZE} Karten)`
          : `⚠ Deck unvollständig (${deckInstances.length}/${DECK_SIZE}) — Deckbuilder öffnen`}
      </div>

      <div className="battle-tower-spacer" />

      <button
        className={`battle-tower-btn ${!deckComplete || noEnergy ? 'battle-start-btn--disabled' : ''}`}
        disabled={!deckComplete || noEnergy}
        onClick={handleTowerStart}
      >
        {!deckComplete ? '⚠ Deck unvollständig'
          : noEnergy ? '⚡ Keine Energie'
          : isBoss
            ? `⚔ Boss-Kampf — Etage ${towerFloor} betreten`
            : `▶ Etage ${towerFloor} betreten`}
      </button>
    </div>
  );
};

// ── Battle-Arena ──────────────────────────────────────────────

interface BattleArenaProps {
  state:         BattleState;
  battle:        ReturnType<typeof useBattleStore>;
  tacticalConfig?: TacticalEnemyConfig | null;
}

const BattleArena: React.FC<BattleArenaProps> = ({ state, battle, tacticalConfig }) => {
  const combo    = useComboStore();
  const tactical = useTacticalStore(tacticalConfig ?? null);
  const [popups,      setPopups]      = useState<DamagePopup[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [synergyToast, setSynergyToast] = useState<{ a: string; b: string } | null>(null);
  const popupId = React.useRef(0);

  const { player, enemy, round, phase, log, result, enemyData } = state;
  const canPlay   = phase === 'player_turn' && !result;
  const allPlayed = player.hand.every(c => c.played);

  // Auswahl zurücksetzen wenn Phase wechselt
  useEffect(() => {
    setSelectedIds([]);
    if (phase !== 'player_turn') combo.reset();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Popup hinzufügen + auto-entfernen
  const addPopup = useCallback((popup: Omit<DamagePopup, 'id'>) => {
    const id = ++popupId.current;
    setPopups(prev => [...prev, { ...popup, id }]);
    setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 1400);
  }, []);

  // Karte in Auswahl ein-/ausschalten
  const handleToggleCard = useCallback((card: BattleCard) => {
    if (!canPlay || card.played || card.destroyed || card.mpCost > player.mp) return;
    setSelectedIds(prev =>
      prev.includes(card.instanceId)
        ? prev.filter(id => id !== card.instanceId)
        : [...prev, card.instanceId]
    );
  }, [canPlay, player.mp]);

  // Alle ausgewählten Karten in Reihenfolge ausspielen
  const handlePlaySelected = useCallback(() => {
    if (!canPlay || selectedIds.length === 0) return;

    // Combo-Zähler lokal hochzählen (Refs in useComboStore immer aktuell)
    let localComboCount = combo.isActive ? combo.count : 0;
    let lastCard = combo.lastCard;

    for (const instanceId of selectedIds) {
      const card = player.hand.find(c => c.instanceId === instanceId);
      if (!card || card.played || card.destroyed) continue;

      localComboCount = Math.min(5, localComboCount + 1);
      const calc = ComboSystem.calculate(
        card.atk,
        localComboCount,
        lastCard,
        card,
        enemyData.element,
      );

      combo.onCardPlayed(card, calc.windowExtension);
      if (localComboCount >= 2) QuestService.recordEvent('play_combos');

      if (tacticalConfig && tactical.tactical) {
        // Tactical mode: use playTacticalCard which applies tactical multiplier
        tactical.playTacticalCard(card, localComboCount);
      } else {
        battle.playCard(card.instanceId, calc.totalMultiplier);
      }

      addPopup({
        damage:     calc.finalDamage,
        combo:      localComboCount,
        multiplier: calc.totalMultiplier,
        hasSynergy: calc.hasSynergy,
        hasElement: calc.hasElementAdv,
        xPct:       20 + Math.random() * 60,
      });

      if (calc.hasSynergy && lastCard) {
        setSynergyToast({ a: lastCard.name, b: card.name });
        setTimeout(() => setSynergyToast(null), 2200);
        QuestService.recordEvent('use_synergy');
      }

      lastCard = card;
    }

    setSelectedIds([]);
  }, [canPlay, selectedIds, player.hand, combo, enemyData.element, battle, tacticalConfig, tactical, addPopup]);

  return (
    <div className="battle-arena">

      {/* Topbar */}
      <div className="arena-topbar">
        <span className="arena-round">Runde {round} / {MAX_ROUNDS}</span>
        <span className={`arena-phase arena-phase--${phase}`}>
          {phase === 'player_turn' && 'Dein Zug'}
          {phase === 'enemy_turn'  && '⚔ Gegnerzug …'}
          {phase === 'round_end'   && '⏱ Rundenende …'}
          {phase === 'ended'       && (result?.outcome === 'victory' ? '🏆 SIEG' : '💀 NIEDERLAGE')}
        </span>
        <button className="arena-flee-btn" onClick={battle.resetBattle}>✕</button>
      </div>

      {/* Synergie-Toast */}
      {synergyToast && (
        <div className="arena-synergy-toast">
          <span className="arena-synergy-toast__icon">⭐</span>
          <span className="arena-synergy-toast__text">SYNERGIE</span>
          <span className="arena-synergy-toast__cards">{synergyToast.a} + {synergyToast.b}</span>
        </div>
      )}

      {/* Gegner oben */}
      <div className="arena-enemy-zone">
        <div className="arena-enemy-portrait"><span>💀</span></div>
        <div className="arena-enemy-info">
          <div className="arena-enemy-name">{enemyData.name}</div>
          <HpBar current={enemy.hp} max={enemy.hpMax} color="#cc2200" />
          <MpBar current={enemy.mp} max={enemy.mpMax} />
          <div className="arena-enemy-cards-row">
            {enemy.hand.map(c => <EnemyCardMini key={c.instanceId} card={c} />)}
          </div>
          {/* Tactical Overlay */}
          {tactical.tactical && (
            <TacticalOverlay tacticalState={tactical.tactical} />
          )}
        </div>
      </div>

      {/* Battle-Log + Combo-Overlay */}
      <div className="arena-log-wrap">
        <BattleLog entries={log} />

        <div className="combo-overlay">
          <ComboDisplay
            count={combo.count}
            timeLeft={combo.timeLeft}
            maxTime={combo.maxTime}
            isActive={combo.isActive}
            isBreaking={combo.isBreaking}
            isMaxCombo={combo.isMaxCombo}
            lastCard={combo.lastCard}
            popups={popups}
          />
        </div>
      </div>

      {/* Spieler unten */}
      <div className="arena-player-zone">
        <div className="arena-player-stats">
          <div>
            <span className="arena-stat-label">HP</span>
            <HpBar current={player.hp} max={player.hpMax} color="#2d8a3e" />
          </div>
          <div>
            <span className="arena-stat-label">MP {player.mp}/{player.mpMax}</span>
            <MpBar current={player.mp} max={player.mpMax} />
          </div>
        </div>

        {/* Karten-Hand */}
        <div className="arena-hand">
          {player.hand.map(card => (
            <PlayerHandCard
              key={card.instanceId}
              card={card}
              canPlay={canPlay}
              playerMp={player.mp}
              selectIndex={selectedIds.indexOf(card.instanceId)}
              onToggle={() => handleToggleCard(card)}
            />
          ))}
        </div>

        {/* Auswahl-Hinweis */}
        {canPlay && !allPlayed && (
          <div className="arena-play-hint">
            {selectedIds.length === 0
              ? 'Karten antippen zum Auswählen'
              : `${selectedIds.length} Karte(n) ausgewählt — spielen oder weitere wählen`}
          </div>
        )}

        {/* Ausgewählte spielen */}
        {selectedIds.length > 0 && canPlay && (
          <button className="arena-play-selected" onClick={handlePlaySelected}>
            ⚔ {selectedIds.length} Karte{selectedIds.length > 1 ? 'n' : ''} ausspielen
          </button>
        )}

        {/* Taktische Aktionen (nur im Tower-Modus) */}
        {tactical.tactical && (
          <div className="tactical-actions">
            <button
              className={`tactical-action-btn ${tactical.guardActive ? 'tactical-action-btn--active' : ''}`}
              onClick={tactical.useGuard}
              disabled={!canPlay}
            >
              🛡 Guard
              <span className="tactical-action-hint">-50% Schaden · +15 MP</span>
            </button>
            <button
              className={`tactical-action-btn ${tactical.focusActive ? 'tactical-action-btn--active' : ''}`}
              onClick={tactical.useFocus}
              disabled={!canPlay}
            >
              🎯 Focus
              <span className="tactical-action-hint">+2 Break nächste Karte</span>
            </button>
            <button
              className={`tactical-action-btn ${tactical.cleanseUsed >= 2 ? 'tactical-action-btn--disabled' : ''}`}
              onClick={tactical.useCleanse}
              disabled={tactical.cleanseUsed >= 2 || !canPlay}
            >
              ✨ Cleanse
              <span className="tactical-action-hint">{tactical.cleanseUsed}/2 · Flüche entfernen</span>
            </button>
          </div>
        )}

        {/* End-Turn */}
        <button
          className={`arena-end-turn
            ${!canPlay ? 'arena-end-turn--disabled' : ''}
            ${canPlay && allPlayed ? 'arena-end-turn--ready' : ''}
          `}
          onClick={battle.endTurn}
          disabled={!canPlay}
        >
          {phase !== 'player_turn' ? '⏳ Warten …'
            : allPlayed ? '▶ Zug beenden'
            : `▶ Zug beenden (${player.hand.filter(c => !c.played).length} übrig)`}
        </button>
      </div>

    </div>
  );
};

// ── HP/MP-Balken ──────────────────────────────────────────────

const HpBar: React.FC<{ current: number; max: number; color: string }> = ({ current, max, color }) => {
  const pct = max > 0 ? Math.max(0, (current / max) * 100) : 0;
  return (
    <div className="battle-bar">
      <div className="battle-bar__fill" style={{ width: `${pct}%`, background: color }} />
      <span className="battle-bar__label">
        {current.toLocaleString('de-DE')} / {max.toLocaleString('de-DE')}
      </span>
    </div>
  );
};

const MpBar: React.FC<{ current: number; max: number }> = ({ current, max }) => {
  const pct = max > 0 ? Math.max(0, (current / max) * 100) : 0;
  return (
    <div className="battle-bar battle-bar--mp">
      <div className="battle-bar__fill" style={{ width: `${pct}%`, background: '#1a5faf' }} />
      <span className="battle-bar__label">{current} MP</span>
    </div>
  );
};

// ── Spieler-Hand-Karte ────────────────────────────────────────

interface PlayerHandCardProps {
  card:        BattleCard;
  canPlay:     boolean;
  playerMp:    number;
  selectIndex: number;   // -1 = nicht ausgewählt, ≥0 = Spielreihenfolge
  onToggle:    () => void;
}

const PlayerHandCard: React.FC<PlayerHandCardProps> = ({
  card, canPlay, playerMp, selectIndex, onToggle,
}) => {
  const [imgErr, setImgErr] = useState(false);
  const touchStartY = useRef<number | null>(null);

  const noMp       = card.mpCost > playerMp;
  const blocked    = card.played || card.destroyed || !canPlay || noMp;
  const isSelected = selectIndex >= 0;
  const rc         = RARITY_COLOR[card.card?.rarity ?? 'N'] ?? '#8a6520';

  const handleClick = () => {
    if (!blocked) onToggle();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;

    if (Math.abs(deltaY) < 15 && !blocked) {
      e.preventDefault(); // verhindert nachfolgendes click-Event
      onToggle();
    }
  };

  return (
    <div
      className={`hand-card
        ${isSelected     ? 'hand-card--selected'  : ''}
        ${card.played    ? 'hand-card--played'    : ''}
        ${card.destroyed ? 'hand-card--destroyed' : ''}
        ${noMp && !card.played ? 'hand-card--no-mp' : ''}
        ${!blocked && !isSelected ? 'hand-card--playable' : ''}
      `}
      style={{ '--rc': rc } as React.CSSProperties}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      title={noMp ? `Zu wenig MP (${card.mpCost})` : card.name}
    >
      <div className="hand-card__art">
        {!imgErr && card.image
          ? <img src={card.image} alt={card.name} onError={() => setImgErr(true)} />
          : <div className="hand-card__placeholder">🌑</div>}
        {card.played && <div className="hand-card__played-overlay">✓</div>}
        <div className="hand-card__gradient" />
      </div>
      <div className={`hand-card__mp ${noMp ? 'hand-card__mp--low' : ''}`}>
        💧{card.mpCost}
      </div>
      {isSelected && !card.played && (
        <div className="hand-card__select-order">{selectIndex + 1}</div>
      )}
      <div className="hand-card__footer">
        <span className="hand-card__name">{card.name}</span>
        <span className="hand-card__atk">⚔ {card.atk.toLocaleString('de-DE')}</span>
      </div>
    </div>
  );
};

// ── Gegner-Karte (mini) ───────────────────────────────────────

const EnemyCardMini: React.FC<{ card: BattleCard }> = ({ card }) => (
  <div
    className={`enemy-card-mini
      ${card.played    ? 'enemy-card-mini--played'    : ''}
      ${card.destroyed ? 'enemy-card-mini--destroyed' : ''}
    `}
    title={`${card.name} · ATK ${card.atk.toLocaleString('de-DE')} · ${card.mpCost} MP`}
  >
    <span className="enemy-card-mini__icon">
      {card.destroyed ? '💀' : card.played ? '✓' : '🃏'}
    </span>
    <span className="enemy-card-mini__name">{card.name.split(' ')[0]}</span>
    <span className="enemy-card-mini__atk">⚔{card.atk.toLocaleString('de-DE')}</span>
  </div>
);

// ── Battle-Log ────────────────────────────────────────────────

const BattleLog: React.FC<{ entries: BattleState['log'] }> = ({ entries }) => {
  const visible = [...entries].reverse().slice(0, 5);
  return (
    <div className="battle-log">
      {visible.map(e => (
        <div key={e.id} className={`battle-log__entry battle-log__entry--${e.actor}`}>
          {e.text}
          {e.damage > 0 && (
            <span className={`battle-log__dmg battle-log__dmg--${e.actor}`}>
              -{e.damage.toLocaleString('de-DE')}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};


// ── Taktisches Overlay ────────────────────────────────────────

const TacticalOverlay: React.FC<{ tacticalState: TacticalBattleState }> = ({ tacticalState }) => (
  <div className="tactical-overlay">
    {/* Break Bar */}
    <div className="tactical-break-bar">
      <span className="tactical-break-label">
        BREAK {tacticalState.breakState.current}/{tacticalState.breakState.max}
      </span>
      <div className="tactical-break-track">
        <div
          className={`tactical-break-fill ${tacticalState.breakState.isBroken ? 'tactical-break-fill--broken' : ''}`}
          style={{
            width: `${(tacticalState.breakState.current / tacticalState.breakState.max) * 100}%`,
          }}
        />
      </div>
      {tacticalState.breakState.isBroken && (
        <span className="tactical-break-broken-label">⚡ GEBROCHEN! +50% Schaden</span>
      )}
    </div>

    {/* Stance */}
    {tacticalState.stance.current && (
      <div className="tactical-stance">
        Haltung: <strong>{tacticalState.stance.current.toUpperCase()}</strong>
        {tacticalState.stance.weakTo.length > 0 && (
          <> · Schwach gegen: {tacticalState.stance.weakTo.join(', ')}</>
        )}
      </div>
    )}

    {/* Heat */}
    {tacticalState.heat.active && (
      <div className="tactical-heat">
        🔥 Aether-Hitze: {tacticalState.heat.current}/{tacticalState.heat.threshold}
      </div>
    )}

    {/* Seal */}
    {tacticalState.seal.sealedRarity && (
      <div className="tactical-seal">
        🔒 {tacticalState.seal.sealedRarity} gesperrt ({tacticalState.seal.roundsLeft} Runden)
      </div>
    )}

    {/* Intent */}
    {tacticalState.intent && (
      <div className="tactical-intent">
        <span className="tactical-intent-label">⚠ {tacticalState.intent.label}</span>
        <span className="tactical-intent-counter">Konter: {tacticalState.intent.counter}</span>
      </div>
    )}
  </div>
);

export default BattleScreen;
