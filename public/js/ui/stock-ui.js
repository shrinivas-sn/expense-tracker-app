import { formatCurrency, calculateUnrealizedPnL, getPortfolioSummary, safeNum, formatDateTime } from "../logic-core.js";

// ... (renderStockList is same as before) ...
export function renderStockList(items, listId, emptyId) {
    const container = document.getElementById(listId);
    const emptyState = document.getElementById(emptyId);
    container.innerHTML = '';
    
    if (!items || items.length === 0) {
        emptyState.classList.remove('hidden-view');
        emptyState.innerHTML = `
            <div class="empty-state-icon">📈</div>
            <p class="empty-state-title">No stocks yet</p>
            <p class="empty-sub">Start building your portfolio by adding your first stock</p>
            <div class="empty-state-action">
                <button onclick="window.openFabAction()" class="empty-state-btn">Add Your First Stock</button>
            </div>
        `;
        updateSummary({ totalInvested: 0, totalCurrent: 0, totalPnL: 0, totalPnLPercent: 0 });
        return;
    }
    emptyState.classList.add('hidden-view');
    const summary = getPortfolioSummary(items);
    updateSummary(summary);

    items.forEach(item => {
        const qty = safeNum(item.qty);
        const avg = safeNum(item.avgPrice);
        const ltp = safeNum(item.currentLTP || avg); 
        const realizedPnL = safeNum(item.realizedPnL);
        const totalInvestedAmount = safeNum(item.totalInvestedAmount);
        
        const div = document.createElement('div');
        div.className = 'list-item-row';
        div.onclick = () => window.openStockDetail(item.id);
        
        let statusHtml = '';
        
        if (qty === 0) {
            // Fully sold - show realized return
            const realizedReturnPercent = totalInvestedAmount > 0 ? (realizedPnL / totalInvestedAmount) * 100 : 0;
            const pnlClass = realizedPnL >= 0 ? 'text-profit' : 'text-loss';
            const pnlSign = realizedPnL >= 0 ? '+' : '';
            const statusDot = realizedPnL >= 0 ? '<span class="status-dot status-dot-profit"></span>' : '<span class="status-dot status-dot-loss"></span>';
            statusHtml = `
                <div class="item-left">
                    <p class="item-name">${statusDot}${item.ticker}</p>
                    <p class="item-sub" style="color:var(--text-muted); font-weight:600;">Sold • ${pnlSign}${realizedReturnPercent.toFixed(2)}% return</p>
                </div>
                <div class="item-right">
                    <p class="item-price ${pnlClass}">${pnlSign}${formatCurrency(realizedPnL)}</p>
                    <p class="item-stat ${pnlClass}" style="font-size:0.7rem;">Realized</p>
                </div>
            `;
        } else {
            // Holding or partially sold - show total return
            const invested = qty * avg;
            const current = qty * ltp;
            const unrealizedPnL = current - invested;
            const totalPnL = unrealizedPnL + realizedPnL;
            const totalInvested = invested + totalInvestedAmount;
            const totalReturnPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
            
            const pnlClass = totalPnL >= 0 ? 'text-profit' : 'text-loss';
            const pnlSign = totalPnL >= 0 ? '+' : '';
            const statusDot = totalPnL >= 0 ? '<span class="status-dot status-dot-profit"></span>' : '<span class="status-dot status-dot-loss"></span>';
            
            statusHtml = `
                <div class="item-left">
                    <p class="item-name">${statusDot}${item.ticker}</p>
                    <p class="item-sub">${qty} units @ ${formatCurrency(avg)}</p>
                </div>
                <div class="item-right">
                    <p class="item-price">${formatCurrency(ltp)}</p>
                    <p class="item-stat ${pnlClass}">${pnlSign}${formatCurrency(totalPnL)} <span class="status-badge ${totalPnL >= 0 ? 'status-badge-profit' : 'status-badge-loss'}">${pnlSign}${totalReturnPercent.toFixed(1)}%</span></p>
                </div>
            `;
        }
        
        div.innerHTML = statusHtml;
        container.appendChild(div);
    });
}

function updateSummary(summary) {
    const pnlEl = document.getElementById(`stock-total-pnl`);
    document.getElementById(`stock-current-val`).innerText = formatCurrency(summary.totalCurrent);
    document.getElementById(`stock-invested-val`).innerText = formatCurrency(summary.totalInvested);
    const pnlClass = summary.totalPnL >= 0 ? 'text-profit' : 'text-loss';
    const pnlSign = summary.totalPnL >= 0 ? '+' : '';
    pnlEl.className = `pnl-val ${pnlClass}`;
    pnlEl.innerHTML = `${pnlSign}${formatCurrency(summary.totalPnL)} (${pnlSign}${summary.totalPnLPercent.toFixed(2)}%)<br><span style="font-size:0.7rem; opacity:0.8;">Realized: ${formatCurrency(summary.totalRealizedPnL || 0)}</span>`;
}

