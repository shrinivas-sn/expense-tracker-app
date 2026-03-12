import { formatCurrency, calculateUnrealizedPnL, getPortfolioSummary, safeNum, formatDateTime } from "../logic-core.js";

export function renderMFList(items) {
    const container = document.getElementById('mf-list');
    const emptyState = document.getElementById('mf-empty');
    container.innerHTML = '';
    
    if (!items || items.length === 0) {
        emptyState.classList.remove('hidden-view');
        emptyState.innerHTML = `
            <div class="empty-state-icon">💰</div>
            <p class="empty-state-title">No mutual funds yet</p>
            <p class="empty-sub">Start tracking your mutual fund investments</p>
            <div class="empty-state-action">
                <button onclick="window.openFabAction()" class="empty-state-btn">Add Your First Fund</button>
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
    const pnlEl = document.getElementById(`mf-total-pnl`);
    document.getElementById(`mf-current-val`).innerText = formatCurrency(summary.totalCurrent);
    document.getElementById(`mf-invested-val`).innerText = formatCurrency(summary.totalInvested);
    const pnlClass = summary.totalPnL >= 0 ? 'text-profit' : 'text-loss';
    const pnlSign = summary.totalPnL >= 0 ? '+' : '';
    pnlEl.className = `pnl-val ${pnlClass}`;
    pnlEl.innerHTML = `${pnlSign}${formatCurrency(summary.totalPnL)} (${pnlSign}${summary.totalPnLPercent.toFixed(2)}%)<br><span style="font-size:0.7rem; opacity:0.8;">Realized: ${formatCurrency(summary.totalRealizedPnL || 0)}</span>`;
}