/**
 * Loading State Utility
 * Manages loading indicators for async operations
 */

/**
 * Shows loading state on a button
 * @param {HTMLElement|string} button - Button element or selector
 * @param {string} loadingText - Text to show while loading
 */
export function setButtonLoading(button, loadingText = "Loading...") {
    const btn = typeof button === 'string' ? document.querySelector(button) : button;
    if (!btn) return;
    
    btn.disabled = true;
    btn.classList.add('loading');
    btn.dataset.originalText = btn.textContent;
    btn.textContent = loadingText;
}

/**
 * Removes loading state from a button
 * @param {HTMLElement|string} button - Button element or selector
 */
export function removeButtonLoading(button) {
    const btn = typeof button === 'string' ? document.querySelector(button) : button;
    if (!btn) return;
    
    btn.disabled = false;
    btn.classList.remove('loading');
    if (btn.dataset.originalText) {
        btn.textContent = btn.dataset.originalText;
        delete btn.dataset.originalText;
    }
}
