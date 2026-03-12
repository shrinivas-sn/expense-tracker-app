/**
 * logic-core.js
 */

export const safeNum = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
};

export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(safeNum(amount));
};

// *** NEW: Indian Date & Time Formatter ***
// Input: "2026-01-24T14:30" -> "24-01-2026 | 02:30 PM"
export const formatDateTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    
    return `${day}-${month}-${year} | ${hours}:${minutes} ${ampm}`;
};

export const calculateNewAverage = (currentQty, currentAvgPrice, buyQty, buyPrice) => {
    const cQty = safeNum(currentQty);
    const cAvg = safeNum(currentAvgPrice);
    const bQty = safeNum(buyQty);
    const bPrice = safeNum(buyPrice);

    const oldTotalCost = cQty * cAvg;
    const newCost = bQty * bPrice;
    const totalQty = cQty + bQty;
    
    if (totalQty === 0) return 0;
    return (oldTotalCost + newCost) / totalQty;
};

export const calculateSellImpact = (currentQty, currentAvgPrice, sellQty, sellPrice) => {
    const cQty = safeNum(currentQty);
    const cAvg = safeNum(currentAvgPrice);
    const sQty = safeNum(sellQty);
    const sPrice = safeNum(sellPrice);
    
    if (sQty > cQty) return { remainingQty: cQty, realizedPnL: 0, avgPrice: cAvg };

    const remainingQty = cQty - sQty;
    const realizedPnL = (sPrice - cAvg) * sQty;
    
    return {
        remainingQty,
        realizedPnL,
        avgPrice: cAvg 
    };
};

export const recalculateFromHistory = (transactions) => {
    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    let qty = 0;
    let avg = 0;
    let totalRealizedPnL = 0;
    let totalInvestedAmount = 0;

    sorted.forEach(tx => {
        const txQty = safeNum(tx.qty);
        const txPrice = safeNum(tx.price);

        if (tx.type === 'BUY') {
            avg = calculateNewAverage(qty, avg, txQty, txPrice);
            qty += txQty;
            totalInvestedAmount += (txQty * txPrice);
        } else if (tx.type === 'SELL') {
            const res = calculateSellImpact(qty, avg, txQty, txPrice);
            qty = res.remainingQty;
            avg = res.avgPrice;
            totalRealizedPnL += res.realizedPnL;
        }
    });

    const realizedReturnPercent = totalInvestedAmount > 0 ? (totalRealizedPnL / totalInvestedAmount) * 100 : 0;

    return { 
        qty, 
        avgPrice: avg, 
        investedAmount: qty * avg, 
        realizedPnL: totalRealizedPnL,
        totalInvestedAmount,
        realizedReturnPercent
    };
};

export const calculateUnrealizedPnL = (qty, avgPrice, currentLTP) => {
    const q = safeNum(qty);
    const avg = safeNum(avgPrice);
    const ltp = safeNum(currentLTP);
    const investedVal = q * avg;
    const currentVal = q * ltp;
    const pnlValue = currentVal - investedVal;
    const pnlPercent = investedVal > 0 ? (pnlValue / investedVal) * 100 : 0;
    return { investedVal, currentVal, pnlValue, pnlPercent };
};

export const getPortfolioSummary = (holdings) => {
    let totalInvested = 0;
    let totalCurrent = 0;
    let totalRealizedPnL = 0;
    
    holdings.forEach(stock => {
        const q = safeNum(stock.qty);
        const avg = safeNum(stock.avgPrice);
        const ltp = stock.currentLTP ? safeNum(stock.currentLTP) : avg;
        totalInvested += (q * avg);
        totalCurrent += (q * ltp);
        totalRealizedPnL += safeNum(stock.realizedPnL);
    });
    
    const totalUnrealizedPnL = totalCurrent - totalInvested;
    const totalPnL = totalUnrealizedPnL + totalRealizedPnL;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    
    return { 
        totalInvested, 
        totalCurrent, 
        totalPnL, 
        totalPnLPercent,
        totalRealizedPnL,
        totalUnrealizedPnL
    };
};