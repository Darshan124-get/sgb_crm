document.addEventListener('DOMContentLoaded', () => {
    // 1. Load CRM sidebar
    if (typeof window.loadSidebar === 'function') {
        window.loadSidebar('chatbot');
    }

    // 2. Fetch logged user name
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('profileName').textContent = user.name || 'Admin User';

    // 3. Fetch settings from API
    fetchSettings();
});

// Fetch current configurations
async function fetchSettings() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${window.API_URL}/chatbot/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load settings');
        const settings = await res.json();

        // Populate fields
        if (settings.ai_fallback_enabled !== undefined) {
            document.getElementById('aiToggle').checked = !!settings.ai_fallback_enabled;
        }
        if (settings.ai_model) {
            document.getElementById('aiModel').value = settings.ai_model;
        }
        if (settings.ai_temperature !== undefined) {
            const tempVal = parseFloat(settings.ai_temperature);
            document.getElementById('aiTemp').value = tempVal;
            document.getElementById('tempValue').textContent = tempVal;
        }
        if (settings.default_fallback_msg) {
            document.getElementById('fallbackMsg').value = settings.default_fallback_msg;
        }
        if (settings.max_fallback_attempts) {
            document.getElementById('maxFallbacks').value = settings.max_fallback_attempts;
        }
        if (settings.webhook_url) {
            document.getElementById('webhookUrl').value = settings.webhook_url;
        }
        if (settings.webhook_token) {
            document.getElementById('webhookToken').value = settings.webhook_token;
        }
    } catch (err) {
        console.error('[FETCH SETTINGS ERROR]', err);
    }
}

// Save configurations to API
async function saveConfigurations() {
    const token = localStorage.getItem('token');
    const ai_fallback_enabled = document.getElementById('aiToggle').checked;
    const ai_model = document.getElementById('aiModel').value;
    const ai_temperature = parseFloat(document.getElementById('aiTemp').value);
    const default_fallback_msg = document.getElementById('fallbackMsg').value.trim();
    const max_fallback_attempts = parseInt(document.getElementById('maxFallbacks').value);
    const webhook_url = document.getElementById('webhookUrl').value.trim();
    const webhook_token = document.getElementById('webhookToken').value.trim();

    if (!default_fallback_msg) {
        alert("Please enter a default fallback message.");
        return;
    }

    const saveBtn = document.querySelector('.btn-primary[onclick="saveConfigurations()"]');
    const originalHtml = saveBtn.innerHTML;
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
        const res = await fetch(`${window.API_URL}/chatbot/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                ai_fallback_enabled,
                ai_model,
                ai_temperature,
                default_fallback_msg,
                max_fallback_attempts,
                webhook_url,
                webhook_token
            })
        });

        if (!res.ok) throw new Error('Save configuration request failed');
        alert('Configurations saved successfully!');
    } catch (err) {
        alert('Error saving settings: ' + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHtml;
    }
}
