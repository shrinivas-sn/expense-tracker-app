/**
 * Search & Filter Utility
 * Handles client-side filtering, sorting, and searching
 */

/**
 * Filters and sorts items based on current settings
 * @param {Array} items - Items to filter/sort
 * @param {string} type - Type of items ('stocks', 'mfs', 'wallet')
 * @param {string} searchTerm - Search query
 * @param {string} filterType - Filter type ('all', 'profit', 'loss', etc.)
 * @param {string} sortBy - Sort field ('name', 'value', 'pnl', etc.)
 * @returns {Array} Filtered and sorted items
 */
export function filterAndSort(items, type, searchTerm, filterType, sortBy) {
    if (!items || items.length === 0) return [];

    let filtered = [...items];

    // Apply search filter
    if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        if (type === 'wallet') {
            filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(term)
            );
        } else {
            filtered = filtered.filter(item => 
                item.ticker.toLowerCase().includes(term)
            );
        }
    }

    // Apply profit/loss filter
    if (filterType !== 'all') {
        if (type === 'wallet') {
            if (filterType === 'positive') {
                filtered = filtered.filter(item => (item.netBalance || 0) >= 0);
            } else if (filterType === 'negative') {
                filtered = filtered.filter(item => (item.netBalance || 0) < 0);
            }
        } else {
            // For stocks/MF - calculate P&L
            filtered = filtered.filter(item => {
                const qty = parseFloat(item.qty) || 0;
                const avg = parseFloat(item.avgPrice) || 0;
                const ltp = parseFloat(item.currentLTP || item.avgPrice) || 0;
                const pnl = (ltp - avg) * qty;
                
                if (filterType === 'profit') return pnl >= 0;
                if (filterType === 'loss') return pnl < 0;
                return true;
            });
        }
    }

    // Apply sorting
    if (sortBy) {
        filtered.sort((a, b) => {
            if (type === 'wallet') {
                return sortWalletItems(a, b, sortBy);
            } else {
                return sortStockItems(a, b, sortBy);
            }
        });
    }

    return filtered;
}

/**
 * Sorts stock/MF items
 */
function sortStockItems(a, b, sortBy) {
    const qtyA = parseFloat(a.qty) || 0;
    const avgA = parseFloat(a.avgPrice) || 0;
    const ltpA = parseFloat(a.currentLTP || a.avgPrice) || 0;
    const valueA = qtyA * ltpA;
    const pnlA = (ltpA - avgA) * qtyA;
    const pnlPercentA = avgA > 0 ? ((ltpA - avgA) / avgA) * 100 : 0;

    const qtyB = parseFloat(b.qty) || 0;
    const avgB = parseFloat(b.avgPrice) || 0;
    const ltpB = parseFloat(b.currentLTP || b.avgPrice) || 0;
    const valueB = qtyB * ltpB;
    const pnlB = (ltpB - avgB) * qtyB;
    const pnlPercentB = avgB > 0 ? ((ltpB - avgB) / avgB) * 100 : 0;

    switch (sortBy) {
        case 'name':
            return (a.ticker || '').localeCompare(b.ticker || '');
        case 'value':
            return valueB - valueA; // Descending
        case 'pnl':
            return pnlB - pnlA; // Descending
        case 'pnlPercent':
            return pnlPercentB - pnlPercentA; // Descending
        default:
            return 0;
    }
}

/**
 * Sorts wallet items
 */
function sortWalletItems(a, b, sortBy) {
    switch (sortBy) {
        case 'name':
            return (a.name || '').localeCompare(b.name || '');
        case 'balance':
            return (parseFloat(b.netBalance) || 0) - (parseFloat(a.netBalance) || 0); // Descending
        case 'date':
            const dateA = a.lastUpdated?.toDate ? a.lastUpdated.toDate() : new Date(0);
            const dateB = b.lastUpdated?.toDate ? b.lastUpdated.toDate() : new Date(0);
            return dateB - dateA; // Descending
        default:
            return 0;
    }
}

/**
 * Debounce function for search input
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
