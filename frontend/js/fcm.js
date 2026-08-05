// fcm.js - Client-Side Firebase Cloud Messaging for SGB Agro CRM

const firebaseConfig = {
  apiKey: "AIzaSyCt7ulTF7LkzGQHqd-8xdMGU8gAKxoFJ7o",
  authDomain: "sgb-fcm.firebaseapp.com",
  projectId: "sgb-fcm",
  storageBucket: "sgb-fcm.firebasestorage.app",
  messagingSenderId: "786281022584",
  appId: "1:786281022584:web:09a14a29c0d2424c74d98d"
};

export async function initFCM() {
  try {
    console.log('Initializing FCM client...');

    // 1. Permanent click and tray handler setup for the bell icon
    setupBellIconListener();

    // 2. Dynamic import of Firebase SDKs (v10.12.0)
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const { getMessaging, getToken, onMessage } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js");

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    // 3. Register Service Worker
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker is not supported in this browser.');
      return;
    }

    const swUrl = `${window.ROOT_PATH}firebase-messaging-sw.js`;
    const registration = await navigator.serviceWorker.register(swUrl);
    console.log('FCM Service Worker registered successfully with scope:', registration.scope);

    // 4. Check / Request Notification Permission
    const permission = Notification.permission;
    if (permission === 'default') {
      console.log('FCM Notification permission is default. Showing banner.');
      showNotificationPrompt();
      return; // Stop here, wait for user click to re-init
    }

    if (permission !== 'granted') {
      console.warn('FCM Notification permission not granted/denied by browser settings.');
      return;
    }

    // 5. Retrieve FCM Registration Token
    if (!window.FCM_VAPID_KEY) {
      console.error('FCM VAPID key is missing in config.js. Cannot request registration token.');
      return;
    }

    const token = await getToken(messaging, { 
      vapidKey: window.FCM_VAPID_KEY,
      serviceWorkerRegistration: registration 
    });

    if (token) {
      console.log('FCM Registration Token acquired.');
      localStorage.setItem('fcm_token', token);

      // Register the token with the backend if the user is authenticated
      const user = window.getCurrentUser();
      if (user && user.id) {
        await saveTokenToBackend(token);
      }
    } else {
      console.warn('No FCM registration token received.');
    }

    // 6. Handle foreground notifications
    onMessage(messaging, (payload) => {
      console.log('FCM foreground message received:', payload);
      const title = payload.notification?.title || 'SGB Agro CRM';
      const body = payload.notification?.body || 'New update';

      // Save notification to local storage cache & update badge
      saveNotificationToCache(title, body);
      updateBellBadge();

      if (typeof window.showAlert === 'function') {
        window.showAlert(title, body, 'info');
      } else {
        const notification = new Notification(title, { body });
      }
    });

  } catch (error) {
    console.error('FCM initialization failed:', error);
  }
}

function saveNotificationToCache(title, body) {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem('crm_notifications')) || [];
  } catch (e) {}

  list.unshift({
    title,
    body,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    read: false
  });

  if (list.length > 20) list = list.slice(0, 20);
  localStorage.setItem('crm_notifications', JSON.stringify(list));
}

function updateBellBadge() {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem('crm_notifications')) || [];
  } catch (e) {}

  const unreadCount = list.filter(n => !n.read).length;
  const badge = document.getElementById('notifBadge');
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

function setupBellIconListener() {
  const bells = document.querySelectorAll('.notif-bell');
  bells.forEach(bell => {
    if (bell.dataset.fcmBound) return;
    bell.dataset.fcmBound = 'true';

    // Synchronize initial badge count
    updateBellBadge();

    bell.addEventListener('click', async (e) => {
      e.stopPropagation();

      // 1. Request permission if default
      if (Notification.permission !== 'granted') {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            if (typeof window.showAlert === 'function') {
              window.showAlert('Notifications Enabled', 'You will now receive desktop alerts for CRM updates.', 'success');
            }
            await initFCM();
          } else {
            if (typeof window.showAlert === 'function') {
              window.showAlert('Permission Denied', 'Please enable notifications in your browser settings.', 'error');
            }
          }
        } catch (err) {
          console.error('Error requesting notification permission from bell click:', err);
        }
        return;
      }

      // 2. Toggle notification tray dropdown
      toggleNotificationDropdown(bell);
    });
  });
}

