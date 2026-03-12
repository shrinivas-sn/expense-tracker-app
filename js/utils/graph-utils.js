/**
 * Graph Utilities
 * Time range calculations and date helpers
 */

/**
 * Gets date range based on time period
 * @param {string} range - Time range ('1d', '1w', '1m', '3m', '6m', '1y', '5y', 'all')
 * @returns {Object} { startDate, endDate }
 */
export function getDateRange(range) {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (range) {
        case '1d':
            startDate.setDate(endDate.getDate() - 1);
            break;
        case '1w':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case '1m':
            startDate.setMonth(endDate.getMonth() - 1);
            break;
        case '3m':
            startDate.setMonth(endDate.getMonth() - 3);
            break;
        case '6m':
            startDate.setMonth(endDate.getMonth() - 6);
            break;
        case '1y':
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
        case '5y':
            startDate.setFullYear(endDate.getFullYear() - 5);
            break;
        case 'all':
            startDate.setFullYear(2020, 0, 1); // Start from 2020
            break;
        default:
            startDate.setMonth(endDate.getMonth() - 1);
    }
    
    return { startDate, endDate };
}

/**
 * Formats date for display
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
export function formatChartDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
}

/**
 * Generates date points for chart based on range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Array of formatted date strings
 */
export function generateDatePoints(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - current) / (1000 * 60 * 60 * 24));
    
    // Determine interval based on range
    let interval = 1; // days
    if (daysDiff > 365) interval = 30; // monthly for > 1 year
    else if (daysDiff > 90) interval = 7; // weekly for > 3 months
    else if (daysDiff > 30) interval = 2; // every 2 days for > 1 month
    
    while (current <= end) {
        dates.push(formatChartDate(new Date(current)));
        current.setDate(current.getDate() + interval);
    }
    
    // Always include end date
    const lastDate = dates[dates.length - 1];
    const endDateStr = formatChartDate(end);
    if (!lastDate || lastDate !== endDateStr) {
        dates.push(endDateStr);
    }
    
    return dates;
}
