import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initPWA } from './pwa';
import './index.css';

// Service Worker registrieren (nur im Productionsbuild aktiv)
initPWA();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
