export type Screen =
  | 'title'
  | 'main'
  | 'gacha'
  | 'deck'
  | 'fusion'
  | 'battle'
  | 'collection'
  | 'menu'
  | 'cardCollection'
  | 'guild'
  | 'training'
  | 'profile'
  | 'trade'
  | 'friends'
  | 'inventory'
  | 'quests';

const shortcutScreens: Record<string, Screen> = {
  gacha:  'gacha',
  battle: 'battle',
};

export function getInitialScreenStack(search: string): Screen[] {
  const shortcutScreen = shortcutScreens[new URLSearchParams(search).get('tab') ?? ''];

  return shortcutScreen ? ['title', shortcutScreen] : ['title'];
}
