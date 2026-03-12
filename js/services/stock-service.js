/**
 * Stock Service
 * Handles all Firestore operations for stock portfolio
 */

import { db } from "../firebase-config.js";
import { 
    collection, doc, getDocs, getDoc, setDoc, updateDoc, runTransaction, deleteDoc, writeBatch, serverTimestamp, query, where, addDoc, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { calculateNewAverage, calculateSellImpact, safeNum, recalculateFromHistory } from "../logic-core.js";
import { showConfirm } from "../ui/confirm-modal.js";

const COL_STOCKS = "portfolio_stocks";

/**
 * Loads all stocks from Firestore
 * @returns {Promise<Array>} Array of stock objects
 */
export async function loadStocks() {
    try {
        const snapshot = await getDocs(collection(db, COL_STOCKS));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) { 
        console.error("Error loading stocks:", error); 
        return []; 
    }
}

/**
 * Loads stocks with full transaction history (for backup)
 * @returns {Promise<Array>} Array of stocks with history
 */
export async function loadStocksDeep() {
    try {
        const stocks = await loadStocks();
        const deepData = [];
        
        for (const stock of stocks) {
            // Fetch History for each stock
            const historyRef = collection(doc(db, COL_STOCKS, stock.id), "transactions");
            const historySnap = await getDocs(historyRef);
            const history = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            deepData.push({ ...stock, history: history });
        }
        return deepData;
    } catch (error) { 
        console.error("Error loading stocks deep:", error); 
        return []; 
    }
}

// --- SMART MERGE (FOR RESTORE) ---
export async function mergeStockData(backupItems) {
    let restoredCount = 0;
    
    for (const item of backupItems) {
        const stockRef = doc(db, COL_STOCKS, item.id); // Use ID from backup
        const docSnap = await getDoc(stockRef);
        let isNewStock = false;

        // 1. Restore Parent (Only if missing)
        if (!docSnap.exists()) {
            await setDoc(stockRef, {
                ticker: item.ticker,
                qty: 0, avgPrice: 0, investedAmount: 0, // Will be recalc'd
                lastUpdated: serverTimestamp()
            });
            isNewStock = true;
        }

        // 2. Merge Transactions
        const historyRef = collection(stockRef, "transactions");
        let dirty = false;

        for (const tx of item.history) {
            const txRef = doc(historyRef, tx.id);
            const txSnap = await getDoc(txRef);
            
            // ONLY Insert if ID does not exist (Prevents overwriting edits)
            if (!txSnap.exists()) {
                await setDoc(txRef, {
                    ...tx,
                    // Parse timestamp string back to Date object if needed
                    timestamp: serverTimestamp() 
                });
                dirty = true;
                restoredCount++;
            }
        }

        // 3. Recalculate Math (If we touched anything)
        if (dirty || isNewStock) {
            const allTxSnap = await getDocs(historyRef);
            const allTx = allTxSnap.docs.map(d => d.data());
            const newStats = recalculateFromHistory(allTx);
            
            await updateDoc(stockRef, {
                qty: newStats.qty,
                avgPrice: newStats.avgPrice,
                investedAmount: newStats.investedAmount,
                lastUpdated: serverTimestamp()
            });
        }
    }
    return restoredCount;
}

export async function getStockHistory(id) {
    try {
        const stockRef = doc(db, COL_STOCKS, id);
        const historyRef = collection(stockRef, "transactions");
        const q = query(historyRef, orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) { 
        console.error("Error loading stock history:", error); 
        return []; 
    }
}

export async function saveStockTransaction(ticker, txData) {
    const stocksRef = collection(db, COL_STOCKS);
    const q = query(stocksRef, where("ticker", "==", ticker));
    const snapshot = await getDocs(q);
    
    let stockDocRef;
    let isNew = false;

    if (snapshot.empty) {
        isNew = true;
        stockDocRef = await addDoc(stocksRef, { ticker: ticker });
    } else {
        stockDocRef = snapshot.docs[0].ref;
    }

    const historyRef = collection(stockDocRef, "transactions");

    try {
        await runTransaction(db, async (transaction) => {
            const newTxDoc = doc(historyRef);
            transaction.set(newTxDoc, { ...txData, timestamp: serverTimestamp() });
        });
        
        // Recalculate from full history
        const historySnapshot = await getDocs(historyRef);
        const allTx = historySnapshot.docs.map(d => d.data());
        const newStats = recalculateFromHistory(allTx);
        
        await updateDoc(stockDocRef, {
            ticker: ticker,
            qty: newStats.qty,
            avgPrice: newStats.avgPrice,
            investedAmount: newStats.investedAmount,
            realizedPnL: newStats.realizedPnL,
            totalInvestedAmount: newStats.totalInvestedAmount,
            realizedReturnPercent: newStats.realizedReturnPercent,
            lastUpdated: serverTimestamp()
        });
        
        return true;
    } catch (error) { 
        console.error("Error saving stock transaction:", error); 
        return false; 
    }
}

export async function updateStockTransaction(stockId, txId, newTxData) {
    try {
        const stockRef = doc(db, COL_STOCKS, stockId);
        const txRef = doc(stockRef, "transactions", txId);
        await updateDoc(txRef, newTxData);
        const historySnapshot = await getDocs(collection(stockRef, "transactions"));
        const allTx = historySnapshot.docs.map(d => d.data());
        const newStats = recalculateFromHistory(allTx);
        await updateDoc(stockRef, {
            qty: newStats.qty,
            avgPrice: newStats.avgPrice,
            investedAmount: newStats.investedAmount,
            realizedPnL: newStats.realizedPnL || 0,
            totalInvestedAmount: newStats.totalInvestedAmount || 0,
            realizedReturnPercent: newStats.realizedReturnPercent || 0,
            lastUpdated: serverTimestamp()
        });
        return true;
    } catch (error) { 
        console.error("Error saving stock transaction:", error); 
        return false; 
    }
}

export async function deleteStockTransaction(stockId, txId) {
    const confirmed = await showConfirm("Delete this transaction?", "Confirm Delete");
    if (!confirmed) return false;
    try {
        const stockRef = doc(db, COL_STOCKS, stockId);
        const txRef = doc(stockRef, "transactions", txId);
        await deleteDoc(txRef);
        const historySnapshot = await getDocs(collection(stockRef, "transactions"));
        const remainingTx = historySnapshot.docs.map(d => d.data());
        const newStats = recalculateFromHistory(remainingTx);
        await updateDoc(stockRef, {
            qty: newStats.qty,
            avgPrice: newStats.avgPrice,
            investedAmount: newStats.investedAmount,
            realizedPnL: newStats.realizedPnL || 0,
            totalInvestedAmount: newStats.totalInvestedAmount || 0,
            realizedReturnPercent: newStats.realizedReturnPercent || 0
        });
        return true;
    } catch (error) { 
        console.error("Error saving stock transaction:", error); 
        return false; 
    }
}

export async function updateStock(id, newName, newQty, newAvg) {
    try {
        const stockRef = doc(db, COL_STOCKS, id);
        await updateDoc(stockRef, {
            ticker: newName, qty: safeNum(newQty), avgPrice: safeNum(newAvg),
            investedAmount: safeNum(newQty) * safeNum(newAvg), lastUpdated: serverTimestamp()
        });
        return true;
    } catch (error) { 
        console.error("Error saving stock transaction:", error); 
        return false; 
    }
}

export async function deleteStock(id) {
    const confirmed = await showConfirm("Delete stock and all history?", "Confirm Delete");
    if (!confirmed) return false;
    try {
        const stockRef = doc(db, COL_STOCKS, id);
        const historyRef = collection(stockRef, "transactions");
        const snapshot = await getDocs(historyRef);
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        await deleteDoc(stockRef);
        return true;
    } catch (error) { 
        console.error("Error saving stock transaction:", error); 
        return false; 
    }
}

export async function updateStockPrice(id, newPrice) {
    try {
        const stockRef = doc(db, COL_STOCKS, id);
        await updateDoc(stockRef, {
            currentLTP: safeNum(newPrice),
            lastUpdated: serverTimestamp()
        });
        return true;
    } catch (error) { 
        console.error("Error updating stock price:", error); 
        return false; 
    }
}