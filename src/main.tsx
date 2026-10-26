import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './styles.css';
import './ui/panels.css';
import './ui/responsive.css';
import './ui/map.css';
import './ui/audio.css';

createRoot(document.getElementById('root')!).render(<App />);
