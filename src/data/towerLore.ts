// Floor lore — shown as overlay before entering each tower floor.

export interface FloorLore {
  title:    string;
  subtitle: string;
  text:     string;
}

const BOSS_LORE: Record<number, FloorLore> = {
  10: {
    title:    'Etage 10',
    subtitle: 'Wächter des Eingangs',
    text:     'Hier endet die Anfängergrube. Wer weiter will, muss den Türsteher überleben — er prüft, ob du den Turm überhaupt verdient hast.',
  },
  20: {
    title:    'Etage 20',
    subtitle: 'Spiegel der Selbstzweifel',
    text:     'Diese Etage zeigt dir nichts Fremdes. Sie zeigt dir dich selbst — verzerrt, schneller, grausamer.',
  },
  30: {
    title:    'Etage 30',
    subtitle: 'Das ertrunkene Heiligtum',
    text:     'Wasser steigt seit hundert Jahren. Die Wächter atmen es längst.',
  },
  40: {
    title:    'Etage 40',
    subtitle: 'Brennende Bibliothek',
    text:     'Eine Stimme im Rauch flüstert deinen wahren Namen. Antworte nicht.',
  },
  50: {
    title:    'Etage 50',
    subtitle: 'Der Hof der Tausend Klingen',
    text:     'Die halbe Strecke ist die einsamste. Niemand klettert nur aus Neugier so weit.',
  },
  60: {
    title:    'Etage 60',
    subtitle: 'Sternenwall',
    text:     'Hier oben verlieren die Sterne ihre Ordnung. Was du als Mond siehst, ist nur ein Auge.',
  },
  70: {
    title:    'Etage 70',
    subtitle: 'Asche-Thron',
    text:     'Auf diesem Thron saß einst ein Kletterer wie du. Er ist nie mehr aufgestanden.',
  },
  80: {
    title:    'Etage 80',
    subtitle: 'Das Eis am Ende des Atems',
    text:     'Niemand spricht hier oben. Worte gefrieren bevor sie die Lippe verlassen.',
  },
  90: {
    title:    'Etage 90',
    subtitle: 'Tor zur Spitze',
    text:     'Nur neun Etagen bis zum Gipfel. Der Turm fängt jetzt erst an, dich ernst zu nehmen.',
  },
  100: {
    title:    'Etage 100',
    subtitle: 'Turmherr Azgaroth',
    text:     'Er hat nie geblinzelt. Nicht in dreitausend Jahren. Heute zwingst du ihn dazu — oder du wirst zu Staub.',
  },
};

const ELITE_TEMPLATES: FloorLore[] = [
  {
    title:    '',
    subtitle: 'Elite-Etage',
    text:     'Ein Wächter, der nicht zur normalen Wache gehört. Beobachtet dich schon eine Weile.',
  },
  {
    title:    '',
    subtitle: 'Elite-Etage',
    text:     'Die Luft hier ist kalt und still. Etwas Schweres hängt zwischen den Säulen.',
  },
  {
    title:    '',
    subtitle: 'Elite-Etage',
    text:     'Du hörst Schritte hinter dir, jedes Mal wenn du anhältst. Dreh dich nicht um — geh weiter.',
  },
];

const NORMAL_TEMPLATES: FloorLore[] = [
  {
    title:    '',
    subtitle: 'Normale Etage',
    text:     'Wachen, wie überall. Sie wissen, dass du kommst.',
  },
  {
    title:    '',
    subtitle: 'Normale Etage',
    text:     'Steingang. Fackeln. Schritte. Routine — falls man Routine im Turm haben kann.',
  },
  {
    title:    '',
    subtitle: 'Normale Etage',
    text:     'Eine kurze Etage. Mach es schnell.',
  },
];

export const TowerLore = {
  forFloor(floor: number, type: 'normal' | 'elite' | 'boss'): FloorLore {
    if (type === 'boss') {
      return BOSS_LORE[floor] ?? {
        title:    `Etage ${floor}`,
        subtitle: 'Boss-Etage',
        text:     'Ein Wächter, den niemand benennt. Er war schon immer hier.',
      };
    }
    const pool = type === 'elite' ? ELITE_TEMPLATES : NORMAL_TEMPLATES;
    const lore = pool[floor % pool.length];
    return { ...lore, title: `Etage ${floor}` };
  },
};
