import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Register Firebase service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then((registration) => {
      console.log('Service Worker registration successful with scope: ', registration.scope);
    })
    .catch((err) => {
      console.log('Service Worker registration failed: ', err);
    });
}

createRoot(document.getElementById("root")!).render(<App />);
