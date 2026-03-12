/**
 * Graph UI Component
 * Renders portfolio performance chart using Chart.js
 */

import { formatCurrency } from "../logic-core.js";
import { showNotification } from "./notifications.js";

let chartInstance = null;

/**
 * Renders portfolio graph
 * @param {Object} data - Graph data from graph-service
 * @param {string} timeRange - Current time range
 */
export function renderPortfolioGraph(data, timeRange) {
    const canvas = document.getElementById('portfolio-chart');
    const emptyState = document.getElementById('graph-empty');
    const chartWrapper = document.querySelector('.chart-wrapper');
    
    if (!data || data.values.length === 0) {
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        emptyState.classList.remove('hidden-view');
        chartWrapper?.classList.add('hidden-view');
        return;
    }
    
    emptyState.classList.add('hidden-view');
    chartWrapper?.classList.remove('hidden-view');
    
    // Destroy existing chart
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1f2937';
    const gridColor = isDark ? '#334155' : '#e5e7eb';
    const primaryColor = '#2563eb';
    const investedColor = isDark ? '#64748b' : '#94a3b8';
    
    // Update stats
    document.getElementById('graph-invested').textContent = formatCurrency(data.invested);
    document.getElementById('graph-current').textContent = formatCurrency(data.current);
    const pnlEl = document.getElementById('graph-pnl');
    pnlEl.textContent = formatCurrency(data.pnl);
    pnlEl.style.color = data.pnl >= 0 ? '#16a34a' : '#dc2626';
    
    // Create chart - Chart.js is loaded from CDN
    if (typeof window.Chart === 'undefined' && typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded');
        showNotification('Chart library not loaded. Please refresh the page.', 'error');
        return;
    }
    
    const ChartLib = window.Chart || Chart;
    const ctx = canvas.getContext('2d');
    chartInstance = new ChartLib(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Current Value',
                    data: data.values,
                    borderColor: primaryColor,
                    backgroundColor: `${primaryColor}20`,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: 'Invested Amount',
                    data: data.investedValues,
                    borderColor: investedColor,
                    backgroundColor: `${investedColor}20`,
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: textColor,
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? '#1e293b' : 'white',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: gridColor,
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        maxTicksLimit: 8,
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            if (value >= 100000) return '₹' + (value / 100000).toFixed(1) + 'L';
                            if (value >= 1000) return '₹' + (value / 1000).toFixed(1) + 'K';
                            return '₹' + value;
                        },
                        font: {
                            size: 10
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

/**
 * Updates graph with new time range
 * @param {string} timeRange - New time range
 */
export async function updateGraph(timeRange) {
    // Update active button
    document.querySelectorAll('.time-range-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === timeRange);
    });
    
    // Show loading
    const canvas = document.getElementById('portfolio-chart');
    if (canvas) {
        canvas.style.opacity = '0.5';
    }
    
    // Import and generate data
    const { generatePortfolioData } = await import('../services/graph-service.js');
    const data = await generatePortfolioData(timeRange);
    
    // Render graph
    renderPortfolioGraph(data, timeRange);
    
    if (canvas) {
        canvas.style.opacity = '1';
    }
}

/**
 * Destroys chart instance
 */
export function destroyGraph() {
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
}
