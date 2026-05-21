import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useBattleStore }       from '../hooks/useBattleStore';
import { useComboStore }        from '../hooks/useComboStore';
import { useDeckStore }         from '../hooks/useDeckStore';
import { useEnergyStore }       from '../hooks/useEnergyStore';
import { EnemyDatabase }        from '../services/EnemyDatabase';
import { SaveService }          from '../services/SaveService';
import { ComboSystem }          from '../services/ComboSystem';
import { ProgressionService }   from '../services/ProgressionService';
import ComboDisplay             from '../components/ComboDisplay';
import VictoryScreen            from './VictoryScreen';
import DefeatScreen             from './DefeatScreen';
import type { BattleCard, BattleState, EnemyData } from '../types/BattleTypes';
import type { DamagePopup }     from '../types/ComboTypes';
import type { RewardDetails }   from '../types/ProgressionTypes';
import { MAX_ROUNDS }           from '../types/BattleTypes';
import { DECK_SIZE }            from '../types/DeckTypes';
import { RARITY_COLOR }         from '../types/Card';
import './BattleScreen.css';

// ── Haupt-Screen ──────────────────────────────────────────────

const BattleScreen: React.FC = () => {
  const battle = useBattleStore();
  const deck   = useDeckStore();
  const energy = useEnergyStore();

  const [selectedEnemy, setSelectedEnemy] = useState<EnemyData | null>(null);
  const [rewardDetails, setRewardDetails] = useState<RewardDetails | null>(null);
  const rewardApplied = useRef(false);

  const enemies       = EnemyDatabase.getAll();
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
  }, [battle.state?.result]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContinue = useCallback(() => {
    battle.resetBattle();
    setRewardDetails(null);
    rewardApplied.current = false;
    energy.refresh();
  }, [battle, energy]);

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
    return <BattleArena state={battle.state} battle={battle} />;
  }

  // ── Gegner-Auswahl ────────────────────────────────────────
  const noEnergy = energy.energy < 1;
  const canStart = deckComplete && !!selectedEnemy && !noEnergy;

  const handleStart = () => {
    if (!selectedEnemy || !deckComplete) return;
    if (!energy.consume()) return;
    battle.startBattle(deckInstances, selectedEnemy);
  };

  return (
    <div className="battle-screen--select">
      <div className="battle-select-header">
        <h1 className="battle-select-title">◆ KAMPF ◆</h1>
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

      <div className="battle-enemy-list">
        {enemies.map(enemy => (
          <EnemySelectCard
            key={enemy.id}
            enemy={enemy}
            selected={selectedEnemy?.id === enemy.id}
            onSelect={() => setSelectedEnemy(
              selectedEnemy?.id === enemy.id ? null : enemy
            )}
          />
        ))}
      </div>

      <button
        className={`battle-start-btn ${!canStart ? 'battle-start-btn--disabled' : ''}`}
        disabled={!canStart}
        onClick={handleStart}
      >
        {!deckComplete ? 'Deck unvollständig'
          : noEnergy ? 'Keine Energie — Trank nutzen oder morgen wiederkommen'
          : !selectedEnemy ? 'Gegner wählen'
          : `⚔ Kampf starten → ${selectedEnemy.name}`}
      </button>
    </div>
  );
};

// ── Gegner-Auswahl-Karte ──────────────────────────────────────

interface EnemySelectCardProps {
  enemy: EnemyData; selected: boolean; onSelect: () => void;
}
const EnemySelectCard: React.FC<EnemySelectCardProps> = ({ enemy, selected, onSelect }) => (
  <div
    className={`enemy-select-card ${selected ? 'enemy-select-card--selected' : ''}`}
    onClick={onSelect}
  >
    <div className="enemy-select-card__tier">Tier {enemy.tier}</div>
    <div className="enemy-select-card__info">
      <div className="enemy-select-card__name">{enemy.name}</div>
      <div className="enemy-select-card__title">{enemy.title}</div>
      <div className="enemy-select-card__element">{enemy.element}</div>
    </div>
    <div className="enemy-select-card__stats">
      <span>❤ {enemy.stats.hp.toLocaleString('de-DE')}</span>
      <span>🃏 {enemy.cards.length} Karten</span>
      <span>💎 {enemy.rewardCrystals}</span>
    </div>
  </div>
);

