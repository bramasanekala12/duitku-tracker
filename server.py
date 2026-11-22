#!/usr/bin/env python3
"""
DuitKu - Personal Money & Finance Tracker
Backend Server with Built-in SQLite & REST API
Zero external dependencies (uses standard Python library only)
"""

import os
import sys
import json
import sqlite3
import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import mimetypes

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "finance.db")
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# Database Initialization
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Wallets / Accounts table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'bank', -- cash, bank, ewallet, savings, credit
        initial_balance REAL DEFAULT 0,
        color TEXT DEFAULT '#3B82F6',
        icon TEXT DEFAULT 'wallet',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
    """)

    # Categories table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL, -- expense, income
        color TEXT DEFAULT '#10B981',
        icon TEXT DEFAULT 'tag',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
    """)

    # Transactions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL, -- expense, income, transfer
        amount REAL NOT NULL,
        category_id INTEGER,
        wallet_id INTEGER NOT NULL,
        to_wallet_id INTEGER, -- only for transfer
        date TEXT NOT NULL, -- YYYY-MM-DD
        time TEXT DEFAULT '12:00',
        note TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
        FOREIGN KEY (wallet_id) REFERENCES wallets (id) ON DELETE CASCADE,
        FOREIGN KEY (to_wallet_id) REFERENCES wallets (id) ON DELETE CASCADE
    )
    """)

    # Monthly Budgets table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL UNIQUE,
        monthly_limit REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
    )
    """)

    # Check if default wallets exist, if not seed them
    cursor.execute("SELECT COUNT(*) as count FROM wallets")
    if cursor.fetchone()["count"] == 0:
        default_wallets = [
            ("Uang Tunai / Cash", "cash", 0, "#10B981", "banknote"),
            ("Rekening Bank (BCA)", "bank", 0, "#3B82F6", "credit-card"),
            ("E-Wallet (GoPay/Dana)", "ewallet", 0, "#8B5CF6", "smartphone"),
        ]
        cursor.executemany("INSERT INTO wallets (name, type, initial_balance, color, icon) VALUES (?, ?, ?, ?, ?)", default_wallets)

    # Check if default categories exist, if not seed them
    cursor.execute("SELECT COUNT(*) as count FROM categories")
    if cursor.fetchone()["count"] == 0:
        default_categories = [
            # Expense
            ("Makanan & Minuman", "expense", "#EF4444", "utensils"),
            ("Transportasi", "expense", "#F97316", "car"),
            ("Belanja Kebutuhan", "expense", "#F59E0B", "shopping-cart"),
            ("Tagihan & Listrik", "expense", "#3B82F6", "receipt"),
            ("Hiburan & Hobi", "expense", "#8B5CF6", "gamepad-2"),
            ("Kesehatan & Medis", "expense", "#EC4899", "heart-pulse"),
            ("Pendidikan & Belajar", "expense", "#06B6D4", "book-open"),
            ("Keluarga & Donasi", "expense", "#10B981", "users"),
            ("Biaya Lainnya", "expense", "#6B7280", "more-horizontal"),
            # Income
            ("Gaji Pokok", "income", "#10B981", "briefcase"),
            ("Bonus & THR", "income", "#059669", "gift"),
            ("Freelance & Projek", "income", "#0D9488", "laptop"),
            ("Investasi & Dividen", "income", "#14B8A6", "trending-up"),
            ("Hadiah & Pemasukan Lain", "income", "#6EE7B7", "award"),
        ]
        cursor.executemany("INSERT INTO categories (name, type, color, icon) VALUES (?, ?, ?, ?)", default_categories)

    conn.commit()
    conn.close()

class FinanceRequestHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def parse_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            raw_data = self.rfile.read(content_length).decode('utf-8')
            return json.loads(raw_data)
        return {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # API Routes
        if path == '/api/status':
            self.send_json({"status": "ok", "version": "1.0.0", "app": "DuitKu Money Tracker"})
            return

        if path == '/api/summary':
            self.handle_get_summary(query)
            return

        if path == '/api/transactions':
            self.handle_get_transactions(query)
            return

        if path.startswith('/api/transactions/'):
            try:
                tx_id = int(path.split('/')[-1])
                self.handle_get_transaction_by_id(tx_id)
            except ValueError:
                self.send_json({"error": "Invalid ID"}, 400)
            return

        if path == '/api/wallets':
            self.handle_get_wallets()
            return

        if path == '/api/categories':
            self.handle_get_categories()
            return

        if path == '/api/budgets':
            self.handle_get_budgets(query)
            return

        if path == '/api/export/json':
            self.handle_export_json()
            return

        if path == '/api/export/csv':
            self.handle_export_csv()
            return

        # Static file handling
        self.serve_static(path)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/transactions':
            self.handle_create_transaction()
            return

        if path == '/api/wallets':
            self.handle_create_wallet()
            return

        if path == '/api/categories':
            self.handle_create_category()
            return

        if path == '/api/budgets':
            self.handle_save_budget()
            return

        if path == '/api/import/json':
            self.handle_import_json()
            return

        self.send_json({"error": "Endpoint not found"}, 404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/transactions/'):
            try:
                tx_id = int(path.split('/')[-1])
                self.handle_update_transaction(tx_id)
            except ValueError:
                self.send_json({"error": "Invalid ID"}, 400)
            return

        if path.startswith('/api/wallets/'):
            try:
                w_id = int(path.split('/')[-1])
                self.handle_update_wallet(w_id)
            except ValueError:
                self.send_json({"error": "Invalid ID"}, 400)
            return

        self.send_json({"error": "Endpoint not found"}, 404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/transactions/'):
            try:
                tx_id = int(path.split('/')[-1])
                self.handle_delete_transaction(tx_id)
            except ValueError:
                self.send_json({"error": "Invalid ID"}, 400)
            return

        if path.startswith('/api/wallets/'):
            try:
                w_id = int(path.split('/')[-1])
                self.handle_delete_wallet(w_id)
            except ValueError:
                self.send_json({"error": "Invalid ID"}, 400)
            return

        if path.startswith('/api/categories/'):
            try:
                c_id = int(path.split('/')[-1])
                self.handle_delete_category(c_id)
            except ValueError:
                self.send_json({"error": "Invalid ID"}, 400)
            return

        if path.startswith('/api/budgets/'):
            try:
                b_id = int(path.split('/')[-1])
                self.handle_delete_budget(b_id)
            except ValueError:
                self.send_json({"error": "Invalid ID"}, 400)
            return

        self.send_json({"error": "Endpoint not found"}, 404)

    # API Handlers
    def handle_get_summary(self, query):
        now = datetime.datetime.now()
        month = query.get('month', [now.strftime('%Y-%m')])[0]
        start_of_month = f"{month}-01"
        # calculate next month for upper bound
        y, m = map(int, month.split('-'))
        if m == 12:
            next_month = f"{y+1:04d}-01-01"
        else:
            next_month = f"{y:04d}-{m+1:02d}-01"

        conn = get_db()
        cur = conn.cursor()

        # Total Wallet Balances
        # Balance = initial_balance + sum(income) - sum(expense) + sum(transfer in) - sum(transfer out)
        cur.execute("SELECT id, name, initial_balance FROM wallets")
        wallets = cur.fetchall()
        total_balance = 0
        wallet_balances = []

        for w in wallets:
            w_id = w["id"]
            init_bal = w["initial_balance"]
            
            # Incomes for this wallet
            cur.execute("SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE wallet_id = ? AND type = 'income'", (w_id,))
            inc = cur.fetchone()["s"]
            
            # Expenses from this wallet
            cur.execute("SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE wallet_id = ? AND type = 'expense'", (w_id,))
            exp = cur.fetchone()["s"]

            # Transfers out
            cur.execute("SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE wallet_id = ? AND type = 'transfer'", (w_id,))
            tr_out = cur.fetchone()["s"]

            # Transfers in
            cur.execute("SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE to_wallet_id = ? AND type = 'transfer'", (w_id,))
            tr_in = cur.fetchone()["s"]

            current_bal = init_bal + inc - exp + tr_in - tr_out
            total_balance += current_bal
            wallet_balances.append({
                "id": w["id"],
                "name": w["name"],
                "balance": current_bal
            })

        # Month Income & Expense
        cur.execute("""
            SELECT COALESCE(SUM(amount), 0) as total_income 
            FROM transactions 
            WHERE type = 'income' AND date >= ? AND date < ?
        """, (start_of_month, next_month))
        month_income = cur.fetchone()["total_income"]

        cur.execute("""
            SELECT COALESCE(SUM(amount), 0) as total_expense 
            FROM transactions 
            WHERE type = 'expense' AND date >= ? AND date < ?
        """, (start_of_month, next_month))
        month_expense = cur.fetchone()["total_expense"]

        # Category breakdown for expenses this month
        cur.execute("""
            SELECT c.id, c.name, c.color, c.icon, COALESCE(SUM(t.amount), 0) as total
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.type = 'expense' AND t.date >= ? AND t.date < ?
            GROUP BY c.id
            ORDER BY total DESC
        """, (start_of_month, next_month))
        category_breakdown = [dict(row) for row in cur.fetchall()]

        # Cashflow trend past 6 months
        trend = []
        for i in range(5, -1, -1):
            # calculate year and month i months ago
            target_date = (now.replace(day=1) - datetime.timedelta(days=i*30)).replace(day=1)
            ty = target_date.year
            tm = target_date.month
            cur_m_str = f"{ty:04d}-{tm:02d}"
            m_start = f"{cur_m_str}-01"
            if tm == 12:
                m_end = f"{ty+1:04d}-01-01"
            else:
                m_end = f"{ty:04d}-{tm+1:02d}-01"

            cur.execute("SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE type='income' AND date >= ? AND date < ?", (m_start, m_end))
            inc_val = cur.fetchone()["s"]
            cur.execute("SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE type='expense' AND date >= ? AND date < ?", (m_start, m_end))
            exp_val = cur.fetchone()["s"]

            month_names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
            trend.append({
                "month": cur_m_str,
                "label": f"{month_names[tm-1]} {ty}",
                "income": inc_val,
                "expense": exp_val
            })

        # Recent 5 transactions
        cur.execute("""
            SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
                   w.name as wallet_name, tw.name as to_wallet_name
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN wallets w ON t.wallet_id = w.id
            LEFT JOIN wallets tw ON t.to_wallet_id = tw.id
            ORDER BY t.date DESC, t.time DESC, t.id DESC
            LIMIT 5
        """)
        recent_tx = [dict(row) for row in cur.fetchall()]

        conn.close()

        self.send_json({
            "month": month,
            "total_balance": total_balance,
            "month_income": month_income,
            "month_expense": month_expense,
            "net_savings": month_income - month_expense,
            "wallets": wallet_balances,
            "category_breakdown": category_breakdown,
            "trend": trend,
            "recent_transactions": recent_tx
        })

    def handle_get_transactions(self, query):
        conn = get_db()
        cur = conn.cursor()

        sql = """
            SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
                   w.name as wallet_name, tw.name as to_wallet_name
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN wallets w ON t.wallet_id = w.id
            LEFT JOIN wallets tw ON t.to_wallet_id = tw.id
            WHERE 1=1
        """
        params = []

        if 'type' in query and query['type'][0] and query['type'][0] != 'all':
            sql += " AND t.type = ?"
            params.append(query['type'][0])

        if 'wallet_id' in query and query['wallet_id'][0]:
            sql += " AND (t.wallet_id = ? OR t.to_wallet_id = ?)"
            params.append(int(query['wallet_id'][0]))
            params.append(int(query['wallet_id'][0]))

        if 'category_id' in query and query['category_id'][0]:
            sql += " AND t.category_id = ?"
            params.append(int(query['category_id'][0]))

        if 'start_date' in query and query['start_date'][0]:
            sql += " AND t.date >= ?"
            params.append(query['start_date'][0])

        if 'end_date' in query and query['end_date'][0]:
            sql += " AND t.date <= ?"
            params.append(query['end_date'][0])

        if 'month' in query and query['month'][0]:
            sql += " AND t.date LIKE ?"
            params.append(f"{query['month'][0]}%")

        if 'search' in query and query['search'][0]:
            search_term = f"%{query['search'][0]}%"
            sql += " AND (t.note LIKE ? OR c.name LIKE ?)"
            params.append(search_term)
            params.append(search_term)

        sql += " ORDER BY t.date DESC, t.time DESC, t.id DESC"

        limit = query.get('limit', ['100'])[0]
        offset = query.get('offset', ['0'])[0]
        sql += f" LIMIT {int(limit)} OFFSET {int(offset)}"

        cur.execute(sql, params)
        transactions = [dict(row) for row in cur.fetchall()]
        conn.close()
        self.send_json(transactions)

    def handle_get_transaction_by_id(self, tx_id):
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT t.*, c.name as category_name, w.name as wallet_name, tw.name as to_wallet_name
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN wallets w ON t.wallet_id = w.id
            LEFT JOIN wallets tw ON t.to_wallet_id = tw.id
            WHERE t.id = ?
        """, (tx_id,))
        row = cur.fetchone()
        conn.close()
        if row:
            self.send_json(dict(row))
        else:
            self.send_json({"error": "Transaction not found"}, 404)

    def handle_create_transaction(self):
        data = self.parse_json_body()
        tx_type = data.get('type', 'expense')
        amount = float(data.get('amount', 0))
        category_id = data.get('category_id')
        wallet_id = data.get('wallet_id')
        to_wallet_id = data.get('to_wallet_id')
        date_val = data.get('date', datetime.date.today().isoformat())
        time_val = data.get('time', datetime.datetime.now().strftime('%H:%M'))
        note = data.get('note', '')

        if amount <= 0:
            self.send_json({"error": "Nominal harus lebih dari 0"}, 400)
            return

        if not wallet_id:
            self.send_json({"error": "Dompet harus dipilih"}, 400)
            return

        if tx_type == 'transfer' and not to_wallet_id:
            self.send_json({"error": "Dompet tujuan harus dipilih untuk transfer"}, 400)
            return

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO transactions (type, amount, category_id, wallet_id, to_wallet_id, date, time, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (tx_type, amount, category_id, wallet_id, to_wallet_id, date_val, time_val, note))
        conn.commit()
        new_id = cur.lastrowid
        conn.close()

        self.send_json({"id": new_id, "message": "Transaksi berhasil disimpan"})

    def handle_update_transaction(self, tx_id):
        data = self.parse_json_body()
        tx_type = data.get('type', 'expense')
        amount = float(data.get('amount', 0))
        category_id = data.get('category_id')
        wallet_id = data.get('wallet_id')
        to_wallet_id = data.get('to_wallet_id')
        date_val = data.get('date')
        time_val = data.get('time')
        note = data.get('note', '')

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            UPDATE transactions
            SET type = ?, amount = ?, category_id = ?, wallet_id = ?, to_wallet_id = ?, date = ?, time = ?, note = ?
            WHERE id = ?
        """, (tx_type, amount, category_id, wallet_id, to_wallet_id, date_val, time_val, note, tx_id))
        conn.commit()
        conn.close()
        self.send_json({"message": "Transaksi berhasil diperbarui"})

    def handle_delete_transaction(self, tx_id):
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM transactions WHERE id = ?", (tx_id,))
        conn.commit()
        conn.close()
        self.send_json({"message": "Transaksi berhasil dihapus"})

    def handle_get_wallets(self):
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT * FROM wallets ORDER BY id ASC")
        wallets = [dict(w) for w in cur.fetchall()]

        # Compute dynamic balances
        for w in wallets:
            w_id = w["id"]
            init_bal = w["initial_balance"]
            cur.execute("SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE wallet_id = ? AND type = 'income'", (w_id,))
            inc = cur.fetchone()["s"]
            cur.execute("SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE wallet_id = ? AND type = 'expense'", (w_id,))
            exp = cur.fetchone()["s"]
            cur.execute("SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE wallet_id = ? AND type = 'transfer'", (w_id,))
            tr_out = cur.fetchone()["s"]
            cur.execute("SELECT COALESCE(SUM(amount), 0) as s FROM transactions WHERE to_wallet_id = ? AND type = 'transfer'", (w_id,))
            tr_in = cur.fetchone()["s"]

            w["current_balance"] = init_bal + inc - exp + tr_in - tr_out

        conn.close()
        self.send_json(wallets)

    def handle_create_wallet(self):
        data = self.parse_json_body()
        name = data.get('name', '').strip()
        w_type = data.get('type', 'bank')
        initial_balance = float(data.get('initial_balance', 0))
        color = data.get('color', '#3B82F6')
        icon = data.get('icon', 'wallet')

        if not name:
            self.send_json({"error": "Nama dompet wajib diisi"}, 400)
            return

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO wallets (name, type, initial_balance, color, icon)
            VALUES (?, ?, ?, ?, ?)
        """, (name, w_type, initial_balance, color, icon))
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        self.send_json({"id": new_id, "message": "Dompet berhasil dibuat"})

    def handle_update_wallet(self, w_id):
        data = self.parse_json_body()
        name = data.get('name', '').strip()
        w_type = data.get('type', 'bank')
        initial_balance = float(data.get('initial_balance', 0))
        color = data.get('color', '#3B82F6')
        icon = data.get('icon', 'wallet')

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            UPDATE wallets
            SET name = ?, type = ?, initial_balance = ?, color = ?, icon = ?
            WHERE id = ?
        """, (name, w_type, initial_balance, color, icon, w_id))
        conn.commit()
        conn.close()
        self.send_json({"message": "Dompet berhasil diperbarui"})

    def handle_delete_wallet(self, w_id):
        conn = get_db()
        cur = conn.cursor()
        # check how many wallets exist
        cur.execute("SELECT COUNT(*) as count FROM wallets")
        if cur.fetchone()["count"] <= 1:
            conn.close()
            self.send_json({"error": "Minimal harus memiliki 1 dompet aktif"}, 400)
            return

        cur.execute("DELETE FROM wallets WHERE id = ?", (w_id,))
        conn.commit()
        conn.close()
        self.send_json({"message": "Dompet berhasil dihapus"})

    def handle_get_categories(self):
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT * FROM categories ORDER BY type ASC, id ASC")
        categories = [dict(c) for c in cur.fetchall()]
        conn.close()
        self.send_json(categories)

    def handle_create_category(self):
        data = self.parse_json_body()
        name = data.get('name', '').strip()
        c_type = data.get('type', 'expense')
        color = data.get('color', '#10B981')
        icon = data.get('icon', 'tag')

        if not name:
            self.send_json({"error": "Nama kategori wajib diisi"}, 400)
            return

        conn = get_db()
        cur = conn.cursor()
        cur.execute("INSERT INTO categories (name, type, color, icon) VALUES (?, ?, ?, ?)", (name, c_type, color, icon))
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        self.send_json({"id": new_id, "message": "Kategori berhasil ditambahkan"})

    def handle_delete_category(self, c_id):
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM categories WHERE id = ?", (c_id,))
        conn.commit()
        conn.close()
        self.send_json({"message": "Kategori berhasil dihapus"})

    def handle_get_budgets(self, query):
        now = datetime.datetime.now()
        month = query.get('month', [now.strftime('%Y-%m')])[0]
        start_of_month = f"{month}-01"
        y, m = map(int, month.split('-'))
        next_month = f"{y+1:04d}-01-01" if m == 12 else f"{y:04d}-{m+1:02d}-01"

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
                   COALESCE((
                       SELECT SUM(t.amount) 
                       FROM transactions t 
                       WHERE t.category_id = b.category_id 
                         AND t.type = 'expense' 
                         AND t.date >= ? AND t.date < ?
                   ), 0) as spent
            FROM budgets b
            JOIN categories c ON b.category_id = c.id
            ORDER BY b.monthly_limit DESC
        """, (start_of_month, next_month))
        budgets = [dict(b) for b in cur.fetchall()]
        conn.close()
        self.send_json(budgets)

    def handle_save_budget(self):
        data = self.parse_json_body()
        category_id = data.get('category_id')
        monthly_limit = float(data.get('monthly_limit', 0))

        if not category_id or monthly_limit <= 0:
            self.send_json({"error": "Kategori dan batas anggaran harus valid"}, 400)
            return

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO budgets (category_id, monthly_limit)
            VALUES (?, ?)
            ON CONFLICT(category_id) DO UPDATE SET monthly_limit=excluded.monthly_limit
        """, (category_id, monthly_limit))
        conn.commit()
        conn.close()
        self.send_json({"message": "Anggaran berhasil disimpan"})

    def handle_delete_budget(self, b_id):
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM budgets WHERE id = ?", (b_id,))
        conn.commit()
        conn.close()
        self.send_json({"message": "Anggaran berhasil dihapus"})

    def handle_export_json(self):
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT * FROM wallets")
        wallets = [dict(row) for row in cur.fetchall()]
        cur.execute("SELECT * FROM categories")
        categories = [dict(row) for row in cur.fetchall()]
        cur.execute("SELECT * FROM transactions")
        transactions = [dict(row) for row in cur.fetchall()]
        cur.execute("SELECT * FROM budgets")
        budgets = [dict(row) for row in cur.fetchall()]
        conn.close()

        export_data = {
            "version": "1.0",
            "exported_at": datetime.datetime.now().isoformat(),
            "wallets": wallets,
            "categories": categories,
            "transactions": transactions,
            "budgets": budgets
        }
        self.send_json(export_data)

    def handle_export_csv(self):
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT t.id, t.date, t.time, t.type, t.amount, 
                   c.name as category, w.name as wallet, tw.name as to_wallet, t.note
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN wallets w ON t.wallet_id = w.id
            LEFT JOIN wallets tw ON t.to_wallet_id = tw.id
            ORDER BY t.date DESC, t.time DESC
        """)
        rows = cur.fetchall()
        conn.close()

        csv_lines = ["ID,Tanggal,Waktu,Tipe,Nominal,Kategori,Dompet,Dompet_Tujuan,Catatan"]
        for r in rows:
            # Escape commas & quotes
            note_esc = f'"{r["note"] or ""}"' if r["note"] else '""'
            csv_lines.append(f'{r["id"]},{r["date"]},{r["time"]},{r["type"]},{r["amount"]},"{r["category"] or ""}","{r["wallet"] or ""}","{r["to_wallet"] or ""}",{note_esc}')

        csv_content = "\n".join(csv_lines).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/csv; charset=utf-8')
        self.send_header('Content-Disposition', 'attachment; filename="duitku_transactions.csv"')
        self.send_header('Content-Length', str(len(csv_content)))
        self.end_headers()
        self.wfile.write(csv_content)

    def handle_import_json(self):
        data = self.parse_json_body()
        conn = get_db()
        cur = conn.cursor()

        try:
            if "wallets" in data and isinstance(data["wallets"], list):
                for w in data["wallets"]:
                    cur.execute("""
                        INSERT OR REPLACE INTO wallets (id, name, type, initial_balance, color, icon)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (w.get("id"), w.get("name"), w.get("type", "bank"), w.get("initial_balance", 0), w.get("color", "#3B82F6"), w.get("icon", "wallet")))

            if "categories" in data and isinstance(data["categories"], list):
                for c in data["categories"]:
                    cur.execute("""
                        INSERT OR REPLACE INTO categories (id, name, type, color, icon)
                        VALUES (?, ?, ?, ?, ?)
                    """, (c.get("id"), c.get("name"), c.get("type", "expense"), c.get("color", "#10B981"), c.get("icon", "tag")))

            if "transactions" in data and isinstance(data["transactions"], list):
                for t in data["transactions"]:
                    cur.execute("""
                        INSERT OR REPLACE INTO transactions (id, type, amount, category_id, wallet_id, to_wallet_id, date, time, note)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (t.get("id"), t.get("type"), t.get("amount"), t.get("category_id"), t.get("wallet_id"), t.get("to_wallet_id"), t.get("date"), t.get("time", "12:00"), t.get("note", "")))

            if "budgets" in data and isinstance(data["budgets"], list):
                for b in data["budgets"]:
                    cur.execute("""
                        INSERT OR REPLACE INTO budgets (id, category_id, monthly_limit)
                        VALUES (?, ?, ?)
                    """, (b.get("id"), b.get("category_id"), b.get("monthly_limit")))

            conn.commit()
            conn.close()
            self.send_json({"message": "Data berhasil diimpor!"})
        except Exception as e:
            conn.rollback()
            conn.close()
            self.send_json({"error": f"Gagal mengimpor data: {str(e)}"}, 500)

    def serve_static(self, path):
        if path == '/' or path == '':
            path = '/index.html'

        # Strip leading slash
        safe_path = path.lstrip('/')
        file_path = os.path.join(STATIC_DIR, safe_path)

        # Normalize and prevent directory traversal
        real_file_path = os.path.realpath(file_path)
        real_static_dir = os.path.realpath(STATIC_DIR)
        if not real_file_path.startswith(real_static_dir):
            self.send_response(403)
            self.end_headers()
            return

        if not os.path.exists(real_file_path) or os.path.isdir(real_file_path):
            # Fallback to index.html for SPA routing
            real_file_path = os.path.join(STATIC_DIR, "index.html")
            if not os.path.exists(real_file_path):
                self.send_response(404)
                self.end_headers()
                return

        mime_type, _ = mimetypes.guess_type(real_file_path)
        if not mime_type:
            if real_file_path.endswith('.js'):
                mime_type = 'application/javascript'
            elif real_file_path.endswith('.css'):
                mime_type = 'text/css'
            elif real_file_path.endswith('.json') or real_file_path.endswith('.webmanifest'):
                mime_type = 'application/json'
            else:
                mime_type = 'application/octet-stream'

        try:
            with open(real_file_path, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', f"{mime_type}; charset=utf-8")
            self.send_header('Content-Length', str(len(content)))
            # Cache control
            if real_file_path.endswith('.html'):
                self.send_header('Cache-Control', 'no-cache')
            else:
                self.send_header('Cache-Control', 'max-age=86400')
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))

def run_server(port=5000):
    init_db()
    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, FinanceRequestHandler)
    print("=" * 60)
    print(f"💰 DuitKu - Money Tracker Web App Berjalan!")
    print(f"🚀 Akses di Browser: http://localhost:{port}")
    print(f"📱 Atau di jaringan lokal HP/WiFi: http://<IP_HP>:{port}")
    print("Tekan Ctrl + C untuk menghentikan server.")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")
        httpd.server_close()

if __name__ == '__main__':
    port = 5000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port)
