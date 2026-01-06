import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8080;

const DB_CONFIG = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', 
    database: process.env.DB_NAME || 'chatkara',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 20, 
    queueLimit: 0,
    timezone: '+00:00',
    dateStrings: true 
};

if (process.env.INSTANCE_CONNECTION_NAME) {
    DB_CONFIG.socketPath = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
    delete DB_CONFIG.host;
    delete DB_CONFIG.port;
}

const app = express();
let pool = mysql.createPool(DB_CONFIG);
let isDbInitialized = false;

const initDb = async () => {
    console.log(`[SYS-DB] Initializing Enterprise Data Layer...`);
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query("SET time_zone = '+00:00'");

        const ensureTable = async (name, query) => {
            await connection.query(query);
            console.log(`[SYS-DB] Table Verified: '${name}'`);
        };

        await ensureTable('users', `CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role ENUM('Manager', 'Server', 'Chef', 'Bartender') NOT NULL,
            permissions JSON
        )`);

        await ensureTable('ingredients', `CREATE TABLE IF NOT EXISTS ingredients (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            category VARCHAR(50),
            unit VARCHAR(20) NOT NULL,
            unit_cost DECIMAL(10,2) DEFAULT 0.00,
            stock_quantity DECIMAL(10,2) DEFAULT 0.00,
            barcode VARCHAR(100)
        )`);

        await ensureTable('menu_items', `CREATE TABLE IF NOT EXISTS menu_items (
            id VARCHAR(50) PRIMARY KEY,
            category_id VARCHAR(50),
            sub_category_id VARCHAR(50),
            name VARCHAR(100) NOT NULL,
            category VARCHAR(50) NOT NULL,
            sub_category VARCHAR(50),
            price DECIMAL(10,2) NOT NULL,
            portion_prices JSON,
            is_veg BOOLEAN DEFAULT FALSE,
            ingredients JSON,
            description TEXT,
            tags JSON,
            available BOOLEAN DEFAULT TRUE
        )`);

        await ensureTable('orders', `CREATE TABLE IF NOT EXISTS orders (
            id VARCHAR(50) PRIMARY KEY,
            table_number INT,
            server_name VARCHAR(100),
            status ENUM('NEW', 'IN_PROGRESS', 'READY', 'SERVED', 'CANCELLED') DEFAULT 'NEW',
            payment_status ENUM('PENDING', 'PAID', 'CANCELLED') DEFAULT 'PENDING',
            payment_method ENUM('CASH', 'UPI', 'POS', 'ONLINE'),
            created_at DATETIME NOT NULL,
            completed_at DATETIME,
            tax_rate DECIMAL(5,2) DEFAULT 0.00,
            discount DECIMAL(10,2) DEFAULT 0.00
        )`);

        await ensureTable('order_items', `CREATE TABLE IF NOT EXISTS order_items (
            id VARCHAR(50) PRIMARY KEY,
            order_id VARCHAR(50) NOT NULL,
            menu_item_id VARCHAR(50),
            name VARCHAR(100),
            quantity INT DEFAULT 1,
            price_at_order DECIMAL(10,2) NOT NULL,
            portion VARCHAR(20),
            modifiers JSON,
            INDEX (order_id),
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        )`);

        await ensureTable('expenses', `CREATE TABLE IF NOT EXISTS expenses (
            id VARCHAR(50) PRIMARY KEY,
            description TEXT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            category VARCHAR(50),
            date DATETIME NOT NULL,
            reported_by VARCHAR(100),
            receipt_image MEDIUMTEXT
        )`);

        await ensureTable('requisitions', `CREATE TABLE IF NOT EXISTS requisitions (
            id VARCHAR(50) PRIMARY KEY,
            ingredient_id VARCHAR(50),
            ingredient_name VARCHAR(100),
            quantity DECIMAL(10,2) NOT NULL,
            unit VARCHAR(20),
            urgency ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'LOW',
            status ENUM('PENDING', 'ORDERED', 'RECEIVED', 'REJECTED') DEFAULT 'PENDING',
            requested_by VARCHAR(100),
            requested_at DATETIME NOT NULL,
            notes TEXT,
            estimated_unit_cost DECIMAL(10,2),
            preferred_supplier VARCHAR(255)
        )`);

        await ensureTable('customers', `CREATE TABLE IF NOT EXISTS customers (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(20) UNIQUE NOT NULL,
            email VARCHAR(100),
            loyalty_points INT DEFAULT 0,
            total_visits INT DEFAULT 0,
            last_visit DATETIME,
            notes TEXT
        )`);

        const [users] = await connection.query('SELECT count(*) as count FROM users');
        if (users[0].count === 0) {
            await connection.query(
                "INSERT INTO users (id, name, email, password, role, permissions) VALUES (?, ?, ?, ?, ?, ?)",
                ['u-root-admin', 'System Admin', 'admin@biharichatkara.com', 'admin123', 'Manager', JSON.stringify([])]
            );
        }

        isDbInitialized = true;
        console.log("[SYS-DB] Enterprise Data Layer Online.");
    } catch (e) {
        console.error(`[SYS-DB] FATAL: Initialization failed! ${e.message}`);
    } finally {
        if (connection) connection.release();
    }
};

