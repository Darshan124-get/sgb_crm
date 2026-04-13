document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin'])) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const el = document.getElementById('profileName');
    if (el) el.textContent = user.name || 'Administrator';
    const pc = document.getElementById('pageContent');
    if (pc) pc.querySelector('p').textContent = 'System Logs module — feature coming soon.';
});
