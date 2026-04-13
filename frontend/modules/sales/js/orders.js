document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['sales','admin'])) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const el = document.getElementById('profileName');
    if (el) el.textContent = user.name || 'User';
    const desc = document.getElementById('pageDesc');
    if (desc) desc.textContent = 'Conversions (Orders) — Full feature coming soon.';
});
