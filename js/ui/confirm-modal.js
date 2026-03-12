/**
 * Confirmation Modal Utility
 * Replaces browser confirm() with custom modal
 */

let confirmResolve = null;

/**
 * Shows a confirmation modal
 * @param {string} message - The message to display
 * @param {string} title - Optional title (default: "Confirm")
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
export function showConfirm(message, title = "Confirm") {
    return new Promise((resolve) => {
        confirmResolve = resolve;
        
        const modal = document.createElement('div');
        modal.id = 'confirm-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content animate-slide-up" style="max-width: 400px;">
                <div class="header-neutral">${title}</div>
                <div class="modal-body">
                    <p style="margin: 0; color: var(--text-main); font-size: 0.95rem;">${message}</p>
                    <div class="modal-actions">
                        <button onclick="window.confirmCancel()" class="btn-cancel">Cancel</button>
                        <button onclick="window.confirmOk()" class="btn-save">Confirm</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.remove('hidden-view');
    });
}

/**
 * Handles confirmation
 */
window.confirmOk = function() {
    if (confirmResolve) {
        confirmResolve(true);
        confirmResolve = null;
    }
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.classList.add('hidden-view');
        setTimeout(() => modal.remove(), 300);
    }
};

/**
 * Handles cancellation
 */
window.confirmCancel = function() {
    if (confirmResolve) {
        confirmResolve(false);
        confirmResolve = null;
    }
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.classList.add('hidden-view');
        setTimeout(() => modal.remove(), 300);
    }
};
