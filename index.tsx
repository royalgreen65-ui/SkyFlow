import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  
  const hideSplash = () => {
    const splash = document.getElementById('boot-splash');
    if (splash) splash.classList.add('fade-out');
  };

  try {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    // Hide splash almost immediately once mounting begins
    setTimeout(hideSplash, 200);
  } catch (err) {
    console.error("Critical Render Error:", err);
    hideSplash();
  }
}