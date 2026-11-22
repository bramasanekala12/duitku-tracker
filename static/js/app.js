/**
 * DuitKu - Main Application Script
 * Orchestrates UI, State, Modals, Forms & Interactions
 */

const App = {
  state: {
    activeTab: 'dashboard',
    currentMonth: '', // YYYY-MM
    wallets: [],
    categories: [],
    txFilters: {
      type: 'all',
      wallet_id: '',
      category_id: '',
      month: '',
      search: ''
    },
    editingTxId: null,
    editingWalletId: null,
    selectedTxType: 'expense'
  },

  init() {
    // Determine initial month YYYY-MM
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    this.state.currentMonth = `${y}-${m}`;
    this.state.txFilters.month = this.state.currentMonth;

    // Set input defaults
    const dateInput = document.getElementById('txDate');
    const timeInput = document.getElementById('txTime');
    if (dateInput) dateInput.value = today.toISOString().split('T')[0];
    if (timeInput) timeInput.value = today.toTimeString().slice(0, 5);

    const txMonthFilter = document.getElementById('txMonthFilter');
    if (txMonthFilter) txMonthFilter.value = this.state.currentMonth;

    // Theme initialization
    this.initTheme();

    // Setup Currency Masking
    this.setupRupiahInput('txAmountFormatted', 'txAmount');
    this.setupRupiahInput('walletInitialBalanceFormatted', 'walletInitialBalance');
    this.setupRupiahInput('budgetLimitFormatted', 'budgetLimit');

    // Setup Search & Filter events
    this.setupEventListeners();

    // Check Connection & Load Data
    this.checkConnectionAndLoad();
  },

  async checkConnectionAndLoad() {
    const conn = await API.checkConnection();
    const badge = document.getElementById('connectionBadge');
    const badgeText = document.getElementById('connectionText');
    const headerModeBadge = document.getElementById('headerModeBadge');
    const btnOpenAuth = document.getElementById('btnOpenAuth');
    const userProfileBadge = document.getElementById('userProfileBadge');
    const userEmailLabel = document.getElementById('userEmailLabel');
    const settingsAccountEmail = document.getElementById('settingsAccountEmail');
    const settingsBtnAuth = document.getElementById('settingsBtnAuth');
    const settingsSyncCard = document.getElementById('settingsSyncCard');

    if (conn && conn.mode === 'supabase' && conn.user) {
      if (badge && badgeText) {
        badge.classList.remove('hidden');
        badgeText.textContent = 'Cloud Supabase Terhubung';
        badge.className = 'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40';
      }
      if (headerModeBadge) {
        headerModeBadge.textContent = 'Cloud Online';
        headerModeBadge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
      }
      if (btnOpenAuth) btnOpenAuth.classList.add('hidden');
      if (userProfileBadge) {
        userProfileBadge.classList.remove('hidden');
        userProfileBadge.classList.add('flex');
      }
      if (userEmailLabel) userEmailLabel.textContent = conn.user.email;
      if (settingsAccountEmail) settingsAccountEmail.textContent = `Terhubung: ${conn.user.email}`;
      if (settingsBtnAuth) settingsBtnAuth.textContent = 'Ganti Akun';
      if (settingsSyncCard) settingsSyncCard.classList.remove('hidden');
    } else if (conn && conn.mode === 'sqlite') {
      if (badge && badgeText) {
        badge.classList.remove('hidden');
        badgeText.textContent = 'SQLite Server Lokal';
        badge.className = 'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40';
      }
      if (headerModeBadge) {
        headerModeBadge.textContent = 'Lokal SQLite';
        headerModeBadge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
      }
      if (btnOpenAuth) btnOpenAuth.classList.remove('hidden');
      if (userProfileBadge) {
        userProfileBadge.classList.add('hidden');
        userProfileBadge.classList.remove('flex');
      }
      if (settingsAccountEmail) settingsAccountEmail.textContent = 'Menggunakan SQLite lokal (Belum masuk Cloud)';
      if (settingsBtnAuth) settingsBtnAuth.textContent = 'Masuk Akun Supabase';
      if (settingsSyncCard) settingsSyncCard.classList.add('hidden');
    } else {
      if (badge && badgeText) {
        badge.classList.remove('hidden');
        badgeText.textContent = 'Mode Offline (Browser Storage)';
        badge.className = 'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40';
      }
      if (headerModeBadge) {
        headerModeBadge.textContent = 'Offline';
        headerModeBadge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
      }
      if (btnOpenAuth) btnOpenAuth.classList.remove('hidden');
      if (userProfileBadge) {
        userProfileBadge.classList.add('hidden');
        userProfileBadge.classList.remove('flex');
      }
      if (settingsAccountEmail) settingsAccountEmail.textContent = 'Belum masuk akun (Data tersimpan di browser)';
      if (settingsBtnAuth) settingsBtnAuth.textContent = 'Masuk / Daftar Akun';
      if (settingsSyncCard) settingsSyncCard.classList.add('hidden');
    }

    await this.refreshMeta();
    await this.loadCurrentTab();
  },

  async refreshMeta() {
    this.state.wallets = await API.getWallets();
    this.state.categories = await API.getCategories();
    this.populateWalletSelects();
    this.populateCategorySelects();
    this.renderSettingsCategories();
  },

  // ==========================================
  // TAB NAVIGATION
  // ==========================================
  switchTab(tabName) {
    this.state.activeTab = tabName;

    // Update Desktop Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active-tab');
      } else {
        btn.classList.remove('active-tab');
      }
    });

    // Update Mobile Nav
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active-mobile-nav');
      } else {
        btn.classList.remove('active-mobile-nav');
      }
    });

    // Toggle Content Sections
    document.querySelectorAll('.tab-content').forEach(sec => {
      if (sec.id === `tab-${tabName}`) {
        sec.classList.remove('hidden');
      } else {
        sec.classList.add('hidden');
      }
    });

    // Load Tab Specific Data
    this.loadCurrentTab();

    // Re-initialize Lucide Icons
    if (window.lucide) lucide.createIcons();
  },

  async loadCurrentTab() {
    switch (this.state.activeTab) {
      case 'dashboard':
        await this.loadDashboard();
        break;
      case 'transactions':
        await this.loadTransactions();
        break;
      case 'wallets':
        await this.loadWallets();
        break;
      case 'budgets':
        await this.loadBudgets();
        break;
      case 'reports':
        await this.loadReports();
        break;
      case 'settings':
        this.renderSettingsCategories();
        break;
    }
    if (window.lucide) lucide.createIcons();
  },

  // ==========================================
  // DASHBOARD LOGIC
  // ==========================================
  async loadDashboard() {
    this.updateMonthLabel();
    const summary = await API.getSummary(this.state.currentMonth);

    // Update Cards
    const totalBalEl = document.getElementById('statTotalBalance');
    const monthIncEl = document.getElementById('statMonthIncome');
    const monthExpEl = document.getElementById('statMonthExpense');
    const netSavEl = document.getElementById('statNetSavings');

    if (totalBalEl) totalBalEl.textContent = this.formatRupiah(summary.total_balance);
    if (monthIncEl) monthIncEl.textContent = this.formatRupiah(summary.month_income);
    if (monthExpEl) monthExpEl.textContent = this.formatRupiah(summary.month_expense);
    if (netSavEl) {
      netSavEl.textContent = this.formatRupiah(summary.net_savings);
      if (summary.net_savings < 0) {
        netSavEl.className = 'text-2xl font-bold text-rose-600 dark:text-rose-400 tracking-tight';
      } else {
        netSavEl.className = 'text-2xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight';
      }
    }

    // Quick Wallets List
    this.renderQuickWallets(summary.wallets || []);

    // Render Charts
    Charts.renderCategoryDonut(summary.category_breakdown || []);
    Charts.renderCashFlowTrend(summary.trend || []);

    // Render Recent Transactions
    this.renderRecentTransactions(summary.recent_transactions || []);

    if (window.lucide) lucide.createIcons();
  },

  updateMonthLabel() {
    const lbl = document.getElementById('currentSummaryMonthLabel');
    if (!lbl) return;
    const [y, m] = this.state.currentMonth.split('-');
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    lbl.textContent = `${monthNames[parseInt(m, 10) - 1]} ${y}`;
  },

  changeSummaryMonth(delta) {
    const [y, m] = this.state.currentMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    const ny = date.getFullYear();
    const nm = String(date.getMonth() + 1).padStart(2, '0');
    this.state.currentMonth = `${ny}-${nm}`;
    this.loadDashboard();
  },

  goToCurrentMonth() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    this.state.currentMonth = `${y}-${m}`;
    this.loadDashboard();
  },

  renderQuickWallets(wallets) {
    const container = document.getElementById('quickWalletsList');
    if (!container) return;

    if (!wallets || wallets.length === 0) {
      container.innerHTML = `<p class="col-span-full text-xs text-slate-400">Belum ada dompet aktif.</p>`;
      return;
    }

    container.innerHTML = wallets.map(w => `
      <div class="bg-white dark:bg-dark-card p-3 rounded-2xl border border-slate-200 dark:border-dark-border shadow-sm flex items-center justify-between">
        <div class="flex items-center space-x-2.5 overflow-hidden">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style="background-color: ${w.color || '#3B82F6'}20; color: ${w.color || '#3B82F6'}">
            <i data-lucide="${w.icon || 'wallet'}" class="w-4 h-4"></i>
          </div>
          <div class="truncate">
            <h5 class="text-xs font-bold text-slate-900 dark:text-white truncate">${w.name}</h5>
            <p class="text-xs font-semibold text-slate-600 dark:text-dark-subtext">${this.formatRupiah(w.balance || w.current_balance)}</p>
          </div>
        </div>
      </div>
    `).join('');
  },

  renderRecentTransactions(txs) {
    const container = document.getElementById('recentTransactionsList');
    if (!container) return;

    if (!txs || txs.length === 0) {
      container.innerHTML = `
        <div class="py-8 text-center text-slate-400 dark:text-slate-500">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
          <p class="text-sm">Belum ada transaksi. Tekan tombol Tambah Transaksi di bawah untuk memulai!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = txs.map(t => this.renderSingleTxItem(t)).join('');
  },

  // ==========================================
  // TRANSACTIONS LIST & FILTERS
  // ==========================================
  async loadTransactions() {
    const params = {
      ...this.state.txFilters,
      month: this.state.txFilters.month
    };
    const txs = await API.getTransactions(params);

    const badge = document.getElementById('txCountBadge');
    if (badge) badge.textContent = `Menampilkan ${txs.length} transaksi`;

    const container = document.getElementById('fullTransactionsList');
    if (!container) return;

    if (!txs || txs.length === 0) {
      container.innerHTML = `
        <div class="bg-white dark:bg-dark-card rounded-2xl p-8 text-center border border-slate-200 dark:border-dark-border text-slate-400 dark:text-slate-500">
          <i data-lucide="search-x" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Tidak ada transaksi yang cocok</p>
          <p class="text-xs mt-1">Coba sesuaikan filter pencarian atau ganti bulan.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Group transactions by date
    const groups = {};
    txs.forEach(t => {
      const d = t.date || 'Lainnya';
      if (!groups[d]) groups[d] = [];
      groups[d].push(t);
    });

    let html = '';
    for (const [dateStr, groupTxs] of Object.entries(groups)) {
      // Calculate day total
      let dayNet = 0;
      groupTxs.forEach(t => {
        if (t.type === 'income') dayNet += Number(t.amount);
        if (t.type === 'expense') dayNet -= Number(t.amount);
      });

      html += `
        <div class="space-y-2">
          <div class="flex items-center justify-between px-2 pt-2">
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
              ${this.formatDateReadable(dateStr)}
            </span>
            <span class="text-xs font-semibold ${dayNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
              ${dayNet >= 0 ? '+' : ''}${this.formatRupiah(dayNet)}
            </span>
          </div>
          <div class="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border divide-y divide-slate-100 dark:divide-dark-border shadow-sm overflow-hidden">
            ${groupTxs.map(t => this.renderSingleTxItem(t)).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  },

  renderSingleTxItem(t) {
    const isIncome = t.type === 'income';
    const isTransfer = t.type === 'transfer';
    const color = isIncome ? 'text-emerald-600 dark:text-emerald-400' : (isTransfer ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400');
    const prefix = isIncome ? '+ ' : (isTransfer ? '' : '- ');

    let icon = t.category_icon || 'tag';
    let iconBg = t.category_color || '#10B981';
    let subtext = t.wallet_name || 'Dompet';

    if (isTransfer) {
      icon = 'repeat';
      iconBg = '#6366f1';
      subtext = `${t.wallet_name || 'Dompet'} &rarr; ${t.to_wallet_name || 'Tujuan'}`;
    }

    return `
      <div class="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group">
        <div class="flex items-center space-x-3 overflow-hidden">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background-color: ${iconBg}20; color: ${iconBg}">
            <i data-lucide="${icon}" class="w-5 h-5"></i>
          </div>
          <div class="truncate">
            <h5 class="text-sm font-bold text-slate-900 dark:text-white truncate">
              ${isTransfer ? 'Transfer Saldo' : (t.category_name || 'Tanpa Kategori')}
            </h5>
            <p class="text-xs text-slate-500 dark:text-dark-subtext truncate flex items-center gap-1.5 mt-0.5">
              <span>${subtext}</span>
              ${t.note ? `<span>&bull;</span> <span class="italic text-slate-600 dark:text-slate-400">${t.note}</span>` : ''}
            </p>
          </div>
        </div>

        <div class="flex items-center space-x-3 flex-shrink-0">
          <div class="text-right">
            <span class="text-sm font-bold ${color}">${prefix}${this.formatRupiah(t.amount)}</span>
            <p class="text-[10px] text-slate-400 mt-0.5">${t.time || ''}</p>
          </div>
          <!-- Edit / Delete Buttons -->
          <div class="flex items-center space-x-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition">
            <button onclick="editTx(${t.id})" class="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500" title="Edit">
              <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="deleteTx(${t.id})" class="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-500" title="Hapus">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  setTxTypeFilter(type) {
    this.state.txFilters.type = type;
    document.querySelectorAll('.tx-filter-type').forEach(btn => {
      if (btn.dataset.type === type) {
        btn.classList.add('active-filter-type');
      } else {
        btn.classList.remove('active-filter-type');
      }
    });
    this.loadTransactions();
  },

  resetTxFilters() {
    this.state.txFilters = {
      type: 'all',
      wallet_id: '',
      category_id: '',
      month: this.state.currentMonth,
      search: ''
    };
    const sInput = document.getElementById('txSearchInput');
    const mInput = document.getElementById('txMonthFilter');
    const wInput = document.getElementById('txWalletFilter');
    const cInput = document.getElementById('txCategoryFilter');
    if (sInput) sInput.value = '';
    if (mInput) mInput.value = this.state.currentMonth;
    if (wInput) wInput.value = '';
    if (cInput) cInput.value = '';
    this.setTxTypeFilter('all');
  },

  // ==========================================
  // WALLETS (DOMPET)
  // ==========================================
  async loadWallets() {
    this.state.wallets = await API.getWallets();
    const container = document.getElementById('walletsGrid');
    if (!container) return;

    if (!this.state.wallets || this.state.wallets.length === 0) {
      container.innerHTML = `<p class="col-span-full text-center text-sm text-slate-400">Belum ada dompet.</p>`;
      return;
    }

    container.innerHTML = this.state.wallets.map(w => `
      <div class="bg-white dark:bg-dark-card rounded-2xl p-5 border border-slate-200 dark:border-dark-border shadow-sm relative overflow-hidden flex flex-col justify-between h-44 transition hover:shadow-md">
        <!-- Top row -->
        <div class="flex items-start justify-between">
          <div class="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md" style="background-color: ${w.color || '#3B82F6'}">
            <i data-lucide="${w.icon || 'wallet'}" class="w-5 h-5"></i>
          </div>
          <div class="flex items-center space-x-1">
            <button onclick="editWallet(${w.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteWallet(${w.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Middle row: Balance -->
        <div>
          <span class="text-xs uppercase font-semibold text-slate-400 tracking-wider">${w.name}</span>
          <h4 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight">
            ${this.formatRupiah(w.current_balance)}
          </h4>
        </div>

        <!-- Bottom row: Type & badge -->
        <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-dark-border text-xs text-slate-400">
          <span class="capitalize">${w.type}</span>
          <span>Awal: ${this.formatRupiah(w.initial_balance)}</span>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  // ==========================================
  // BUDGETS (ANGGARAN)
  // ==========================================
  async loadBudgets() {
    const budgets = await API.getBudgets(this.state.currentMonth);
    const container = document.getElementById('budgetsList');
    if (!container) return;

    if (!budgets || budgets.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-white dark:bg-dark-card rounded-2xl p-8 text-center border border-slate-200 dark:border-dark-border text-slate-400 dark:text-slate-500">
          <i data-lucide="pie-chart" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Belum ada anggaran bulanan yang dibuat</p>
          <p class="text-xs mt-1">Buat batas anggaran untuk makanan, transportasi, belanja, dll.</p>
          <button onclick="openBudgetModal()" class="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs">
            + Pasang Anggaran Sekarang
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = budgets.map(b => {
      const spent = b.spent || 0;
      const limit = b.monthly_limit || 1;
      const pct = Math.min(100, Math.round((spent / limit) * 100));
      const remaining = limit - spent;
      const isOver = spent > limit;

      let barColor = 'bg-emerald-500';
      let statusBadge = '<span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Aman</span>';

      if (pct >= 85 && !isOver) {
        barColor = 'bg-amber-500';
        statusBadge = '<span class="text-xs font-semibold text-amber-600 dark:text-amber-400">Hampir Habis</span>';
      } else if (isOver) {
        barColor = 'bg-rose-500';
        statusBadge = '<span class="text-xs font-semibold text-rose-600 dark:text-rose-400 font-bold">Melebihi Anggaran!</span>';
      }

      return `
        <div class="bg-white dark:bg-dark-card rounded-2xl p-5 border border-slate-200 dark:border-dark-border shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background-color: ${b.category_color}20; color: ${b.category_color}">
                <i data-lucide="${b.category_icon || 'tag'}" class="w-4 h-4"></i>
              </div>
              <div>
                <h5 class="text-sm font-bold text-slate-900 dark:text-white">${b.category_name}</h5>
                <p class="text-xs text-slate-400">Batas: ${this.formatRupiah(b.monthly_limit)}</p>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              ${statusBadge}
              <button onclick="deleteBudget(${b.id})" class="p-1 text-slate-400 hover:text-rose-500">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <!-- Progress Bar -->
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="font-semibold text-slate-700 dark:text-slate-300">Terpakai: ${this.formatRupiah(spent)}</span>
              <span class="font-bold text-slate-500 dark:text-dark-subtext">${pct}%</span>
            </div>
            <div class="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
              <div class="${barColor} h-2.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
            </div>
          </div>

          <div class="flex justify-between text-xs pt-1 text-slate-500 dark:text-dark-subtext">
            <span>${isOver ? 'Kelebihan:' : 'Sisa anggaran:'}</span>
            <span class="font-bold ${isOver ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white'}">
              ${this.formatRupiah(Math.abs(remaining))}
            </span>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  // ==========================================
  // REPORTS & ANALYTICS
  // ==========================================
  async loadReports() {
    const summary = await API.getSummary(this.state.currentMonth);
    const breakdown = summary.category_breakdown || [];
    const trend = summary.trend || [];

    // Daily Average Calculation
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dailyAvg = summary.month_expense > 0 ? Math.round(summary.month_expense / daysInMonth) : 0;
    const dailyAvgEl = document.getElementById('reportDailyAvg');
    if (dailyAvgEl) dailyAvgEl.textContent = this.formatRupiah(dailyAvg);

    // Savings Rate
    const savingsRate = summary.month_income > 0 ? Math.max(0, Math.round((summary.net_savings / summary.month_income) * 100)) : 0;
    const savingsRateEl = document.getElementById('reportSavingsRate');
    if (savingsRateEl) savingsRateEl.textContent = `${savingsRate}%`;

    // Top Category
    const topCatEl = document.getElementById('reportTopCategory');
    const topAmtEl = document.getElementById('reportTopCategoryAmount');
    if (breakdown.length > 0) {
      if (topCatEl) topCatEl.textContent = breakdown[0].name;
      if (topAmtEl) topAmtEl.textContent = this.formatRupiah(breakdown[0].total);
    } else {
      if (topCatEl) topCatEl.textContent = '-';
      if (topAmtEl) topAmtEl.textContent = 'Rp 0';
    }

    // Chart
    Charts.renderReportComparison(trend);

    // Table breakdown
    const tbody = document.getElementById('reportCategoryTableBody');
    if (tbody) {
      if (breakdown.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-xs text-slate-400">Belum ada pengeluaran di bulan ini.</td></tr>`;
      } else {
        const totalExp = summary.month_expense || 1;
        tbody.innerHTML = breakdown.map(item => {
          const pct = ((item.total / totalExp) * 100).toFixed(1);
          return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
              <td class="py-2.5 px-3 flex items-center space-x-2 font-medium">
                <span class="w-3 h-3 rounded-full" style="background-color: ${item.color}"></span>
                <span class="text-slate-800 dark:text-white">${item.name}</span>
              </td>
              <td class="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-white">${this.formatRupiah(item.total)}</td>
              <td class="py-2.5 px-3 text-right text-xs font-semibold text-slate-500">${pct}%</td>
            </tr>
          `;
        }).join('');
      }
    }
  },

  // ==========================================
  // SETTINGS & CATEGORIES
  // ==========================================
  renderSettingsCategories() {
    const container = document.getElementById('settingsCategoriesList');
    if (!container) return;

    if (!this.state.categories || this.state.categories.length === 0) {
      container.innerHTML = `<span class="text-xs text-slate-400">Tidak ada kategori.</span>`;
      return;
    }

    container.innerHTML = this.state.categories.map(c => `
      <div class="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-slate-800 text-xs font-semibold">
        <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${c.color}"></span>
        <span class="text-slate-700 dark:text-slate-200">${c.name}</span>
        <span class="text-[10px] uppercase text-slate-400">(${c.type === 'income' ? 'Masuk' : 'Keluar'})</span>
        <button onclick="deleteCategory(${c.id})" class="ml-1 text-slate-400 hover:text-rose-500">
          <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  // ==========================================
  // POPULATE SELECTS
  // ==========================================
  populateWalletSelects() {
    const selects = ['txWalletSelect', 'txToWalletSelect', 'txWalletFilter'];
    selects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const isFilter = id === 'txWalletFilter';
      let opts = isFilter ? '<option value="">Semua Dompet</option>' : '';
      this.state.wallets.forEach(w => {
        opts += `<option value="${w.id}">${w.name} (${this.formatRupiah(w.current_balance || w.balance)})</option>`;
      });
      el.innerHTML = opts;
    });
  },

  populateCategorySelects() {
    const selects = ['txCategorySelect', 'txCategoryFilter', 'budgetCategorySelect'];
    selects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const isFilter = id === 'txCategoryFilter';
      const isBudget = id === 'budgetCategorySelect';
      let opts = isFilter ? '<option value="">Semua Kategori</option>' : '';

      const filtered = isBudget
        ? this.state.categories.filter(c => c.type === 'expense')
        : (id === 'txCategorySelect'
            ? this.state.categories.filter(c => c.type === this.state.selectedTxType)
            : this.state.categories);

      filtered.forEach(c => {
        opts += `<option value="${c.id}">${c.name}</option>`;
      });
      el.innerHTML = opts;
    });
  },

  // ==========================================
  // CURRENCY MASKING HELPER
  // ==========================================
  setupRupiahInput(formattedInputId, hiddenInputId) {
    const formattedInput = document.getElementById(formattedInputId);
    const hiddenInput = document.getElementById(hiddenInputId);
    if (!formattedInput || !hiddenInput) return;

    formattedInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '');
      if (val === '') {
        formattedInput.value = '';
        hiddenInput.value = '0';
        return;
      }
      const num = parseInt(val, 10);
      hiddenInput.value = num;
      formattedInput.value = num.toLocaleString('id-ID');
    });
  },

  setRupiahValue(formattedInputId, hiddenInputId, amount) {
    const formattedInput = document.getElementById(formattedInputId);
    const hiddenInput = document.getElementById(hiddenInputId);
    if (!formattedInput || !hiddenInput) return;

    const num = Math.round(Number(amount || 0));
    hiddenInput.value = num;
    formattedInput.value = num > 0 ? num.toLocaleString('id-ID') : '';
  },

  formatRupiah(num) {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
  },

  formatDateReadable(dateStr) {
    if (!dateStr) return '';
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return 'Hari Ini';
    if (dateStr === yesterday) return 'Kemarin';

    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      return `${parseInt(parts[2], 10)} ${monthNames[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
    }
    return dateStr;
  },

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('txSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.txFilters.search = e.target.value;
        this.loadTransactions();
      });
    }

    // Month filter
    const monthFilter = document.getElementById('txMonthFilter');
    if (monthFilter) {
      monthFilter.addEventListener('change', (e) => {
        this.state.txFilters.month = e.target.value;
        this.loadTransactions();
      });
    }

    // Wallet filter
    const walletFilter = document.getElementById('txWalletFilter');
    if (walletFilter) {
      walletFilter.addEventListener('change', (e) => {
        this.state.txFilters.wallet_id = e.target.value;
        this.loadTransactions();
      });
    }

    // Category filter
    const categoryFilter = document.getElementById('txCategoryFilter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.state.txFilters.category_id = e.target.value;
        this.loadTransactions();
      });
    }

    // Theme Toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Import File
    const importInput = document.getElementById('importFileInput');
    if (importInput) {
      importInput.addEventListener('change', (e) => this.handleImportFile(e));
    }
  },

  // ==========================================
  // THEME MANAGEMENT
  // ==========================================
  initTheme() {
    const saved = localStorage.getItem('duitku_theme') || 'dark';
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      document.getElementById('themeIconDark')?.classList.remove('hidden');
      document.getElementById('themeIconLight')?.classList.add('hidden');
    } else {
      document.documentElement.classList.remove('dark');
      document.getElementById('themeIconDark')?.classList.add('hidden');
      document.getElementById('themeIconLight')?.classList.remove('hidden');
    }
  },

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('duitku_theme', isDark ? 'dark' : 'light');
    document.getElementById('themeIconDark')?.classList.toggle('hidden', !isDark);
    document.getElementById('themeIconLight')?.classList.toggle('hidden', isDark);
    Charts.updateTheme();
  },

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================
  showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const bg = type === 'success' ? 'bg-emerald-600' : 'bg-rose-600';
    toast.className = `toast-item pointer-events-auto px-4 py-2.5 rounded-2xl text-white text-xs sm:text-sm font-semibold shadow-xl flex items-center gap-2 ${bg}`;
    toast.innerHTML = `
      <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" class="w-4 h-4"></i>
      <span>${msg}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }
};

// =========================================================================
// GLOBAL MODAL & INTERACTION HANDLERS (Invoked by HTML onclick/onsubmit)
// =========================================================================

function switchTab(tab) {
  App.switchTab(tab);
}

function changeSummaryMonth(delta) {
  App.changeSummaryMonth(delta);
}

function goToCurrentMonth() {
  App.goToCurrentMonth();
}

function setTxTypeFilter(type) {
  App.setTxTypeFilter(type);
}

function resetTxFilters() {
  App.resetTxFilters();
}

// Transaction Modal Handlers
function openTxModal(tx = null) {
  App.state.editingTxId = tx ? tx.id : null;
  const modal = document.getElementById('txModal');
  const modalTitle = document.getElementById('txModalTitle');
  if (modalTitle) modalTitle.textContent = tx ? 'Edit Transaksi' : 'Tambah Transaksi';

  if (tx) {
    selectTxType(tx.type);
    App.setRupiahValue('txAmountFormatted', 'txAmount', tx.amount);
    document.getElementById('txWalletSelect').value = tx.wallet_id;
    if (tx.type === 'transfer') {
      document.getElementById('txToWalletSelect').value = tx.to_wallet_id;
    } else {
      document.getElementById('txCategorySelect').value = tx.category_id;
    }
    document.getElementById('txDate').value = tx.date;
    document.getElementById('txTime').value = tx.time || '12:00';
    document.getElementById('txNote').value = tx.note || '';
  } else {
    selectTxType('expense');
    App.setRupiahValue('txAmountFormatted', 'txAmount', 0);
    const today = new Date();
    document.getElementById('txDate').value = today.toISOString().split('T')[0];
    document.getElementById('txTime').value = today.toTimeString().slice(0, 5);
    document.getElementById('txNote').value = '';
  }

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeTxModal() {
  document.getElementById('txModal')?.classList.add('hidden');
}

function selectTxType(type) {
  App.state.selectedTxType = type;

  const btnExp = document.getElementById('btnTypeExpense');
  const btnInc = document.getElementById('btnTypeIncome');
  const btnTr = document.getElementById('btnTypeTransfer');
  const catGroup = document.getElementById('txCategoryGroup');
  const toWalletGroup = document.getElementById('txToWalletGroup');
  const walletLabel = document.getElementById('txWalletLabel');

  [btnExp, btnInc, btnTr].forEach(b => {
    b.className = 'py-2 rounded-lg text-slate-500 hover:text-slate-800 transition';
  });

  if (type === 'expense') {
    btnExp.className = 'py-2 rounded-lg text-rose-600 bg-white dark:bg-dark-card shadow-sm font-bold';
    catGroup.classList.remove('hidden');
    toWalletGroup.classList.add('hidden');
    walletLabel.textContent = 'Dari Dompet';
  } else if (type === 'income') {
    btnInc.className = 'py-2 rounded-lg text-emerald-600 bg-white dark:bg-dark-card shadow-sm font-bold';
    catGroup.classList.remove('hidden');
    toWalletGroup.classList.add('hidden');
    walletLabel.textContent = 'Masuk ke Dompet';
  } else if (type === 'transfer') {
    btnTr.className = 'py-2 rounded-lg text-indigo-600 bg-white dark:bg-dark-card shadow-sm font-bold';
    catGroup.classList.add('hidden');
    toWalletGroup.classList.remove('hidden');
    walletLabel.textContent = 'Dari Dompet Asal';
  }

  App.populateCategorySelects();
}

async function handleSaveTx(e) {
  e.preventDefault();
  const amount = Number(document.getElementById('txAmount').value);
  if (!amount || amount <= 0) {
    App.showToast('Nominal harus lebih dari 0', 'error');
    return;
  }

  const txData = {
    type: App.state.selectedTxType,
    amount: amount,
    wallet_id: document.getElementById('txWalletSelect').value,
    to_wallet_id: App.state.selectedTxType === 'transfer' ? document.getElementById('txToWalletSelect').value : null,
    category_id: App.state.selectedTxType !== 'transfer' ? document.getElementById('txCategorySelect').value : null,
    date: document.getElementById('txDate').value,
    time: document.getElementById('txTime').value,
    note: document.getElementById('txNote').value.trim()
  };

  if (txData.type === 'transfer' && txData.wallet_id == txData.to_wallet_id) {
    App.showToast('Dompet asal dan tujuan tidak boleh sama', 'error');
    return;
  }

  try {
    if (App.state.editingTxId) {
      await API.updateTransaction(App.state.editingTxId, txData);
      App.showToast('Transaksi berhasil diperbarui!');
    } else {
      await API.createTransaction(txData);
      App.showToast('Transaksi berhasil dicatat!');
    }
    closeTxModal();
    await App.refreshMeta();
    await App.loadCurrentTab();
  } catch (err) {
    App.showToast(err.message || 'Gagal menyimpan transaksi', 'error');
  }
}

async function editTx(id) {
  const txs = await API.getTransactions();
  const tx = txs.find(t => t.id == id);
  if (tx) {
    openTxModal(tx);
  }
}

async function deleteTx(id) {
  if (confirm('Yakin ingin menghapus transaksi ini?')) {
    await API.deleteTransaction(id);
    App.showToast('Transaksi berhasil dihapus');
    await App.refreshMeta();
    await App.loadCurrentTab();
  }
}

// Wallet Modal Handlers
function openWalletModal(wallet = null) {
  App.state.editingWalletId = wallet ? wallet.id : null;
  const modal = document.getElementById('walletModal');
  const title = document.getElementById('walletModalTitle');
  if (title) title.textContent = wallet ? 'Edit Dompet' : 'Tambah Dompet Baru';

  document.getElementById('walletName').value = wallet ? wallet.name : '';
  document.getElementById('walletType').value = wallet ? wallet.type : 'bank';
  App.setRupiahValue('walletInitialBalanceFormatted', 'walletInitialBalance', wallet ? wallet.initial_balance : 0);
  document.getElementById('walletColor').value = wallet ? wallet.color : '#3B82F6';

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeWalletModal() {
  document.getElementById('walletModal')?.classList.add('hidden');
}

function editWallet(id) {
  const w = App.state.wallets.find(item => item.id == id);
  if (w) openWalletModal(w);
}

async function deleteWallet(id) {
  if (confirm('Hapus dompet ini? Semua riwayat saldo terkait mungkin terpengaruh.')) {
    try {
      await API.deleteWallet(id);
      App.showToast('Dompet berhasil dihapus');
      await App.refreshMeta();
      await App.loadCurrentTab();
    } catch (e) {
      App.showToast(e.message || 'Gagal menghapus dompet', 'error');
    }
  }
}

async function handleSaveWallet(e) {
  e.preventDefault();
  const name = document.getElementById('walletName').value.trim();
  const type = document.getElementById('walletType').value;
  const initial_balance = Number(document.getElementById('walletInitialBalance').value || 0);
  const color = document.getElementById('walletColor').value;

  const data = { name, type, initial_balance, color, icon: type === 'cash' ? 'banknote' : (type === 'ewallet' ? 'smartphone' : 'credit-card') };

  try {
    if (App.state.editingWalletId) {
      await API.updateWallet(App.state.editingWalletId, data);
      App.showToast('Dompet berhasil diperbarui!');
    } else {
      await API.createWallet(data);
      App.showToast('Dompet baru berhasil dibuat!');
    }
    closeWalletModal();
    await App.refreshMeta();
    await App.loadCurrentTab();
  } catch (err) {
    App.showToast(err.message || 'Gagal menyimpan dompet', 'error');
  }
}

function openTransferModal() {
  openTxModal();
  selectTxType('transfer');
}

// Budget Modal Handlers
function openBudgetModal() {
  App.populateCategorySelects();
  App.setRupiahValue('budgetLimitFormatted', 'budgetLimit', 0);
  document.getElementById('budgetModal')?.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeBudgetModal() {
  document.getElementById('budgetModal')?.classList.add('hidden');
}

async function handleSaveBudget(e) {
  e.preventDefault();
  const category_id = document.getElementById('budgetCategorySelect').value;
  const monthly_limit = Number(document.getElementById('budgetLimit').value);

  if (!monthly_limit || monthly_limit <= 0) {
    App.showToast('Batas anggaran harus lebih dari 0', 'error');
    return;
  }

  await API.saveBudget({ category_id, monthly_limit });
  App.showToast('Anggaran berhasil disimpan!');
  closeBudgetModal();
  await App.loadBudgets();
}

async function deleteBudget(id) {
  if (confirm('Hapus batas anggaran kategori ini?')) {
    await API.deleteBudget(id);
    App.showToast('Anggaran dihapus');
    await App.loadBudgets();
  }
}

// Custom Category Modal Handlers
function openCategoryModal() {
  document.getElementById('categoryName').value = '';
  document.getElementById('categoryModal')?.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeCategoryModal() {
  document.getElementById('categoryModal')?.classList.add('hidden');
}

async function handleSaveCategory(e) {
  e.preventDefault();
  const name = document.getElementById('categoryName').value.trim();
  const type = document.getElementById('categoryType').value;
  const color = document.getElementById('categoryColor').value;

  if (!name) return;

  await API.createCategory({ name, type, color, icon: 'tag' });
  App.showToast('Kategori baru ditambahkan!');
  closeCategoryModal();
  await App.refreshMeta();
}

async function deleteCategory(id) {
  if (confirm('Hapus kategori ini?')) {
    await API.deleteCategory(id);
    App.showToast('Kategori dihapus');
    await App.refreshMeta();
  }
}

// Export / Import
async function exportDataJSON() {
  const data = await API.exportJSON();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `duitku_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  App.showToast('File cadangan JSON berhasil diunduh!');
}

async function exportDataCSV() {
  if (API.isServerOnline) {
    window.location.href = '/api/export/csv';
  } else {
    // Generate CSV on client
    const txs = await API.getTransactions();
    let csv = "ID,Tanggal,Waktu,Tipe,Nominal,Kategori,Dompet,Catatan\n";
    txs.forEach(t => {
      csv += `${t.id},"${t.date}","${t.time}","${t.type}",${t.amount},"${t.category_name || ''}","${t.wallet_name || ''}","${(t.note || '').replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `duitku_transaksi_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast('File transaksi CSV berhasil diekspor!');
  }
}

async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      await API.importJSON(data);
      App.showToast('Pemulihan data berhasil!');
      await App.refreshMeta();
      await App.loadCurrentTab();
    } catch (err) {
      App.showToast('Gagal membaca file JSON cadangan: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function confirmResetAllData() {
  if (confirm('PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA transaksi dan data keuangan? Tindakan ini tidak dapat dibatalkan!')) {
    localStorage.removeItem('duitku_transactions');
    localStorage.removeItem('duitku_wallets');
    localStorage.removeItem('duitku_categories');
    localStorage.removeItem('duitku_budgets');
    location.reload();
  }
}

// ==========================================
// SUPABASE AUTH & CLOUD SYNC MODAL HANDLERS
// ==========================================
let currentAuthTab = 'login';

function openAuthModal() {
  currentAuthTab = 'login';
  selectAuthTab('login');
  const modal = document.getElementById('authModal');
  const emailInput = document.getElementById('authEmail');
  const passInput = document.getElementById('authPassword');
  const alertBox = document.getElementById('authAlertMessage');
  if (emailInput) emailInput.value = '';
  if (passInput) passInput.value = '';
  if (alertBox) {
    alertBox.classList.add('hidden');
    alertBox.textContent = '';
  }
  if (modal) modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
  if (emailInput) setTimeout(() => emailInput.focus(), 100);
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.add('hidden');
}

function selectAuthTab(tab) {
  currentAuthTab = tab;
  const btnLogin = document.getElementById('btnAuthTabLogin');
  const btnRegister = document.getElementById('btnAuthTabRegister');
  const btnSubmitText = document.getElementById('btnAuthSubmitText');
  const alertBox = document.getElementById('authAlertMessage');
  if (alertBox) alertBox.classList.add('hidden');

  if (tab === 'login') {
    if (btnLogin) {
      btnLogin.className = 'py-2 rounded-lg text-emerald-600 bg-white dark:bg-dark-card shadow-sm transition';
    }
    if (btnRegister) {
      btnRegister.className = 'py-2 rounded-lg text-slate-500 hover:text-emerald-600 transition';
    }
    if (btnSubmitText) btnSubmitText.textContent = 'Masuk Sekarang';
  } else {
    if (btnLogin) {
      btnLogin.className = 'py-2 rounded-lg text-slate-500 hover:text-emerald-600 transition';
    }
    if (btnRegister) {
      btnRegister.className = 'py-2 rounded-lg text-emerald-600 bg-white dark:bg-dark-card shadow-sm transition';
    }
    if (btnSubmitText) btnSubmitText.textContent = 'Daftar Akun Baru';
  }
  if (window.lucide) lucide.createIcons();
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const submitBtn = document.getElementById('btnAuthSubmit');
  const submitText = document.getElementById('btnAuthSubmitText');
  const alertBox = document.getElementById('authAlertMessage');

  if (!email || !password) return;

  if (submitBtn) submitBtn.disabled = true;
  if (submitText) submitText.textContent = 'Memproses...';
  if (alertBox) alertBox.classList.add('hidden');

  try {
    if (currentAuthTab === 'login') {
      await API.signIn(email, password);
      App.showToast('Berhasil masuk ke akun Supabase Cloud!');
      closeAuthModal();
      await App.checkConnectionAndLoad();
    } else {
      const res = await API.signUp(email, password);
      if (res && res.session) {
        App.showToast('Akun berhasil dibuat & Anda telah masuk!');
        closeAuthModal();
        await App.checkConnectionAndLoad();
      } else {
        // Email confirmation may be required
        if (alertBox) {
          alertBox.textContent = 'Pendaftaran berhasil! Silakan periksa inbox/spam email Anda untuk verifikasi akun, kemudian beralih ke tab Masuk.';
          alertBox.className = 'p-3 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
          alertBox.classList.remove('hidden');
        }
        selectAuthTab('login');
      }
    }
  } catch (err) {
    console.error('Auth error:', err);
    if (alertBox) {
      let msg = err.message || 'Terjadi kesalahan autentikasi.';
      if (msg.includes('Invalid login credentials')) {
        msg = 'Email atau kata sandi salah. Silakan coba lagi.';
      } else if (msg.includes('Email not confirmed')) {
        msg = 'Email belum diverifikasi. Silakan periksa tautan konfirmasi di inbox email Anda.';
      } else if (msg.includes('User already registered')) {
        msg = 'Email ini sudah terdaftar. Silakan pilih tab Masuk.';
      }
      alertBox.textContent = msg;
      alertBox.className = 'p-3 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
      alertBox.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (submitText) {
      submitText.textContent = currentAuthTab === 'login' ? 'Masuk Sekarang' : 'Daftar Akun Baru';
    }
  }
}

async function handleLogout() {
  if (confirm('Apakah Anda yakin ingin keluar dari akun Cloud Supabase?')) {
    try {
      await API.signOut();
      App.showToast('Anda telah keluar dari akun.');
      await App.checkConnectionAndLoad();
    } catch (err) {
      App.showToast(err.message || 'Gagal keluar', 'error');
    }
  }
}

async function handleSyncLocalToCloud() {
  try {
    const res = await API.syncLocalToCloud();
    App.showToast(res.message);
    await App.refreshMeta();
    await App.loadCurrentTab();
  } catch (err) {
    App.showToast(err.message || 'Gagal menyinkronkan data', 'error');
  }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
