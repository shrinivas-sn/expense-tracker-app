import { loadStocksDeep, mergeStockData } from "./stock-service.js";
import { loadMFsDeep, mergeMFData } from "./mf-service.js";
import { loadWalletDeep, mergeWalletData, getBankDeposits, getWalletCategoryHistory } from "./wallet-service.js";
import { loadStocks } from "./stock-service.js"; // For simple lists (PDF)
import { loadMFs } from "./mf-service.js";
import { loadWalletCategories } from "./wallet-service.js";
import { formatCurrency, safeNum } from "../logic-core.js";
import { showNotification } from "../ui/notifications.js";

// Helper for PDF formatting
const cleanNum = (val) => safeNum(val).toFixed(2);

// --- PDF GENERATOR ---
export async function generateReport(type) {
    const doc = new jspdf.jsPDF();
    const dateStr = new Date().toLocaleDateString('en-IN');
    
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235);
    doc.text(`Portfolio Report`, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`${type.toUpperCase()} STATEMENT`, 14, 26);
    doc.text(`Generated on: ${dateStr}`, 14, 32);
    doc.setLineWidth(0.5);
    doc.setDrawColor(200);
    doc.line(14, 36, 196, 36);

    let data = [];
    let columns = [];
    let summaryText = "";
    let colStyles = {};

    if (type === 'stocks' || type === 'mfs') {
        const items = type === 'stocks' ? await loadStocks() : await loadMFs();
        columns = ["Ticker", "Qty", "Avg Price (Rs)", "Invested (Rs)", "Current (Rs)", "P&L (Rs)"];
        colStyles = { 1: {halign:'right'}, 2: {halign:'right'}, 3: {halign:'right'}, 4: {halign:'right'}, 5: {halign:'right'} };

        let totalInv = 0;
        let totalCur = 0;

        data = items.map(item => {
            const qty = parseFloat(item.qty);
            const avg = parseFloat(item.avgPrice);
            const ltp = parseFloat(item.currentLTP || avg); 
            const inv = qty * avg;
            const cur = qty * ltp;
            const pnl = cur - inv;
            totalInv += inv;
            totalCur += cur;

            return [item.ticker, qty, cleanNum(avg), cleanNum(inv), cleanNum(cur), cleanNum(pnl)];
        });
        summaryText = `Total Invested: Rs ${cleanNum(totalInv)}  |  Current Value: Rs ${cleanNum(totalCur)}`;

    } else if (type === 'wallet') {
        const categories = await loadWalletCategories();
        const banks = [...new Set(categories.map(c => c.bankAccount || "General"))];
        
        let startY = 42;
        let totalNetWorth = 0;
        
        for (const bank of banks) {
            const bankCategories = categories.filter(c => (c.bankAccount || "General") === bank);
            const deposits = await getBankDeposits(bank);
            const depositsTotal = deposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
            const categoriesBalance = bankCategories.reduce((sum, c) => sum + (parseFloat(c.netBalance) || 0), 0);
            const bankBalance = depositsTotal + categoriesBalance;
            totalNetWorth += bankBalance;
            
            // Bank Header
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(37, 99, 235);
            doc.text(`Bank: ${bank}`, 14, startY);
            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.text(`Net Balance: Rs ${cleanNum(bankBalance)}`, 14, startY + 6);
            startY += 12;
            
            // Deposits Section
            if (deposits.length > 0) {
                const depositRows = deposits.map(d => [
                    "DEPOSIT",
                    new Date(d.date).toLocaleDateString(),
                    d.notes || "-",
                    `+${cleanNum(d.amount)}`
                ]);
                doc.autoTable({
                    startY: startY,
                    head: [["Type", "Date", "Notes", "Amount (Rs)"]],
                    body: depositRows,
                    theme: 'grid',
                    headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255] },
                    columnStyles: { 3: {halign:'right'} },
                    margin: { left: 14 }
                });
                startY = doc.lastAutoTable.finalY + 6;
            }
            
            // Categories & Transactions
            for (const cat of bankCategories) {
                const transactions = await getWalletCategoryHistory(cat.id);
                if (transactions.length === 0) continue;
                
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(0);
                doc.text(`Category: ${cat.name} (Balance: Rs ${cleanNum(cat.netBalance)})`, 14, startY);
                startY += 6;
                
                const txRows = transactions.map(tx => [
                    new Date(tx.date).toLocaleDateString(),
                    tx.type.toUpperCase(),
                    tx.notes || "-",
                    tx.type === 'credit' ? `+${cleanNum(tx.amount)}` : `-${cleanNum(tx.amount)}`
                ]);
                
                doc.autoTable({
                    startY: startY,
                    head: [["Date", "Type", "Notes", "Amount (Rs)"]],
                    body: txRows,
                    theme: 'striped',
                    headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55] },
                    columnStyles: { 3: {halign:'right'} },
                    margin: { left: 20 }
                });
                startY = doc.lastAutoTable.finalY + 8;
            }
            
            startY += 4;
        }
        
        // Final Summary
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0);
        doc.text(`Total Net Worth: Rs ${cleanNum(totalNetWorth)}`, 14, startY);
        
        doc.save(`wallet_report_${dateStr}.pdf`);
        showNotification("Report Downloaded Successfully", "success");
        return;
    }

    doc.autoTable({
        startY: 42,
        head: [columns],
        body: data,
        theme: 'striped',
        headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 4, textColor: [50, 50, 50] },
        columnStyles: colStyles
    });

    const finalY = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0);
    doc.text(summaryText, 14, finalY);

    doc.save(`${type}_report_${dateStr}.pdf`);
    showNotification("Report Downloaded Successfully", "success");
}

// --- DEEP BACKUP (EXPORT) ---
export async function exportData(type) {
    showNotification("Generating Backup...", "success");
    let payload = [];
    
    // FETCH DEEP DATA (Items + History)
    if (type === 'stocks') payload = await loadStocksDeep(); 
    else if (type === 'mfs') payload = await loadMFsDeep();
    else if (type === 'wallet') payload = await loadWalletDeep();

    const backupObj = {
        app_signature: "smart_portfolio_v1",
        data_type: type,
        timestamp: new Date().toISOString(),
        payload: payload
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${type}_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// --- SMART RESTORE (IMPORT) ---
export async function importData(file, targetType) {
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);
            
            // 1. Validation
            if (data.app_signature !== "smart_portfolio_v1") {
                throw "Invalid file format. Not a Smart Portfolio backup.";
            }
            if (data.data_type !== targetType) {
                throw `Error: Trying to restore ${data.data_type.toUpperCase()} data into ${targetType.toUpperCase()}.`;
            }

            showNotification(`Analyzing ${data.payload.length} items...`, "success");

            // 2. Route to Smart Merge Logic
            let restoredCount = 0;
            if (targetType === 'stocks') restoredCount = await mergeStockData(data.payload);
            else if (targetType === 'mfs') restoredCount = await mergeMFData(data.payload);
            else if (targetType === 'wallet') restoredCount = await mergeWalletData(data.payload);

            showNotification(`Sync Complete. Added ${restoredCount} new entries.`, "success");
            
            // Reload page to reflect changes
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error("Restore error:", error);
            showNotification("Restore Failed: " + (error.message || error), "error");
        }
    };
    reader.readAsText(file);
}