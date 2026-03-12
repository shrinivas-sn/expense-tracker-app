/**
 * Smart Portfolio - Main Application Controller
 * Manages routing, state, and user interactions
 */

import { loadStocks, saveStockTransaction, updateStock, deleteStock, getStockHistory, deleteStockTransaction, updateStockTransaction } from "./services/stock-service.js";
import { loadMFs, saveMFTransaction, updateMF, deleteMF, getMFHistory, deleteMFTransaction, updateMFTransaction } from "./services/mf-service.js";
import { loadWalletCategories, createWalletCategory, getWalletCategoryHistory, addWalletTransaction, deleteWalletTransaction, deleteWalletCategory, updateWalletTransaction, updateDoc, doc, db, getBankDeposits, addBankDeposit, updateBankDeposit, deleteBankDeposit } from "./services/wallet-service.js";
import { generateReport, exportData, importData } from "./services/report-service.js";
import { renderStockList, renderStockDetailView } from "./ui/stock-ui.js";
import { renderMFList } from "./ui/mf-ui.js";
import { renderWalletList, renderWalletDetailView } from "./ui/wallet-ui.js";
import { showNotification } from "./ui/notifications.js";
import { setButtonLoading, removeButtonLoading } from "./ui/loading.js";
import { filterAndSort, debounce } from "./utils/search-filter.js";
import { initTheme } from "./utils/theme.js";
import { updateGraph, destroyGraph } from "./ui/graph-ui.js";
import { formatCurrency, formatDateTime } from "./logic-core.js";
import { showConfirm } from "./ui/confirm-modal.js";
import { loginUser, signupUser, logoutUser, onAuthChange } from "./services/auth-service.js";

// --- SECURITY CONFIG ---
const ALLOWED_USERS = ['your.email@example.com'];

/**
 * Application state management
 */
let appState = {
    currentTab: 'stocks', 
    currentInvType: 'BUY',
    editingStockId: null,
    editingTxId: null,
    activeCatId: null,
    activeCatName: null,
    actionType: null,
    selectedBank: null,
    editingBankName: null,
    editingDepositId: null,
    walletView: 'bank-selection',
    isRenderingBanks: false,
    searchTerms: { stocks: '', mfs: '', wallet: '' },
    filters: { stocks: 'all', mfs: 'all', wallet: 'all' },
    sortBy: { stocks: 'name', mfs: 'name', wallet: 'name' },
    originalData: { stocks: [], mfs: [], wallet: [] },
    user: null // Store current user
};

// --- TIMEZONE FIX HELPER ---
function getLocalISOString() {
    const now = new Date();
    const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    return localDate.toISOString().slice(0, 16);
}

// Initialize app on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initTheme(); // Initialize theme first
    
    // AUTH LISTENER: The Gatekeeper
    onAuthChange((user) => {
        appState.user = user;
        
        if (user) {
            // Check Access
            if (ALLOWED_USERS.includes(user.email)) {
                // ACCESS GRANTED
                document.getElementById('view-auth').classList.add('hidden-view');
                document.getElementById('app-wrapper').classList.remove('hidden-view');
                
                // Initialize Router & App
                handleRoute(window.location.pathname);
                
                // Init handlers only once
                if (!window.searchHandlersInitialized) {
                    setTimeout(initSearchHandlers, 100);
                    window.searchHandlersInitialized = true;
                }
            } else {
                // ACCESS DENIED
                document.getElementById('view-auth').classList.remove('hidden-view');
                document.getElementById('app-wrapper').classList.add('hidden-view');
                document.getElementById('form-login').classList.add('hidden-view');
                document.getElementById('form-signup').classList.add('hidden-view');
                document.getElementById('auth-denied').classList.remove('hidden-view');
            }
        } else {
            // NO USER - SHOW LOGIN
            document.getElementById('view-auth').classList.remove('hidden-view');
            document.getElementById('app-wrapper').classList.add('hidden-view');
            document.getElementById('auth-denied').classList.add('hidden-view');
            window.toggleAuthMode('login'); // Reset to login form
        }
    });

    window.onpopstate = (event) => {
        if (appState.user && ALLOWED_USERS.includes(appState.user.email)) {
            if (event.state) restoreState(event.state);
            else handleRoute(window.location.pathname);
        }
    };
});

// --- AUTH HANDLERS ---

window.toggleAuthMode = (mode) => {
    if (mode === 'login') {
        document.getElementById('form-login').classList.remove('hidden-view');
        document.getElementById('form-signup').classList.add('hidden-view');
    } else {
        document.getElementById('form-login').classList.add('hidden-view');
        document.getElementById('form-signup').classList.remove('hidden-view');
    }
};

window.handleLogin = async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    
    if (!email || !pass) {
        showNotification("Please enter email and password", "error");
        return;
    }
    
    const btn = document.querySelector('#form-login button');
    setButtonLoading(btn, "Logging In...");
    
    const result = await loginUser(email, pass);
    
    if (result.success) {
        // Auth Listener will handle UI switch
    } else {
        showNotification(result.error, "error");
    }
    removeButtonLoading(btn);
};

window.handleSignup = async () => {
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPass').value;
    
    if (!email || !pass) {
        showNotification("Please enter email and password", "error");
        return;
    }
    
    const btn = document.querySelector('#form-signup button');
    setButtonLoading(btn, "Creating Account...");
    
    const result = await signupUser(email, pass);
    
    if (result.success) {
        // Auth Listener will handle UI switch (likely to Access Denied since new email isn't in whitelist)
        showNotification("Account created!", "success");
    } else {
        showNotification(result.error, "error");
    }
    removeButtonLoading(btn);
};

window.handleLogout = async () => {
    await logoutUser();
    // Auth Listener will handle redirect to login
};

// ... (Rest of your existing main.js logic follows below) ...

/**
 * Handles routing based on URL path
 * @param {string} path - Current URL path
 */
