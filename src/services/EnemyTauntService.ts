/**
 * EnemyTauntService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Provides battle taunts for enemies based on tier and element.
 * Taunts fire at battle start, when enemy is low HP, and on
 * player defeat. Adds narrative life to the combat loop.
 * ─────────────────────────────────────────────────────────────
 */

export type TauntTrigger = 'battle_start' | 'low_hp' | 'enemy_victory' | 'player_victory';

const GENERIC_TAUNTS: Record<TauntTrigger, string[]> = {
  battle_start: [
    'Du wagst es, mir entgegenzutreten?',
    'Ein weiterer Sterblicher, der seinen Untergang sucht.',
    'Deine Kräfte sind nichts gegen meine!',
    'Ich habe stärkere Krieger vernichtet als dich.',
    'Der Turm hat viele Träumer verschluckt. Du wirst der Nächste sein.',
  ],
  low_hp: [
    'Unmöglich! Dein Können übersteigt meinen Erwartungen…',
    'Gib mir deine beste Attacke! Das hier hat erst begonnen.',
    'Du hast mich verletzt? Dann kämpfe ich mit echter Stärke!',
    'Jetzt… nehme ich alles zurück, was ich sagte.',
    'So viel Kraft…! Aber es reicht noch nicht!',
  ],
  enemy_victory: [
    'Wie erwartet. Du warst nicht bereit.',
    'Kehre zurück und wachse. Dann komm wieder.',
    'Der Turm zeigt keine Gnade für Schwäche.',
    'Ein ehrenhafter Kampf. Du wirst stärker zurückkehren.',
    'Niederlagen sind das Fundament der Stärke.',
  ],
  player_victory: [
    'Unglaublich… Du hast mich wirklich besiegt.',
    'Ich… habe unterschätzt, wie weit du kommen würdest.',
    'Die Höheren werden von dir erfahren. Sei bereit.',
    'Du steigst auf. Aber der wahre Test liegt noch vor dir.',
    'Genieße deinen Sieg, Krieger. Du hast ihn verdient.',
  ],
};

const BOSS_TAUNTS: Record<TauntTrigger, string[]> = {
  battle_start: [
    'ENDLICH! Ein würdiger Herausforderer betritt meine Etage!',
    'Ich bin der Wächter dieses Stockwerks. Niemand ist je passiert.',
    'Sterblicher… du trägst die Last des gesamten Turms auf deinen Schultern.',
    'Diese Etage ist mein Reich. Zeige mir, warum du hier stehst!',
    'Die letzten tausend Kämpfer haben hier geendet. Du wirst nicht anders sein.',
  ],
  low_hp: [
    'NEIN! Wie kannst du so viel Macht besitzen?!',
    'Ich… ich spüre es. Meine Kräfte verlassen mich!',
    'Das ist nicht möglich! NIEMAND kann mich so weit bringen!',
    'Du… du bist tatsächlich anders als die anderen.',
    '...Ich muss alles geben. ALLES!',
  ],
  enemy_victory: [
    'Du warst stark. Aber der Turm hat strengere Richter als mich.',
    'Kehre zurück, wenn du das Unmögliche möglich machen kannst.',
    'Ein Boss-Etage zeigt keine Gnade. Das ist das Gesetz des Turms.',
    'Ich akzeptiere deinen Kampfgeist. Komm stärker zurück.',
    'Heute gehörte der Sieg mir. Morgen… das ist eine andere Geschichte.',
  ],
  player_victory: [
    'UNGLAUBLICH! Du hast einen Boss des Turms besiegt!',
    'Du… du bist der Erste seit Jahren, der mich besiegt hat.',
    'Der Turm selbst zittert vor deiner Stärke. Pass auf — was oben wartet, ist schlimmer.',
    'Ich verbeuge mich vor deinem Talent. Gehe. Der nächste Wächter erwartet dich.',
    'Ich werde dich nicht vergessen, Krieger. Steige auf. Beweise dem Turm, wer du bist.',
  ],
};

const ELITE_TAUNTS: Record<TauntTrigger, string[]> = {
  battle_start: [
    'Ich bin kein gewöhnlicher Gegner. Bereite dich vor.',
    'Elite-Wächter stehen hier aus gutem Grund.',
    'Du weißt nicht, was du herausforderst.',
    'Viele Talentierte sind an mir gescheitert.',
    'Diese Etage gehört den Elites. Und Elite duldet keine Schwäche.',
  ],
  low_hp: [
    'Du überraschst mich wirklich…',
    'Ich werde nicht nachlassen!',
    'Halt ein! Das war erst der Anfang meiner Macht!',
    'So… du bist des Titels würdig.',
    'Dann lass uns sehen, wer am Ende steht!',
  ],
  enemy_victory: [
    'Elite bedeutet Exzellenz. Du hast heute gefehlt.',
    'Übe hart. Das nächste Mal mag es anders ausgehen.',
    'Nicht jeder ist bereit für diese Etage.',
    'Stärke kommt durch Niederlage. Komm zurück.',
    'Du kämpftest gut. Das reichte nicht.',
  ],
  player_victory: [
    'Du hast meine Stärke übertroffen. Respekt.',
    'Ein Elite-Kämpfer besiegt — beeindruckend.',
    'Der Turm anerkennt deine Würde. Geh weiter.',
    'Wenige erreichen dieses Niveau. Du gehörst dazu.',
    'Ich bin überwältigt. Zeige dem nächsten Wächter dasselbe.',
  ],
};

function pickTaunt(taunts: string[], seed: number): string {
  return taunts[seed % taunts.length];
}

export const EnemyTauntService = {
  getTaunt(trigger: TauntTrigger, tier: 'boss' | 'elite' | 'normal'): string {
    const pool = tier === 'boss' ? BOSS_TAUNTS
      : tier === 'elite' ? ELITE_TAUNTS
      : GENERIC_TAUNTS;
    const lines = pool[trigger];
    return pickTaunt(lines, Math.floor(Math.random() * lines.length));
  },
};