// ── Battle-Arena ──────────────────────────────────────────────

interface BattleArenaProps {
  state:  BattleState;
  battle: ReturnType<typeof useBattleStore>;
}

const BattleArena: React.FC<BattleArenaProps> = ({ state, battle }) => {
  const combo  = useComboStore();
  const [popups, setPopups]         = useState<DamagePopup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const popupId = React.useRef(0);

  const { player, enemy, round, phase, log, result, enemyData } = state;
  const canPlay   = phase === 'player_turn' && !result;
  const allPlayed = player.hand.every(c => c.played);

  // Auswahl zurücksetzen wenn Phase wechselt
  useEffect(() => {
    setSelectedId(null);
    if (phase !== 'player_turn') combo.reset();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Popup hinzufügen + auto-entfernen
  const addPopup = useCallback((popup: Omit<DamagePopup, 'id'>) => {
    const id = ++popupId.current;
    setPopups(prev => [...prev, { ...popup, id }]);
    setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 1400);
  }, []);

  // Karte auswählen (erster Klick) oder abwählen
  const handleSelectCard = useCallback((card: BattleCard) => {
    if (!canPlay || card.played || card.destroyed || card.mpCost > player.mp) return;
    setSelectedId(prev => prev === card.instanceId ? null : card.instanceId);
  }, [canPlay, player.mp]);

  // Karte spielen (zweiter Klick oder Wisch nach oben)
  const handlePlayCard = useCallback((card: BattleCard) => {
    if (!canPlay) return;

    const newCount = combo.isActive ? Math.min(5, combo.count + 1) : 1;

    const calc = ComboSystem.calculate(
      card.atk,
      newCount,
      combo.lastCard,
      card,
      enemyData.element,
    );

    combo.onCardPlayed(card, calc.windowExtension);
    battle.playCard(card.instanceId, calc.totalMultiplier);
    setSelectedId(null);

    addPopup({
      damage:     calc.finalDamage,
      combo:      newCount,
      multiplier: calc.totalMultiplier,
      hasSynergy: calc.hasSynergy,
      hasElement: calc.hasElementAdv,
      xPct:       20 + Math.random() * 60,
    });
  }, [canPlay, combo, enemyData.element, battle, addPopup]);

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
              isSelected={selectedId === card.instanceId}
              onSelect={() => handleSelectCard(card)}
              onPlay={() => handlePlayCard(card)}
            />
          ))}
        </div>

        {/* Hinweis wenn Karte ausgewählt */}
        {selectedId && canPlay && (
          <div className="arena-play-hint">
            ↑ Wisch nach oben oder nochmal tippen zum Ausspielen
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
  card:       BattleCard;
  canPlay:    boolean;
  playerMp:   number;
  isSelected: boolean;
  onSelect:   () => void;
  onPlay:     () => void;
}

const PlayerHandCard: React.FC<PlayerHandCardProps> = ({
  card, canPlay, playerMp, isSelected, onSelect, onPlay,
}) => {
  const [imgErr, setImgErr] = useState(false);
  const touchStartY = useRef<number | null>(null);

  const noMp    = card.mpCost > playerMp;
  const blocked = card.played || card.destroyed || !canPlay || noMp;
  const rc      = RARITY_COLOR[card.card?.rarity ?? 'N'] ?? '#8a6520';

  const handleClick = () => {
    if (blocked) return;
    if (isSelected) {
      onPlay(); // zweiter Klick = ausspielen
    } else {
      onSelect();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;

    if (isSelected && deltaY < -40) {
      // Wisch nach oben auf ausgewählter Karte → spielen
      onPlay();
    } else if (!blocked && Math.abs(deltaY) < 10) {
      // Kurzer Tap ohne Wisch → auswählen/abspielen
      handleClick();
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
        <div className="hand-card__select-hint">▲</div>
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


export default BattleScreen;