function handleRoute(path) {
    // Normalize path - remove trailing slash and handle .html extension
    path = path.replace(/\/$/, "").replace(/\.html$/, "");
    
    // Exact Matches
    if (path === "" || path === "/" || path === "/index" || path === "/stocks") {
        switchTab('stocks', false);
        return;
    } 
    
    if (path === "/mfs") {
        switchTab('mfs', false);
        return;
    }
    
    if (path === "/wallet") {
        switchTab('wallet', false);
        return;
    }
    
    // Deep Links
    if (path.startsWith("/details/")) {
        const parts = path.split('/'); 
        if (parts.length >= 4) {
            const type = parts[2];
            const id = decodeURIComponent(parts[3]);
            if (type === 'wallet') {
                const name = decodeURIComponent(parts[4] || "Account");
                appState.currentTab = 'wallet';
                window.openWalletDetail(id, name, false);
            } else {
                appState.currentTab = (type === 'mf') ? 'mfs' : 'stocks';
                window.openStockDetail(id, false);
            }
        } else {
            switchTab('stocks', false);
        }
        return;
    }
    
    // FALLBACK (Sticky Routing Fix)
    // If exact match fails, check for keywords to keep user on correct tab
    if (path.includes('wallet')) {
        switchTab('wallet', false);
    } else if (path.includes('mf') || path.includes('fund')) {
        switchTab('mfs', false);
    } else {
        switchTab('stocks', false);
    }
}

/**
 * Restores application state from history
 * @param {Object} state - State object from history
 */
function restoreState(state) {
    if (state.view === 'detail') {
        if (state.type === 'wallet') window.openWalletDetail(state.id, state.name, false);
        else window.openStockDetail(state.id, false);
    } else switchTab(state.tab, false);
}

/**
 * Switches between main tabs (Stocks, Mutual Funds, Wallet)
 * @param {string} tabName - Tab to switch to ('stocks', 'mfs', 'wallet')
 * @param {boolean} pushHistory - Whether to update browser history
 */
window.switchTab = async function(tabName, pushHistory = true) {
    appState.currentTab = tabName;
    if (tabName === 'wallet') {
        appState.walletView = 'bank-selection';
        appState.selectedBank = null;
    }
    if (pushHistory) history.pushState({ view: 'list', tab: tabName }, "", tabName === 'stocks' ? '/' : `/${tabName}`);
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    ['stocks', 'mfs', 'wallet', 'detail', 'graph'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) {
            el.classList.add('hidden-view');
            el.classList.remove('active-view');
        }
    });
    document.getElementById(`view-${tabName}`).classList.remove('hidden-view');
    document.getElementById(`view-${tabName}`).classList.add('active-view');
    document.getElementById('fab-container').classList.remove('hidden-view');
    document.getElementById('bottom-nav').classList.remove('hidden-view');
    document.getElementById('btn-menu').classList.remove('hidden-view');
    document.getElementById('btn-back').classList.add('hidden-view');
    const titles = { 'stocks': 'Stocks', 'mfs': 'Mutual Funds', 'wallet': 'Wallet' };
    const fabTexts = { 'stocks': 'ADD STOCK', 'mfs': 'ADD FUND', 'wallet': 'ADD BANK' };
    document.getElementById('page-title').innerText = titles[tabName];
    document.getElementById('fab-text').innerText = fabTexts[tabName];
    await loadDataForTab(tabName);
}

/**
 * Loads and renders data for the specified tab
 * @param {string} tab - Tab name ('stocks', 'mfs', 'wallet')
 */
async function loadDataForTab(tab) {
    let data = [];
    if (tab === 'stocks') {
        data = await loadStocks();
        appState.originalData.stocks = data;
        applyFiltersAndRender('stocks', data);
    } else if (tab === 'mfs') {
        data = await loadMFs();
        appState.originalData.mfs = data;
        applyFiltersAndRender('mfs', data);
    } else {
        data = await loadWalletCategories();
        appState.originalData.wallet = data;
        
        if (appState.walletView === 'bank-selection') {
            renderBankSelection(data);
        } else {
            applyFiltersAndRender('wallet', data);
        }
    }
}

/**
 * Applies filters and renders the list
 */
function applyFiltersAndRender(tab, data) {
    const filtered = filterAndSort(
        data,
        tab,
        appState.searchTerms[tab],
        appState.filters[tab],
        appState.sortBy[tab]
    );

    if (tab === 'stocks') {
        renderStockList(filtered, 'stock-list', 'stock-empty');
    } else if (tab === 'mfs') {
        renderMFList(filtered);
    } else {
        renderWalletList(filtered, appState.selectedBank);
    }
}

/**
 * Opens stock/MF detail view
 * @param {string} id - Stock/MF document ID
 * @param {boolean} pushHistory - Whether to update browser history
 */
window.openStockDetail = async function(id, pushHistory = true) {
    let stockData, historyData;
    const isMf = appState.currentTab === 'mfs';
    if(!isMf) {
        const stocks = await loadStocks();
        stockData = stocks.find(s => s.id === id);
        historyData = await getStockHistory(id);
    } else {
        const mfs = await loadMFs();
        stockData = mfs.find(s => s.id === id);
        historyData = await getMFHistory(id);
    }
    if(!stockData) return;
    renderStockDetailView(stockData, historyData);
    document.getElementById(`view-${appState.currentTab}`).classList.add('hidden-view');
    document.getElementById('view-detail').classList.remove('hidden-view');
    document.getElementById('page-title').innerText = "Details";
    document.getElementById('fab-container').classList.add('hidden-view');
    document.getElementById('bottom-nav').classList.add('hidden-view');
    document.getElementById('btn-menu').classList.add('hidden-view');
    document.getElementById('btn-back').classList.remove('hidden-view');
    if (pushHistory) {
        const type = isMf ? 'mf' : 'stock';
        history.pushState({ view: 'detail', id: id, type: type }, "", `/details/${type}/${id}`);
    }
}

