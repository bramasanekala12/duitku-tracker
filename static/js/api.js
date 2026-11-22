/**
 * DuitKu - API & Data Management Module
 * Tri-Mode Support:
 * 1. Supabase Cloud (Online Multi-Device with Auth & PostgreSQL)
 * 2. Local Python SQLite Server
 * 3. Browser LocalStorage (Offline Mode)
 */

const API = {
  supabase: null,
  currentUser: null,
  isServerOnline: false,

  initSupabase() {
    if (window.supabase && typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url) {
      try {
        if (!this.supabase) {
          this.supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
          // Listen to auth state changes in real-time
          this.supabase.auth.onAuthStateChange((event, session) => {
            this.currentUser = session ? session.user : null;
          });
        }
      } catch (e) {
        console.error("Gagal inisialisasi Supabase:", e);
      }
    }
  },

  async checkAuth() {
    this.initSupabase();
    if (!this.supabase) return null;
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      this.currentUser = session ? session.user : null;
      return this.currentUser;
    } catch (e) {
      console.warn("Auth check error:", e);
      this.currentUser = null;
      return null;
    }
  },

  isCloudMode() {
    return !!(this.supabase && this.currentUser);
  },

  // ==========================================
  // AUTHENTICATION METHODS (SUPABASE)
  // ==========================================
  async signUp(email, password) {
    if (!this.supabase) throw new Error("Supabase client belum siap");
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data && data.user) {
      if (data.session) {
        this.currentUser = data.user;
        // Ensure initial default wallets & categories exist for new user
        await this.ensureInitialSupabaseData(data.user.id);
      }
    }
    return data;
  },

  async signIn(email, password) {
    if (!this.supabase) throw new Error("Supabase client belum siap");
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.currentUser = data.user;
    await this.ensureInitialSupabaseData(data.user.id);
    return data;
  },

  async signOut() {
    if (!this.supabase) return;
    const { error } = await this.supabase.auth.signOut();
    this.currentUser = null;
    if (error) throw error;
  },

  async ensureInitialSupabaseData(userId) {
    try {
      // Check wallets
      const { data: wallets } = await this.supabase.from('wallets').select('id').eq('user_id', userId).limit(1);
      if (!wallets || wallets.length === 0) {
        await this.supabase.from('wallets').insert([
          { user_id: userId, name: "Uang Tunai / Cash", type: "cash", initial_balance: 0, color: "#10B981", icon: "banknote" },
          { user_id: userId, name: "Rekening Bank (BCA)", type: "bank", initial_balance: 0, color: "#3B82F6", icon: "credit-card" },
          { user_id: userId, name: "E-Wallet (GoPay/Dana)", type: "ewallet", initial_balance: 0, color: "#8B5CF6", icon: "smartphone" }
        ]);
      }

      // Check categories
      const { data: categories } = await this.supabase.from('categories').select('id').eq('user_id', userId).limit(1);
      if (!categories || categories.length === 0) {
        await this.supabase.from('categories').insert([
          { user_id: userId, name: "Makanan & Minuman", type: "expense", color: "#EF4444", icon: "utensils" },
          { user_id: userId, name: "Transportasi", type: "expense", color: "#F97316", icon: "car" },
          { user_id: userId, name: "Belanja Kebutuhan", type: "expense", color: "#F59E0B", icon: "shopping-cart" },
          { user_id: userId, name: "Tagihan & Listrik", type: "expense", color: "#3B82F6", icon: "receipt" },
          { user_id: userId, name: "Hiburan & Hobi", type: "expense", color: "#8B5CF6", icon: "gamepad-2" },
          { user_id: userId, name: "Kesehatan & Medis", type: "expense", color: "#EC4899", icon: "heart-pulse" },
          { user_id: userId, name: "Pendidikan & Belajar", type: "expense", color: "#06B6D4", icon: "book-open" },
          { user_id: userId, name: "Keluarga & Donasi", type: "expense", color: "#10B981", icon: "users" },
          { user_id: userId, name: "Biaya Lainnya", type: "expense", color: "#6B7280", icon: "more-horizontal" },
          { user_id: userId, name: "Gaji Pokok", type: "income", color: "#10B981", icon: "briefcase" },
          { user_id: userId, name: "Bonus & THR", type: "income", color: "#059669", icon: "gift" },
          { user_id: userId, name: "Freelance & Projek", type: "income", color: "#0D9488", icon: "laptop" },
          { user_id: userId, name: "Investasi & Dividen", type: "income", color: "#14B8A6", icon: "trending-up" },
          { user_id: userId, name: "Hadiah & Pemasukan Lain", type: "income", color: "#6EE7B7", icon: "award" }
        ]);
      }
    } catch (e) {
      console.warn("Ensure data notice:", e);
    }
  },

  async checkConnection() {
    // Check Supabase first
    const user = await this.checkAuth();
    if (user) {
      return { mode: 'supabase', user: user };
    }

    // Check Local Python Server
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch('/api/status', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        this.isServerOnline = true;
        return { mode: 'sqlite' };
      }
    } catch (e) {
      this.isServerOnline = false;
    }

    return { mode: 'offline' };
  },

  // ==========================================
  // SUMMARY DATA
  // ==========================================
  async getSummary(month) {
    if (this.isCloudMode()) {
      return this.supabaseGetSummary(month);
    }
    if (this.isServerOnline) {
      const res = await fetch(`/api/summary?month=${encodeURIComponent(month)}`);
      return await res.json();
    }
    return this.localGetSummary(month);
  },

  // ==========================================
  // TRANSACTIONS
  // ==========================================
  async getTransactions(params = {}) {
    if (this.isCloudMode()) {
      return this.supabaseGetTransactions(params);
    }
    if (this.isServerOnline) {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/transactions?${qs}`);
      return await res.json();
    }
    return this.localGetTransactions(params);
  },

  async createTransaction(txData) {
    if (this.isCloudMode()) {
      return this.supabaseCreateTransaction(txData);
    }
    if (this.isServerOnline) {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
      });
      return await res.json();
    }
    return this.localCreateTransaction(txData);
  },

  async updateTransaction(id, txData) {
    if (this.isCloudMode()) {
      return this.supabaseUpdateTransaction(id, txData);
    }
    if (this.isServerOnline) {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
      });
      return await res.json();
    }
    return this.localUpdateTransaction(id, txData);
  },

  async deleteTransaction(id) {
    if (this.isCloudMode()) {
      return this.supabaseDeleteTransaction(id);
    }
    if (this.isServerOnline) {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      return await res.json();
    }
    return this.localDeleteTransaction(id);
  },

  // ==========================================
  // WALLETS
  // ==========================================
  async getWallets() {
    if (this.isCloudMode()) {
      return this.supabaseGetWallets();
    }
    if (this.isServerOnline) {
      const res = await fetch('/api/wallets');
      return await res.json();
    }
    return this.localGetWallets();
  },

  async createWallet(data) {
    if (this.isCloudMode()) {
      return this.supabaseCreateWallet(data);
    }
    if (this.isServerOnline) {
      const res = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    }
    return this.localCreateWallet(data);
  },

  async updateWallet(id, data) {
    if (this.isCloudMode()) {
      return this.supabaseUpdateWallet(id, data);
    }
    if (this.isServerOnline) {
      const res = await fetch(`/api/wallets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    }
    return this.localUpdateWallet(id, data);
  },

  async deleteWallet(id) {
    if (this.isCloudMode()) {
      return this.supabaseDeleteWallet(id);
    }
    if (this.isServerOnline) {
      const res = await fetch(`/api/wallets/${id}`, { method: 'DELETE' });
      return await res.json();
    }
    return this.localDeleteWallet(id);
  },

  // ==========================================
  // CATEGORIES
  // ==========================================
  async getCategories() {
    if (this.isCloudMode()) {
      return this.supabaseGetCategories();
    }
    if (this.isServerOnline) {
      const res = await fetch('/api/categories');
      return await res.json();
    }
    return this.localGetCategories();
  },

  async createCategory(data) {
    if (this.isCloudMode()) {
      return this.supabaseCreateCategory(data);
    }
    if (this.isServerOnline) {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    }
    return this.localCreateCategory(data);
  },

  async deleteCategory(id) {
    if (this.isCloudMode()) {
      return this.supabaseDeleteCategory(id);
    }
    if (this.isServerOnline) {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      return await res.json();
    }
    return this.localDeleteCategory(id);
  },

  // ==========================================
  // BUDGETS
  // ==========================================
  async getBudgets(month) {
    if (this.isCloudMode()) {
      return this.supabaseGetBudgets(month);
    }
    if (this.isServerOnline) {
      const res = await fetch(`/api/budgets?month=${encodeURIComponent(month)}`);
      return await res.json();
    }
    return this.localGetBudgets(month);
  },

  async saveBudget(data) {
    if (this.isCloudMode()) {
      return this.supabaseSaveBudget(data);
    }
    if (this.isServerOnline) {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    }
    return this.localSaveBudget(data);
  },

  async deleteBudget(id) {
    if (this.isCloudMode()) {
      return this.supabaseDeleteBudget(id);
    }
    if (this.isServerOnline) {
      const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
      return await res.json();
    }
    return this.localDeleteBudget(id);
  },

  // ==========================================
  // EXPORT & IMPORT
  // ==========================================
  async exportJSON() {
    if (this.isCloudMode()) {
      const [w, c, t, b] = await Promise.all([
        this.supabase.from('wallets').select('*'),
        this.supabase.from('categories').select('*'),
        this.supabase.from('transactions').select('*'),
        this.supabase.from('budgets').select('*')
      ]);
      return {
        version: '1.0',
        mode: 'supabase',
        exported_at: new Date().toISOString(),
        wallets: w.data || [],
        categories: c.data || [],
        transactions: t.data || [],
        budgets: b.data || []
      };
    }
    if (this.isServerOnline) {
      const res = await fetch('/api/export/json');
      return await res.json();
    }
    return {
      version: '1.0',
      mode: 'local',
      exported_at: new Date().toISOString(),
      wallets: this.localGetStorage('duitku_wallets', []),
      categories: this.localGetStorage('duitku_categories', []),
      transactions: this.localGetStorage('duitku_transactions', []),
      budgets: this.localGetStorage('duitku_budgets', [])
    };
  },

  async importJSON(data) {
    if (this.isCloudMode()) {
      const userId = this.currentUser.id;
      if (data.wallets && Array.isArray(data.wallets)) {
        for (const w of data.wallets) {
          const { id, ...wRest } = w;
          await this.supabase.from('wallets').insert([{ ...wRest, user_id: userId }]);
        }
      }
      if (data.categories && Array.isArray(data.categories)) {
        for (const c of data.categories) {
          const { id, ...cRest } = c;
          await this.supabase.from('categories').insert([{ ...cRest, user_id: userId }]);
        }
      }
      if (data.transactions && Array.isArray(data.transactions)) {
        for (const t of data.transactions) {
          const { id, ...tRest } = t;
          await this.supabase.from('transactions').insert([{ ...tRest, user_id: userId }]);
        }
      }
      return { message: "Data berhasil diimpor ke akun Supabase Anda!" };
    }
    if (this.isServerOnline) {
      const res = await fetch('/api/import/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    }
    return this.localImportJSON(data);
  },

  async syncLocalToCloud() {
    if (!this.isCloudMode()) throw new Error("Silakan masuk (login) ke Supabase terlebih dahulu.");
    const localTxs = this.localGetStorage('duitku_transactions', []);
    if (!localTxs || localTxs.length === 0) {
      return { message: "Tidak ada transaksi offline untuk disinkronkan." };
    }

    const userId = this.currentUser.id;
    // Map local wallets & categories to cloud
    const cloudWallets = await this.getWallets();
    const cloudCats = await this.getCategories();
    const defaultWalletId = cloudWallets.length ? cloudWallets[0].id : null;
    const defaultCatId = cloudCats.length ? cloudCats[0].id : null;

    let count = 0;
    for (const t of localTxs) {
      await this.supabase.from('transactions').insert([{
        user_id: userId,
        type: t.type,
        amount: Number(t.amount),
        category_id: t.category_id || defaultCatId,
        wallet_id: t.wallet_id || defaultWalletId,
        to_wallet_id: t.to_wallet_id,
        date: t.date,
        time: t.time || '12:00',
        note: t.note || ''
      }]);
      count++;
    }

    return { message: `Berhasil menyinkronkan ${count} transaksi offline ke Supabase!` };
  },

  // =========================================================================
  // SUPABASE IMPLEMENTATION METHODS
  // =========================================================================
  async supabaseGetWallets() {
    const { data: wallets, error } = await this.supabase
      .from('wallets')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;

    // Get all user transactions to compute dynamic balance
    const { data: txs } = await this.supabase
      .from('transactions')
      .select('type, amount, wallet_id, to_wallet_id');

    const transactions = txs || [];
    return (wallets || []).map(w => {
      const inc = transactions.filter(t => t.wallet_id == w.id && t.type === 'income').reduce((a, b) => a + Number(b.amount), 0);
      const exp = transactions.filter(t => t.wallet_id == w.id && t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);
      const trOut = transactions.filter(t => t.wallet_id == w.id && t.type === 'transfer').reduce((a, b) => a + Number(b.amount), 0);
      const trIn = transactions.filter(t => t.to_wallet_id == w.id && t.type === 'transfer').reduce((a, b) => a + Number(b.amount), 0);
      return {
        ...w,
        current_balance: Number(w.initial_balance || 0) + inc - exp + trIn - trOut
      };
    });
  },

  async supabaseCreateWallet(data) {
    const { data: res, error } = await this.supabase
      .from('wallets')
      .insert([{
        user_id: this.currentUser.id,
        name: data.name,
        type: data.type || 'bank',
        initial_balance: Number(data.initial_balance || 0),
        color: data.color || '#3B82F6',
        icon: data.icon || 'wallet'
      }])
      .select();
    if (error) throw error;
    return { id: res[0].id, message: "Dompet berhasil dibuat di Cloud" };
  },

  async supabaseUpdateWallet(id, data) {
    const { error } = await this.supabase
      .from('wallets')
      .update({
        name: data.name,
        type: data.type,
        initial_balance: Number(data.initial_balance || 0),
        color: data.color,
        icon: data.icon
      })
      .eq('id', id);
    if (error) throw error;
    return { message: "Dompet berhasil diperbarui" };
  },

  async supabaseDeleteWallet(id) {
    const { data: wallets } = await this.supabase.from('wallets').select('id');
    if (wallets && wallets.length <= 1) {
      throw new Error("Minimal harus memiliki 1 dompet aktif");
    }
    const { error } = await this.supabase.from('wallets').delete().eq('id', id);
    if (error) throw error;
    return { message: "Dompet berhasil dihapus" };
  },

  async supabaseGetCategories() {
    const { data: categories, error } = await this.supabase
      .from('categories')
      .select('*')
      .order('type', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw error;
    return categories || [];
  },

  async supabaseCreateCategory(data) {
    const { data: res, error } = await this.supabase
      .from('categories')
      .insert([{
        user_id: this.currentUser.id,
        name: data.name,
        type: data.type || 'expense',
        color: data.color || '#10B981',
        icon: data.icon || 'tag'
      }])
      .select();
    if (error) throw error;
    return { id: res[0].id, message: "Kategori berhasil ditambahkan" };
  },

  async supabaseDeleteCategory(id) {
    const { error } = await this.supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    return { message: "Kategori berhasil dihapus" };
  },

  async supabaseGetTransactions(params = {}) {
    let query = this.supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false });

    if (params.type && params.type !== 'all') {
      query = query.eq('type', params.type);
    }
    if (params.wallet_id) {
      query = query.or(`wallet_id.eq.${params.wallet_id},to_wallet_id.eq.${params.wallet_id}`);
    }
    if (params.category_id) {
      query = query.eq('category_id', params.category_id);
    }
    if (params.month) {
      // Filter by month prefix YYYY-MM
      const [y, m] = params.month.split('-');
      const start = `${params.month}-01`;
      const nextY = parseInt(m) === 12 ? parseInt(y) + 1 : parseInt(y);
      const nextM = parseInt(m) === 12 ? 1 : parseInt(m) + 1;
      const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
      query = query.gte('date', start).lt('date', end);
    }

    const { data: txs, error } = await query;
    if (error) throw error;

    const [categories, wallets] = await Promise.all([
      this.supabaseGetCategories(),
      this.supabase.from('wallets').select('id, name').then(r => r.data || [])
    ]);

    let results = (txs || []).map(t => {
      const cat = categories.find(c => c.id == t.category_id);
      const w = wallets.find(w => w.id == t.wallet_id);
      const tw = wallets.find(w => w.id == t.to_wallet_id);
      return {
        ...t,
        category_name: cat ? cat.name : null,
        category_color: cat ? cat.color : '#6B7280',
        category_icon: cat ? cat.icon : 'tag',
        wallet_name: w ? w.name : null,
        to_wallet_name: tw ? tw.name : null
      };
    });

    if (params.search) {
      const q = params.search.toLowerCase();
      results = results.filter(t => {
        const catName = (t.category_name || '').toLowerCase();
        const note = (t.note || '').toLowerCase();
        return catName.includes(q) || note.includes(q);
      });
    }

    return results;
  },

  async supabaseCreateTransaction(data) {
    const { data: res, error } = await this.supabase
      .from('transactions')
      .insert([{
        user_id: this.currentUser.id,
        type: data.type,
        amount: Number(data.amount),
        category_id: data.category_id ? Number(data.category_id) : null,
        wallet_id: Number(data.wallet_id),
        to_wallet_id: data.to_wallet_id ? Number(data.to_wallet_id) : null,
        date: data.date,
        time: data.time || '12:00',
        note: data.note || ''
      }])
      .select();
    if (error) throw error;
    return { id: res[0].id, message: "Transaksi berhasil dicatat di Cloud" };
  },

  async supabaseUpdateTransaction(id, data) {
    const { error } = await this.supabase
      .from('transactions')
      .update({
        type: data.type,
        amount: Number(data.amount),
        category_id: data.category_id ? Number(data.category_id) : null,
        wallet_id: Number(data.wallet_id),
        to_wallet_id: data.to_wallet_id ? Number(data.to_wallet_id) : null,
        date: data.date,
        time: data.time || '12:00',
        note: data.note || ''
      })
      .eq('id', id);
    if (error) throw error;
    return { message: "Transaksi berhasil diperbarui" };
  },

  async supabaseDeleteTransaction(id) {
    const { error } = await this.supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
    return { message: "Transaksi berhasil dihapus" };
  },

  async supabaseGetBudgets(month) {
    const { data: budgets, error } = await this.supabase.from('budgets').select('*');
    if (error) throw error;

    const [categories, txs] = await Promise.all([
      this.supabaseGetCategories(),
      this.supabase.from('transactions').select('category_id, amount, type, date').eq('type', 'expense')
    ]);

    const monthTxs = (txs.data || []).filter(t => t.date && t.date.startsWith(month));

    return (budgets || []).map(b => {
      const cat = categories.find(c => c.id == b.category_id);
      const spent = monthTxs
        .filter(t => t.category_id == b.category_id)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return {
        ...b,
        category_name: cat ? cat.name : 'Kategori',
        category_color: cat ? cat.color : '#3B82F6',
        category_icon: cat ? cat.icon : 'tag',
        spent: spent
      };
    });
  },

  async supabaseSaveBudget(data) {
    const { error } = await this.supabase
      .from('budgets')
      .upsert({
        user_id: this.currentUser.id,
        category_id: Number(data.category_id),
        monthly_limit: Number(data.monthly_limit)
      }, { onConflict: 'user_id, category_id' });
    if (error) throw error;
    return { message: "Anggaran berhasil disimpan di Cloud" };
  },

  async supabaseDeleteBudget(id) {
    const { error } = await this.supabase.from('budgets').delete().eq('id', id);
    if (error) throw error;
    return { message: "Anggaran berhasil dihapus" };
  },

  async supabaseGetSummary(month) {
    const [wallets, categories, allTxs] = await Promise.all([
      this.supabaseGetWallets(),
      this.supabaseGetCategories(),
      this.supabaseGetTransactions()
    ]);

    const monthTxs = allTxs.filter(t => t.date && t.date.startsWith(month));
    const totalBalance = wallets.reduce((acc, w) => acc + (w.current_balance || 0), 0);
    const monthIncome = monthTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
    const monthExpense = monthTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);

    // Category breakdown
    const catMap = {};
    monthTxs.filter(t => t.type === 'expense').forEach(t => {
      const cId = t.category_id || 0;
      if (!catMap[cId]) {
        const cat = categories.find(c => c.id == cId);
        catMap[cId] = {
          id: cId,
          name: cat ? cat.name : 'Lainnya',
          color: cat ? cat.color : '#6B7280',
          icon: cat ? cat.icon : 'tag',
          total: 0
        };
      }
      catMap[cId].total += Number(t.amount);
    });
    const categoryBreakdown = Object.values(catMap).sort((a, b) => b.total - a.total);

    // Trend last 6 months
    const trend = [];
    const now = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mTxs = allTxs.filter(t => t.date && t.date.startsWith(mStr));
      trend.push({
        month: mStr,
        label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        income: mTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0),
        expense: mTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0)
      });
    }

    return {
      month: month,
      total_balance: totalBalance,
      month_income: monthIncome,
      month_expense: monthExpense,
      net_savings: monthIncome - monthExpense,
      wallets: wallets,
      category_breakdown: categoryBreakdown,
      trend: trend,
      recent_transactions: allTxs.slice(0, 5)
    };
  },

  // =========================================================================
  // LOCALSTORAGE FALLBACK ENGINE (Autonomous offline mode)
  // =========================================================================
  localGetStorage(key, defaultVal) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  },

  localSetStorage(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.error("Storage error:", e);
    }
  },

  initLocalDefaults() {
    let wallets = this.localGetStorage('duitku_wallets', null);
    if (!wallets || wallets.length === 0) {
      wallets = [
        { id: 1, name: "Uang Tunai / Cash", type: "cash", initial_balance: 0, color: "#10B981", icon: "banknote" },
        { id: 2, name: "Rekening Bank (BCA)", type: "bank", initial_balance: 0, color: "#3B82F6", icon: "credit-card" },
        { id: 3, name: "E-Wallet (GoPay/Dana)", type: "ewallet", initial_balance: 0, color: "#8B5CF6", icon: "smartphone" }
      ];
      this.localSetStorage('duitku_wallets', wallets);
    }

    let categories = this.localGetStorage('duitku_categories', null);
    if (!categories || categories.length === 0) {
      categories = [
        { id: 1, name: "Makanan & Minuman", type: "expense", color: "#EF4444", icon: "utensils" },
        { id: 2, name: "Transportasi", type: "expense", color: "#F97316", icon: "car" },
        { id: 3, name: "Belanja Kebutuhan", type: "expense", color: "#F59E0B", icon: "shopping-cart" },
        { id: 4, name: "Tagihan & Listrik", type: "expense", color: "#3B82F6", icon: "receipt" },
        { id: 5, name: "Hiburan & Hobi", type: "expense", color: "#8B5CF6", icon: "gamepad-2" },
        { id: 6, name: "Kesehatan & Medis", type: "expense", color: "#EC4899", icon: "heart-pulse" },
        { id: 7, name: "Pendidikan & Belajar", type: "expense", color: "#06B6D4", icon: "book-open" },
        { id: 8, name: "Keluarga & Donasi", type: "expense", color: "#10B981", icon: "users" },
        { id: 9, name: "Biaya Lainnya", type: "expense", color: "#6B7280", icon: "more-horizontal" },
        { id: 10, name: "Gaji Pokok", type: "income", color: "#10B981", icon: "briefcase" },
        { id: 11, name: "Bonus & THR", type: "income", color: "#059669", icon: "gift" },
        { id: 12, name: "Freelance & Projek", type: "income", color: "#0D9488", icon: "laptop" },
        { id: 13, name: "Investasi & Dividen", type: "income", color: "#14B8A6", icon: "trending-up" },
        { id: 14, name: "Hadiah & Pemasukan Lain", type: "income", color: "#6EE7B7", icon: "award" }
      ];
      this.localSetStorage('duitku_categories', categories);
    }

    let txs = this.localGetStorage('duitku_transactions', null);
    if (!txs) this.localSetStorage('duitku_transactions', []);

    let budgets = this.localGetStorage('duitku_budgets', null);
    if (!budgets) this.localSetStorage('duitku_budgets', []);
  },

  localGetWallets() {
    this.initLocalDefaults();
    const wallets = this.localGetStorage('duitku_wallets', []);
    const txs = this.localGetStorage('duitku_transactions', []);

    return wallets.map(w => {
      const inc = txs.filter(t => t.wallet_id == w.id && t.type === 'income').reduce((a, b) => a + Number(b.amount), 0);
      const exp = txs.filter(t => t.wallet_id == w.id && t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);
      const trOut = txs.filter(t => t.wallet_id == w.id && t.type === 'transfer').reduce((a, b) => a + Number(b.amount), 0);
      const trIn = txs.filter(t => t.to_wallet_id == w.id && t.type === 'transfer').reduce((a, b) => a + Number(b.amount), 0);
      return {
        ...w,
        current_balance: Number(w.initial_balance || 0) + inc - exp + trIn - trOut
      };
    });
  },

  localCreateWallet(data) {
    const wallets = this.localGetStorage('duitku_wallets', []);
    const newId = wallets.length ? Math.max(...wallets.map(w => w.id)) + 1 : 1;
    const newW = {
      id: newId,
      name: data.name,
      type: data.type || 'bank',
      initial_balance: Number(data.initial_balance || 0),
      color: data.color || '#3B82F6',
      icon: data.icon || 'wallet'
    };
    wallets.push(newW);
    this.localSetStorage('duitku_wallets', wallets);
    return { id: newId, message: "Dompet berhasil dibuat" };
  },

  localUpdateWallet(id, data) {
    let wallets = this.localGetStorage('duitku_wallets', []);
    wallets = wallets.map(w => w.id == id ? { ...w, ...data, initial_balance: Number(data.initial_balance || 0) } : w);
    this.localSetStorage('duitku_wallets', wallets);
    return { message: "Dompet berhasil diperbarui" };
  },

  localDeleteWallet(id) {
    let wallets = this.localGetStorage('duitku_wallets', []);
    if (wallets.length <= 1) throw new Error("Minimal harus memiliki 1 dompet aktif");
    wallets = wallets.filter(w => w.id != id);
    this.localSetStorage('duitku_wallets', wallets);
    return { message: "Dompet berhasil dihapus" };
  },

  localGetCategories() {
    this.initLocalDefaults();
    return this.localGetStorage('duitku_categories', []);
  },

  localCreateCategory(data) {
    const categories = this.localGetStorage('duitku_categories', []);
    const newId = categories.length ? Math.max(...categories.map(c => c.id)) + 1 : 1;
    const newC = {
      id: newId,
      name: data.name,
      type: data.type || 'expense',
      color: data.color || '#10B981',
      icon: data.icon || 'tag'
    };
    categories.push(newC);
    this.localSetStorage('duitku_categories', categories);
    return { id: newId, message: "Kategori berhasil ditambahkan" };
  },

  localDeleteCategory(id) {
    let categories = this.localGetStorage('duitku_categories', []);
    categories = categories.filter(c => c.id != id);
    this.localSetStorage('duitku_categories', categories);
    return { message: "Kategori berhasil dihapus" };
  },

  localGetTransactions(params = {}) {
    this.initLocalDefaults();
    let txs = this.localGetStorage('duitku_transactions', []);
    const categories = this.localGetStorage('duitku_categories', []);
    const wallets = this.localGetStorage('duitku_wallets', []);

    if (params.type && params.type !== 'all') {
      txs = txs.filter(t => t.type === params.type);
    }
    if (params.wallet_id) {
      txs = txs.filter(t => t.wallet_id == params.wallet_id || t.to_wallet_id == params.wallet_id);
    }
    if (params.category_id) {
      txs = txs.filter(t => t.category_id == params.category_id);
    }
    if (params.month) {
      txs = txs.filter(t => t.date && t.date.startsWith(params.month));
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      txs = txs.filter(t => {
        const cat = categories.find(c => c.id == t.category_id);
        const catName = cat ? cat.name.toLowerCase() : '';
        const note = (t.note || '').toLowerCase();
        return catName.includes(q) || note.includes(q);
      });
    }

    txs.sort((a, b) => {
      const dtA = (a.date || '') + ' ' + (a.time || '00:00');
      const dtB = (b.date || '') + ' ' + (b.time || '00:00');
      return dtB.localeCompare(dtA);
    });

    return txs.map(t => {
      const cat = categories.find(c => c.id == t.category_id);
      const w = wallets.find(w => w.id == t.wallet_id);
      const tw = wallets.find(w => w.id == t.to_wallet_id);
      return {
        ...t,
        category_name: cat ? cat.name : null,
        category_color: cat ? cat.color : '#6B7280',
        category_icon: cat ? cat.icon : 'tag',
        wallet_name: w ? w.name : null,
        to_wallet_name: tw ? tw.name : null
      };
    });
  },

  localCreateTransaction(data) {
    const txs = this.localGetStorage('duitku_transactions', []);
    const newId = txs.length ? Math.max(...txs.map(t => t.id)) + 1 : 1;
    const newTx = {
      id: newId,
      type: data.type,
      amount: Number(data.amount),
      category_id: data.category_id ? Number(data.category_id) : null,
      wallet_id: Number(data.wallet_id),
      to_wallet_id: data.to_wallet_id ? Number(data.to_wallet_id) : null,
      date: data.date,
      time: data.time || '12:00',
      note: data.note || ''
    };
    txs.push(newTx);
    this.localSetStorage('duitku_transactions', txs);
    return { id: newId, message: "Transaksi berhasil disimpan" };
  },

  localUpdateTransaction(id, data) {
    let txs = this.localGetStorage('duitku_transactions', []);
    txs = txs.map(t => t.id == id ? {
      ...t,
      type: data.type,
      amount: Number(data.amount),
      category_id: data.category_id ? Number(data.category_id) : null,
      wallet_id: Number(data.wallet_id),
      to_wallet_id: data.to_wallet_id ? Number(data.to_wallet_id) : null,
      date: data.date,
      time: data.time || '12:00',
      note: data.note || ''
    } : t);
    this.localSetStorage('duitku_transactions', txs);
    return { message: "Transaksi berhasil diperbarui" };
  },

  localDeleteTransaction(id) {
    let txs = this.localGetStorage('duitku_transactions', []);
    txs = txs.filter(t => t.id != id);
    this.localSetStorage('duitku_transactions', txs);
    return { message: "Transaksi berhasil dihapus" };
  },

  localGetBudgets(month) {
    const budgets = this.localGetStorage('duitku_budgets', []);
    const categories = this.localGetStorage('duitku_categories', []);
    const txs = this.localGetStorage('duitku_transactions', []);

    return budgets.map(b => {
      const cat = categories.find(c => c.id == b.category_id);
      const spent = txs
        .filter(t => t.category_id == b.category_id && t.type === 'expense' && t.date && t.date.startsWith(month))
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return {
        ...b,
        category_name: cat ? cat.name : 'Kategori',
        category_color: cat ? cat.color : '#3B82F6',
        category_icon: cat ? cat.icon : 'tag',
        spent: spent
      };
    });
  },

  localSaveBudget(data) {
    let budgets = this.localGetStorage('duitku_budgets', []);
    const existingIdx = budgets.findIndex(b => b.category_id == data.category_id);
    if (existingIdx >= 0) {
      budgets[existingIdx].monthly_limit = Number(data.monthly_limit);
    } else {
      const newId = budgets.length ? Math.max(...budgets.map(b => b.id)) + 1 : 1;
      budgets.push({
        id: newId,
        category_id: Number(data.category_id),
        monthly_limit: Number(data.monthly_limit)
      });
    }
    this.localSetStorage('duitku_budgets', budgets);
    return { message: "Anggaran berhasil disimpan" };
  },

  localDeleteBudget(id) {
    let budgets = this.localGetStorage('duitku_budgets', []);
    budgets = budgets.filter(b => b.id != id);
    this.localSetStorage('duitku_budgets', budgets);
    return { message: "Anggaran berhasil dihapus" };
  },

  localGetSummary(month) {
    const wallets = this.localGetWallets();
    const categories = this.localGetCategories();
    const allTxs = this.localGetTransactions();
    const monthTxs = allTxs.filter(t => t.date && t.date.startsWith(month));

    const totalBalance = wallets.reduce((acc, w) => acc + (w.current_balance || 0), 0);
    const monthIncome = monthTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
    const monthExpense = monthTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);

    const catMap = {};
    monthTxs.filter(t => t.type === 'expense').forEach(t => {
      const cId = t.category_id || 0;
      if (!catMap[cId]) {
        const cat = categories.find(c => c.id == cId);
        catMap[cId] = {
          id: cId,
          name: cat ? cat.name : 'Lainnya',
          color: cat ? cat.color : '#6B7280',
          icon: cat ? cat.icon : 'tag',
          total: 0
        };
      }
      catMap[cId].total += Number(t.amount);
    });
    const categoryBreakdown = Object.values(catMap).sort((a, b) => b.total - a.total);

    const trend = [];
    const now = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mTxs = allTxs.filter(t => t.date && t.date.startsWith(mStr));
      trend.push({
        month: mStr,
        label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        income: mTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0),
        expense: mTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0)
      });
    }

    return {
      month: month,
      total_balance: totalBalance,
      month_income: monthIncome,
      month_expense: monthExpense,
      net_savings: monthIncome - monthExpense,
      wallets: wallets,
      category_breakdown: categoryBreakdown,
      trend: trend,
      recent_transactions: allTxs.slice(0, 5)
    };
  },

  localImportJSON(data) {
    if (data.wallets) this.localSetStorage('duitku_wallets', data.wallets);
    if (data.categories) this.localSetStorage('duitku_categories', data.categories);
    if (data.transactions) this.localSetStorage('duitku_transactions', data.transactions);
    if (data.budgets) this.localSetStorage('duitku_budgets', data.budgets);
    return { message: "Data berhasil diimpor!" };
  }
};
