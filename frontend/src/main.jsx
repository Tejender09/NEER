import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const rootEl = document.getElementById('root');
if (rootEl) {
    if (!window._neerRoot) {
        window._neerRoot = ReactDOM.createRoot(rootEl);
    }
    window._neerRoot.render(<App />);
}
