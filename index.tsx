
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './r3f-declarations'; // NEW: Import this early to register R3F elements

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);