/**
 * Opens wallet category detail view
 * @param {string} id - Category document ID
 * @param {string} name - Category name
 * @param {boolean} pushHistory - Whether to update browser history
 */
window.openWalletDetail = async function(id, name, pushHistory = true) {
    appState.activeCatId = id;
    appState.activeCatName = name;
    const historyData = await getWalletCategoryHistory(id);
    renderWalletDetailView(name, historyData, id);
    document.getElementById('view-wallet').classList.add('hidden-view');
    document.getElementById('view-detail').classList.remove('hidden-view');
    document.getElementById('page-title').innerText = name;
    document.getElementById('fab-text').innerText = "ADD TRANSACTION";
    document.getElementById('fab-container').classList.remove('hidden-view');
    document.getElementById('bottom-nav').classList.add('hidden-view');
    document.getElementById('btn-menu').classList.add('hidden-view');
    document.getElementById('btn-back').classList.remove('hidden-view');
    if (pushHistory) {
        history.pushState({ view: 'detail', id: id, name: name, type: 'wallet' }, "", `/details/wallet/${id}/${encodeURIComponent(name)}`);
    }
}

/**
 * Opens type selector modal for reports/backup/restore
 * @param {string} action - Action type ('report', 'backup', 'restore')
 */
window.openTypeSelector = function(action) {
    appState.actionType = action;
    const titleMap = { 'report': 'Download Report', 'backup': 'Backup Data', 'restore': 'Restore Data' };
    document.getElementById('selector-title').innerText = titleMap[action];
    
    // Reset file input for restore
    if(action === 'restore') {
        document.getElementById('importInput').value = '';
    }
    
    window.openModal('modal-type-selector');
}

/**
 * Handles type selection from modal
 * @param {string} type - Selected type ('stocks', 'mfs', 'wallet')
 */
window.selectType = function(type) {
    window.closeModal('modal-type-selector');
    
    if (appState.actionType === 'report') {
        generateReport(type);
    } else if (appState.actionType === 'backup') {
        exportData(type);
    } else if (appState.actionType === 'restore') {
        // Trigger file input
        const fileInput = document.getElementById('importInput');
        fileInput.setAttribute('data-target-type', type); // Store target type
        fileInput.click();
    }
}

/**
 * Handles file import for restore
 * @param {HTMLInputElement} input - File input element
 */
window.handleImportFile = function(input) {
    const file = input.files[0];
    const targetType = input.getAttribute('data-target-type');
    if(file && targetType) {
        importData(file, targetType);
    }
}

/**
 * Prepares transaction edit modal with existing data
 * @param {string} id - Transaction ID
 * @param {string} dataStr - Encoded transaction data
 */
window.prepEditTx = function(id, dataStr) {
    const data = JSON.parse(decodeURIComponent(dataStr));
    appState.editingTxId = id;
    
    if (appState.currentTab === 'wallet') {
        document.getElementById('txAmount').value = data.amount;
        document.getElementById('txDate').value = data.date;
        document.getElementById('txNotes').value = data.notes || '';
        const radios = document.getElementsByName('txType');
        for(let r of radios) { if(r.value === data.type) r.checked = true; }
        
        // Hide Category Select during Edit
        document.getElementById('cat-select-container').classList.add('hidden-view');
        
        // Change Button Text
        const btn = document.querySelector('#modal-wallet-tx .btn-save');
        btn.innerText = "Update";
        btn.onclick = window.saveWalletTxEdit;
        window.openModal('modal-wallet-tx');
        
    } else {
        // Stocks/MF
        document.getElementById('invName').value = "LOCKED";
        document.getElementById('invName').readOnly = true;
        document.getElementById('invPrice').value = data.price;
        document.getElementById('invQty').value = data.qty;
        document.getElementById('invDate').value = data.date;
        document.getElementById('invNotes').value = data.notes || '';
        window.setInvType(data.type);
        
        const btn = document.querySelector('#modal-investment .btn-save');
        btn.innerText = "Update";
        btn.onclick = window.saveInvestmentEdit;
        window.openModal('modal-investment');
    }
}

/**
 * Saves edited investment transaction
 */
window.saveInvestmentEdit = async function() {
    const price = parseFloat(document.getElementById('invPrice').value);
    const qty = parseFloat(document.getElementById('invQty').value);
    const date = document.getElementById('invDate').value;
    const notes = document.getElementById('invNotes').value.trim();
    
    if (!price || price <= 0) {
        showNotification("Please enter a valid price", "error");
        return;
    }
    if (!qty || qty <= 0 || !Number.isInteger(Number(qty))) {
        showNotification("Please enter a valid quantity", "error");
        return;
    }
    if (!date) {
        showNotification("Please select a date", "error");
        return;
    }
    
    const btn = document.querySelector('#modal-investment .btn-save');
    const txData = { price, qty, date, type: appState.currentInvType };
    if (notes) txData.notes = notes;
    
    const pathParts = window.location.pathname.split('/');
    const parentId = pathParts[3];
    
    setButtonLoading(btn, "Updating...");
    
    try {
        const success = (appState.currentTab === 'stocks') 
            ? await updateStockTransaction(parentId, appState.editingTxId, txData)
            : await updateMFTransaction(parentId, appState.editingTxId, txData);
        
        if (success) {
            showNotification("Transaction Updated", "success");
            window.closeModal('modal-investment');
            window.openStockDetail(parentId, false);
        } else {
            showNotification("Update Failed", "error");
        }
    } catch (error) {
        console.error("Update error:", error);
        showNotification("An error occurred. Please try again.", "error");
    } finally {
        removeButtonLoading(btn);
    }
}

/**
 * Saves edited wallet transaction
 */
