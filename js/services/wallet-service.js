/**
 * Wallet Service
 * Handles all Firestore operations for wallet categories and transactions
 */

import { db } from "../firebase-config.js";
import { 
    collection, getDocs, getDoc, setDoc, addDoc, deleteDoc, doc, updateDoc, query, orderBy, serverTimestamp, where, runTransaction 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showConfirm } from "../ui/confirm-modal.js";

const COL_WALLET_CATS = "wallet_categories";

// Export for use in main.js
export { updateDoc, doc, db };

export async function loadWalletCategories() {
    try {
        const q = query(collection(db, COL_WALLET_CATS), orderBy("lastUpdated", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) { 
        console.error("Error loading wallet categories:", error); 
        return []; 
    }
}

// --- DEEP FETCH ---
export async function loadWalletDeep() {
    try {
        const cats = await loadWalletCategories();
        const deepData = [];
        for (const cat of cats) {
            const historyRef = collection(doc(db, COL_WALLET_CATS, cat.id), "transactions");
            const historySnap = await getDocs(historyRef);
            const history = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));
            deepData.push({ ...cat, history: history });
        }
        return deepData;
    } catch (error) { 
        console.error("Error loading wallet deep:", error); 
        return []; 
    }
}

// --- SMART MERGE ---
export async function mergeWalletData(backupItems) {
    let restoredCount = 0;
    
    for (const item of backupItems) {
        const catRef = doc(db, COL_WALLET_CATS, item.id);
        const catSnap = await getDoc(catRef);
        let isNew = false;

        if (!catSnap.exists()) {
            await setDoc(catRef, {
                name: item.name,
                netBalance: 0, // Recalc later
                lastUpdated: serverTimestamp()
            });
            isNew = true;
        }

        const historyRef = collection(catRef, "transactions");
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

        // Recalculate Balance by summing all transactions
        if (dirty || isNew) {
            const allTxSnap = await getDocs(historyRef);
            let newBal = 0;
            allTxSnap.forEach(d => {
                const data = d.data();
                const amt = parseFloat(data.amount) || 0;
                if (data.type === 'debit') newBal -= amt;
                else newBal += amt;
            });
            
            await updateDoc(catRef, {
                netBalance: newBal,
                lastUpdated: serverTimestamp()
            });
        }
    }
    return restoredCount;
}

