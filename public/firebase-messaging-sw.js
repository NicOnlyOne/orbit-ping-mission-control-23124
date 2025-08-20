// Import the functions you need from the SDKs you need
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js');
import { getAnalytics } from "firebase/analytics";
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging.js');

const firebaseConfig = {
  apiKey: "AIzaSyA0aR3ZEyn5uqB6AbqcDtmcHL03o0LIZ1o",
  authDomain: "orbitping.firebaseapp.com",
  projectId: "orbitping",
  storageBucket: "orbitping.firebasestorage.app",
  messagingSenderId: "78766485282",
  appId: "1:78766485282:web:44cf91211b92ae83027f7b",
  measurementId: "G-T7XV1L11TG"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});