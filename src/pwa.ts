/**
 * pwa.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Service-Worker-Registrierung via vite-plugin-pwa.
 * Wird einmal beim App-Start aufgerufen.
 * ─────────────────────────────────────────────────────────────
 */

import { registerSW } from 'virtual:pwa-register';

export function initPWA(): void {
  // In Produktionsbuilds registriert vite-plugin-pwa automatisch.
  // Dieser Aufruf aktiviert Update-Handling.
  const updateSW = registerSW({
    // Neuer SW verfügbar → sofort übernehmen
    onNeedRefresh() {
      console.log('[PWA] Update verfügbar — wird installiert …');
      updateSW(true); // true = sofortige Übernahme
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
