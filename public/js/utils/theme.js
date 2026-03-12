/**
 * Theme Management Utility
 * Handles dark mode toggle and persistence
 */

/**
 * Initializes theme from localStorage or system preference
 */
export function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (prefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    }
    
    updateThemeUI();
}

/**
 * Toggles between light and dark mode
 */
export function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeUI();
}

/**
 * Updates theme UI elements (icons, labels)
 */
function updateThemeUI() {
    const theme = document.documentElement.getAttribute('data-theme');
    const icon = document.getElementById('dark-mode-icon');
    const status = document.getElementById('dark-mode-status');
    
    if (icon && status) {
        if (theme === 'dark') {
            icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />`;
            status.textContent = 'On';
        } else {
            icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />`;
            status.textContent = 'Off';
        }
    }
}

// Make toggleTheme available globally
window.toggleDarkMode = toggleTheme;
