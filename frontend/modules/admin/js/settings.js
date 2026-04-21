document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin'])) return;
    const user = window.getCurrentUser();
    const el = document.getElementById('profileName');
    if (el) el.textContent = user.name || 'Administrator';

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

    } catch (err) {
        showToast('Failed to load settings', true);
    }
}

async function saveSettings() {
    const payload = {
        gst_rate: document.getElementById('s-gst-rate').value,
        company_state: document.getElementById('s-company-state').value,
        auto_tax_switch: document.getElementById('s-auto-tax').checked ? 'true' : 'false',
        invoice_prefix: document.getElementById('s-invoice-prefix').value,
        last_invoice_num: document.getElementById('s-last-invoice').value
    };

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