app.use(cors());
app.use(express.json({ limit: '15mb' }));

const parseRow = (row, jsonFields = []) => {
    if (!row) return row;
    const dateFields = ['created_at', 'completed_at', 'date', 'last_visit', 'requested_at'];
    const map = {
        'table_number': 'tableNumber', 'server_name': 'serverName', 'payment_status': 'paymentStatus', 'payment_method': 'paymentMethod',
        'created_at': 'createdAt', 'completed_at': 'completedAt', 'tax_rate': 'taxRate', 'price_at_order': 'priceAtOrder', 
        'menu_item_id': 'menuItemId', 'category_id': 'categoryId', 'sub_category_id': 'subCategoryId', 'sub_category': 'subCategory',
        'is_veg': 'isVeg', 'portion_prices': 'portionPrices', 'unit_cost': 'unitCost', 'stock_quantity': 'stockQuantity',
        'reported_by': 'reportedBy', 'ingredient_id': 'ingredientId', 'ingredient_name': 'ingredientName', 'requested_by': 'requestedBy',
        'requested_at': 'requestedAt', 'estimated_unit_cost': 'estimatedUnitCost', 'loyalty_points': 'loyaltyPoints',
        'total_visits': 'totalVisits', 'last_visit': 'lastVisit', 'receipt_image': 'receiptImage'
    };
    
    const numericFields = ['unitCost', 'stockQuantity', 'price', 'taxRate', 'discount', 'priceAtOrder', 'quantity', 'amount', 'estimatedUnitCost', 'loyaltyPoints', 'totalVisits'];

    const final = {};
    Object.keys(row).forEach(key => {
        const newKey = map[key] || key;
        let val = row[key];
        
        if (dateFields.includes(key) && val && typeof val === 'string') {
            if (!val.includes('T')) {
                val = val.replace(' ', 'T');
            }
            if (!val.includes('Z') && !val.includes('+')) {
                val = val + 'Z';
            }
        }

        if (numericFields.includes(newKey)) val = val === null || val === undefined ? 0 : Number(val);
        final[newKey] = val;
    });

    jsonFields.forEach(field => { 
        if (final[field]) {
            try { final[field] = typeof final[field] === 'string' ? JSON.parse(final[field]) : final[field]; } catch(e) { final[field] = []; } 
        }
    });

    if (final.isVeg !== undefined) final.isVeg = Boolean(final.isVeg);
    if (final.available !== undefined) final.available = Boolean(final.available);
    return final;
};

const api = express.Router();
api.get('/health', (req, res) => res.json({ status: isDbInitialized ? 'ok' : 'initializing', db: isDbInitialized, engine: 'Enterprise v2.5' }));

api.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
        if (rows.length > 0) {
            const user = parseRow(rows[0], ['permissions']);
            delete user.password; 
            res.json({ success: true, user });
        } else res.status(401).json({ success: false, error: 'Access Denied: Invalid Credentials' });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

