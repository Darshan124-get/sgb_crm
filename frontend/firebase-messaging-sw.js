importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyCt7ulTF7LkzGQHqd-8xdMGU8gAKxoFJ7o",
  authDomain: "sgb-fcm.firebaseapp.com",
  projectId: "sgb-fcm",
  storageBucket: "sgb-fcm.firebasestorage.app",
  messagingSenderId: "786281022584",
  appId: "1:786281022584:web:09a14a29c0d2424c74d98d"
});

const messaging = firebase.messaging();

// Handle background notifications
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message payload:', payload);

  const notificationTitle = payload.notification?.title || 'SGB Agro CRM';
  const notificationOptions = {
    body: payload.notification?.body || 'New system update',
    icon: '/assets/logo.png',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
