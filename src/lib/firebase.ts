import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyA0aR3ZEyn5uqB6AbqcDtmcHL03o0LIZ1o",
  authDomain: "orbitping.firebaseapp.com",
  projectId: "orbitping",
  storageBucket: "orbitping.firebasestorage.app",
  messagingSenderId: "78766485282",
  appId: "1:78766485282:web:44cf91211b92ae83027f7b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
let messaging: any = null;

try {
  // Only initialize messaging in browser environment
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.warn('Firebase messaging not available:', error);
}

// VAPID key - get from Firebase Console Cloud Messaging settings
export const VAPID_KEY = 'BPkoOndd5JzcoWyjXotg2ilYnDKHe_nLDXPzdKriP62Jcf4pdAjvoNoNDKGhKLHUBuSVhkEs3Z20POt7osdXEoc';

export { messaging, app };

// Request notification permission and get FCM token
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    if (!messaging) {
      throw new Error('Messaging not initialized');
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      
      // Get registration token
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY
      });
      
      console.log('Registration token:', token);
      return token;
    } else {
      console.log('Unable to get permission to notify.');
      return null;
    }
  } catch (err) {
    console.error('An error occurred while retrieving token:', err);
    return null;
  }
};

// Listen for foreground messages
export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    
    onMessage(messaging, (payload) => {
      console.log('Message received in foreground:', payload);
      resolve(payload);
    });
  });