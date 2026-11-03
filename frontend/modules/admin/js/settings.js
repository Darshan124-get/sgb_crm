document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin'])) return;
    const user = window.getCurrentUser();
    const el = document.getElementById('profileName');
    if (el) el.textContent = user.name || 'Administrator';

    // Synchronize initial UI state from localStorage
    const initialNotif = localStorage.getItem('notifications_enabled') !== 'false';
    const notifEl = document.getElementById('s-notifications-toggle');
    if (notifEl) notifEl.checked = initialNotif;
    if (!initialNotif && typeof window.dismissAllNotificationPopups === 'function') {
        window.dismissAllNotificationPopups();
    }

    loadSettings();

    document.getElementById('saveBtn').addEventListener('click', saveSettings);
});

async function loadSettings() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // Map data to inputs
        document.getElementById('s-gst-rate').value = data.gst_rate || 18;
        document.getElementById('s-company-state').value = data.company_state || '';
        document.getElementById('s-auto-tax').checked = data.auto_tax_switch === 'true';
        document.getElementById('s-invoice-prefix').value = data.invoice_prefix || 'SGB';
        document.getElementById('s-last-invoice').value = data.last_invoice_num || 0;
        
        const postInput = document.getElementById('s-post-tracking');
        if (postInput) postInput.value = data.post_tracking_url || 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx';
        
        const vrlInput = document.getElementById('s-vrl-tracking');
        if (vrlInput) vrlInput.value = data.vrl_tracking_url || 'https://www.vrlgroup.in/track_consignment.aspx';

        // Load Notification Toggles from Backend / LocalStorage
        const notifOn = data.notifications_enabled !== undefined ? data.notifications_enabled === 'true' : (localStorage.getItem('notifications_enabled') !== 'false');
        const soundMuted = data.notification_sound_muted !== undefined ? data.notification_sound_muted === 'true' : (localStorage.getItem('notification_sound_muted') === 'true');

        localStorage.setItem('notifications_enabled', notifOn ? 'true' : 'false');
        localStorage.setItem('notification_sound_muted', soundMuted ? 'true' : 'false');

        const notifEl = document.getElementById('s-notifications-toggle');
        if (notifEl) {
            notifEl.checked = notifOn;
            notifEl.onchange = () => {
                const enabled = notifEl.checked;
                localStorage.setItem('notifications_enabled', enabled ? 'true' : 'false');
                if (!enabled) {
                    if (typeof window.dismissAllNotificationPopups === 'function') {
                        window.dismissAllNotificationPopups();
                    }
                } else {
                    if (typeof window.fetchPendingHumanAlerts === 'function') {
                        window.fetchPendingHumanAlerts();
                    }
                    if (typeof window.pollPaymentVerificationSummary === 'function') {
                        window.pollPaymentVerificationSummary();
                    }
                }
            };
        }

        const soundEl = document.getElementById('s-sound-mute-toggle');
        if (soundEl) {
            soundEl.checked = soundMuted;
            soundEl.onchange = () => {
                localStorage.setItem('notification_sound_muted', soundEl.checked ? 'true' : 'false');
            };
        }

        if (!notifOn && typeof window.dismissAllNotificationPopups === 'function') {
            window.dismissAllNotificationPopups();
        }

    } catch (err) {
        showToast('Failed to load settings', true);
    }
}

async function saveSettings() {
    const notifEnabled = document.getElementById('s-notifications-toggle') ? document.getElementById('s-notifications-toggle').checked : true;
    const soundMuted = document.getElementById('s-sound-mute-toggle') ? document.getElementById('s-sound-mute-toggle').checked : false;

    // Save to LocalStorage immediately
    localStorage.setItem('notifications_enabled', notifEnabled ? 'true' : 'false');
    localStorage.setItem('notification_sound_muted', soundMuted ? 'true' : 'false');

    if (!notifEnabled && typeof window.dismissAllNotificationPopups === 'function') {
        window.dismissAllNotificationPopups();
    } else if (notifEnabled) {
        if (typeof window.fetchPendingHumanAlerts === 'function') {
            window.fetchPendingHumanAlerts();
        }
        if (typeof window.pollPaymentVerificationSummary === 'function') {
            window.pollPaymentVerificationSummary();
        }
    }

    const payload = {
        gst_rate: document.getElementById('s-gst-rate').value,
        company_state: document.getElementById('s-company-state').value,
        auto_tax_switch: document.getElementById('s-auto-tax').checked ? 'true' : 'false',
        invoice_prefix: document.getElementById('s-invoice-prefix').value,
        last_invoice_num: document.getElementById('s-last-invoice').value,
        notifications_enabled: notifEnabled ? 'true' : 'false',
        notification_sound_muted: soundMuted ? 'true' : 'false'
    };

    const postInput = document.getElementById('s-post-tracking');
    if (postInput) payload.post_tracking_url = postInput.value;

    const vrlInput = document.getElementById('s-vrl-tracking');
    if (vrlInput) payload.vrl_tracking_url = vrlInput.value;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/settings`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast('Settings saved successfully! ✅');
        } else {
            showToast('Error saving settings', true);
        }
    } catch (err) {
        showToast('Server error', true);
    }
}

function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.background = isError ? '#ef4444' : '#1e293b';
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 3000);
}
