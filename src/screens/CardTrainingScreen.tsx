import React, { useState, useMemo, useCallback } from 'react';
import { SaveService }   from '../services/SaveService';
import { CardDatabase }  from '../services/CardDatabase';
import { LevelSystem, CRYSTAL_CARD_XP, type CrystalCardSize } from '../services/LevelSystem';
import type { CardInstance } from '../types/GachaTypes';
import { RARITY_COLOR }  from '../types/Card';
import './CardTrainingScreen.css';

// ── Tabs ──────────────────────────────────────────────────────
type Tab = 'sacrifice' | 'crystal';

// ── Haupt-Screen ──────────────────────────────────────────────

const CardTrainingScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [gState,      setGState]      = useState(() => SaveService.loadGachaState());
  const [targetUuid,  setTargetUuid]  = useState<string | null>(null);
  const [sacrificeIds, setSacrificeIds] = useState<Set<string>>(new Set());
  const [crystalQty,  setCrystalQty]  = useState<Record<CrystalCardSize, number>>({
    small: 0, medium: 0, large: 0,
  });
  const [tab,         setTab]         = useState<Tab>('sacrifice');
  const [toast,       setToast]       = useState<string | null>(null);
  const [levelUpAnim, setLevelUpAnim] = useState(false);

  const inventory = gState.inventory;

  const target = useMemo(
    () => inventory.find(i => i.uuid === targetUuid) ?? null,
    [inventory, targetUuid],
  );

  const targetCard = target ? CardDatabase.getById(target.cardId) : null;
  const cap        = target ? LevelSystem.levelCap(target.rarity) : 1;
  const atMax      = target ? (target.level ?? 1) >= cap : false;

  // Gesamter XP-Gewinn aus gewählten Materialien
  const totalXpGain = useMemo(() => {
    let xp = 0;
    for (const uuid of sacrificeIds) {
      const inst = inventory.find(i => i.uuid === uuid);
      if (inst) xp += LevelSystem.sacrificeXp(inst);
    }
    xp += (crystalQty.small  ?? 0) * CRYSTAL_CARD_XP.small;
    xp += (crystalQty.medium ?? 0) * CRYSTAL_CARD_XP.medium;
    xp += (crystalQty.large  ?? 0) * CRYSTAL_CARD_XP.large;
    return xp;
  }, [sacrificeIds, crystalQty, inventory]);

  // Ziel-Level-Vorschau
  const preview = useMemo(() => {
    if (!target || totalXpGain === 0) return null;
    return LevelSystem.applyXp(target, totalXpGain);
  }, [target, totalXpGain]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const toggleSacrifice = useCallback((uuid: string) => {
    setSacrificeIds(prev => {
      const next = new Set(prev);
      next.has(uuid) ? next.delete(uuid) : next.add(uuid);
      return next;
    });
  }, []);

  const changeCrystal = (size: CrystalCardSize, delta: number) => {
    setCrystalQty(prev => {
      const available = gState.crystalCards[size];
      const next      = Math.max(0, Math.min(available, (prev[size] ?? 0) + delta));
      return { ...prev, [size]: next };
    });
  };

  const handleTrain = () => {
    if (!target || totalXpGain === 0) return;

    const prevLevel = target.level ?? 1;
    const updated   = LevelSystem.applyXp(target, totalXpGain);
    const didLevelUp = updated.level > prevLevel;

    // Inventar: Ziel updaten, geopferte entfernen
    const removedUuids = new Set(sacrificeIds);
    const newInventory = inventory
      .filter(i => !removedUuids.has(i.uuid))
      .map(i => i.uuid === target.uuid ? updated : i);

    // Kristallkarten abziehen
    const newCrystalCards = {
      small:  gState.crystalCards.small  - (crystalQty.small  ?? 0),
      medium: gState.crystalCards.medium - (crystalQty.medium ?? 0),
      large:  gState.crystalCards.large  - (crystalQty.large  ?? 0),
    };

    const newState = { ...gState, inventory: newInventory, crystalCards: newCrystalCards };
    SaveService.saveGachaState(newState);
    setGState(newState);

    // Reset
    setSacrificeIds(new Set());
    setCrystalQty({ small: 0, medium: 0, large: 0 });

    if (didLevelUp) {
      setLevelUpAnim(true);
      setTimeout(() => setLevelUpAnim(false), 1200);
      showToast(`Level Up! ${prevLevel} → ${updated.level} ✦`);
    } else {
      showToast(`+${totalXpGain.toLocaleString('de-DE')} XP erhalten`);
    }
  };

  // Karten die als Material wählbar sind (nicht das Ziel)
  const materialCards = useMemo(
    () => inventory.filter(i => i.uuid !== targetUuid),
    [inventory, targetUuid],
  );

  return (
    <div className="training-screen">
      {toast && <div className="training-toast">{toast}</div>}

      {/* Header */}
      <div className="training-header">
        <button className="training-back" onClick={onBack}>◀</button>
        <span className="training-header__title">TRAINING</span>
        <div style={{ width: 32 }} />
      </div>

      {/* ── Zielkarte ── */}
      <div className="training-target-section">
        <div className="training-target-label">ZIELKARTE</div>
        {inventory.length === 0 ? (
          <div className="training-empty">Noch keine Karten im Inventar.</div>
        ) : (
          <div className="training-target-scroll">
            {inventory.map(inst => (
              <TargetCardThumb
                key={inst.uuid}
                inst={inst}
                selected={inst.uuid === targetUuid}
                onSelect={() => {
                  setTargetUuid(inst.uuid);
                  setSacrificeIds(new Set());
                }}
              />
            ))}
          </div>
        )}

        {/* Zielkarte Detail */}
        {target && targetCard && (
          <div className={`training-target-detail ${levelUpAnim ? 'training-target-detail--levelup' : ''}`}>
            <div className="training-target-detail__left">
              <TargetCardArt inst={target} />
            </div>
            <div className="training-target-detail__right">
              <div className="training-td__name">{targetCard.name}</div>
              <div className="training-td__rarity" style={{ color: RARITY_COLOR[target.rarity] ?? '#9e9e9e' }}>
                {target.rarity}
              </div>
              <div className="training-td__level">
                Lv. <strong>{target.level ?? 1}</strong>
                {atMax ? ' (MAX)' : ` / ${cap}`}
              </div>
              <XpBar inst={target} preview={preview} />
              {preview && preview.level > (target.level ?? 1) && (
                <div className="training-td__preview-level">
                  → Lv. {preview.level}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Material-Tabs ── */}
      {target && !atMax && (
        <>
          <div className="training-tabs">
            <button
              className={`training-tab ${tab === 'sacrifice' ? 'training-tab--active' : ''}`}
              onClick={() => setTab('sacrifice')}
            >
              🗡 Opfern
            </button>
            <button
              className={`training-tab ${tab === 'crystal' ? 'training-tab--active' : ''}`}
              onClick={() => setTab('crystal')}
            >
              💠 Kristallkarten
            </button>
          </div>

          <div className="training-material-area">
            {tab === 'sacrifice' && (
              <div className="training-sacrifice-grid">
                {materialCards.length === 0 ? (
                  <div className="training-empty">Keine weiteren Karten zum Opfern.</div>
                ) : (
                  materialCards.map(inst => (
                    <SacrificeCard
                      key={inst.uuid}
                      inst={inst}
                      selected={sacrificeIds.has(inst.uuid)}
                      onToggle={() => toggleSacrifice(inst.uuid)}
                    />
                  ))
                )}
              </div>
            )}

            {tab === 'crystal' && (
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
            )}
          </div>
        </>
      )}

      {target && atMax && (
        <div className="training-max-msg">✦ Diese Karte hat das maximale Level ({cap}) erreicht.</div>
      )}

      {/* ── Bestätigen ── */}
      {target && !atMax && (
        <div className="training-footer">
          <div className="training-footer__xp">
            {totalXpGain > 0
              ? `+${totalXpGain.toLocaleString('de-DE')} XP gewählt`
              : 'Material wählen'}
          </div>
          <button
            className={`training-confirm-btn ${totalXpGain === 0 ? 'training-confirm-btn--disabled' : ''}`}
            disabled={totalXpGain === 0}
            onClick={handleTrain}
          >
            ⬆ Training starten
          </button>
        </div>
      )}
    </div>
  );
};

// ── Ziel-Karte Thumbnail ──────────────────────────────────────

const TargetCardThumb: React.FC<{
  inst: CardInstance; selected: boolean; onSelect: () => void;
}> = ({ inst, selected, onSelect }) => {
  const card = CardDatabase.getById(inst.cardId);
  const rc   = RARITY_COLOR[inst.rarity] ?? '#9e9e9e';
  const [err, setErr] = useState(false);

  return (
    <div
      className={`target-thumb ${selected ? 'target-thumb--selected' : ''}`}
      style={{ '--rc': rc } as React.CSSProperties}
      onClick={onSelect}
    >
      <div className="target-thumb__art">
        {card && !err
          ? <img src={card.image} alt={card.name} onError={() => setErr(true)} />
          : <span>🌑</span>}
      </div>
      <div className="target-thumb__level">Lv.{inst.level ?? 1}</div>
    </div>
  );
};

// ── Ziel-Karte Artwork ────────────────────────────────────────

const TargetCardArt: React.FC<{ inst: CardInstance }> = ({ inst }) => {
  const card = CardDatabase.getById(inst.cardId);
  const rc   = RARITY_COLOR[inst.rarity] ?? '#9e9e9e';
  const [err, setErr] = useState(false);

  return (
    <div className="target-art" style={{ '--rc': rc } as React.CSSProperties}>
      {card && !err
        ? <img src={card.image} alt={card.name} onError={() => setErr(true)} />
        : <span className="target-art__placeholder">🌑</span>}
    </div>
  );
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

// ── Opfer-Karte ───────────────────────────────────────────────

const SacrificeCard: React.FC<{
  inst: CardInstance; selected: boolean; onToggle: () => void;
}> = ({ inst, selected, onToggle }) => {
  const card = CardDatabase.getById(inst.cardId);
  const rc   = RARITY_COLOR[inst.rarity] ?? '#9e9e9e';
  const xp   = LevelSystem.sacrificeXp(inst);
  const [err, setErr] = useState(false);

  return (
    <div
      className={`sacrifice-card ${selected ? 'sacrifice-card--selected' : ''}`}
      style={{ '--rc': rc } as React.CSSProperties}
      onClick={onToggle}
    >
      <div className="sacrifice-card__art">
        {card && !err
          ? <img src={card.image} alt={card.name} onError={() => setErr(true)} />
          : <span>🌑</span>}
        {selected && <div className="sacrifice-card__check">✓</div>}
      </div>
      <div className="sacrifice-card__footer">
        <span className="sacrifice-card__name">{card?.name ?? inst.cardId}</span>
        <span className="sacrifice-card__xp">+{xp} XP</span>
      </div>
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

export default CardTrainingScreen;
