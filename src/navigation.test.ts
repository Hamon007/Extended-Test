import { describe, expect, it } from 'vitest';
import { getInitialScreenStack } from './navigation';

describe('getInitialScreenStack', () => {
  it('starts on the title screen by default', () => {
    expect(getInitialScreenStack('')).toEqual(['title']);
  });

  it('opens manifest shortcut destinations directly', () => {
    expect(getInitialScreenStack('?tab=gacha')).toEqual(['title', 'gacha']);
    expect(getInitialScreenStack('?tab=battle')).toEqual(['title', 'battle']);
  });

  it('ignores tabs that are not exposed as shortcuts', () => {
    expect(getInitialScreenStack('?tab=menu')).toEqual(['title']);
  });
});
