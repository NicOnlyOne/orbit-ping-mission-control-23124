import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyA0aR3ZEyn5uqB6AbqcDtmcHL03o0LIZ1o",
  authDomain: "orbitping.firebaseapp.com",
  projectId: "orbitping",
  storageBucket: "orbitping.firebasestorage.app",
  messagingSenderId: "78766485282",
  appId: "1:78766485282:web:44cf91211b92ae83027f7b",
  measurementId: "G-T7XV1L11TG"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const requestPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'BH8fNfMrJLOYLj5YQrByJOWPbTEgEfZphCPEG9KGQhx5rD2F-L1VPRgXJOYcQXqcLHHCKG5O1JL5YQrByJOWPbT',
      });
      return token;
    }
    return null;
  } catch (error) {
    console.error('Error getting permission or token:', error);
    return null;
  }
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  onMessage(messaging, callback);
};
