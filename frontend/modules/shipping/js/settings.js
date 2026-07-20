document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    const user = window.getCurrentUser();
    if (!user) {
        window.location.href = '../../index.html';
        return;
    }
    
    // Load Settings
    loadSettings();

    // Event Listeners
    document.getElementById('trackingForm').addEventListener('submit', handleSaveTrackingSettings);
});

async function loadSettings() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`${window.API_URL}/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Populate tracking fields
            if (data.post_tracking_url) {
                document.getElementById('postTrackingUrl').value = data.post_tracking_url;
            } else {
                document.getElementById('postTrackingUrl').value = 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx';
            }
            if (data.vrl_tracking_url) {
                document.getElementById('vrlTrackingUrl').value = data.vrl_tracking_url;
            } else {
                document.getElementById('vrlTrackingUrl').value = 'https://www.vrlgroup.in/track_consignment.aspx';
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        window.showToast("Failed to load settings", "error");
    }
}

async function handleSaveTrackingSettings(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveTracking');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    const settings = {
        post_tracking_url: document.getElementById('postTrackingUrl').value,
        vrl_tracking_url: document.getElementById('vrlTrackingUrl').value
    };

    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${window.API_URL}/settings`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            window.showToast("Tracking settings saved successfully", "success");
        } else {
            const data = await response.json();
            window.showToast(data.message || "Failed to save settings", "error");
        }
    } catch (error) {
        console.error('Save error:', error);
        window.showToast("An error occurred", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
