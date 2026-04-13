const API_BASE = `${window.BASE_URL}/api`;
const toast = document.getElementById('toast');

// Download Handler
async function downloadReport(endpoint, filename, buttonId) {
    const btn = document.getElementById(buttonId);
    const text = btn.querySelector('.btn-text');
    
    // Set loading state
    btn.classList.add('loading');
    btn.disabled = true;
    text.textContent = 'Generating...';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Export failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showToast(`${filename} ready!`, 'success');
    } catch (err) {
        showToast('Download Error: ' + err.message, 'error');
    } finally {
        // Reset state
        btn.classList.remove('loading');
        btn.disabled = false;
        text.textContent = 'Download Excel';
    }
}

// Event Listeners
document.getElementById('downloadLeads').addEventListener('click', () => {
    downloadReport('/reports/leads', 'sgb_leads_report.xlsx', 'downloadLeads');
});

document.getElementById('downloadOrders').addEventListener('click', () => {
    downloadReport('/reports/orders', 'sgb_orders_report.xlsx', 'downloadOrders');
});

// Toast Notification
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}