window.saveWalletTxEdit = async function() {
    const amount = parseFloat(document.getElementById('txAmount').value);
    const date = document.getElementById('txDate').value;
    const type = document.querySelector('input[name="txType"]:checked').value;
    const notes = document.getElementById('txNotes').value.trim();
    
    if (!amount || amount <= 0) {
        showNotification("Please enter a valid amount", "error");
        return;
    }
    if (!date) {
        showNotification("Please select a date", "error");
        return;
    }
    
    const btn = document.querySelector('#modal-wallet-tx .btn-save');
    setButtonLoading(btn, "Updating...");
    
    try {
        const txData = { amount, date, type };
        if (notes) txData.notes = notes;
        
        const success = await updateWalletTransaction(appState.activeCatId, appState.editingTxId, txData);
        if (success) {
            showNotification("Transaction Updated", "success");
            window.closeModal('modal-wallet-tx');
            window.openWalletDetail(appState.activeCatId, appState.activeCatName, false);
        } else {
            showNotification("Update Failed", "error");
        }
    } catch (error) {
        console.error("Update error:", error);
        showNotification("An error occurred. Please try again.", "error");
    } finally {
        removeButtonLoading(btn);
    }
}

function validateInvestmentForm() {
    const ticker = document.getElementById('invName').value.trim().toUpperCase();
    const price = parseFloat(document.getElementById('invPrice').value);
    const qty = parseFloat(document.getElementById('invQty').value);
    const date = document.getElementById('invDate').value;
    
    if (!ticker || ticker.length < 1) {
        showNotification("Please enter a valid ticker/name", "error");
        return false;
    }
    if (!price || price <= 0) {
        showNotification("Please enter a valid price (greater than 0)", "error");
        return false;
    }
    if (!qty || qty <= 0 || !Number.isInteger(Number(qty))) {
        showNotification("Please enter a valid quantity (whole number greater than 0)", "error");
        return false;
    }
    if (!date) {
        showNotification("Please select a date and time", "error");
        return false;
    }
    return true;
}

window.saveInvestment = async function() {
    if (!validateInvestmentForm()) return;
    
    const btn = document.querySelector('#modal-investment .btn-save');
    const ticker = document.getElementById('invName').value.trim().toUpperCase();
    const price = parseFloat(document.getElementById('invPrice').value);
    const qty = parseFloat(document.getElementById('invQty').value);
    const date = document.getElementById('invDate').value;
    const notes = document.getElementById('invNotes').value.trim();
    
    setButtonLoading(btn, "Saving...");
    
    try {
        const txData = { type: appState.currentInvType, qty, price, date };
        if (notes) txData.notes = notes;
        
        const success = (appState.currentTab === 'stocks') 
            ? await saveStockTransaction(ticker, txData) 
            : await saveMFTransaction(ticker, txData);
        
        if (success) {
            showNotification("✓ Transaction Recorded!", "success");
            window.closeModal('modal-investment');
            document.getElementById('invNotes').value = ''; 
            
            await loadDataForTab(appState.currentTab);
            const isDetailOpen = !document.getElementById('view-detail').classList.contains('hidden-view');
            if (isDetailOpen) {
                const pathParts = window.location.pathname.split('/'); 
                const currentId = pathParts[3]; 
                if (currentId) {
                    await window.openStockDetail(currentId, false);
                }
            }
        } else {
            showNotification("Failed to save. Please try again.", "error");
        }
    } catch (error) {
        console.error("Save error:", error);
        showNotification("An error occurred. Please try again.", "error");
    } finally {
        removeButtonLoading(btn);
    }
}

window.deleteStockTx = async function(stockId, txId) {
    let success = (appState.currentTab === 'stocks') ? await deleteStockTransaction(stockId, txId) : await deleteMFTransaction(stockId, txId);
    if(success) {
        showNotification("Deleted", "success");
        window.openStockDetail(stockId, false);
    } else { showNotification("Failed", "error"); }
}

window.saveWalletCategory = async function() {
    const name = document.getElementById('catName').value.trim();
    if (!name || name.length < 1) {
        showNotification("Please enter an account name", "error");
        return;
    }
    
    const btn = document.querySelector('#modal-wallet-cat .btn-save');
    setButtonLoading(btn, "Creating...");
    
    try {
        const success = await createWalletCategory(name, appState.selectedBank);
        if (success) {
            showNotification("Account Created", "success");
            window.closeModal('modal-wallet-cat');
            await loadDataForTab('wallet');
        } else {
            showNotification("Account name already exists or error occurred", "error");
        }
    } catch (error) {
        console.error("Create error:", error);
        showNotification("An error occurred. Please try again.", "error");
    } finally {
        removeButtonLoading(btn);
    }
}

// Bank Account Functions
async function renderBankSelection(categories) {
    if (appState.isRenderingBanks) return;
    appState.isRenderingBanks = true;
    
    document.getElementById('wallet-bank-selection').classList.remove('hidden-view');
    document.getElementById('wallet-categories-view').classList.add('hidden-view');
    
    const banks = [...new Set(categories.map(c => c.bankAccount || "General"))];
    const container = document.getElementById('bank-accounts-list');
    const emptyState = document.getElementById('bank-empty');
    
    if (banks.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden-view');
        appState.isRenderingBanks = false;
        return;
    }
    
    emptyState.classList.add('hidden-view');
    
    const bankElements = [];
    for (const bank of banks) {
        const bankCategories = categories.filter(c => (c.bankAccount || "General") === bank);
        const categoriesBalance = bankCategories.reduce((sum, c) => sum + (parseFloat(c.netBalance) || 0), 0);
        
        const deposits = await getBankDeposits(bank);
        const depositsTotal = deposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
        
        const totalBalance = depositsTotal + categoriesBalance;
        const balanceColor = totalBalance >= 0 ? 'var(--profit)' : 'var(--loss)';
        
        const div = document.createElement('div');
        div.className = 'list-item-row';
        div.innerHTML = `
            <div class="item-left" onclick="window.selectBankAccount('${bank}')" style="flex:1; cursor:pointer;">
                <p class="item-name">🏦 ${bank}</p>
                <p class="item-sub">${bankCategories.length} categories • <span style="color:var(--profit)">${formatCurrency(depositsTotal)}</span> deposited</p>
            </div>
            <div class="item-right" style="display:flex; align-items:center; gap:1rem;">
                <div style="text-align:right;" onclick="window.selectBankAccount('${bank}')" style="cursor:pointer;">
                    <p class="item-price" style="color:${balanceColor}">${formatCurrency(totalBalance)}</p>
                </div>
                <button onclick="window.openEditBankModal('${bank}')" class="btn-icon-sm text-neutral" style="flex-shrink:0;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
            </div>
        `;
        bankElements.push(div);
    }
    
    container.innerHTML = '';
    bankElements.forEach(el => container.appendChild(el));
    appState.isRenderingBanks = false;
}

