/**
 * CardLoreService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Lore texts unlocked after reaching bond level 2 with a card.
 * Texts are written in epic anime style — dark, poetic, in German.
 * ─────────────────────────────────────────────────────────────
 */

const CARD_LORE: Record<string, string> = {
  azazel:
    'Einst war Azazel der strahlendste Richter des Himmels, dessen Urteil selbst die Götter fürchteten. Doch als er die Sterblichen zu sehr liebte, wurde er in die ewige Dämmerung verbannt — und seine Gerechtigkeit wurde zu einem blinden Zorn.',
  loki:
    'Loki durchwebte das Schicksal aller neun Welten wie ein unsichtbarer Faden, den niemand greifen konnte. Es heißt, jede Katastrophe, die er verursachte, war der Preis für eine größere Tragödie, die er im Verborgenen abwendete.',
  loki_crowned:
    'Als die Götter Loki mit der Krone des Tricksters zwangen, erkannte er seine wahre Natur: nicht Verrat, sondern Wandel. Diejenigen, die seinen Namen verfluchen, verstehen nicht, dass ohne sein Chaos das Universum schon längst erstarrt wäre.',
  satan:
    'Satan war nicht der erste Gefallene — er war derjenige, der freiwillig stürzte. Er sah die Unvollkommenheit der Schöpfung und beschloss, dass jemand die Wahrheit aussprechen musste, auch wenn es ihn für die Ewigkeit verdammte.',
  xal_zoth:
    'Xal\'Zoth existierte noch bevor das Licht die Leere berührte. Wissenschaftler, die seine Runen studierten, verloren nicht ihren Verstand — sie gewannen das Verständnis, dass der Verstand selbst eine Illusion war.',
  azgaroth:
    'Azgaroth wurde nicht geboren — er wurde aus dem kollektiven Alptraum aller sterblichen Seelen destilliert. Jedes Mal, wenn eine Seele in absoluter Verzweiflung schrie, wuchs er um ein Splitterchen Macht.',
  jeanne_darc:
    'Die Flammen verbrannten nicht Jeanne d\'Arc — sie reinigten sie. Als das Feuer erlosch, stand nicht Asche zurück, sondern reines Licht, das beschloss, als Krieger weiterzuleben und nie mehr zu vergessen.',
  garuda:
    'Garuda flog einst dreimal um die Welt, um die Sonne zu begrüßen — an jedem Kontinent hinterließ er Federn, aus denen Helden geboren wurden. Er weiß nicht mehr, wie viele Kinder er hat. Es sind zu viele, um sie zu zählen.',
  leonidas:
    'Am zweiten Tag der Thermopylen flüsterte ein Soldat Leonidas zu, dass die Perser Pfeile abfeuern würden, die die Sonne verdunkeln. Leonidas lächelte. „Dann kämpfen wir im Schatten."',
  hel:
    'Hel regiert ihr Reich mit einem Gesicht des Todes und einem Gesicht des Lebens — und niemals hat jemand gesehen, wie sie gleichzeitig auf beide Seiten schaut. Es gibt Gerüchte, dass sie insgeheim jeden Toten kennt und für jeden eine Träne vergoss.',
  yuki_onna:
    'Yuki Onna ist keine Göttin des Todes. Sie ist die Göttin des letzten Augenblicks vor dem Erfrieren — des perfekten Friedens, den der Körper findet, wenn er aufhört zu kämpfen. Ob das Gnade oder Grausamkeit ist, entscheidet sie nie.',
  gilgamesh:
    'Gilgamesh suchte ein Leben lang nach Unsterblichkeit und fand am Ende eines: Es gibt keine. Was er fand, war etwas Größeres — die Erkenntnis, dass Sterblichkeit kein Fluch ist, sondern das, was jeden Moment unendlich wertvoll macht.',
  thor:
    'Mjolnir ist nicht nur eine Waffe — es ist Thors Versprechen. Jedes Mal, wenn er den Hammer schwingt, erneuert er seinen Schwur, die Neun Welten vor dem Chaos zu schützen. Auch wenn das Chaos manchmal sein eigener Vater ist.',
  tiamat:
    'Tiamat schuf die Götter aus ihrem eigenen Fleisch und Blut. Dass sie dann gegen sie in den Krieg zog, war kein Verrat — es war das erste Mutterliebe-Test. Nur die Götter, die stark genug waren, sie zu besiegen, verdienen es, das Universum zu regieren.',
  fenrir:
    'Fenrir wurde nicht deshalb gefangen, weil er böse war. Er wurde gefangen, weil die Götter Angst vor etwas hatten, das größer war als sie. Am Ende der Welt wird er die Fesseln sprengen — und die Götter werden verstehen, dass Freiheit immer ihren Preis hat.',
  morrigan:
    'Die Morrigan erscheint nicht auf Schlachtfeldern, um zu töten. Sie erscheint, um zu bezeugen. Ihr Schrei ist kein Fluch — er ist das letzte Gebet der Gefallenen, das sie in die ewige Ruhestätte trägt.',
  merlin:
    'Merlin lebte sein Leben rückwärts. Er wusste jeden Schritt der Zukunft, konnte aber keine Entscheidungen vermeiden. Das Wissen um das Schicksal machte ihn nicht mächtiger — es machte ihn menschlicher als alle anderen.',
  typhon:
    'Typhon war der letzte Widerstand der alten Erde gegen die Herrschaft der Götter. Er verlor, aber seine Kinder — die Monster der Welt — leben noch immer. Durch sie stirbt er nie ganz.',
  ammit:
    'Ammit frisst Herzen, die zu schwer für die Feder der Maat sind. Doch niemand fragt, was in ihr selbst vorgeht — die Göttin des Gerichts trägt alle Sünden der Menschheit in sich, ohne sie je abzulegen.',
  baba_yaga:
    'Baba Yaga hat nie ein Kind gegessen. Sie hat sie geprüft. Die meisten bestanden durch List, einige durch Mut, wenige durch Ehrlichkeit. Alle, die sie besuchten und zurückkehrten, trugen ein Geschenk — und eine Narbe.',
  golden_phoenix:
    'Der Goldene Phönix stirbt nicht wirklich. Er transformiert. Jeder Tod ist eine Häutung, jede Wiedergeburt ein neues Versprechen. Das Feuer, das ihn verzehrt, ist nicht sein Feind — es ist sein Spiegel.',
  cu_chulainn:
    'Cú Chulainn wusste, dass sein Ruhm seinen Tod bedingte. Er wählte trotzdem den Ruhm. Am letzten Tag band er sich an einen Stein, damit er stehend sterben konnte — damit seine Feinde sein Gesicht sehen würden, bis zum letzten Atemzug.',
  valkyrie_eira:
    'Eira wählte nicht die tapfersten Krieger — sie wählte die, deren Geschichten noch nicht fertig erzählt waren. Valhalla war keine Belohnung. Es war eine zweite Chance.',
  arthur_pendragon:
    'Excalibur war nicht Arthurs Stärke. Excalibur war sein Versprechen — an jeden Ritter der Tafelrunde, an jeden Bürger seines Reiches, an das Ideal, das er verkörperte. Als das Schwert zerbrach, zerbrach das Versprechen — und Arthur mit ihm.',
};

export const CARD_LORE_FALLBACK =
  'Diese Einheit hüllt sich in Schweigen. Stärke deine Bindung weiter, um ihre verborgene Geschichte zu enthüllen.';

export const LORE_UNLOCK_BOND_LEVEL = 2;

export const CardLoreService = {
  LORE_UNLOCK_BOND_LEVEL,

  getLore(cardId: string): string | null {
    return CARD_LORE[cardId] ?? null;
  },

  getFallback(): string {
    return CARD_LORE_FALLBACK;
  },

  isUnlocked(bondLevel: number): boolean {
    return bondLevel >= LORE_UNLOCK_BOND_LEVEL;
  },
};