function toggleNotificationDropdown(bell) {
  let dropdown = document.getElementById('crm-notification-dropdown');
  if (dropdown) {
    dropdown.remove();
    return;
  }

  // Create dropdown
  dropdown = document.createElement('div');
  dropdown.id = 'crm-notification-dropdown';
  dropdown.style.cssText = `
    position: absolute;
    top: 36px;
    right: 0;
    width: 320px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
    border: 1px solid #e2e8f0;
    z-index: 10001;
    font-family: 'Inter', sans-serif;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: fcmFadeIn 0.15s ease-out;
  `;

  // Get notifications
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem('crm_notifications')) || [];
  } catch (e) {}

  // Mark all as read
  list.forEach(n => n.read = true);
  localStorage.setItem('crm_notifications', JSON.stringify(list));
  updateBellBadge();

  let itemsHtml = '';
  if (list.length === 0) {
    itemsHtml = `
      <div style="padding: 24px; text-align: center; color: #94a3b8; font-size: 13px;">
        <i class="fa-regular fa-bell-slash" style="font-size: 24px; margin-bottom: 8px; display: block; color: #cbd5e1;"></i>
        No notifications yet
      </div>
    `;
  } else {
    itemsHtml = list.map(n => `
      <div style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 4px; transition: background 0.15s; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
          <span style="font-weight: 700; font-size: 13px; color: #1e293b; line-height: 1.2;">${n.title}</span>
          <span style="font-size: 9.5px; color: #94a3b8; font-weight: 500; white-space: nowrap;">${n.timestamp}</span>
        </div>
        <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.4; word-break: break-word;">${n.body}</p>
      </div>
    `).join('');
  }

  dropdown.innerHTML = `
    <div style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
      <span style="font-weight: 700; font-size: 13.5px; color: #0f172a;">Notifications</span>
      <button id="crm-notif-clear-all" style="background: transparent; border: none; font-size: 11px; font-weight: 700; color: #ef4444; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: background 0.2s;">Clear All</button>
    </div>
    <div style="max-height: 280px; overflow-y: auto;">
      ${itemsHtml}
    </div>
    <style>
      @keyframes fcmFadeIn {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #crm-notification-dropdown div:hover {
        background: #f8fafc;
      }
      #crm-notif-clear-all:hover {
        background: #fef2f2;
      }
    </style>
  `;

  bell.appendChild(dropdown);

  // Clear all click handler
  document.getElementById('crm-notif-clear-all').onclick = (e) => {
    e.stopPropagation();
    localStorage.setItem('crm_notifications', JSON.stringify([]));
    dropdown.remove();
    updateBellBadge();
  };

  // Close dropdown on click outside
  const closeDropdown = (e) => {
    if (!dropdown.contains(e.target) && !bell.contains(e.target)) {
      dropdown.remove();
      document.removeEventListener('click', closeDropdown);
    }
  };
  document.addEventListener('click', closeDropdown);
}

function showNotificationPrompt() {
  if (localStorage.getItem('notif_prompt_dismissed') === 'true') {
    return;
  }

  // Check if prompt already exists
  if (document.getElementById('fcm-notification-prompt')) return;

  const promptDiv = document.createElement('div');
  promptDiv.id = 'fcm-notification-prompt';
  promptDiv.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #ffffff;
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
    border-radius: 16px;
    padding: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 340px;
    border-left: 5px solid #3b82f6;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    animation: fcmSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  promptDiv.innerHTML = `
    <div style="display: flex; align-items: start; gap: 14px; text-align: left;">
      <div style="background: #eff6ff; color: #3b82f6; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1);">
        <i class="fa-solid fa-bell" style="font-size: 20px;"></i>
      </div>
      <div style="flex: 1;">
        <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: #1e293b; letter-spacing: -0.01em;">Enable CRM Notifications</h4>
        <p style="margin: 6px 0 0 0; font-size: 12.5px; color: #64748b; line-height: 1.45; font-weight: 500;">Get instant alerts on desktop when new leads are assigned or WhatsApp messages arrive.</p>
      </div>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px;">
      <button id="fcm-prompt-dismiss" style="background: transparent; border: none; padding: 8px 16px; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; border-radius: 8px; transition: background 0.2s;">Dismiss</button>
      <button id="fcm-prompt-enable" style="background: #3b82f6; border: none; padding: 8px 16px; font-size: 13px; font-weight: 700; color: #ffffff; cursor: pointer; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2); transition: background 0.2s, transform 0.1s;">Enable</button>
    </div>
    <style>
      @keyframes fcmSlideIn {
        from { transform: translateY(120px) scale(0.95); opacity: 0; }
        to { transform: translateY(0) scale(1); opacity: 1; }
      }
      #fcm-prompt-dismiss:hover { background: #f1f5f9; color: #334155; }
      #fcm-prompt-enable:hover { background: #2563eb; }
      #fcm-prompt-enable:active { transform: scale(0.97); }
    </style>
  `;

  document.body.appendChild(promptDiv);

  // Click handlers
  document.getElementById('fcm-prompt-dismiss').onclick = () => {
    promptDiv.remove();
    localStorage.setItem('notif_prompt_dismissed', 'true');
  };

  document.getElementById('fcm-prompt-enable').onclick = async () => {
    promptDiv.remove();
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('FCM Notification permission granted via banner button.');
        await initFCM();
      } else {
        console.warn('FCM Notification permission denied/ignored.');
      }
    } catch (err) {
      console.error('Error requesting notification permission from banner click:', err);
    }
  };
}

async function saveTokenToBackend(fcmToken) {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const response = await fetch(`${window.API_URL}/users/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ token: fcmToken, device_type: 'web' })
    });

    if (!response.ok) {
      console.error('Failed to save FCM token to backend database:', response.statusText);
    } else {
      console.log('FCM token registered with backend database successfully.');
    }
  } catch (err) {
    console.error('Network error registering FCM token with backend:', err);
  }
}