window.selectBankAccount = function(bankName) {
    appState.selectedBank = bankName;
    appState.walletView = 'categories';
    document.getElementById('wallet-bank-selection').classList.add('hidden-view');
    document.getElementById('wallet-categories-view').classList.remove('hidden-view');
    document.getElementById('selected-bank-display').innerText = `🏦 ${bankName}`;
    document.getElementById('fab-text').innerText = 'ADD CATEGORY';
    document.getElementById('wallet-list').innerHTML = '';
    loadDataForTab('wallet');
}

window.backToBankSelection = function() {
    appState.walletView = 'bank-selection';
    appState.selectedBank = null;
    loadDataForTab('wallet');
}

window.openAddBankModal = function() {
    document.getElementById('bankName').value = '';
    window.openModal('modal-add-bank');
}

window.saveBankAccount = async function() {
    const bankName = document.getElementById('bankName').value.trim();
    if (!bankName || bankName.length < 1) {
        showNotification("Please enter a bank name", "error");
        return;
    }
    
    const btn = document.querySelector('#modal-add-bank .btn-save');
    setButtonLoading(btn, "Adding...");
    
    try {
        // Create a placeholder category to make the bank visible
        const success = await createWalletCategory("General", bankName);
        if (success) {
            showNotification(`Bank "${bankName}" added successfully!`, "success");
            window.closeModal('modal-add-bank');
            await loadDataForTab('wallet');
        } else {
            showNotification("Failed to add bank. Please try again.", "error");
        }
    } catch (error) {
        console.error("Add bank error:", error);
        showNotification("An error occurred. Please try again.", "error");
    } finally {
        removeButtonLoading(btn);
    }
}

window.openEditBankModal = function(bankName) {
    appState.editingBankName = bankName;
    document.getElementById('editBankName').value = bankName;
    window.openModal('modal-edit-bank');
}

window.updateBankAccount = async function() {
    const newBankName = document.getElementById('editBankName').value.trim();
    if (!newBankName || newBankName.length < 1) {
        showNotification("Please enter a bank name", "error");
        return;
    }
    
    const oldBankName = appState.editingBankName;
    const categories = appState.originalData.wallet;
    
    for (const cat of categories) {
        if ((cat.bankAccount || "General") === oldBankName) {
            await updateDoc(doc(db, "wallet_categories", cat.id), {
                bankAccount: newBankName
            });
        }
    }
    
    showNotification("Bank updated successfully", "success");
    window.closeModal('modal-edit-bank');
    await loadDataForTab('wallet');
}

window.deleteBankAccount = async function() {
    const bankName = appState.editingBankName;
    const categories = appState.originalData.wallet.filter(c => (c.bankAccount || "General") === bankName);
    
    const confirmed = await showConfirm(
        `Delete bank "${bankName}" and all its ${categories.length} categories?`,
        "Confirm Delete"
    );
    
    if (!confirmed) return;
    
    const btn = document.querySelector('#modal-edit-bank .btn-delete');
    setButtonLoading(btn, "Deleting...");
    
    try {
        // Delete all categories under this bank
        for (const cat of categories) {
            await deleteWalletCategory(cat.id);
        }
        
        showNotification("Bank and all categories deleted successfully", "success");
        window.closeModal('modal-edit-bank');
        await loadDataForTab('wallet');
    } catch (error) {
        console.error("Delete bank error:", error);
        showNotification("An error occurred. Please try again.", "error");
    } finally {
        removeButtonLoading(btn);
    }
}

// Bank Deposit Functions
window.openBankDeposit = async function() {
    const deposits = await getBankDeposits(appState.selectedBank);
    const totalDeposits = deposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    
    document.getElementById('total-deposits').innerText = formatCurrency(totalDeposits);
    
    const container = document.getElementById('deposits-list');
    container.innerHTML = '';
    
    if (deposits.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem;">No deposits yet</p>';
    } else {
        deposits.forEach(deposit => {
            const div = document.createElement('div');
            div.style.cssText = 'padding:0.75rem; background:var(--bg-body); border-radius:0.5rem; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;';
            div.innerHTML = `
                <div style="flex:1;">
                    <p style="margin:0; font-weight:600; color:var(--profit);">${formatCurrency(deposit.amount)}</p>
                    <p style="margin:0.25rem 0 0 0; font-size:0.75rem; color:var(--text-muted);">${formatDateTime(deposit.date)}</p>
                    ${deposit.notes ? `<p style="margin:0.25rem 0 0 0; font-size:0.75rem; color:var(--text-muted); font-style:italic;">${deposit.notes}</p>` : ''}
                </div>
                <button onclick="window.openEditDeposit('${deposit.id}', ${deposit.amount}, '${deposit.date}', '${(deposit.notes || '').replace(/'/g, "\\'")}')
" class="btn-icon-sm text-neutral">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
            `;
            container.appendChild(div);
        });
    }
    
    window.openModal('modal-bank-deposit');
}

window.openAddDeposit = function() {
    window.closeModal('modal-bank-deposit');
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositDate').value = getLocalISOString();
    document.getElementById('depositNotes').value = '';
    window.openModal('modal-add-deposit');
}

