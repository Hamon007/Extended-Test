/**
 * useComboStore.ts
 * ─────────────────────────────────────────────────────────────
 * Verwaltet den Combo-Timer und -State.
 * Refs verhindern Stale-Closure-Bugs bei schnellen Taps.
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { BattleCard } from '../types/BattleTypes';
import type { ComboState } from '../types/ComboTypes';
import { COMBO_WINDOW_MS, MAX_COMBO } from '../types/ComboTypes';

const TICK_MS      = 50;    // Timer-Auflösung in ms
const BREAK_DUR_MS = 700;   // Dauer der Break-Animation

export interface ComboStore extends ComboState {
  /** Aufruf direkt vor battle.playCard(). windowExtension in ms. */
  onCardPlayed: (card: BattleCard, windowExtension?: number) => void;
  /** Sofort zurücksetzen (z.B. bei Phasenwechsel). */
  reset:        () => void;
}

export function useComboStore(): ComboStore {

  // ── State (für Re-Render) ─────────────────────────────────
  const [count,      setCount]      = useState(0);
  const [timeLeft,   setTimeLeft]   = useState(0);
  const [maxTime,    setMaxTime]    = useState(COMBO_WINDOW_MS);
  const [isActive,   setIsActive]   = useState(false);
  const [isBreaking, setIsBreaking] = useState(false);
  const [lastCard,   setLastCard]   = useState<BattleCard | null>(null);

  // ── Refs (vermeiden Stale Closures in Timern) ─────────────
  const countRef    = useRef(0);
  const isActiveRef = useRef(false);
  const tickRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Aufräumen ─────────────────────────────────────────────

  const clearTimers = useCallback(() => {
    if (tickRef.current)  { clearInterval(tickRef.current);  tickRef.current  = null; }
    if (breakRef.current) { clearTimeout(breakRef.current);  breakRef.current = null; }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // ── Combo-Break ───────────────────────────────────────────

  const triggerBreak = useCallback(() => {
    clearTimers();
    countRef.current    = 0;
    isActiveRef.current = false;
    setCount(0);
    setTimeLeft(0);
    setIsActive(false);
    setIsBreaking(true);
    setLastCard(null);
    breakRef.current = setTimeout(() => setIsBreaking(false), BREAK_DUR_MS);
  }, [clearTimers]);

  // ── Timer starten / neu starten ───────────────────────────

  const startTimer = useCallback((windowMs: number) => {
    clearTimers();
    const endTime = Date.now() + windowMs;
    setTimeLeft(windowMs);
    setMaxTime(windowMs);
    isActiveRef.current = true;
    setIsActive(true);
    setIsBreaking(false);

    tickRef.current = setInterval(() => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        triggerBreak();
      } else {
        setTimeLeft(remaining);
      }
    }, TICK_MS);
  }, [clearTimers, triggerBreak]);

  // ── Öffentliche API ───────────────────────────────────────

  const onCardPlayed = useCallback((
    card:            BattleCard,
    windowExtension: number = 0,
  ) => {
    // Neue Combo-Stufe berechnen (Ref lesen = immer aktuell)
    const newCount = isActiveRef.current
      ? Math.min(MAX_COMBO, countRef.current + 1)
      : 1;

    countRef.current = newCount;
    setCount(newCount);
    setLastCard(card);
    startTimer(COMBO_WINDOW_MS + windowExtension);
  }, [startTimer]);

  const reset = useCallback(() => {
    clearTimers();
    countRef.current    = 0;
    isActiveRef.current = false;
    setCount(0);
    setTimeLeft(0);
    setMaxTime(COMBO_WINDOW_MS);
    setIsActive(false);
    setIsBreaking(false);
    setLastCard(null);
  }, [clearTimers]);

  return {
    count,
    timeLeft,
    maxTime,
    isActive,
    isBreaking,
    isMaxCombo: count >= MAX_COMBO,
    lastCard,
    onCardPlayed,
    reset,
  };
}