export function renderStockDetailView(stock, history) {
    const container = document.getElementById('view-detail');
    const qty = safeNum(stock.qty);
    const avg = safeNum(stock.avgPrice);
    const ltp = safeNum(stock.currentLTP || avg);
    const invested = qty * avg;
    const current = qty * ltp;
    const unrealizedPnl = current - invested;
    const unrealizedPnlPercent = invested > 0 ? (unrealizedPnl / invested) * 100 : 0;
    const realizedPnl = safeNum(stock.realizedPnL);
    const realizedReturnPercent = safeNum(stock.realizedReturnPercent);
    const totalInvestedAmount = safeNum(stock.totalInvestedAmount);
    const totalPnl = unrealizedPnl + realizedPnl;
    const totalPnlPercent = (invested + totalInvestedAmount) > 0 ? (totalPnl / (invested + totalInvestedAmount)) * 100 : 0;
    const pnlClass = totalPnl >= 0 ? 'text-profit' : 'text-loss';
    const lastUpdated = stock.lastUpdated?.toDate ? formatDateTime(stock.lastUpdated.toDate()) : 'Not updated';

    let historyHtml = history.map(tx => {
        const isBuy = tx.type === 'BUY';
        const dataStr = encodeURIComponent(JSON.stringify(tx));
        const notesHtml = tx.notes ? `<p class="item-notes" style="font-size:0.75rem; color:var(--text-muted); margin-top:4px; font-style:italic;">📝 ${tx.notes}</p>` : '';
        
        return `
            <div class="list-item-row" style="cursor:default;">
                <div class="item-left">
                    <p class="item-name" style="font-size:0.9rem;">${tx.type}</p>
                    <p class="item-sub">${formatDateTime(tx.date)}</p>
                    ${notesHtml}
                </div>
                <div class="item-right">
                    <p class="item-price">${formatCurrency(tx.price)}</p>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <p class="item-stat text-neutral" style="margin-right:4px;">${tx.qty} Qty</p>
                        
                        <button onclick="window.prepEditTx('${tx.id}', '${dataStr}')" class="btn-icon-sm text-neutral">
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>

                        <button onclick="window.deleteStockTx('${stock.id}', '${tx.id}')" class="btn-icon-sm text-loss">
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if(history.length === 0) historyHtml = `<div class="empty-state"><p class="empty-sub">No transaction history found.</p></div>`;

    container.innerHTML = `
        <div class="detail-header-card">
            <h2 class="detail-ticker">${stock.ticker}</h2>
            <h1 class="detail-price ${pnlClass}">${formatCurrency(current)}</h1>
            <div class="detail-stats">
                <div class="stat-box"><p class="stat-label">Invested</p><p class="stat-val">${formatCurrency(invested)}</p></div>
                <div class="stat-box"><p class="stat-label">Qty</p><p class="stat-val">${qty}</p></div>
                <div class="stat-box"><p class="stat-label">Avg</p><p class="stat-val">${formatCurrency(avg)}</p></div>
            </div>
            <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                    <p style="font-size:0.75rem; color:var(--text-muted); margin:0;">Current Price: ${formatCurrency(ltp)}</p>
                    <button onclick="window.openUpdatePriceModal('${stock.id}', ${ltp})" style="padding:0.35rem 0.75rem; background:var(--primary); color:white; border:none; border-radius:0.5rem; font-size:0.75rem; font-weight:600; cursor:pointer;">Update Price</button>
                </div>
                <p style="font-size:0.65rem; color:var(--text-muted); margin:0; text-align:center;">Last updated: ${lastUpdated}</p>
            </div>
            <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border); display:flex; justify-content:space-around;">
                <div style="text-align:center;">
                    <p style="font-size:0.7rem; color:var(--text-muted); margin:0;">Unrealized P&L</p>
                    <p style="font-size:0.9rem; font-weight:700; margin:0.25rem 0 0 0; color:${unrealizedPnl >= 0 ? 'var(--profit)' : 'var(--loss)'}">${formatCurrency(unrealizedPnl)}</p>
                    <p style="font-size:0.7rem; font-weight:600; margin:0.25rem 0 0 0; color:${unrealizedPnl >= 0 ? 'var(--profit)' : 'var(--loss)'}">${unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnlPercent.toFixed(2)}%</p>
                </div>
                <div style="text-align:center;">
                    <p style="font-size:0.7rem; color:var(--text-muted); margin:0;">Realized P&L</p>
                    <p style="font-size:0.9rem; font-weight:700; margin:0.25rem 0 0 0; color:${realizedPnl >= 0 ? 'var(--profit)' : 'var(--loss)'}">${formatCurrency(realizedPnl)}</p>
                    <p style="font-size:0.7rem; font-weight:600; margin:0.25rem 0 0 0; color:${realizedPnl >= 0 ? 'var(--profit)' : 'var(--loss)'}">${realizedPnl >= 0 ? '+' : ''}${realizedReturnPercent.toFixed(2)}%</p>
                </div>
                <div style="text-align:center;">
                    <p style="font-size:0.7rem; color:var(--text-muted); margin:0;">Total P&L</p>
                    <p style="font-size:0.9rem; font-weight:700; margin:0.25rem 0 0 0; color:${totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)'}">${formatCurrency(totalPnl)}</p>
                    <p style="font-size:0.7rem; font-weight:600; margin:0.25rem 0 0 0; color:${totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)'}">${totalPnl >= 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%</p>
                </div>
            </div>
        </div>
        <div class="list-header">Transaction History</div>
        <div class="history-list" style="padding-bottom: 80px; background:transparent;">${historyHtml}</div>
        <div class="detail-actions-bar">
             <button onclick="window.openStockEdit('${stock.id}', '${stock.ticker}', ${qty}, ${avg})" class="btn-action btn-neutral">Edit</button>
             <button onclick="window.openStockDetailAdd('${stock.ticker}', 'BUY')" class="btn-action btn-primary" style="margin: 0 0.5rem;">Buy</button>
             <button onclick="window.openStockDetailAdd('${stock.ticker}', 'SELL')" class="btn-action btn-danger-outline">Sell</button>
        </div>
    `;
}