window.saveDeposit = async function() {
    const amount = parseFloat(document.getElementById('depositAmount').value);
    const date = document.getElementById('depositDate').value;
    const notes = document.getElementById('depositNotes').value.trim();
    
    if (!amount || amount <= 0) {
        showNotification("Please enter a valid amount", "error");
        return;
    }
    if (!date) {
        showNotification("Please select a date", "error");
        return;
    }
    
    const btn = document.querySelector('#modal-add-deposit .btn-save');
    setButtonLoading(btn, "Saving...");
    
    try {
        const success = await addBankDeposit(appState.selectedBank, amount, date, notes);
        if (success) {
            showNotification("Deposit added successfully", "success");
            window.closeModal('modal-add-deposit');
            await loadDataForTab('wallet');
            window.openBankDeposit();
        } else {
            showNotification("Failed to add deposit", "error");
        }
    } catch (error) {
        console.error("Save deposit error:", error);
        showNotification("An error occurred. Please try again.", "error");
    } finally {
        removeButtonLoading(btn);
    }
}

window.openEditDeposit = function(id, amount, date, notes) {
    appState.editingDepositId = id;
    document.getElementById('editDepositAmount').value = amount;
    document.getElementById('editDepositDate').value = date;
    document.getElementById('editDepositNotes').value = notes;
    window.closeModal('modal-bank-deposit');
    window.openModal('modal-edit-deposit');
}

window.updateDeposit = async function() {
    const amount = parseFloat(document.getElementById('editDepositAmount').value);
    const date = document.getElementById('editDepositDate').value;
    const notes = document.getElementById('editDepositNotes').value.trim();
    
    if (!amount || amount <= 0) {
        showNotification("Please enter a valid amount", "error");
        return;
    }
    if (!date) {
        showNotification("Please select a date", "error");
        return;
    }
    
    const btn = document.querySelector('#modal-edit-deposit .btn-save');
    setButtonLoading(btn, "Updating...");
    
    try {
        const success = await updateBankDeposit(appState.editingDepositId, amount, date, notes);
        if (success) {
            showNotification("Deposit updated successfully", "success");
            window.closeModal('modal-edit-deposit');
            await loadDataForTab('wallet');
            window.openBankDeposit();
        } else {
            showNotification("Failed to update deposit", "error");
        }
    } catch (error) {
        console.error("Update deposit error:", error);
        showNotification("An error occurred. Please try again.", "error");
    } finally {
        removeButtonLoading(btn);
    }
}

window.deleteDeposit = async function() {
    const confirmed = await showConfirm("Delete this deposit?", "Confirm Delete");
    if (!confirmed) return;
    
    const btn = document.querySelector('#modal-edit-deposit .btn-delete');
    setButtonLoading(btn, "Deleting...");
    
    try {
        const success = await deleteBankDeposit(appState.editingDepositId);
        if (success) {
            showNotification("Deposit deleted successfully", "success");
            window.closeModal('modal-edit-deposit');
            await loadDataForTab('wallet');
            window.openBankDeposit();
        } else {
            showNotification("Failed to delete deposit", "error");
        }
    } catch (error) {
        console.error("Delete deposit error:", error);
        showNotification("An error occurred. Please try again.", "error");
    } finally {
        removeButtonLoading(btn);
    }
}

// --- NEW QUICK DEPOSIT LOGIC ---
window.openQuickDeposit = async function() {
    const categories = await loadWalletCategories(); 
    if (!categories || categories.length === 0) {
        showNotification("Please create an account first", "error");
        document.getElementById('catName').value = '';
        window.openModal('modal-wallet-cat');
        return;
    }

    const select = document.getElementById('txCategory');
    select.innerHTML = '';
    categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = c.name;
        select.appendChild(opt);
    });

    document.getElementById('cat-select-container').classList.remove('hidden-view');

    document.getElementById('txAmount').value = '';
    document.getElementById('txDate').value = getLocalISOString();
    document.getElementById('txNotes').value = '';
    
    appState.activeCatId = null;
    
    const btn = document.querySelector('#modal-wallet-tx .btn-save');
    btn.innerText = "Save";
    btn.onclick = window.saveWalletTx;

    window.openModal('modal-wallet-tx');
}

window.saveWalletTx = async function() {
    let targetCatId = appState.activeCatId;
    
    if (!targetCatId) {
        const select = document.getElementById('txCategory');
        if (select) targetCatId = select.value;
    }
    
    if (!targetCatId) {
        showNotification("Please select a wallet account", "error");
        return;
    }

    const amount = parseFloat(document.getElementById('txAmount').value);
    const date = document.getElementById('txDate').value;
    const type = document.querySelector('input[name="txType"]:checked').value;
    const notes = document.getElementById('txNotes').value.trim();
    
    if (!amount || amount <= 0) {
        showNotification("Please enter a valid amount", "error");
        return;
    }
    if (!date) {
        showNotification("Please select a date", "error");
        return;
    }
    
    const btn = document.querySelector('#modal-wallet-tx .btn-save');
    setButtonLoading(btn, "Saving...");
    
    try {
        const txData = { amount, date, type };
        if (notes) txData.notes = notes;
        
        const success = await addWalletTransaction(targetCatId, txData);
        if (success) {
            showNotification("Transaction Saved", "success");
            window.closeModal('modal-wallet-tx');
            document.getElementById('txNotes').value = ''; 
            
            await loadDataForTab('wallet');
            if (appState.activeCatId) {
                await window.openWalletDetail(appState.activeCatId, appState.activeCatName, false);
            }
        } else {
            showNotification("Failed to save. Please try again.", "error");
        }
    } catch (error) {
        console.error("Save error:", error);
        showNotification("An error occurred. Please try again.", "error");
    } finally {
        removeButtonLoading(btn);
    }
}

