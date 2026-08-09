document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['sales','admin'])) return;
    // Centralized logic in components.js handles sidebar, tabs, and content population.
});


