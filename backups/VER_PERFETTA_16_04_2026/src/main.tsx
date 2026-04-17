import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import EventEmitter from 'events';

// Polyfills for browser compatibility with some Node-leaning libraries
if (typeof window !== 'undefined') {
  (window as any).global = window;
  (window as any).process = { 
    env: { NODE_ENV: 'development' },
    version: '',
    nextTick: (cb: any) => setTimeout(cb, 0),
    browser: true,
    on: () => {},
    once: () => {},
    off: () => {},
    emit: () => {},
    removeAllListeners: () => {},
  };
  (window as any).Buffer = (window as any).Buffer || { isBuffer: () => false };
  (window as any).EventEmitter = EventEmitter;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