window.deleteWalletTx = async function(catId, txId) {
    if(await deleteWalletTransaction(catId, txId)) {
        showNotification("Deleted", "success");
        window.openWalletDetail(catId, appState.activeCatName, false);
    }
}

window.openFabAction = function() {
    if (appState.currentTab === 'wallet') {
        if (appState.walletView === 'bank-selection') {
            // Add new bank
            window.openAddBankModal();
        } else {
            const isDetail = !document.getElementById('view-detail').classList.contains('hidden-view');
            if (isDetail) {
                // Add transaction
                document.getElementById('txAmount').value = '';
                document.getElementById('txDate').value = getLocalISOString();
                document.getElementById('txNotes').value = '';
                document.getElementById('cat-select-container').classList.add('hidden-view');
                const btn = document.querySelector('#modal-wallet-tx .btn-save');
                btn.innerText = "Save";
                btn.onclick = window.saveWalletTx;
                window.openModal('modal-wallet-tx');
            } else {
                // Add category
                document.getElementById('catName').value = '';
                window.openModal('modal-wallet-cat');
            }
        }
    } else {
        document.getElementById('invName').value = '';
        document.getElementById('invName').readOnly = false;
        document.getElementById('invPrice').value = '';
        document.getElementById('invQty').value = '';
        document.getElementById('invDate').value = getLocalISOString();
        document.getElementById('invNotes').value = '';
        window.setInvType('BUY');
        const btn = document.querySelector('#modal-investment .btn-save');
        btn.innerText = "Save";
        btn.onclick = window.saveInvestment;
        window.openModal('modal-investment');
    }
}

window.openStockDetailAdd = function(ticker, type) {
    document.getElementById('invName').value = ticker;
    document.getElementById('invName').readOnly = true; 
    document.getElementById('invPrice').value = '';
    document.getElementById('invQty').value = '';
    document.getElementById('invDate').value = getLocalISOString();
    document.getElementById('invNotes').value = '';
    window.setInvType(type);
    
    const btn = document.querySelector('#modal-investment .btn-save');
    btn.innerText = "Save";
    btn.onclick = window.saveInvestment;
    
    window.openModal('modal-investment');
}

window.openStockEdit = function(id, ticker, qty, avg) {
    appState.editingStockId = id;
    document.getElementById('editTicker').value = ticker;
    document.getElementById('editQty').value = qty;
    document.getElementById('editAvg').value = avg;
    window.openModal('modal-stock-edit');
}

window.saveStockEdit = async function() {
    const id = appState.editingStockId;
    const name = document.getElementById('editTicker').value.trim().toUpperCase();
    const qty = parseFloat(document.getElementById('editQty').value);
    const avg = parseFloat(document.getElementById('editAvg').value);
    
    if (!name || name.length < 1) {
        showNotification("Please enter a valid name", "error");
        return;
    }
    if (!qty || qty < 0 || !Number.isInteger(Number(qty))) {
        showNotification("Please enter a valid quantity", "error");
        return;
    }
    if (!avg || avg <= 0) {
        showNotification("Please enter a valid average price", "error");
        return;
    }
    
    const btn = document.querySelector('#modal-stock-edit .btn-save');
    setButtonLoading(btn, "Updating...");
    
    try {
        const success = (appState.currentTab === 'stocks') 
            ? await updateStock(id, name, qty, avg) 
            : await updateMF(id, name, qty, avg);
        
        if (success) {
            showNotification("Updated Successfully", "success");
            window.closeModal('modal-stock-edit');
            window.openStockDetail(id, false);
        } else {
            showNotification("Update Failed", "error");
        }
    } catch (error) {
        console.error("Update error:", error);
        showNotification("An error occurred. Please try again.", "error");
    } finally {
        removeButtonLoading(btn);
    }
}

window.triggerDeleteStock = async function() {
    if (!appState.editingStockId) return;
    let success = (appState.currentTab === 'stocks') ? await deleteStock(appState.editingStockId) : await deleteMF(appState.editingStockId);
    if(success) {
        showNotification("Item Deleted", "success");
        window.closeModal('modal-stock-edit');
        window.switchTab(appState.currentTab, true);
    }
}

window.openModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden-view');
        const firstInput = modal.querySelector('input, textarea, select');
        if (firstInput && !firstInput.readOnly) {
            setTimeout(() => firstInput.focus(), 100);
        }
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                window.closeModal(id);
                document.removeEventListener('keydown', handleKeyDown);
            } else if (e.key === 'Enter' && e.ctrlKey) {
                const saveBtn = modal.querySelector('.btn-save');
                if (saveBtn && !saveBtn.disabled) {
                    saveBtn.click();
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    }
};

window.closeModal = (id) => document.getElementById(id).classList.add('hidden-view');

window.setInvType = function(type) {
    appState.currentInvType = type;
    document.getElementById('btn-type-buy').classList.toggle('active', type === 'BUY');
    document.getElementById('btn-type-sell').classList.toggle('active', type === 'SELL');
}

window.openSidebar = () => {
    document.getElementById('side-menu').classList.add('menu-open');
    document.getElementById('menu-overlay').classList.add('menu-open');
}

window.closeSidebar = () => {
    document.getElementById('side-menu').classList.remove('menu-open');
    document.getElementById('menu-overlay').classList.remove('menu-open');
}

function initSearchHandlers() {
    ['stocks', 'mfs', 'wallet'].forEach(tab => {
        const searchInput = document.getElementById(`search-${tab}`);
        if (searchInput) {
            const debouncedSearch = debounce((value) => {
                appState.searchTerms[tab] = value;
                const clearBtn = document.getElementById(`clear-search-${tab}`);
                if (value) {
                    clearBtn?.classList.remove('hidden-view');
                } else {
                    clearBtn?.classList.add('hidden-view');
                }
                applyFiltersAndRender(tab, appState.originalData[tab]);
            }, 300);

            searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });
        }
    });
}