export async function getWalletCategoryHistory(categoryId) {
    try {
        const catRef = doc(db, COL_WALLET_CATS, categoryId);
        const historyRef = collection(catRef, "transactions");
        const q = query(historyRef, orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) { 
        console.error("Error loading wallet categories:", error); 
        return []; 
    }
}

export async function createWalletCategory(name, bankAccount = null) {
    const q = query(collection(db, COL_WALLET_CATS), where("name", "==", name));
    const snap = await getDocs(q);
    if (!snap.empty) return false; 
    try {
        await addDoc(collection(db, COL_WALLET_CATS), {
            name: name, 
            bankAccount: bankAccount || "General",
            netBalance: 0, 
            lastUpdated: serverTimestamp()
        });
        return true;
    } catch (error) { 
        console.error("Error in wallet service:", error); 
        return false; 
    }
}

export async function addWalletTransaction(categoryId, txData) {
    try {
        const catRef = doc(db, COL_WALLET_CATS, categoryId);
        const historyRef = collection(catRef, "transactions");
        await runTransaction(db, async (transaction) => {
            const catDoc = await transaction.get(catRef);
            if (!catDoc.exists()) throw "Category not found";
            const currentBal = catDoc.data().netBalance || 0;
            const amount = parseFloat(txData.amount);
            const impact = txData.type === 'debit' ? -amount : amount;
            const newBal = currentBal + impact;
            transaction.update(catRef, { netBalance: newBal, lastUpdated: serverTimestamp() });
            const newTxDoc = doc(historyRef);
            transaction.set(newTxDoc, { ...txData, timestamp: serverTimestamp() });
        });
        return true;
    } catch (error) { 
        console.error("Error in wallet service:", error); 
        return false; 
    }
}

export async function updateWalletTransaction(categoryId, txId, newTxData) {
    try {
        const catRef = doc(db, COL_WALLET_CATS, categoryId);
        const txRef = doc(catRef, "transactions", txId);
        await runTransaction(db, async (transaction) => {
            const txDoc = await transaction.get(txRef);
            if (!txDoc.exists()) throw "Tx not found";
            const oldTx = txDoc.data();
            const catDoc = await transaction.get(catRef);
            const currentBal = catDoc.data().netBalance || 0;
            const oldAmount = parseFloat(oldTx.amount);
            const oldReverse = oldTx.type === 'debit' ? oldAmount : -oldAmount;
            const newAmount = parseFloat(newTxData.amount);
            const newImpact = newTxData.type === 'debit' ? -newAmount : newAmount;
            const finalBal = currentBal + oldReverse + newImpact;
            transaction.update(catRef, { netBalance: finalBal, lastUpdated: serverTimestamp() });
            transaction.update(txRef, newTxData);
        });
        return true;
    } catch (error) { 
        console.error("Error in wallet service:", error); 
        return false; 
    }
}

export async function deleteWalletTransaction(categoryId, txId) {
    try {
        const catRef = doc(db, COL_WALLET_CATS, categoryId);
        const txRef = doc(catRef, "transactions", txId);
        await runTransaction(db, async (transaction) => {
            const txDoc = await transaction.get(txRef);
            if (!txDoc.exists()) throw "Tx not found";
            const txData = txDoc.data();
            const amount = parseFloat(txData.amount);
            const reverseImpact = txData.type === 'debit' ? amount : -amount;
            const catDoc = await transaction.get(catRef);
            const currentBal = catDoc.data().netBalance || 0;
            transaction.update(catRef, { netBalance: currentBal + reverseImpact });
            transaction.delete(txRef);
        });
        return true;
    } catch (error) { 
        console.error("Error in wallet service:", error); 
        return false; 
    }
}

export async function deleteWalletCategory(id) {
    const confirmed = await showConfirm("Delete this entire category and all transactions?", "Confirm Delete");
    if (!confirmed) return false;
    try {
        const catRef = doc(db, COL_WALLET_CATS, id);
        await deleteDoc(catRef); 
        return true;
    } catch (error) { 
        console.error("Error in wallet service:", error); 
        return false; 
    }
}

// Bank Deposits Functions
const COL_BANK_DEPOSITS = "bank_deposits";

export async function getBankDeposits(bankName) {
    try {
        const q = query(
            collection(db, COL_BANK_DEPOSITS),
            where("bankName", "==", bankName)
        );
        const snapshot = await getDocs(q);
        const deposits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort in JavaScript instead of Firestore to avoid index requirement
        return deposits.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
        console.error("Error loading deposits:", error);
        return [];
    }
}

export async function addBankDeposit(bankName, amount, date, notes) {
    try {
        await addDoc(collection(db, COL_BANK_DEPOSITS), {
            bankName,
            amount: parseFloat(amount),
            date,
            notes: notes || "",
            timestamp: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Error adding deposit:", error);
        return false;
    }
}

export async function updateBankDeposit(depositId, amount, date, notes) {
    try {
        const depositRef = doc(db, COL_BANK_DEPOSITS, depositId);
        await updateDoc(depositRef, {
            amount: parseFloat(amount),
            date,
            notes: notes || ""
        });
        return true;
    } catch (error) {
        console.error("Error updating deposit:", error);
        return false;
    }
}

export async function deleteBankDeposit(depositId) {
    try {
        const depositRef = doc(db, COL_BANK_DEPOSITS, depositId);
        await deleteDoc(depositRef);
        return true;
    } catch (error) {
        console.error("Error deleting deposit:", error);
        return false;
    }
}