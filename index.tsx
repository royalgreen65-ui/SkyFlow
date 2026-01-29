import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const container = document.getElementById('root');
const splash = document.getElementById('boot-splash');

const dismissSplash = () => {
  if (splash) splash.classList.add('fade-out');
};

if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    // Success - hide loading
    setTimeout(dismissSplash, 500);
  } catch (error) {
    console.error("Mounting Error:", error);
    dismissSplash();
  }
} else {
  dismissSplash();
}