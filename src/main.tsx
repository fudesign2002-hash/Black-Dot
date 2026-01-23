import React from 'react';
import ReactDOM from 'react-dom/client';
import './input.css';
import App from '../App'; // 注意：你的 App.tsx 在專案根目錄，不在 src 裡


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
