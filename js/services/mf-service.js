/**
 * Mutual Fund Service
 * Handles all Firestore operations for mutual fund portfolio
 */

import { db } from "../firebase-config.js";
import { 
    collection, doc, getDocs, getDoc, setDoc, updateDoc, runTransaction, deleteDoc, writeBatch, serverTimestamp, query, where, addDoc, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { calculateNewAverage, calculateSellImpact, safeNum, recalculateFromHistory } from "../logic-core.js";
import { showConfirm } from "../ui/confirm-modal.js";

const COL_MFS = "portfolio_mfs";

export async function loadMFs() {
    try {
        const snapshot = await getDocs(collection(db, COL_MFS));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) { 
        console.error("Error loading mutual funds:", error); 
        return []; 
    }
}

// --- DEEP FETCH ---
export async function loadMFsDeep() {
    try {
        const mfs = await loadMFs();
        const deepData = [];
        for (const mf of mfs) {
            const historyRef = collection(doc(db, COL_MFS, mf.id), "transactions");
            const historySnap = await getDocs(historyRef);
            const history = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));
            deepData.push({ ...mf, history: history });
        }
        return deepData;
    } catch (error) { 
        console.error("Error loading mutual funds deep:", error); 
        return []; 
    }
}

// --- SMART MERGE ---
export async function mergeMFData(backupItems) {
    let restoredCount = 0;
    
    for (const item of backupItems) {
        const docRef = doc(db, COL_MFS, item.id);
        const docSnap = await getDoc(docRef);
        let isNew = false;

        if (!docSnap.exists()) {
            await setDoc(docRef, {
                ticker: item.ticker,
                qty: 0, avgPrice: 0, investedAmount: 0,
                lastUpdated: serverTimestamp()
            });
            isNew = true;
        }

        const historyRef = collection(docRef, "transactions");
        let dirty = false;

        for (const tx of item.history) {
            const txRef = doc(historyRef, tx.id);
            const txSnap = await getDoc(txRef);
            if (!txSnap.exists()) {
                await setDoc(txRef, { ...tx, timestamp: serverTimestamp() });
                dirty = true;
                restoredCount++;
            }
        }

        if (dirty || isNew) {
            const allTxSnap = await getDocs(historyRef);
            const allTx = allTxSnap.docs.map(d => d.data());
            const newStats = recalculateFromHistory(allTx);
            await updateDoc(docRef, {
                qty: newStats.qty,
                avgPrice: newStats.avgPrice,
                investedAmount: newStats.investedAmount,
                lastUpdated: serverTimestamp()
            });
        }
    }
    return restoredCount;
}

export async function getMFHistory(id) {
    try {
        const docRef = doc(db, COL_MFS, id);
        const historyRef = collection(docRef, "transactions");
        const q = query(historyRef, orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) { 
        console.error("Error loading mutual funds:", error); 
        return []; 
    }
}

export async function saveMFTransaction(ticker, txData) {
    const mfsRef = collection(db, COL_MFS);
    const q = query(mfsRef, where("ticker", "==", ticker));
    const snapshot = await getDocs(q);
    let docRef;
    let isNew = false;
    if (snapshot.empty) {
        isNew = true;
        docRef = await addDoc(mfsRef, { ticker: ticker });
    } else {
        docRef = snapshot.docs[0].ref;
    }
    const historyRef = collection(docRef, "transactions");
    try {
        await runTransaction(db, async (transaction) => {
            const newTxDoc = doc(historyRef);
            transaction.set(newTxDoc, { ...txData, timestamp: serverTimestamp() });
        });
        
        // Recalculate from full history
        const historySnapshot = await getDocs(historyRef);
        const allTx = historySnapshot.docs.map(d => d.data());
        const newStats = recalculateFromHistory(allTx);
        
        await updateDoc(docRef, {
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
        console.error("Error in MF service:", error); 
        return false; 
    }
}

export async function updateMFTransaction(stockId, txId, newTxData) {
    try {
        const stockRef = doc(db, COL_MFS, stockId);
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
        console.error("Error in MF service:", error); 
        return false; 
    }
}

export async function deleteMFTransaction(stockId, txId) {
    const confirmed = await showConfirm("Delete this transaction?", "Confirm Delete");
    if (!confirmed) return false;
    try {
        const stockRef = doc(db, COL_MFS, stockId);
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
        console.error("Error in MF service:", error); 
        return false; 
    }
}

export async function updateMF(id, newName, newQty, newAvg) {
    try {
        const docRef = doc(db, COL_MFS, id);
        await updateDoc(docRef, {
            ticker: newName, qty: safeNum(newQty), avgPrice: safeNum(newAvg),
            investedAmount: safeNum(newQty) * safeNum(newAvg), lastUpdated: serverTimestamp()
        });
        return true;
    } catch (error) { 
        console.error("Error in MF service:", error); 
        return false; 
    }
}

export async function deleteMF(id) {
    const confirmed = await showConfirm("Delete fund and all history?", "Confirm Delete");
    if (!confirmed) return false;
    try {
        const docRef = doc(db, COL_MFS, id);
        const historyRef = collection(docRef, "transactions");
        const snapshot = await getDocs(historyRef);
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        await deleteDoc(docRef);
        return true;
    } catch (error) { 
        console.error("Error in MF service:", error); 
        return false; 
    }
}

export async function updateMFPrice(id, newPrice) {
    try {
        const docRef = doc(db, COL_MFS, id);
        await updateDoc(docRef, {
            currentLTP: safeNum(newPrice),
            lastUpdated: serverTimestamp()
        });
        return true;
    } catch (error) { 
        console.error("Error updating MF price:", error); 
        return false; 
    }
}