api.get('/orders', async (req, res) => {
    try {
        const [orders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200');
        const result = orders.map(o => parseRow(o));
        if (result.length > 0) {
            const [allItems] = await pool.query(`SELECT * FROM order_items WHERE order_id IN (?)`, [result.map(o => o.id)]);
            const itemsMap = {};
            allItems.forEach(item => {
                const p = parseRow(item, ['modifiers']);
                if (!itemsMap[p.order_id]) itemsMap[p.order_id] = [];
                itemsMap[p.order_id].push(p);
            });
            result.forEach(order => order.items = itemsMap[order.id] || []);
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

api.post('/orders', async (req, res) => {
    const o = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const createdAt = new Date(o.createdAt).toISOString().slice(0, 19).replace('T', ' ');
        await connection.query(
            'INSERT INTO orders (id, table_number, server_name, status, payment_status, payment_method, created_at, tax_rate, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
            [o.id, o.tableNumber, o.serverName, o.status, o.paymentStatus, o.paymentMethod || null, createdAt, o.taxRate || 0, o.discount || 0]
        );
        for (const i of (o.items || [])) {
            await connection.query(
                'INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, price_at_order, portion, modifiers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
                [i.id, o.id, i.menuItemId, i.name, i.quantity, i.priceAtOrder, i.portion, JSON.stringify(i.modifiers || [])]
            );
        }
        await connection.commit(); res.json({ success: true });
    } catch (e) { await connection.rollback(); res.status(500).json({ error: e.message }); } finally { connection.release(); }
});

api.put('/orders/:id', async (req, res) => {
    const o = req.body;
    try {
        const completedAt = o.completedAt ? new Date(o.completedAt).toISOString().slice(0, 19).replace('T', ' ') : null;
        await pool.query(
            'UPDATE orders SET status = ?, payment_status = ?, payment_method = ?, completed_at = ?, discount = ?, tax_rate = ? WHERE id = ?', 
            [o.status, o.paymentStatus, o.paymentMethod, completedAt, o.discount || 0, o.taxRate || 0, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

api.get('/menu-items', async (req, res) => { 
    try { 
        const [rows] = await pool.query('SELECT * FROM menu_items'); 
        res.json(rows.map(r => parseRow(r, ['ingredients', 'portionPrices', 'tags']))); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

api.post('/menu-items', async (req, res) => {
    const i = req.body;
    try {
        await pool.query(
            'INSERT INTO menu_items (id, category_id, sub_category_id, name, category, sub_category, price, portion_prices, is_veg, ingredients, description, tags, available) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [i.id, i.categoryId, i.subCategoryId, i.name, i.category, i.subCategory, i.price, JSON.stringify(i.portionPrices), i.isVeg, JSON.stringify(i.ingredients), i.description, JSON.stringify(i.tags), i.available]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

api.put('/menu-items/:id', async (req, res) => {
    const i = req.body;
    try {
        await pool.query(
            'UPDATE menu_items SET name=?, category=?, sub_category=?, price=?, portion_prices=?, is_veg=?, ingredients=?, description=?, tags=?, available=? WHERE id=?',
            [i.name, i.category, i.subCategory, i.price, JSON.stringify(i.portionPrices), i.isVeg, JSON.stringify(i.ingredients), i.description, JSON.stringify(i.tags), i.available, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

api.get('/ingredients', async (req, res) => { 
    try { 
        const [rows] = await pool.query('SELECT * FROM ingredients'); 
        res.json(rows.map(r => parseRow(r))); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

api.post('/ingredients', async (req, res) => {
    const i = req.body;
    try {
        await pool.query(
            'INSERT INTO ingredients (id, name, category, unit, unit_cost, stock_quantity, barcode) VALUES (?,?,?,?,?,?,?)',
            [i.id, i.name, i.category, i.unit, i.unitCost, i.stockQuantity, i.barcode]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

api.put('/ingredients/:id', async (req, res) => {
    const i = req.body;
    try {
        await pool.query(
            'UPDATE ingredients SET name=?, category=?, unit=?, unit_cost=?, stock_quantity=?, barcode=? WHERE id=?',
            [i.name, i.category, i.unit, i.unitCost, i.stockQuantity, i.barcode, req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

api.get('/users', async (req, res) => { 
    try { 
        const [rows] = await pool.query('SELECT * FROM users'); 
        res.json(rows.map(r => parseRow(r, ['permissions']))); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

api.post('/users', async (req, res) => {
    const u = req.body;
    try {
        await pool.query(
            'INSERT INTO users (id, name, email, password, role, permissions) VALUES (?,?,?,?,?,?)',
            [u.id, u.name, u.email, u.password, u.role, JSON.stringify(u.permissions || [])]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

api.get('/expenses', async (req, res) => { 
    try { 
        const [rows] = await pool.query('SELECT * FROM expenses ORDER BY date DESC'); 
        res.json(rows.map(r => parseRow(r))); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

api.post('/expenses', async (req, res) => {
    const e = req.body;
    try {
        const dt = new Date(e.date).toISOString().slice(0, 19).replace('T', ' ');
        await pool.query(
            'INSERT INTO expenses (id, description, amount, category, date, reported_by, receipt_image) VALUES (?,?,?,?,?,?,?)',
            [e.id, e.description, e.amount, e.category, dt, e.reportedBy, e.receiptImage]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

api.get('/requisitions', async (req, res) => { 
    try { 
        const [rows] = await pool.query('SELECT * FROM requisitions ORDER BY requested_at DESC'); 
        res.json(rows.map(r => parseRow(r))); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

api.post('/requisitions', async (req, res) => {
    const r = req.body;
    try {
        const dt = new Date(r.requestedAt).toISOString().slice(0, 19).replace('T', ' ');
        await pool.query(
            'INSERT INTO requisitions (id, ingredient_id, ingredient_name, quantity, unit, urgency, status, requested_by, requested_at, notes, estimated_unit_cost, preferred_supplier) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            [r.id, r.ingredientId, r.ingredientName, r.quantity, r.unit, r.urgency, r.status, r.requestedBy, dt, r.notes, r.estimatedUnitCost, r.preferredSupplier]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

api.get('/customers', async (req, res) => { 
    try { 
        const [rows] = await pool.query('SELECT * FROM customers'); 
        res.json(rows.map(r => parseRow(r))); 
    } catch (e) { res.status(500).json({ error: e.message }); } 
});

api.post('/customers', async (req, res) => {
    const c = req.body;
    try {
        const dt = new Date(c.lastVisit).toISOString().slice(0, 19).replace('T', ' ');
        await pool.query(
            'INSERT INTO customers (id, name, phone, email, loyalty_points, total_visits, last_visit, notes) VALUES (?,?,?,?,?,?,?,?)',
            [c.id, c.name, c.phone, c.email, c.loyalty_points, c.total_visits, dt, c.notes]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use('/api', api);

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, 'dist', 'index.html')));
}

initDb().then(() => {
    app.listen(PORT, () => console.log(`[RMS Server] Online at http://localhost:${PORT}`));
});