window.setFilter = function(tab, filterType) {
    appState.filters[tab] = filterType;
    const container = document.querySelector(`#view-${tab} .filter-buttons`);
    if (container) {
        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filterType);
        });
    }
    applyFiltersAndRender(tab, appState.originalData[tab]);
}

window.toggleSortMenu = function(tab) {
    const menu = document.getElementById(`sort-menu-${tab}`);
    if (menu) {
        document.querySelectorAll('.sort-menu').forEach(m => {
            if (m.id !== `sort-menu-${tab}`) m.classList.add('hidden-view');
        });
        menu.classList.toggle('hidden-view');
    }
}

window.setSort = function(tab, sortBy) {
    appState.sortBy[tab] = sortBy;
    const label = document.getElementById(`sort-label-${tab}`);
    const labels = {
        name: 'Name',
        value: 'Value',
        pnl: 'P&L',
        pnlPercent: 'P&L %',
        balance: 'Balance',
        date: 'Date'
    };
    if (label) label.textContent = `Sort: ${labels[sortBy] || sortBy}`;
    const menu = document.getElementById(`sort-menu-${tab}`);
    if (menu) menu.classList.add('hidden-view');
    applyFiltersAndRender(tab, appState.originalData[tab]);
}

window.clearSearch = function(tab) {
    const searchInput = document.getElementById(`search-${tab}`);
    const clearBtn = document.getElementById(`clear-search-${tab}`);
    if (searchInput) {
        searchInput.value = '';
        appState.searchTerms[tab] = '';
        clearBtn?.classList.add('hidden-view');
        applyFiltersAndRender(tab, appState.originalData[tab]);
    }
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.sort-dropdown')) {
        document.querySelectorAll('.sort-menu').forEach(menu => {
            menu.classList.add('hidden-view');
        });
    }
});

window.openPortfolioGraph = async function() {
    ['stocks', 'mfs', 'wallet', 'detail'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) {
            el.classList.add('hidden-view');
            el.classList.remove('active-view');
        }
    });
    const graphView = document.getElementById('view-graph');
    if (graphView) {
        graphView.classList.remove('hidden-view');
        graphView.classList.add('active-view');
    }
    document.getElementById('page-title').innerText = 'Portfolio Graph';
    document.getElementById('fab-container').classList.add('hidden-view');
    document.getElementById('bottom-nav').classList.add('hidden-view');
    document.getElementById('btn-menu').classList.add('hidden-view');
    document.getElementById('btn-back').classList.remove('hidden-view');
    await updateGraph('1m');
};

window.setTimeRange = async function(range) {
    await updateGraph(range);
};

// --- STICKY BACK BUTTON FIX ---
// This ensures that when in Detail View, clicking back returns to the current tab's list
// regardless of browser history state.
const originalBackClick = document.getElementById('btn-back')?.onclick;
document.getElementById('btn-back')?.addEventListener('click', function(e) {
    e.preventDefault(); // Take full control
    const graphView = document.getElementById('view-graph');
    const detailView = document.getElementById('view-detail');

    if (graphView && !graphView.classList.contains('hidden-view')) {
        window.switchTab('stocks', true);
        destroyGraph();
    } 
    else if (detailView && !detailView.classList.contains('hidden-view')) {
        // Check if we're in wallet and coming from categories view
        if (appState.currentTab === 'wallet' && appState.selectedBank) {
            // Going back from category detail to bank selection
            e.stopPropagation();
            appState.walletView = 'bank-selection';
            appState.selectedBank = null;
            appState.activeCatId = null;
            appState.activeCatName = null;
            document.getElementById('view-detail').classList.add('hidden-view');
            document.getElementById('view-wallet').classList.remove('hidden-view');
            document.getElementById('page-title').innerText = 'Wallet';
            document.getElementById('fab-text').innerText = 'ADD BANK';
            document.getElementById('fab-container').classList.remove('hidden-view');
            document.getElementById('bottom-nav').classList.remove('hidden-view');
            document.getElementById('btn-menu').classList.remove('hidden-view');
            document.getElementById('btn-back').classList.add('hidden-view');
            
            // Clear container before loading to prevent duplicates
            const container = document.getElementById('bank-accounts-list');
            if (container) container.innerHTML = '';
            
            loadDataForTab('wallet');
            return; // Prevent further execution
        } else if (appState.currentTab === 'wallet') {
            // If in wallet but no selected bank, stay in wallet
            e.stopPropagation();
            return;
        } else {
            // Force navigation to the list view of the CURRENT tab (stocks/mfs)
            const target = appState.currentTab || 'stocks';
            window.switchTab(target, true);
        }
    } 
    else {
        history.back();
    }
});


// --- UPDATE CURRENT PRICE LOGIC ---
window.openUpdatePriceModal = function(stockId, currentPrice) {
    appState.editingStockId = stockId;
    document.getElementById('updatePriceInput').value = currentPrice || '';
    window.openModal('modal-update-price');
};

window.saveCurrentPrice = async function() {
    const price = parseFloat(document.getElementById('updatePriceInput').value);
    
    if (!price || price <= 0) {
        showNotification("Please enter a valid price", "error");
        return;
    }
    
    const btn = document.querySelector('#modal-update-price .btn-save');
    setButtonLoading(btn, "Updating...");
    
    try {
        const isMf = appState.currentTab === 'mfs';
        const { updateStockPrice } = await import('./services/stock-service.js');
        const { updateMFPrice } = await import('./services/mf-service.js');
        
        const success = isMf 
            ? await updateMFPrice(appState.editingStockId, price)
            : await updateStockPrice(appState.editingStockId, price);
        
        if (success) {
            showNotification("Price updated successfully", "success");
            window.closeModal('modal-update-price');
            await window.openStockDetail(appState.editingStockId, false);
        } else {
            showNotification("Failed to update price", "error");
        }
    } catch (error) {
        console.error("Update price error:", error);
        showNotification("An error occurred. Please try again.", "error");
    } finally {
        removeButtonLoading(btn);
    }
};
