/**
 * DuitKu - Chart.js Visualization Module
 */

const Charts = {
  donutChart: null,
  trendChart: null,
  reportChart: null,

  isDarkMode() {
    return document.documentElement.classList.contains('dark');
  },

  getTextColor() {
    return this.isDarkMode() ? '#94a3b8' : '#64748b';
  },

  getGridColor() {
    return this.isDarkMode() ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)';
  },

  formatRupiah(num) {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
  },

  renderCategoryDonut(breakdown) {
    const ctx = document.getElementById('categoryDonutChart');
    if (!ctx) return;

    const noDataEl = document.getElementById('donutNoDataMessage');
    const emptyHint = document.getElementById('donutEmptyHint');

    if (!breakdown || breakdown.length === 0) {
      if (this.donutChart) {
        this.donutChart.destroy();
        this.donutChart = null;
      }
      ctx.style.display = 'none';
      if (noDataEl) noDataEl.classList.remove('hidden');
      if (emptyHint) emptyHint.classList.remove('hidden');
      return;
    }

    ctx.style.display = 'block';
    if (noDataEl) noDataEl.classList.add('hidden');
    if (emptyHint) emptyHint.classList.add('hidden');

    const labels = breakdown.map(item => item.name);
    const data = breakdown.map(item => item.total);
    const colors = breakdown.map(item => item.color || '#10b981');

    if (this.donutChart) {
      this.donutChart.destroy();
    }

    this.donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: this.isDarkMode() ? '#1e293b' : '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              padding: 12,
              color: this.getTextColor(),
              font: {
                family: 'Plus Jakarta Sans',
                size: 11
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const val = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${label}: ${this.formatRupiah(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  },

  renderCashFlowTrend(trendData) {
    const ctx = document.getElementById('cashFlowTrendChart');
    if (!ctx) return;

    if (!trendData || trendData.length === 0) return;

    const labels = trendData.map(d => d.label);
    const incomes = trendData.map(d => d.income);
    const expenses = trendData.map(d => d.expense);

    if (this.trendChart) {
      this.trendChart.destroy();
    }

    this.trendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Pemasukan',
            data: incomes,
            backgroundColor: '#10b981',
            borderRadius: 6,
            maxBarThickness: 18
          },
          {
            label: 'Pengeluaran',
            data: expenses,
            backgroundColor: '#f43f5e',
            borderRadius: 6,
            maxBarThickness: 18
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: this.getTextColor(),
              font: { family: 'Plus Jakarta Sans', size: 10 }
            }
          },
          y: {
            grid: { color: this.getGridColor() },
            ticks: {
              color: this.getTextColor(),
              font: { family: 'Plus Jakarta Sans', size: 10 },
              callback: (val) => {
                if (val >= 1000000) return (val / 1000000).toFixed(1) + ' jt';
                if (val >= 1000) return (val / 1000).toFixed(0) + ' rb';
                return val;
              }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 10,
              padding: 10,
              color: this.getTextColor(),
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${this.formatRupiah(context.raw)}`
            }
          }
        }
      }
    });
  },

  renderReportComparison(trendData) {
    const ctx = document.getElementById('reportComparisonChart');
    if (!ctx) return;

    if (!trendData || trendData.length === 0) return;

    const labels = trendData.map(d => d.label);
    const incomes = trendData.map(d => d.income);
    const expenses = trendData.map(d => d.expense);
    const nets = trendData.map(d => d.income - d.expense);

    if (this.reportChart) {
      this.reportChart.destroy();
    }

    this.reportChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Pemasukan',
            data: incomes,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.3,
            fill: true,
            borderWidth: 2.5
          },
          {
            label: 'Pengeluaran',
            data: expenses,
            borderColor: '#f43f5e',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            tension: 0.3,
            fill: true,
            borderWidth: 2.5
          },
          {
            label: 'Sisa Bersih (Net)',
            data: nets,
            borderColor: '#6366f1',
            borderDash: [5, 5],
            tension: 0.3,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: this.getTextColor(),
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          },
          y: {
            grid: { color: this.getGridColor() },
            ticks: {
              color: this.getTextColor(),
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: (val) => {
                if (val >= 1000000 || val <= -1000000) return (val / 1000000).toFixed(1) + ' jt';
                if (val >= 1000 || val <= -1000) return (val / 1000).toFixed(0) + ' rb';
                return val;
              }
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: this.getTextColor(),
              font: { family: 'Plus Jakarta Sans', size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${this.formatRupiah(context.raw)}`
            }
          }
        }
      }
    });
  },

  updateTheme() {
    // Re-render when theme switches
    if (this.donutChart) {
      this.donutChart.options.plugins.legend.labels.color = this.getTextColor();
      this.donutChart.data.datasets[0].borderColor = this.isDarkMode() ? '#1e293b' : '#ffffff';
      this.donutChart.update();
    }
    if (this.trendChart) {
      this.trendChart.options.scales.x.ticks.color = this.getTextColor();
      this.trendChart.options.scales.y.ticks.color = this.getTextColor();
      this.trendChart.options.scales.y.grid.color = this.getGridColor();
      this.trendChart.options.plugins.legend.labels.color = this.getTextColor();
      this.trendChart.update();
    }
    if (this.reportChart) {
      this.reportChart.options.scales.x.ticks.color = this.getTextColor();
      this.reportChart.options.scales.y.ticks.color = this.getTextColor();
      this.reportChart.options.scales.y.grid.color = this.getGridColor();
      this.reportChart.options.plugins.legend.labels.color = this.getTextColor();
      this.reportChart.update();
    }
  }
};
