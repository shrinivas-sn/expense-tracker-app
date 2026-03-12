import { formatCurrency, formatDateTime, safeNum } from "../logic-core.js";

// DASHBOARD: Show Categories (Items)
export async function renderWalletList(categories, selectedBank = null) {
    const container = document.getElementById('wallet-list');
    const emptyState = document.getElementById('wallet-empty');
    const balanceEl = document.getElementById('wallet-balance');
    
    if (!balanceEl) return; // Guard clause
    
    container.innerHTML = '';
    let totalSpent = 0;

    // Filter by selected bank
    let filteredCategories = categories;
    if (selectedBank) {
        filteredCategories = categories.filter(c => (c.bankAccount || "General") === selectedBank);
    }

    // Get deposits for this bank
    let depositsTotal = 0;
    if (selectedBank) {
        const { getBankDeposits } = await import("../services/wallet-service.js");
        const deposits = await getBankDeposits(selectedBank);
        depositsTotal = deposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    }

    // Handle Empty State
    if (!filteredCategories || filteredCategories.length === 0) {
        emptyState.classList.remove('hidden-view');
        const bankMsg = selectedBank ? `No categories in ${selectedBank}` : 'No categories yet';
        emptyState.innerHTML = `
            <div class="empty-state-icon">💳</div>
            <p class="empty-state-title">${bankMsg}</p>
            <p class="empty-sub">Create your first category to start tracking transactions</p>
            <div class="empty-state-action">
                <button onclick="window.openFabAction()" class="empty-state-btn">Create Category</button>
            </div>
        `;
    } else {
        emptyState.classList.add('hidden-view');

        // Loop through categories to calculate Total Spent and Render Items
        filteredCategories.forEach(cat => {
            const balance = safeNum(cat.netBalance);
            totalSpent += balance;

            const colorClass = balance >= 0 ? 'text-profit' : 'text-loss';

            const div = document.createElement('div');
            div.className = 'list-item-row'; 
            div.onclick = () => window.openWalletDetail(cat.id, cat.name);

            div.innerHTML = `
                <div class="item-left">
                    <p class="item-name">${cat.name}</p>
                    <p class="item-sub">Updated: ${cat.lastUpdated && cat.lastUpdated.toDate ? formatDateTime(cat.lastUpdated.toDate()) : 'New'}</p>
                </div>
                <div class="item-right">
                    <p class="item-price ${colorClass}" style="font-weight: 700;">${formatCurrency(balance)}</p>
                </div>
            `;
            container.appendChild(div);
        });
    }

    // Calculate net balance: deposits + category balances
    const netBalance = depositsTotal + totalSpent;
    const balanceColor = netBalance >= 0 ? 'var(--profit)' : 'var(--loss)';
    balanceEl.style.color = balanceColor;
    balanceEl.innerText = formatCurrency(netBalance);
}

// DETAIL VIEW: Show History
export function renderWalletDetailView(name, history, catId) {
    const container = document.getElementById('view-detail');
    
    // Calculate running balance for this specific account
    let currentBalance = 0;
    
    // Sort history by date descending for display, but we might need logic if we want running balance per row
    // For now, let's just show the list
    
    let historyHtml = history.map(t => {
        const amt = parseFloat(t.amount);
        const isCredit = t.type === 'credit';
        const colorClass = isCredit ? 'text-profit' : 'text-loss';
        const sign = isCredit ? '+' : '-';
        
        // Update balance logic (visual only for header usually, but good to know)
        if(isCredit) currentBalance += amt; else currentBalance -= amt;

        // Encode data for editing
        const dataStr = encodeURIComponent(JSON.stringify(t));

        return `
            <div class="list-item-row" style="cursor:default;">
                <div class="item-left">
                    <p class="item-name" style="font-size:1rem;">${t.notes || (isCredit ? "Deposit" : "Expense")}</p>
                    <p class="item-sub">${formatDateTime(t.date)}</p>
                </div>
                <div class="item-right">
                    <p class="item-price ${colorClass}" style="font-size:1.1rem;">${sign}${formatCurrency(amt)}</p>
                    <div style="display:flex; align-items:center; gap:8px; margin-top:4px; justify-content:flex-end;">
                        <button onclick="window.prepEditTx('${t.id}', '${dataStr}')" class="btn-icon-sm text-neutral">
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button onclick="window.deleteWalletTx('${catId}', '${t.id}')" class="btn-icon-sm text-loss">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (history.length === 0) historyHtml = `<div class="empty-state"><p class="empty-sub">No transactions in this account.</p></div>`;

    container.innerHTML = `
        <div class="detail-header-card" style="background: linear-gradient(135deg, #1f2937 0%, #111827 100%); color:white;">
            <p class="label-xs" style="color:#9ca3af;">ACCOUNT</p>
            <h2 class="detail-ticker" style="color:white;">${name}</h2>
        </div>
        <div class="list-header">Transaction History</div>
        <div class="history-list" style="padding-bottom: 80px; background:transparent;">${historyHtml}</div>
        <div class="detail-actions-bar">
             <button onclick="window.openFabAction()" class="btn-action btn-primary" style="width:100%">Add Transaction</button>
        </div>
    `;
}