document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin'])) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const el = document.getElementById('profileName');
    if (el) el.textContent = user.name || 'Administrator';
});
