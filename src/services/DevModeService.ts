const DEV_KEY  = 'ci_dev_mode';
const PASSWORD = 'Osmanos';

export const DevModeService = {
  isEnabled(): boolean {
    return localStorage.getItem(DEV_KEY) === '1';
  },

  tryActivate(password: string): boolean {
    if (password === PASSWORD) {
      localStorage.setItem(DEV_KEY, '1');
      return true;
    }
    return false;
  },

  deactivate(): void {
    localStorage.removeItem(DEV_KEY);
  },
};
