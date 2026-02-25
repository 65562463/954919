import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import jwt from 'jsonwebtoken'; // For QR code encryption

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeythatshouldbeverylongandrandom';

// Helper functions for JWT (QR Code) encryption/decryption
function generateLoyaltyToken(customerId: number): string {
  const payload = { customerId, timestamp: Date.now() };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '90s' }); // Token valid for 90 seconds
}

function verifyLoyaltyToken(token: string): { customerId: number; timestamp: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { customerId: number; timestamp: number; exp: number; iat: number };
    // Check if token is within 90 seconds of generation (extra check for client-side generation)
    const now = Date.now();
    if (now - decoded.timestamp > 90 * 1000 + (5 * 1000)) { // 90s + 5s grace period
      console.warn('[SERVER] Token too old based on timestamp in payload');
      return null;
    }
    return { customerId: decoded.customerId, timestamp: decoded.timestamp };
  } catch (error) {
    console.error('[SERVER] JWT verification failed:', error);
    return null;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const db = new Database('pos.db');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pin TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL, -- 'admin' or 'cashier'
    branch_id INTEGER,
    FOREIGN KEY(branch_id) REFERENCES branches(id)
  );

  CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    cost_price REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL, -- 'kg' or 'piece'
    barcode TEXT,
    image_url TEXT,
    low_stock_threshold REAL NOT NULL DEFAULT 10,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS branch_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER,
    product_id INTEGER,
    stock_quantity REAL DEFAULT 0,
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(product_id) REFERENCES products(id),
    UNIQUE(branch_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS stock_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_branch_id INTEGER,
    to_branch_id INTEGER,
    product_id INTEGER,
    quantity REAL NOT NULL,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(from_branch_id) REFERENCES branches(id),
    FOREIGN KEY(to_branch_id) REFERENCES branches(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_info TEXT
  );

  CREATE TABLE IF NOT EXISTS purchase_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER,
    supplier_id INTEGER,
    total_amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
  );

  CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER,
    product_id INTEGER,
    quantity REAL NOT NULL,
    cost_price REAL NOT NULL,
    FOREIGN KEY(invoice_id) REFERENCES purchase_invoices(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS waste_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER,
    product_id INTEGER,
    quantity REAL NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(branch_id) REFERENCES branches(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER,
    total_amount REAL NOT NULL,
    tax_amount REAL NOT NULL,
    discount_amount REAL NOT NULL,
    total_cost REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(branch_id) REFERENCES branches(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    cost REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    total_points INTEGER NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'برونزي' -- 'برونزي', 'فضي', 'ذهبي'
  );

  CREATE TABLE IF NOT EXISTS rewards_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    points_required INTEGER NOT NULL,
    product_id INTEGER, -- Optional: if reward is a specific product
    product_quantity REAL, -- Quantity of product if applicable
    is_available BOOLEAN NOT NULL DEFAULT 1,
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS points_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    order_id INTEGER, -- Can be NULL if points are added/redeemed outside an order
    points_added INTEGER NOT NULL DEFAULT 0,
    points_redeemed INTEGER NOT NULL DEFAULT 0,
    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id),
    FOREIGN KEY(order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS validation_tokens (
    token TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT 0,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS receipt_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_name TEXT NOT NULL DEFAULT 'متجر الخضار والفواكه',
    branch_default_name TEXT NOT NULL DEFAULT 'فرع الرياض - العليا',
    tax_number TEXT NOT NULL DEFAULT '300000000000003',
    invoice_type TEXT NOT NULL DEFAULT 'فاتورة ضريبية مبسطة',
    thank_you_message TEXT NOT NULL DEFAULT 'شكراً لتسوقكم معنا!',
    return_policy TEXT NOT NULL DEFAULT 'البضاعة المباعة لا ترد ولا تستبدل إلا حسب الشروط',
    qr_code_image_url TEXT -- Optional QR code image for app download etc.
  );
`);

// Migration: Add low_stock_threshold to products table if it doesn't exist
try {
  db.prepare('SELECT low_stock_threshold FROM products LIMIT 1').get();
} catch (e) {
  console.log('[SERVER] Running migration: Adding low_stock_threshold to products table...');
  db.exec('ALTER TABLE products ADD COLUMN low_stock_threshold REAL NOT NULL DEFAULT 10');
}

// Ensure receipt_settings has a default row
const receiptSettingsCount = db.prepare('SELECT COUNT(*) as count FROM receipt_settings').get() as { count: number };
if (receiptSettingsCount.count === 0) {
  console.log('[SERVER] Seeding default receipt settings...');
  db.prepare('INSERT INTO receipt_settings (id, store_name, branch_default_name, tax_number, invoice_type, thank_you_message, return_policy, qr_code_image_url) VALUES (1, ?, ?, ?, ?, ?, ?, ?)')
    .run('متجر الخضار والفواكه', 'فرع الرياض - العليا', '300000000000003', 'فاتورة ضريبية مبسطة', 'شكراً لتسوقكم معنا!', 'البضاعة المباعة لا ترد ولا تستبدل إلا حسب الشروط', null);
}


// Seed initial data if empty
const branchCount = db.prepare('SELECT COUNT(*) as count FROM branches').get() as { count: number };
const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };

if (branchCount.count === 0 || productCount.count === 0) {
  console.log('[SERVER] Database empty or incomplete, seeding...');
  
  // Clear existing to avoid unique constraint errors if partially seeded
  db.transaction(() => {
    db.prepare('DELETE FROM branch_inventory').run();
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM categories').run();
    db.prepare('DELETE FROM branches').run();
    db.prepare('DELETE FROM suppliers').run();
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM customers').run(); // Clear customers
    db.prepare('DELETE FROM rewards_catalog').run(); // Clear rewards
    db.prepare('DELETE FROM points_transactions').run(); // Clear transactions
    db.prepare('DELETE FROM validation_tokens').run(); // Clear tokens
    db.prepare('DELETE FROM receipt_settings').run(); // Clear receipt settings
  })();

  // Seed default receipt settings
  db.prepare('INSERT INTO receipt_settings (store_name, branch_default_name, tax_number, invoice_type, thank_you_message, return_policy, qr_code_image_url) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('متجر الخضار والفواكه', 'فرع الرياض - العليا', '300000000000003', 'فاتورة ضريبية مبسطة', 'شكراً لتسوقكم معنا!', 'البضاعة المباعة لا ترد ولا تستبدل إلا حسب الشروط', null);

  console.log('[SERVER] Default receipt settings seeded successfully');

  const insertBranch = db.prepare('INSERT INTO branches (name, location) VALUES (?, ?)');
  const branchRiyadh = insertBranch.run('فرع الرياض - العليا', 'الرياض').lastInsertRowid;
  const branchJeddah = insertBranch.run('فرع جدة - التحلية', 'جدة').lastInsertRowid;

  const insertCategory = db.prepare('INSERT INTO categories (name) VALUES (?)');
  const catFruits = insertCategory.run('فواكه').lastInsertRowid;
  const catVeg = insertCategory.run('خضروات').lastInsertRowid;

  const insertProduct = db.prepare('INSERT INTO products (category_id, name, price, cost_price, unit, barcode, image_url, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertInventory = db.prepare('INSERT INTO branch_inventory (branch_id, product_id, stock_quantity) VALUES (?, ?, ?)');
  
  const addProduct = (cat: number | bigint, name: string, price: number, cost: number, unit: string, barcode: string, img: string, stock1: number, stock2: number, threshold: number = 10) => {
    const pid = insertProduct.run(cat, name, price, cost, unit, barcode, img, threshold).lastInsertRowid;
    insertInventory.run(branchRiyadh, pid, stock1);
    insertInventory.run(branchJeddah, pid, stock2);
  };

  // Fruits
  addProduct(catFruits, 'تفاح أحمر', 8.5, 5.0, 'kg', '10001', 'https://images.unsplash.com/photo-1560806887-1e4cd0b6faa6?w=400&h=300&fit=crop', 50, 30);
  addProduct(catFruits, 'موز', 5.0, 3.0, 'kg', '10002', 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&h=300&fit=crop', 30, 20);
  addProduct(catFruits, 'برتقال', 6.0, 4.0, 'kg', '10003', 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=400&h=300&fit=crop', 8, 40);
  addProduct(catFruits, 'بطيخ', 2.5, 1.5, 'kg', '10004', 'https://images.unsplash.com/photo-1589984662646-e7b2e4962f18?w=400&h=300&fit=crop', 100, 50);
  addProduct(catFruits, 'أناناس', 15.0, 10.0, 'piece', '10005', 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=400&h=300&fit=crop', 20, 15);
  
  // Vegetables
  addProduct(catVeg, 'طماطم', 4.5, 2.5, 'kg', '20001', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&h=300&fit=crop', 40, 60);
  addProduct(catVeg, 'خيار', 3.5, 2.0, 'kg', '20002', 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=400&h=300&fit=crop', 25, 30);
  addProduct(catVeg, 'بصل أحمر', 2.0, 1.0, 'kg', '20003', 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400&h=300&fit=crop', 60, 80);
  addProduct(catVeg, 'بطاطس', 3.0, 1.5, 'kg', '20004', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&h=300&fit=crop', 80, 100);
  addProduct(catVeg, 'خس', 4.0, 2.0, 'piece', '20005', 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=400&h=300&fit=crop', 5, 25);

  const insertSupplier = db.prepare('INSERT INTO suppliers (name, contact_info) VALUES (?, ?)');
  insertSupplier.run('مزارع القصيم', '0500000001');
  insertSupplier.run('شركة الفواكه الطازجة', '0500000002');

  // Seed Loyalty Program Data
  const insertCustomer = db.prepare('INSERT INTO customers (name, total_points, tier) VALUES (?, ?, ?)');
  const customer1 = insertCustomer.run('عميل مميز 1', 1500, 'ذهبي').lastInsertRowid;
  const customer2 = insertCustomer.run('عميل مميز 2', 400, 'فضي').lastInsertRowid;
  const customer3 = insertCustomer.run('عميل مميز 3', 50, 'برونزي').lastInsertRowid;

  const insertReward = db.prepare('INSERT INTO rewards_catalog (name, points_required, product_id, product_quantity, is_available) VALUES (?, ?, ?, ?, ?)');
  const appleProduct = db.prepare('SELECT id FROM products WHERE name = ?').get('تفاح أحمر') as {id: number};
  const bananaProduct = db.prepare('SELECT id FROM products WHERE name = ?').get('موز') as {id: number};

  insertReward.run('خصم 10% على الفاتورة', 500, null, null, 1);
  insertReward.run('1 كجم تفاح أحمر مجاناً', 200, appleProduct.id, 1, 1);
  insertReward.run('0.5 كجم موز مجاناً', 100, bananaProduct.id, 0.5, 1);
  insertReward.run('هدية صغيرة', 50, null, null, 1);

  console.log('[SERVER] Loyalty program data seeded successfully');

  console.log('[SERVER] Database seeded successfully');
} else {
  console.log(`[SERVER] Database already has ${branchCount.count} branches`);
}

// Ensure admin user exists
try {
  const adminUser = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
  if (!adminUser) {
    console.log('[SERVER] Admin user not found, creating default admin...');
    const insertUser = db.prepare('INSERT INTO users (name, pin, role, branch_id) VALUES (?, ?, ?, ?)');
    insertUser.run('المالك', '1234', 'admin', null);
    console.log('[SERVER] Admin user created successfully');
  }
} catch (err) {
  console.error('[SERVER] Error checking/creating admin user:', err);
}

// Add other default users if table is nearly empty
try {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count <= 1) {
    console.log('[SERVER] Seeding additional default users...');
    const insertUser = db.prepare('INSERT INTO users (name, pin, role, branch_id) VALUES (?, ?, ?, ?)');
    
    // Use individual try-catches for each user to avoid one failure blocking others
    try { insertUser.run('مدير الفرع', '5555', 'branch_manager', 1); } catch(e) {}
    try { insertUser.run('كاشير', '0000', 'cashier', 1); } catch(e) {}
    try { insertUser.run('كاشير جديد', '3234', 'cashier', 1); } catch(e) {}
    
    console.log('[SERVER] Default users check completed');
  }
} catch (err) {
  console.error('[SERVER] Error seeding additional users:', err);
}

try {
  const allUsers = db.prepare('SELECT name, pin, role FROM users').all();
  console.log('[SERVER] Current users in database:', JSON.stringify(allUsers));
} catch (err) {
  console.error('[SERVER] Error listing users:', err);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    console.log(`[SERVER] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json());
  app.use('/uploads', express.static(uploadsDir));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.post('/api/products', (req, res) => {
    console.log(`[SERVER] POST /api/products`);
    
    // Use multer manually to handle errors better
    const uploadSingle = upload.single('image');
    uploadSingle(req, res, (err) => {
      if (err) {
        console.error('[SERVER] Multer error:', err);
        return res.status(400).json({ success: false, error: 'Upload failed: ' + err.message });
      }

      try {
        const { category_id, name, price, cost_price, unit, barcode, branch_id, stock_quantity, low_stock_threshold } = req.body;
        
        if (!name) {
          return res.status(400).json({ success: false, error: 'Name is required' });
        }

        const parsedPrice = parseFloat(price || '0');
        const parsedCostPrice = parseFloat(cost_price || '0');
        const parsedStockQuantity = parseFloat(stock_quantity || '0');
        const parsedBranchId = parseInt(branch_id || '0');
        const parsedCategoryId = parseInt(category_id || '1');
        const parsedLowStockThreshold = parseFloat(low_stock_threshold || '10');

        const image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || '');

        const transaction = db.transaction(() => {
          const result = db.prepare('INSERT INTO products (category_id, name, price, cost_price, unit, barcode, image_url, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(
            parsedCategoryId, 
            name, 
            parsedPrice, 
            parsedCostPrice, 
            unit || 'piece', 
            barcode || String(Date.now()), 
            image_url,
            parsedLowStockThreshold
          );
          const productId = Number(result.lastInsertRowid);
          
          const branches = db.prepare('SELECT id FROM branches').all() as {id: number}[];
          for (const branch of branches) {
            const initialStock = branch.id === parsedBranchId ? parsedStockQuantity : 0;
            db.prepare('INSERT INTO branch_inventory (branch_id, product_id, stock_quantity) VALUES (?, ?, ?)').run(
              branch.id, productId, initialStock
            );
          }
          
          return productId;
        });

        const productId = transaction();
        res.json({ success: true, productId });
      } catch (error: any) {
        console.error('[SERVER] Error adding product:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

  app.post('/api/login', (req, res) => {
    const { pin } = req.body;
    console.log(`[SERVER] Login attempt with PIN: "${pin}" (type: ${typeof pin})`);
    
    if (!pin) return res.status(400).json({ error: 'PIN is required' });
    
    const user = db.prepare('SELECT * FROM users WHERE pin = ?').get(pin);
    if (!user) {
      console.log(`[SERVER] Login failed: PIN "${pin}" not found in database`);
      const allUsers = db.prepare('SELECT name, pin, role FROM users').all();
      console.log(`[SERVER] Current users in DB: ${JSON.stringify(allUsers)}`);
      return res.status(401).json({ error: 'Invalid PIN' });
    }
    console.log(`[SERVER] Login success for user: ${user.name} (${user.role})`);
    res.json({ success: true, user });
  });

  app.get('/api/users', (req, res) => {
    const users = db.prepare(`
      SELECT u.id, u.name, u.pin, u.role, u.branch_id, b.name as branch_name 
      FROM users u 
      LEFT JOIN branches b ON u.branch_id = b.id
    `).all();
    res.json(users);
  });

  app.post('/api/users', (req, res) => {
    const { name, pin, role, branch_id } = req.body;
    
    if (!name || !pin || !role) {
      return res.status(400).json({ error: 'Name, PIN, and role are required' });
    }
    
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }

    try {
      const insertUser = db.prepare('INSERT INTO users (name, pin, role, branch_id) VALUES (?, ?, ?, ?)');
      const result = insertUser.run(name, pin, role, branch_id || null);
      res.json({ success: true, userId: result.lastInsertRowid });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ success: false, error: 'This PIN is already in use' });
      } else {
        console.error('Failed to add user:', error);
        res.status(500).json({ success: false, error: 'Failed to add user' });
      }
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete user:', error);
      res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
  });

  app.get('/api/branches', (req, res) => {
    const branches = db.prepare('SELECT * FROM branches').all();
    res.json(branches);
  });

  app.post('/api/branches', (req, res) => {
    const { name, location } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    const insertBranch = db.prepare('INSERT INTO branches (name, location) VALUES (?, ?)');
    const insertInventory = db.prepare('INSERT INTO branch_inventory (branch_id, product_id, stock_quantity) VALUES (?, ?, 0)');
    
    const transaction = db.transaction(() => {
      const result = insertBranch.run(name, location || '');
      const branchId = result.lastInsertRowid;
      
      // Initialize inventory for all existing products for this new branch
      const products = db.prepare('SELECT id FROM products').all() as {id: number}[];
      for (const product of products) {
        insertInventory.run(branchId, product.id);
      }
      
      return branchId;
    });

    try {
      const branchId = transaction();
      res.json({ success: true, branchId });
    } catch (error) {
      console.error('Failed to add branch:', error);
      res.status(500).json({ success: false, error: 'Failed to add branch' });
    }
  });

  app.delete('/api/branches/:id', (req, res) => {
    const branchId = req.params.id;
    const transaction = db.transaction(() => {
      // Delete order items for this branch's orders
      db.prepare(`
        DELETE FROM order_items 
        WHERE order_id IN (SELECT id FROM orders WHERE branch_id = ?)
      `).run(branchId);
      
      // Delete orders
      db.prepare('DELETE FROM orders WHERE branch_id = ?').run(branchId);
      
      // Delete waste logs
      db.prepare('DELETE FROM waste_logs WHERE branch_id = ?').run(branchId);
      
      // Delete purchase items for this branch's invoices
      db.prepare(`
        DELETE FROM purchase_items 
        WHERE invoice_id IN (SELECT id FROM purchase_invoices WHERE branch_id = ?)
      `).run(branchId);

      // Delete purchase invoices
      db.prepare('DELETE FROM purchase_invoices WHERE branch_id = ?').run(branchId);

      // Delete stock transfers
      db.prepare('DELETE FROM stock_transfers WHERE from_branch_id = ? OR to_branch_id = ?').run(branchId, branchId);

      // Delete inventory and users
      db.prepare('DELETE FROM branch_inventory WHERE branch_id = ?').run(branchId);
      db.prepare('DELETE FROM users WHERE branch_id = ?').run(branchId);
      
      // Finally delete the branch
      db.prepare('DELETE FROM branches WHERE id = ?').run(branchId);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete branch:', error);
      res.status(500).json({ success: false, error: 'Failed to delete branch' });
    }
  });

  app.get('/api/categories', (req, res) => {
    try {
      const categories = db.prepare('SELECT * FROM categories ORDER BY id').all();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/categories', (req, res) => {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }
    try {
      const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
      res.status(201).json({ success: true, id: info.lastInsertRowid });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/categories/:id', (req, res) => {
    const { id } = req.params;
    try {
      // First, un-categorize products associated with this category
      db.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').run(id);
      // Then, delete the category
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/products', (req, res) => {
    const branchId = req.query.branch_id;
    if (!branchId) {
      return res.status(400).json({ error: 'branch_id is required' });
    }
    try {
      const products = db.prepare(`
        SELECT p.*, bi.stock_quantity
        FROM products p
        JOIN branch_inventory bi ON p.id = bi.product_id
        WHERE bi.branch_id = ?
      `).all(branchId);
      console.log(`[SERVER] Found ${products.length} products for branch ${branchId}`);
      res.json(products);
    } catch (err: any) {
      console.error('[SERVER] Error fetching products:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/products/:id', (req, res) => {
    const productId = req.params.id;
    const transaction = db.transaction(() => {
      // Delete from inventory first
      db.prepare('DELETE FROM branch_inventory WHERE product_id = ?').run(productId);
      // Delete from order items
      db.prepare('DELETE FROM order_items WHERE product_id = ?').run(productId);
      // Delete from purchase items
      db.prepare('DELETE FROM purchase_items WHERE product_id = ?').run(productId);
      // Delete from waste logs
      db.prepare('DELETE FROM waste_logs WHERE product_id = ?').run(productId);
      // Delete from stock transfers
      db.prepare('DELETE FROM stock_transfers WHERE product_id = ?').run(productId);
      // Finally delete product
      db.prepare('DELETE FROM products WHERE id = ?').run(productId);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete product:', error);
      res.status(500).json({ success: false, error: 'Failed to delete product' });
    }
  });

  app.patch('/api/products/:id/price', (req, res) => {
    const { price } = req.body;
    const productId = req.params.id;

    if (price === undefined || isNaN(parseFloat(price))) {
      return res.status(400).json({ success: false, error: 'Valid price is required' });
    }

    try {
      db.prepare('UPDATE products SET price = ? WHERE id = ?').run(parseFloat(price), productId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to update price:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.put('/api/products/:id/threshold', (req, res) => {
    const { threshold } = req.body;
    const productId = req.params.id;

    if (threshold === undefined || isNaN(parseFloat(threshold))) {
      return res.status(400).json({ success: false, error: 'Valid threshold is required' });
    }

    try {
      db.prepare('UPDATE products SET low_stock_threshold = ? WHERE id = ?').run(parseFloat(threshold), productId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to update threshold:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.patch('/api/products/:id/name', (req, res) => {
    const { name } = req.body;
    const productId = req.params.id;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    try {
      db.prepare('UPDATE products SET name = ? WHERE id = ?').run(name, productId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to update name:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.patch('/api/products/:id/cost-price', (req, res) => {
    const { cost_price } = req.body;
    const productId = req.params.id;

    if (cost_price === undefined || isNaN(parseFloat(cost_price))) {
      return res.status(400).json({ success: false, error: 'Valid cost price is required' });
    }

    try {
      db.prepare('UPDATE products SET cost_price = ? WHERE id = ?').run(parseFloat(cost_price), productId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to update cost price:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/users/check-pin', (req, res) => {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ isAvailable: false });
    }
    try {
      const user = db.prepare('SELECT id FROM users WHERE pin = ?').get(pin);
      res.json({ isAvailable: !user });
    } catch (error) {
      res.status(500).json({ isAvailable: false });
    }
  });

  app.patch('/api/inventory/:branchId/:productId/stock', (req, res) => {
    const { stock_quantity } = req.body;
    const { branchId, productId } = req.params;

    if (stock_quantity === undefined || isNaN(parseFloat(stock_quantity))) {
      return res.status(400).json({ success: false, error: 'Valid stock quantity is required' });
    }

    try {
      db.prepare('UPDATE branch_inventory SET stock_quantity = ? WHERE branch_id = ? AND product_id = ?').run(parseFloat(stock_quantity), branchId, productId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to update stock quantity:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/suppliers', (req, res) => {
    const suppliers = db.prepare('SELECT * FROM suppliers').all();
    res.json(suppliers);
  });

  app.post('/api/suppliers', (req, res) => {
    const { name, contact_info } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    try {
      const result = db.prepare('INSERT INTO suppliers (name, contact_info) VALUES (?, ?)')
        .run(name, contact_info || null);
      res.status(201).json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      console.error('Failed to add supplier:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/suppliers/:id', (req, res) => {
    const supplierId = req.params.id;
    // Check for related purchases before deleting
    const purchases = db.prepare('SELECT id FROM purchase_invoices WHERE supplier_id = ?').all(supplierId);
    if (purchases.length > 0) {
      return res.status(400).json({ success: false, error: 'لا يمكن حذف المورد لوجود فواتير مشتريات مرتبطة به' });
    }

    try {
      db.prepare('DELETE FROM suppliers WHERE id = ?').run(supplierId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete supplier:', error);
      res.status(500).json({ success: false, error: 'Failed to delete supplier' });
    }
  });

  // Receipt Settings API Endpoints
  app.get('/api/receipt-settings', (req, res) => {
    try {
      const settings = db.prepare('SELECT * FROM receipt_settings LIMIT 1').get();
      res.json({ success: true, settings });
    } catch (error: any) {
      console.error('[SERVER] Error fetching receipt settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/receipt-settings', (req, res) => {
    const uploadSingle = upload.single('qr_code_image');
    uploadSingle(req, res, (err) => {
      if (err) {
        console.error('[SERVER] Multer error:', err);
        return res.status(400).json({ success: false, error: 'Upload failed: ' + err.message });
      }

      try {
        const { store_name, branch_default_name, tax_number, invoice_type, thank_you_message, return_policy } = req.body;
        let qr_code_image_url = req.file ? `/uploads/${req.file.filename}` : req.body.qr_code_image_url || null;

        // If a new file is uploaded, and there was an old one, delete the old one
        if (req.file) {
          const oldSettings = db.prepare('SELECT qr_code_image_url FROM receipt_settings LIMIT 1').get() as { qr_code_image_url: string | null };
          if (oldSettings && oldSettings.qr_code_image_url && oldSettings.qr_code_image_url !== qr_code_image_url) {
            const oldImagePath = path.join(uploadsDir, path.basename(oldSettings.qr_code_image_url));
            if (fs.existsSync(oldImagePath)) {
              fs.unlinkSync(oldImagePath);
              console.log(`[SERVER] Deleted old QR code image: ${oldImagePath}`);
            }
          }
        } else if (req.body.qr_code_image_url === 'null' || req.body.qr_code_image_url === '') {
          // If client explicitly sends null/empty string for QR code, delete existing image
          const oldSettings = db.prepare('SELECT qr_code_image_url FROM receipt_settings LIMIT 1').get() as { qr_code_image_url: string | null };
          if (oldSettings && oldSettings.qr_code_image_url) {
            const oldImagePath = path.join(uploadsDir, path.basename(oldSettings.qr_code_image_url));
            if (fs.existsSync(oldImagePath)) {
              fs.unlinkSync(oldImagePath);
              console.log(`[SERVER] Deleted old QR code image: ${oldImagePath}`);
            }
          }
          qr_code_image_url = null; // Ensure it's null in DB
        }

        const updateStmt = db.prepare(`
          UPDATE receipt_settings
          SET store_name = ?,
              branch_default_name = ?,
              tax_number = ?,
              invoice_type = ?,
              thank_you_message = ?,
              return_policy = ?,
              qr_code_image_url = ?
          WHERE id = 1
        `);
        updateStmt.run(store_name, branch_default_name, tax_number, invoice_type, thank_you_message, return_policy, qr_code_image_url);
        res.json({ success: true, settings: { store_name, branch_default_name, tax_number, invoice_type, thank_you_message, return_policy, qr_code_image_url } });
      } catch (error: any) {
        console.error('[SERVER] Error updating receipt settings:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

  // Loyalty Program API Endpoints

  // Get customer by ID
  app.get('/api/customers/:id', (req, res) => {
    try {
      const customer = db.prepare('SELECT id, name, total_points, tier FROM customers WHERE id = ?').get(req.params.id);
      if (customer) {
        res.json({ success: true, customer });
      } else {
        res.status(404).json({ success: false, error: 'Customer not found' });
      }
    } catch (error: any) {
      console.error('[SERVER] Error fetching customer:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Generate dynamic QR code token for a customer
  app.post('/api/loyalty/generate-token', (req, res) => {
    const { customer_id } = req.body;
    if (!customer_id) {
      return res.status(400).json({ success: false, error: 'Customer ID is required' });
    }
    try {
      const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id);
      if (!customer) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }
      const token = generateLoyaltyToken(customer_id);
      // Store token as one-time use
      db.prepare('INSERT INTO validation_tokens (token, customer_id, expires_at) VALUES (?, ?, DATETIME(CURRENT_TIMESTAMP, \'+90 seconds\'))')
        .run(token, customer_id);
      res.json({ success: true, token });
    } catch (error: any) {
      console.error('[SERVER] Error generating loyalty token:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Scan QR code token at POS
  app.post('/api/loyalty/scan-token', (req, res) => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    try {
      let customerId: number | null = null;
      
      // Try to verify as JWT first
      const decoded = verifyLoyaltyToken(token);
      if (decoded) {
        const validationToken = db.prepare('SELECT * FROM validation_tokens WHERE token = ?').get(token);
        if (!validationToken || validationToken.is_used || new Date(validationToken.expires_at) < new Date()) {
          return res.status(400).json({ success: false, error: 'Token already used or expired' });
        }
        // Mark token as used immediately
        db.prepare('UPDATE validation_tokens SET is_used = 1 WHERE token = ?').run(token);
        customerId = decoded.customerId;
      } else {
        // Fallback: try to use token directly as customer ID (for testing/manual entry)
        const parsedId = parseInt(token, 10);
        if (!isNaN(parsedId)) {
          customerId = parsedId;
        } else {
          return res.status(400).json({ success: false, error: 'Invalid token or customer ID' });
        }
      }

      const customer = db.prepare('SELECT id, name, total_points, tier FROM customers WHERE id = ?').get(customerId);
      if (!customer) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }

      const availableRewards = db.prepare('SELECT * FROM rewards_catalog WHERE is_available = 1 AND points_required <= ?').all(customer.total_points);

      res.json({ success: true, customer, availableRewards });
    } catch (error: any) {
      console.error('[SERVER] Error scanning loyalty token:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Redeem a reward
  app.post('/api/loyalty/redeem-reward', (req, res) => {
    const { customer_id, reward_id, order_id } = req.body;
    if (!customer_id || !reward_id) {
      return res.status(400).json({ success: false, error: 'Customer ID and Reward ID are required' });
    }

    const transaction = db.transaction(() => {
      const customer = db.prepare('SELECT id, total_points FROM customers WHERE id = ?').get(customer_id);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const reward = db.prepare('SELECT * FROM rewards_catalog WHERE id = ? AND is_available = 1').get(reward_id);
      if (!reward) {
        throw new Error('Reward not found or not available');
      }

      if (customer.total_points < reward.points_required) {
        throw new Error('Insufficient points');
      }

      // Deduct points
      db.prepare('UPDATE customers SET total_points = total_points - ? WHERE id = ?').run(reward.points_required, customer_id);

      // Log transaction
      db.prepare('INSERT INTO points_transactions (customer_id, order_id, points_redeemed) VALUES (?, ?, ?)')
        .run(customer_id, order_id || null, reward.points_required);

      res.json({ success: true, new_points: customer.total_points - reward.points_required, reward_applied: reward });
    });

    try {
      transaction();
    } catch (error: any) {
      console.error('[SERVER] Error redeeming reward:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Add points to customer (e.g., after an order)
  app.post('/api/loyalty/add-points', (req, res) => {
    const { customer_id, points_to_add, order_id } = req.body;
    if (!customer_id || !points_to_add) {
      return res.status(400).json({ success: false, error: 'Customer ID and points to add are required' });
    }

    const transaction = db.transaction(() => {
      const customer = db.prepare('SELECT id, total_points FROM customers WHERE id = ?').get(customer_id);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Add points
      db.prepare('UPDATE customers SET total_points = total_points + ? WHERE id = ?').run(points_to_add, customer_id);

      // Log transaction
      db.prepare('INSERT INTO points_transactions (customer_id, order_id, points_added) VALUES (?, ?, ?)')
        .run(customer_id, order_id || null, points_to_add);

      res.json({ success: true, new_points: customer.total_points + points_to_add });
    });

    try {
      transaction();
    } catch (error: any) {
      console.error('[SERVER] Error adding points:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get all rewards
  app.get('/api/rewards', (req, res) => {
    try {
      const rewards = db.prepare('SELECT * FROM rewards_catalog').all();
      res.json({ success: true, rewards });
    } catch (error: any) {
      console.error('[SERVER] Error fetching rewards:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Add a new reward
  app.post('/api/rewards', (req, res) => {
    const { name, points_required, product_id, product_quantity, is_available } = req.body;
    if (!name || !points_required) {
      return res.status(400).json({ success: false, error: 'Name and points required are mandatory' });
    }
    try {
      const result = db.prepare('INSERT INTO rewards_catalog (name, points_required, product_id, product_quantity, is_available) VALUES (?, ?, ?, ?, ?)')
        .run(name, points_required, product_id || null, product_quantity || null, is_available === undefined ? 1 : is_available);
      res.status(201).json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      console.error('[SERVER] Error adding reward:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Update a reward
  app.put('/api/rewards/:id', (req, res) => {
    const { name, points_required, product_id, product_quantity, is_available } = req.body;
    const rewardId = req.params.id;
    if (!name || !points_required) {
      return res.status(400).json({ success: false, error: 'Name and points required are mandatory' });
    }
    try {
      db.prepare('UPDATE rewards_catalog SET name = ?, points_required = ?, product_id = ?, product_quantity = ?, is_available = ? WHERE id = ?')
        .run(name, points_required, product_id || null, product_quantity || null, is_available === undefined ? 1 : is_available, rewardId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[SERVER] Error updating reward:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Delete a reward
  app.delete('/api/rewards/:id', (req, res) => {
    const rewardId = req.params.id;
    try {
      db.prepare('DELETE FROM rewards_catalog WHERE id = ?').run(rewardId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[SERVER] Error deleting reward:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get all customers
  app.get('/api/customers', (req, res) => {
    try {
      const customers = db.prepare('SELECT id, name, total_points, tier FROM customers').all();
      res.json({ success: true, customers });
    } catch (error: any) {
      console.error('[SERVER] Error fetching customers:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Add a new customer
  app.post('/api/customers', (req, res) => {
    const { name, total_points, tier } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Customer name is mandatory' });
    }
    try {
      const result = db.prepare('INSERT INTO customers (name, total_points, tier) VALUES (?, ?, ?)')
        .run(name, total_points || 0, tier || 'برونزي');
      res.status(201).json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      console.error('[SERVER] Error adding customer:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Update customer points or tier
  app.put('/api/customers/:id', (req, res) => {
    const { name, total_points, tier } = req.body;
    const customerId = req.params.id;
    if (!name || total_points === undefined || !tier) {
      return res.status(400).json({ success: false, error: 'Name, total points, and tier are mandatory' });
    }
    try {
      db.prepare('UPDATE customers SET name = ?, total_points = ?, tier = ? WHERE id = ?')
        .run(name, total_points, tier, customerId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[SERVER] Error updating customer:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Delete a customer
  app.delete('/api/customers/:id', (req, res) => {
    const customerId = req.params.id;
    const transaction = db.transaction(() => {
      // Delete related points transactions
      db.prepare('DELETE FROM points_transactions WHERE customer_id = ?').run(customerId);
      // Delete related validation tokens
      db.prepare('DELETE FROM validation_tokens WHERE customer_id = ?').run(customerId);
      // Finally delete the customer
      db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
    });
    try {
      transaction();
      res.json({ success: true });
    } catch (error: any) {
      console.error('[SERVER] Error deleting customer:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get points transactions for a customer
  app.get('/api/customers/:id/transactions', (req, res) => {
    try {
      const transactions = db.prepare('SELECT * FROM points_transactions WHERE customer_id = ? ORDER BY transaction_date DESC').all(req.params.id);
      res.json({ success: true, transactions });
    } catch (error: any) {
      console.error('[SERVER] Error fetching customer transactions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get all validation tokens (for debugging/admin)
  app.get('/api/loyalty/tokens', (req, res) => {
    try {
      const tokens = db.prepare('SELECT * FROM validation_tokens').all();
      res.json({ success: true, tokens });
    } catch (error: any) {
      console.error('[SERVER] Error fetching validation tokens:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Clean up expired/used tokens (can be run periodically)
  app.post('/api/loyalty/cleanup-tokens', (req, res) => {
    try {
      const result = db.prepare('DELETE FROM validation_tokens WHERE expires_at < CURRENT_TIMESTAMP OR is_used = 1').run();
      res.json({ success: true, deleted_count: result.changes });
    } catch (error: any) {
      console.error('[SERVER] Error cleaning up tokens:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Add points to customer after an order (called internally or by POS after payment)
  app.post('/api/orders/:orderId/add-loyalty-points', (req, res) => {
    const { customer_id, points_to_add } = req.body;
    const { orderId } = req.params;

    if (!customer_id || !points_to_add || !orderId) {
      return res.status(400).json({ success: false, error: 'Customer ID, points to add, and Order ID are required' });
    }

    const transaction = db.transaction(() => {
      const customer = db.prepare('SELECT id, total_points FROM customers WHERE id = ?').get(customer_id);
      if (!customer) {
        throw new Error('Customer not found');
      }

      db.prepare('UPDATE customers SET total_points = total_points + ? WHERE id = ?').run(points_to_add, customer_id);
      db.prepare('INSERT INTO points_transactions (customer_id, order_id, points_added) VALUES (?, ?, ?)')
        .run(customer_id, orderId, points_to_add);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (error: any) {
      console.error('[SERVER] Error adding loyalty points after order:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Update order to include customer_id for loyalty tracking
  app.patch('/api/orders/:orderId/customer', (req, res) => {
    const { customer_id } = req.body;
    const { orderId } = req.params;

    if (!customer_id) {
      return res.status(400).json({ success: false, error: 'Customer ID is required' });
    }

    try {
      db.prepare('UPDATE orders SET customer_id = ? WHERE id = ?').run(customer_id, orderId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[SERVER] Error updating order with customer ID:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/waste', (req, res) => {
    const branchId = req.query.branch_id;
    let query = `
      SELECT w.*, p.name as product_name, b.name as branch_name
      FROM waste_logs w 
      JOIN products p ON w.product_id = p.id 
      JOIN branches b ON w.branch_id = b.id
    `;
    const params = [];
    if (branchId) {
      query += ` WHERE w.branch_id = ?`;
      params.push(branchId);
    }
    query += ` ORDER BY w.created_at DESC`;
    
    const logs = db.prepare(query).all(...params);
    res.json(logs);
  });

  app.post('/api/waste', (req, res) => {
    const { branch_id, product_id, quantity, reason } = req.body;
    
    const insertWaste = db.prepare('INSERT INTO waste_logs (branch_id, product_id, quantity, reason) VALUES (?, ?, ?, ?)');
    const updateStock = db.prepare('UPDATE branch_inventory SET stock_quantity = stock_quantity - ? WHERE branch_id = ? AND product_id = ?');
    
    const transaction = db.transaction(() => {
      insertWaste.run(branch_id, product_id, quantity, reason);
      updateStock.run(quantity, branch_id, product_id);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (error) {
      console.error('Waste logging failed:', error);
      res.status(500).json({ success: false, error: 'Failed to log waste' });
    }
  });

  app.post('/api/purchases', (req, res) => {
    const { branch_id, supplier_id, total_amount, items } = req.body;
    
    const insertInvoice = db.prepare('INSERT INTO purchase_invoices (branch_id, supplier_id, total_amount) VALUES (?, ?, ?)');
    const insertItem = db.prepare('INSERT INTO purchase_items (invoice_id, product_id, quantity, cost_price) VALUES (?, ?, ?, ?)');
    const updateStock = db.prepare('UPDATE branch_inventory SET stock_quantity = stock_quantity + ? WHERE branch_id = ? AND product_id = ?');
    
    const transaction = db.transaction(() => {
      const result = insertInvoice.run(branch_id, supplier_id, total_amount);
      const invoiceId = result.lastInsertRowid;
      
      for (const item of items) {
        insertItem.run(invoiceId, item.product_id, item.quantity, item.cost_price);
        updateStock.run(item.quantity, branch_id, item.product_id);
      }
      
      return invoiceId;
    });

    try {
      const invoiceId = transaction();
      res.json({ success: true, invoiceId });
    } catch (error) {
      console.error('Purchase creation failed:', error);
      res.status(500).json({ success: false, error: 'Failed to create purchase' });
    }
  });

  app.post('/api/orders', (req, res) => {
    const { branch_id, total_amount, tax_amount, discount_amount, payment_method, items } = req.body;
    
    const insertOrder = db.prepare('INSERT INTO orders (branch_id, total_amount, tax_amount, discount_amount, total_cost, payment_method) VALUES (?, ?, ?, ?, ?, ?)');
    const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price, cost, total) VALUES (?, ?, ?, ?, ?, ?)');
    const updateStock = db.prepare('UPDATE branch_inventory SET stock_quantity = stock_quantity - ? WHERE branch_id = ? AND product_id = ?');
    
    const transaction = db.transaction(() => {
      let totalCost = 0;
      for (const item of items) {
        totalCost += (item.cost_price * item.quantity);
      }

      const result = insertOrder.run(branch_id, total_amount, tax_amount, discount_amount, totalCost, payment_method);
      const orderId = result.lastInsertRowid;
      
      for (const item of items) {
        insertItem.run(orderId, item.product_id, item.quantity, item.price, item.cost_price, item.total);
        updateStock.run(item.quantity, branch_id, item.product_id);
      }
      
      return orderId;
    });

    try {
      const orderId = transaction();
      res.json({ success: true, orderId });
    } catch (error) {
      console.error('Order creation failed:', error);
      res.status(500).json({ success: false, error: 'Failed to create order' });
    }
  });

  app.post('/api/transfers', (req, res) => {
    const { from_branch_id, to_branch_id, product_id, quantity } = req.body;
    
    const insertTransfer = db.prepare('INSERT INTO stock_transfers (from_branch_id, to_branch_id, product_id, quantity) VALUES (?, ?, ?, ?)');
    const deductStock = db.prepare('UPDATE branch_inventory SET stock_quantity = stock_quantity - ? WHERE branch_id = ? AND product_id = ?');
    const addStock = db.prepare('UPDATE branch_inventory SET stock_quantity = stock_quantity + ? WHERE branch_id = ? AND product_id = ?');
    
    const transaction = db.transaction(() => {
      // Check stock first
      const currentStock = db.prepare('SELECT stock_quantity FROM branch_inventory WHERE branch_id = ? AND product_id = ?').get(from_branch_id, product_id) as any;
      if (!currentStock || currentStock.stock_quantity < quantity) {
        throw new Error('Insufficient stock');
      }

      insertTransfer.run(from_branch_id, to_branch_id, product_id, quantity);
      deductStock.run(quantity, from_branch_id, product_id);
      addStock.run(quantity, to_branch_id, product_id);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (error: any) {
      console.error('Transfer failed:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to transfer stock' });
    }
  });

  app.get('/api/reports', (req, res) => {
    const branchId = req.query.branch_id;
    
    let salesQuery = 'SELECT SUM(total_amount) as total_sales, SUM(total_amount - tax_amount - total_cost) as net_profit FROM orders';
    let wasteQuery = 'SELECT SUM(quantity) as total_waste_qty FROM waste_logs';
    
    const params = [];
    if (branchId) {
      salesQuery += ' WHERE branch_id = ?';
      wasteQuery += ' WHERE branch_id = ?';
      params.push(branchId);
    }

    const salesResult = db.prepare(salesQuery).get(...params) as any;
    const wasteResult = db.prepare(wasteQuery).get(...params) as any;

    res.json({
      total_sales: salesResult.total_sales || 0,
      net_profit: salesResult.net_profit || 0,
      total_waste_qty: wasteResult.total_waste_qty || 0
    });
  });

  // Fallback for unmatched API routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
