import '@fontsource-variable/bricolage-grotesque/wght.css';
import '@fontsource-variable/dm-sans/wght.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, installTapFeedback } from './fx';
import './styles.css';

applyTheme();
installTapFeedback();

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* hors ligne ou navigateur incompatible : on ignore */
    });
  });
}
