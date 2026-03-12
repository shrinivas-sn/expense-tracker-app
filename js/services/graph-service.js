/**
 * Graph Service
 * Calculates portfolio data for graph visualization
 */

import { loadStocksDeep } from "./stock-service.js";
import { loadMFsDeep } from "./mf-service.js";
import { recalculateFromHistory, safeNum } from "../logic-core.js";
import { getDateRange, formatChartDate } from "../utils/graph-utils.js";

/**
 * Calculates portfolio value at a specific date
 * @param {Date} targetDate - Date to calculate value for
 * @param {Array} stocks - All stocks with history
 * @param {Array} mfs - All mutual funds with history
 * @returns {Object} { invested, current, pnl }
 */
function calculatePortfolioAtDate(targetDate, stocks, mfs) {
    let totalInvested = 0;
    let totalCurrent = 0;
    
    // Process stocks
    stocks.forEach(stock => {
        if (!stock.history || stock.history.length === 0) return;
        
        const relevantTx = stock.history.filter(tx => {
            const txDate = new Date(tx.date);
            return txDate <= targetDate;
        });
        
        if (relevantTx.length === 0) return;
        
        const stats = recalculateFromHistory(relevantTx);
        const qty = safeNum(stats.qty);
        const avg = safeNum(stats.avgPrice);
        const ltp = safeNum(stock.currentLTP || avg);
        
        totalInvested += (qty * avg);
        totalCurrent += (qty * ltp);
    });
    
    // Process mutual funds
    mfs.forEach(mf => {
        if (!mf.history || mf.history.length === 0) return;
        
        const relevantTx = mf.history.filter(tx => {
            const txDate = new Date(tx.date);
            return txDate <= targetDate;
        });
        
        if (relevantTx.length === 0) return;
        
        const stats = recalculateFromHistory(relevantTx);
        const qty = safeNum(stats.qty);
        const avg = safeNum(stats.avgPrice);
        const ltp = safeNum(mf.currentLTP || avg);
        
        totalInvested += (qty * avg);
        totalCurrent += (qty * ltp);
    });
    
    return {
        invested: totalInvested,
        current: totalCurrent,
        pnl: totalCurrent - totalInvested
    };
}

/**
 * Generates portfolio data points for graph
 * @param {string} timeRange - Time range ('1d', '1w', etc.)
 * @returns {Promise<Object>} { labels, values, invested, current, pnl }
 */
export async function generatePortfolioData(timeRange) {
    try {
        const stocks = await loadStocksDeep();
        const mfs = await loadMFsDeep();
        
        const { startDate, endDate } = getDateRange(timeRange);
        
        // Generate actual date points
        const actualDates = [];
        const current = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = Math.ceil((end - current) / (1000 * 60 * 60 * 24));
        
        // Determine interval based on range
        let interval = 1; // days
        if (daysDiff > 365) interval = 30; // monthly for > 1 year
        else if (daysDiff > 90) interval = 7; // weekly for > 3 months
        else if (daysDiff > 30) interval = 2; // every 2 days for > 1 month
        
        while (current <= end) {
            actualDates.push(new Date(current));
            current.setDate(current.getDate() + interval);
        }
        // Always include end date
        if (actualDates.length === 0 || actualDates[actualDates.length - 1].getTime() !== end.getTime()) {
            actualDates.push(new Date(end));
        }
        
        // Generate labels and calculate values
        const datePoints = actualDates.map(d => formatChartDate(d));
        const values = [];
        const investedValues = [];
        
        // Calculate value for each date
        actualDates.forEach(date => {
            const portfolio = calculatePortfolioAtDate(date, stocks, mfs);
            values.push(portfolio.current);
            investedValues.push(portfolio.invested);
        });
        
        // Get current totals
        const currentPortfolio = calculatePortfolioAtDate(endDate, stocks, mfs);
        
        return {
            labels: datePoints,
            values: values,
            investedValues: investedValues,
            invested: currentPortfolio.invested,
            current: currentPortfolio.current,
            pnl: currentPortfolio.pnl
        };
    } catch (error) {
        console.error("Error generating portfolio data:", error);
        return {
            labels: [],
            values: [],
            investedValues: [],
            invested: 0,
            current: 0,
            pnl: 0
        };
    }
}
