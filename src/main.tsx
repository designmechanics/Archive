import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initSeedZipPacks } from './data/realZipPacks';

initSeedZipPacks();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
