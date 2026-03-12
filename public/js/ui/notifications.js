/**
 * notifications.js
 * Handles professional toast notifications.
 */

export function showNotification(message, type = 'success') {
    // 1. Create the element
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type === 'success' ? 'toast-success' : 'toast-error'}`;
    
    // 2. Icon Selection with animation
    const icon = type === 'success' 
        ? `<svg class="success-checkmark" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
    `;

    // 3. Append to Body
    document.body.appendChild(toast);

    // 4. Animate In with bounce
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 5. Auto Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}