import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

console.log("React: Initializing Component Tree...");

const container = document.getElementById('root');
const splash = document.getElementById('boot-splash');

if (container) {
  try {
    const root = createRoot(container);
    root.render(<App />);
    
    // Auto-clear splash screen
    setTimeout(() => {
      if (splash) splash.classList.add('fade-out');
      console.log("UI: Bootstrapper handshake successful.");
    }, 1000);
  } catch (err) {
    console.error("Mount Error: " + (err as Error).message);
  }
} else {
  console.error("Critical: DOM root not found.");
}

export {};