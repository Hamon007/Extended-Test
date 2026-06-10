import React, { useState, useMemo } from 'react';
import { SaveService }   from '../services/SaveService';
import { CardDatabase }  from '../services/CardDatabase';
import { LevelSystem, CRYSTAL_CARD_XP, type CrystalCardSize } from '../services/LevelSystem';
import { FusionSystem }  from '../services/FusionSystem';
import type { CardInstance } from '../types/GachaTypes';
import type { Card, Rarity } from '../types/Card';
import { RARITY_COLOR, RARITY_MAJORS, RARITY_ORDER, rarityMajor } from '../types/Card';
import './CardTrainingScreen.css';

const MAX_SACRIFICE = 10;

// ── Haupt-Screen ──────────────────────────────────────────────

const CardTrainingScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [gState,         setGState]         = useState(() => SaveService.loadGachaState());
  const [targetUuid,     setTargetUuid]     = useState<string | null>(null);
  const [sacrificeUuids, setSacrificeUuids] = useState<string[]>([]);
  const [autoRarity,     setAutoRarity]     = useState<Rarity | ''>('');
  const [picker,         setPicker]         = useState<'target' | 'sacrifice' | null>(null);
  const [crystalQty,     setCrystalQty]     = useState<Record<CrystalCardSize, number>>({
    small: 0, medium: 0, large: 0,
  });
  const [toast,          setToast]          = useState<string | null>(null);
  const [levelUpAnim,    setLevelUpAnim]    = useState(false);

  const inventory = gState.inventory;

  const target     = useMemo(() => inventory.find(i => i.uuid === targetUuid) ?? null, [inventory, targetUuid]);
  const targetCard = target ? CardDatabase.getById(target.cardId) : null;
  const cap        = target ? LevelSystem.levelCap(target.rarity) : 1;
  const atMax      = target ? (target.level ?? 1) >= cap : false;

  // Lowest-level deck card that can still be trained
  const deckWeakest = useMemo(() => {
    const deck = SaveService.loadDeck();
    return deck.uuids
      .map(uuid => inventory.find(i => i.uuid === uuid))
      .filter((i): i is CardInstance => !!i)
      .filter(i => (i.level ?? 1) < LevelSystem.levelCap(i.rarity))
      .sort((a, b) => {
        const capA = LevelSystem.levelCap(a.rarity);
        const capB = LevelSystem.levelCap(b.rarity);
        return (a.level ?? 1) / capA - (b.level ?? 1) / capB;
      })[0] ?? null;
  }, [inventory]);

  const sacrificeInsts = useMemo(
    () => sacrificeUuids
      .map(u => inventory.find(i => i.uuid === u))
      .filter((x): x is CardInstance => !!x),
    [sacrificeUuids, inventory],
  );

  // Gesamter XP-Gewinn aus Opfern + Kristallkarten
  const totalXpGain = useMemo(() => {
    let xp = 0;
    for (const inst of sacrificeInsts) xp += LevelSystem.sacrificeXp(inst);
    xp += (crystalQty.small  ?? 0) * CRYSTAL_CARD_XP.small;
    xp += (crystalQty.medium ?? 0) * CRYSTAL_CARD_XP.medium;
    xp += (crystalQty.large  ?? 0) * CRYSTAL_CARD_XP.large;
    return xp;
  }, [sacrificeInsts, crystalQty]);

  const preview = useMemo(
    () => (!target || totalXpGain === 0) ? null : LevelSystem.applyXp(target, totalXpGain),
    [target, totalXpGain],
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function chooseTarget(uuid: string) {
    setTargetUuid(uuid);
    setSacrificeUuids(prev => prev.filter(u => u !== uuid));
    setPicker(null);
  }

  function toggleSacrifice(uuid: string) {
    setSacrificeUuids(prev => {
      if (prev.includes(uuid)) return prev.filter(u => u !== uuid);
      if (prev.length >= MAX_SACRIFICE) {
        showToast(`Maximal ${MAX_SACRIFICE} Opfer`);
        return prev;
      }
      return [...prev, uuid];
    });
  }

  function removeSlot(uuid: string) {
    setSacrificeUuids(prev => prev.filter(u => u !== uuid));
  }

  // Auto-Auswahl: füllt freie Felder mit Karten der gewählten Seltenheit
  function autoFill() {
    const slotsLeft = MAX_SACRIFICE - sacrificeUuids.length;
    if (slotsLeft <= 0) { showToast('Alle 10 Felder belegt'); return; }

    const have = new Set(sacrificeUuids);
    let cands = inventory.filter(i => i.uuid !== targetUuid && !have.has(i.uuid));
    if (autoRarity) cands = cands.filter(i => rarityMajor(i.rarity) === autoRarity);

    // Schwächste zuerst (niedrige Seltenheit, niedriges Level) als Futter
    cands.sort((a, b) => {
      const r = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
      return r !== 0 ? r : (a.level ?? 1) - (b.level ?? 1);
    });

    const add = cands.slice(0, slotsLeft).map(i => i.uuid);
    if (add.length === 0) {
      showToast(autoRarity ? `Keine ${autoRarity}-Karten frei` : 'Keine Karten frei');
      return;
    }
    setSacrificeUuids(prev => [...prev, ...add]);
  }

  function clearAll() {
    setSacrificeUuids([]);
    setCrystalQty({ small: 0, medium: 0, large: 0 });
  }

  const changeCrystal = (size: CrystalCardSize, delta: number) => {
    setCrystalQty(prev => {
      const available = gState.crystalCards[size];
      return { ...prev, [size]: Math.max(0, Math.min(available, (prev[size] ?? 0) + delta)) };
    });
  };

  function handleSacrifice() {
    if (!target || totalXpGain === 0) return;

    const prevLevel  = target.level ?? 1;
    const updated    = LevelSystem.applyXp(target, totalXpGain);
    const didLevelUp = updated.level > prevLevel;

    const removed = new Set(sacrificeUuids);
    const newInventory = inventory
      .filter(i => !removed.has(i.uuid))
      .map(i => i.uuid === target.uuid ? updated : i);

    const newCrystalCards = {
      small:  gState.crystalCards.small  - (crystalQty.small  ?? 0),
      medium: gState.crystalCards.medium - (crystalQty.medium ?? 0),
      large:  gState.crystalCards.large  - (crystalQty.large  ?? 0),
    };

    const newState = { ...gState, inventory: newInventory, crystalCards: newCrystalCards };
    SaveService.saveGachaState(newState);
    setGState(newState);

    setSacrificeUuids([]);
    setCrystalQty({ small: 0, medium: 0, large: 0 });

    if (didLevelUp) {
      setLevelUpAnim(true);
      setTimeout(() => setLevelUpAnim(false), 1200);
      showToast(`Level Up! ${prevLevel} → ${updated.level} ✦`);
    } else {
      showToast(`+${totalXpGain.toLocaleString('de-DE')} XP erhalten`);
    }
  }

  return (
    <div className="training-screen">
      {toast && <div className="training-toast">{toast}</div>}

      {/* Header */}
      <div className="training-header">
        <button className="training-back" onClick={onBack}>◀</button>
        <span className="training-header__title">OPFERN</span>
        <div style={{ width: 32 }} />
      </div>

      {/* Deck recommendation: weakest untrained deck card */}
      {deckWeakest && !targetUuid && (() => {
        const wCard = CardDatabase.getById(deckWeakest.cardId);
        const wCap  = LevelSystem.levelCap(deckWeakest.rarity);
        const wLv   = deckWeakest.level ?? 1;
        const wPct  = Math.round((wLv / wCap) * 100);
        return (
          <button
            className="training-deck-suggest"
            onClick={() => chooseTarget(deckWeakest.uuid)}
          >
            <span className="training-deck-suggest__icon">⚔</span>
            <div className="training-deck-suggest__body">
              <span className="training-deck-suggest__eyebrow">DECK-EMPFEHLUNG</span>
              <span className="training-deck-suggest__name">{wCard?.name ?? deckWeakest.cardId}</span>
              <div className="training-deck-suggest__bar-row">
                <div className="training-deck-suggest__bar">
                  <div className="training-deck-suggest__bar-fill" style={{ width: `${wPct}%` }} />
                </div>
                <span className="training-deck-suggest__level">Lv. {wLv} / {wCap}</span>
              </div>
            </div>
            <span className="training-deck-suggest__cta">TRAINIEREN →</span>
          </button>
        );
      })()}

      <div className="opfern-body">

        {/* ── Zielkarte ── */}
        <div className="opfern-section">
          <div className="training-target-label">ZIELKARTE</div>
          <div className={`opfern-target ${levelUpAnim ? 'opfern-target--levelup' : ''}`}>
            {target && targetCard ? (
              <>
                <div className="opfern-target__art" onClick={() => setPicker('target')}>
                  <CardArt card={targetCard} />
                </div>
                <div className="opfern-target__info">
                  <div className="training-td__name">{targetCard.name}</div>
                  <div className="training-td__rarity" style={{ color: RARITY_COLOR[target.rarity] ?? '#9e9e9e' }}>
                    {target.rarity}
                  </div>
                  <div className="training-td__level">
                    Lv. <strong>{target.level ?? 1}</strong>{atMax ? ' (MAX)' : ` / ${cap}`}
                  </div>
                  <XpBar inst={target} preview={preview} />
                  {/* XP hint: how many N/R cards needed for next level */}
                  {!atMax && (() => {
                    const curLv = target.level ?? 1;
                    const needed = LevelSystem.xpToNext(curLv) - (target.xp ?? 0);
                    const nCards = Math.ceil(needed / 300);
                    const rCards = Math.ceil(needed / 600);
                    return (
                      <div className="training-td__xp-hint">
                        <span className="training-td__xp-hint-val">+{needed.toLocaleString('de-DE')} XP</span>
                        <span className="training-td__xp-hint-eq">
                          ≈ {nCards}× N {rCards > 0 ? `· ${rCards}× R` : ''}
                        </span>
                      </div>
                    );
                  })()}
                  {preview && preview.level > (target.level ?? 1) && (
                    <div className="training-td__preview-level">→ Lv. {preview.level}</div>
                  )}
                  {preview && targetCard && (() => {
                    const before = FusionSystem.getEffectiveStats(targetCard, target.rarity, target.level ?? 1);
                    const after  = FusionSystem.getEffectiveStats(targetCard, target.rarity, preview.level ?? 1);
                    const dAtk = after.atk - before.atk;
                    const dHp  = after.hp  - before.hp;
                    if (dAtk === 0 && dHp === 0) return null;
                    return (
                      <div className="training-td__stat-deltas">
                        {dAtk !== 0 && (
                          <span className="training-stat-delta">
                            ⚔ {before.atk.toLocaleString('de-DE')}
                            <span className="training-stat-delta__arrow">→</span>
                            <span className="training-stat-delta__after">{after.atk.toLocaleString('de-DE')}</span>
                            <span className="training-stat-delta__gain">+{dAtk.toLocaleString('de-DE')}</span>
                          </span>
                        )}
                        {dHp !== 0 && (
                          <span className="training-stat-delta training-stat-delta--hp">
                            ♥ {before.hp.toLocaleString('de-DE')}
                            <span className="training-stat-delta__arrow">→</span>
                            <span className="training-stat-delta__after">{after.hp.toLocaleString('de-DE')}</span>
                            <span className="training-stat-delta__gain">+{dHp.toLocaleString('de-DE')}</span>
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  <button className="opfern-change-btn" onClick={() => setPicker('target')}>Karte ändern</button>
                </div>
              </>
            ) : (
              <button className="opfern-empty-target" onClick={() => setPicker('target')}>
                <span className="opfern-plus">+</span>
                <span>Zielkarte wählen</span>
              </button>
            )}
          </div>
        </div>

        {target && atMax && (
          <div className="training-max-banner">
            <div className="training-max-banner__star">★</div>
            <div className="training-max-banner__text">
              <div className="training-max-banner__title">MAX LEVEL ERREICHT</div>
              <div className="training-max-banner__sub">
                Lv. {cap} · {targetCard?.name} ist auf dem Gipfel seiner Macht!
              </div>
            </div>
            <div className="training-max-banner__star">★</div>
          </div>
        )}

        {target && !atMax && (
          <>
            {/* ── Auto-Auswahl nach Seltenheit ── */}
            <div className="opfern-section">
              <div className="training-target-label">OPFER · AUTO-AUSWAHL NACH SELTENHEIT</div>
              <div className="opfern-auto__chips">
                <button
                  className={`opfern-chip ${autoRarity === '' ? 'opfern-chip--active' : ''}`}
                  onClick={() => setAutoRarity('')}
                >Alle</button>
                {RARITY_MAJORS.map(r => (
                  <button
                    key={r}
                    className={`opfern-chip ${autoRarity === r ? 'opfern-chip--active' : ''}`}
                    style={autoRarity === r ? { color: RARITY_COLOR[r], borderColor: RARITY_COLOR[r] } : undefined}
                    onClick={() => setAutoRarity(r)}
                  >{r}</button>
                ))}
              </div>
              <div className="opfern-auto__btns">
                <button className="opfern-auto-btn" onClick={autoFill}>⚡ Auto-Füllen</button>
                <button
                  className="opfern-auto-btn opfern-auto-btn--clear"
                  onClick={clearAll}
                  disabled={sacrificeUuids.length === 0 && crystalQty.small + crystalQty.medium + crystalQty.large === 0}
                >Leeren</button>
              </div>
            </div>

            {/* ── 10 Opfer-Felder ── */}
            <div className="opfern-section">
              <div className="opfern-slots">
                {Array.from({ length: MAX_SACRIFICE }).map((_, i) => {
                  const inst = sacrificeInsts[i];
                  if (inst) {
                    const card = CardDatabase.getById(inst.cardId);
                    const rc   = RARITY_COLOR[inst.rarity] ?? '#9e9e9e';
                    return (
                      <button
                        key={inst.uuid}
                        className="opfern-slot opfern-slot--filled"
                        style={{ '--rc': rc } as React.CSSProperties}
                        onClick={() => removeSlot(inst.uuid)}
                        title="Entfernen"
                      >
                        <CardArt card={card} />
                        <span className="opfern-slot__lv">Lv.{inst.level ?? 1}</span>
                        <span className="opfern-slot__rm">✕</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={`empty-${i}`}
                      className="opfern-slot opfern-slot--empty"
                      onClick={() => setPicker('sacrifice')}
                    >
                      <span className="opfern-plus">+</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Kristallkarten (Zusatz-XP) ── */}
            <div className="opfern-section">
              <div className="training-target-label">KRISTALLKARTEN</div>
              <div className="training-crystal-panel">
                {(['small', 'medium', 'large'] as CrystalCardSize[]).map(size => (
                  <CrystalRow
                    key={size}
                    size={size}
                    available={gState.crystalCards[size]}
                    qty={crystalQty[size]}
                    onChange={delta => changeCrystal(size, delta)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Bestätigen ── */}
      {target && !atMax && (
        <div className="training-footer">
          <div className="training-footer__xp">
            {totalXpGain > 0
              ? `${sacrificeInsts.length}/${MAX_SACRIFICE} Opfer · +${totalXpGain.toLocaleString('de-DE')} XP`
              : 'Opfer wählen'}
          </div>
          <button
            className={`training-confirm-btn ${totalXpGain === 0 ? 'training-confirm-btn--disabled' : ''}`}
            disabled={totalXpGain === 0}
            onClick={handleSacrifice}
          >
            🗡 Opfern
          </button>
        </div>
      )}

      {/* ── Karten-Auswahl-Overlay ── */}
      {picker && (
        <PickerOverlay
          mode={picker}
          inventory={inventory}
          targetUuid={targetUuid}
          sacrificeUuids={sacrificeUuids}
          onChooseTarget={chooseTarget}
          onToggleSacrifice={toggleSacrifice}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
};

// ── Karten-Artwork (mit Fallback) ─────────────────────────────

const CardArt: React.FC<{ card: Card | undefined | null }> = ({ card }) => {
  const [err, setErr] = useState(false);
  if (!card || err) return <span className="opfern-art-ph">🌑</span>;
  return <img src={card.image} alt={card.name} onError={() => setErr(true)} />;
};

// ── XP-Balken ─────────────────────────────────────────────────

const XpBar: React.FC<{ inst: CardInstance; preview: CardInstance | null }> = ({ inst, preview }) => {
  const level  = inst.level ?? 1;
  const cap    = LevelSystem.levelCap(inst.rarity);
  const needed = LevelSystem.xpToNext(level);
  const curXp  = inst.xp ?? 0;

  if (level >= cap) {
    return <div className="xp-bar"><div className="xp-bar__fill xp-bar__fill--max" style={{ width: '100%' }} /></div>;
  }

  const curPct = Math.min(100, (curXp / needed) * 100);
  const prvPct = preview
    ? Math.min(100, ((preview.xp ?? 0) / LevelSystem.xpToNext(Math.min(cap - 1, preview.level ?? 1))) * 100)
    : curPct;

  return (
    <div className="xp-bar" title={`${curXp} / ${needed} XP`}>
      <div className="xp-bar__fill" style={{ width: `${curPct}%` }} />
      {preview && preview.level === level && prvPct > curPct && (
        <div className="xp-bar__preview" style={{ width: `${prvPct}%` }} />
      )}
      <span className="xp-bar__label">{curXp} / {needed} XP</span>
    </div>
  );
};

// ── Kristallkarten-Zeile ──────────────────────────────────────

const CRYSTAL_LABELS: Record<CrystalCardSize, { name: string; icon: string }> = {
  small:  { name: 'Klein',  icon: '💠' },
  medium: { name: 'Mittel', icon: '🔷' },
  large:  { name: 'Groß',   icon: '💎' },
};

const CrystalRow: React.FC<{
  size: CrystalCardSize;
  available: number;
  qty: number;
  onChange: (delta: number) => void;
}> = ({ size, available, qty, onChange }) => {
  const { name, icon } = CRYSTAL_LABELS[size];
  const xpEach = CRYSTAL_CARD_XP[size];

  return (
    <div className={`crystal-row ${available === 0 ? 'crystal-row--empty' : ''}`}>
      <span className="crystal-row__icon">{icon}</span>
      <div className="crystal-row__info">
        <span className="crystal-row__name">{name} Kristallkarte</span>
        <span className="crystal-row__xp">+{xpEach.toLocaleString('de-DE')} XP</span>
      </div>
      <div className="crystal-row__controls">
        <button className="crystal-btn" disabled={qty === 0} onClick={() => onChange(-1)}>−</button>
        <span className="crystal-row__qty">{qty} / {available}</span>
        <button className="crystal-btn" disabled={qty >= available} onClick={() => onChange(1)}>+</button>
      </div>
    </div>
  );
};

// ── Auswahl-Overlay ───────────────────────────────────────────

const PickerOverlay: React.FC<{
  mode: 'target' | 'sacrifice';
  inventory: CardInstance[];
  targetUuid: string | null;
  sacrificeUuids: string[];
  onChooseTarget: (uuid: string) => void;
  onToggleSacrifice: (uuid: string) => void;
  onClose: () => void;
}> = ({ mode, inventory, targetUuid, sacrificeUuids, onChooseTarget, onToggleSacrifice, onClose }) => {
  const [rarityFilter, setRarityFilter] = useState<Rarity | ''>('');

  const filteredList = useMemo(() => {
    let list = mode === 'target'
      ? inventory
      : inventory.filter(i => i.uuid !== targetUuid);
    if (rarityFilter) list = list.filter(i => rarityMajor(i.rarity) === rarityFilter);
    return list;
  }, [mode, inventory, targetUuid, rarityFilter]);

  return (
    <div className="opfern-picker" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="opfern-picker__sheet">
        <div className="opfern-picker__head">
          <span>{mode === 'target' ? 'Zielkarte wählen' : `Opfer wählen (${sacrificeUuids.length}/${MAX_SACRIFICE})`}</span>
          <button className="opfern-picker__close" onClick={onClose} aria-label="Schließen">✕</button>
        </div>

        <div className="opfern-picker__filter">
          <button
            className={`opfern-filter__chip ${rarityFilter === '' ? 'opfern-filter__chip--active' : ''}`}
            onClick={() => setRarityFilter('')}
          >Alle</button>
          {RARITY_MAJORS.map(r => (
            <button
              key={r}
              className={`opfern-filter__chip ${rarityFilter === r ? 'opfern-filter__chip--active' : ''}`}
              style={rarityFilter === r ? { color: RARITY_COLOR[r], borderColor: RARITY_COLOR[r] } : undefined}
              onClick={() => setRarityFilter(r)}
            >{r}</button>
          ))}
        </div>

        <div className="opfern-picker__grid">
          {filteredList.length === 0 ? (
            <div className="training-empty">Keine Karten verfügbar.</div>
          ) : (
            filteredList.map(inst => {
              const card     = CardDatabase.getById(inst.cardId);
              const rc       = RARITY_COLOR[inst.rarity] ?? '#9e9e9e';
              const selected = mode === 'sacrifice' && sacrificeUuids.includes(inst.uuid);
              return (
                <div
                  key={inst.uuid}
                  className={`opfern-pick ${selected ? 'opfern-pick--selected' : ''}`}
                  style={{ '--rc': rc } as React.CSSProperties}
                  onClick={() => mode === 'target' ? onChooseTarget(inst.uuid) : onToggleSacrifice(inst.uuid)}
                >
                  <div className="opfern-pick__img-wrap">
                    {card ? (
                      <img
                        src={card.image}
                        alt={card.name}
                        className="opfern-pick__img"
                        loading="lazy"
                      />
                    ) : (
                      <div className="opfern-pick__fallback">🌑</div>
                    )}
                    <div className="opfern-pick__rarity" style={{ color: rc }}>{inst.rarity}</div>
                    {selected && <div className="opfern-pick__check">✓</div>}
                  </div>
                  <div className="opfern-pick__info">
                    <div className="opfern-pick__name">{card?.name ?? inst.cardId}</div>
                    <div className="opfern-pick__sub">
                      {mode === 'sacrifice'
                        ? `Lv.${inst.level ?? 1} · +${LevelSystem.sacrificeXp(inst)} XP`
                        : `Lv.${inst.level ?? 1}`}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {mode === 'sacrifice' && (
          <button className="opfern-picker__done" onClick={onClose}>Fertig</button>
        )}
      </div>
    </div>
  );
};

export default CardTrainingScreen;
