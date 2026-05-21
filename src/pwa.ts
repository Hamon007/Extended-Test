/**
 * pwa.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Service-Worker-Registrierung via vite-plugin-pwa.
 * Wird einmal beim App-Start aufgerufen.
 * ─────────────────────────────────────────────────────────────
 */

import { registerSW } from 'virtual:pwa-register';

export function initPWA(): void {
  registerSW({
    // New SW ready → skip waiting then reload so new assets are served
    onNeedRefresh() {
      window.location.reload();
    },

    onOfflineReady() {
      console.log('[PWA] App ist offline-fähig.');
    },

    onRegistered(swRegistration) {
      console.log('[PWA] Service Worker registriert:', swRegistration?.scope ?? 'n/a');
    },

    onRegisterError(error) {
      console.warn('[PWA] Service Worker Registrierung fehlgeschlagen:', error);
    },
  });
}
