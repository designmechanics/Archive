import React from 'react';
import ReactDOM from 'react-dom/client';
import gsap from 'gsap';
import { App } from './App';
import { initSeedZipPacks } from './data/realZipPacks';

// Tune GSAP ticker for high-refresh-rate displays (120Hz/144Hz/240Hz) so it doesn't jump down to 33ms (~30fps)
gsap.ticker.lagSmoothing(1000, 16);

initSeedZipPacks();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
