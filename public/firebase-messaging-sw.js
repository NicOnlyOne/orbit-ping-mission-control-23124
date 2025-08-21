// Import the functions you need from the SDKs you need
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

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

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'Website Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'One of your monitored websites has an issue',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'website-alert',
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'View Details'
      }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    // Open the app when notification is clicked
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});