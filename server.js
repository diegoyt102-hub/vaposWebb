const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const dns = require('dns').promises;
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const config = require('./config');
 
const app = express();
const PORT = 5210;
 
app.set('trust proxy', true);
 
// ================= MIDDLEWARE =================
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
 
// ================= UPLOADS =================
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
 
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo se permiten imágenes'));
    cb(null, true);
  }
});
 
// ================= CORREO (VERIFICACIÓN) =================
const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465,
  auth: { user: config.SMTP_USER, pass: config.SMTP_PASS }
});
 
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
 
// Verifica que el DOMINIO del correo pueda recibir correos (tiene registros MX).
// No verifica que el buzón exacto exista: eso ya no es posible de forma confiable
// con proveedores como Gmail, que bloquean ese tipo de sondeo. Esto sí atrapa
// dominios inventados o mal escritos (ej: "gmial.con").
async function domainCanReceiveEmail(email) {
  const domain = email.split('@')[1];
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}
 
async function sendVerificationEmail(to, name, code) {
  const storeName = loadSettings().storeName || 'Tu tienda';
  await transporter.sendMail({
    from: `${storeName} <${config.SMTP_USER}>`,
    to,
    subject: `Tu código de verificación - ${storeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 30px; background:#0d0f14; color:#e8eaf0; border-radius:14px;">
        <h2 style="color:#00f0ff;">⚡ ${storeName}</h2>
        <p>Hola ${name},</p>
        <p>Usa este código para verificar tu correo. Expira en 15 minutos:</p>
        <div style="font-size:32px; font-weight:900; letter-spacing:8px; background:#1a1e28; padding:16px; border-radius:10px; text-align:center; color:#00f0ff; margin:20px 0;">${code}</div>
        <p style="color:#8a8fa3; font-size:12px;">Si no creaste esta cuenta, ignora este correo.</p>
      </div>
    `
  });
}
 
// ================= ARCHIVOS DE DATOS =================
const usersFile = 'users.json';
const salesFile = 'ventas.json';
const ordersFile = 'pedidos.json';
const categoriesFile = 'categorias.json';
const productsFile = 'productos.json';
const settingsFile = 'ajustes.json';
const requestsFile = 'solicitudes.json';
const auditFile = 'auditoria.json';
const favoritesFile = 'favoritos.json';
const supportFile = 'soporte.json';
const notificationsFile = 'notificaciones.json';
const chatFile = 'chat.json';
const priceHistoryFile = 'historial_precios.json';
const productHistoryFile = 'historial_productos.json';
const productTrashFile = 'papelera_productos.json';
const sessionsFile = 'sesiones.json';
const visitsFile = 'visitas.json';
 
const OWNER_EMAIL = 'diegoyt102@gmail.com';
const OWNER_PASSWORD = 'diego1234567890';
 
const PAYMENT_METHODS = ['Efectivo contraentrega', 'Transferencia / Pago electrónico'];
const SALE_PAYMENT_METHODS = ['Efectivo', 'Electrónico'];
const ORDER_STATUSES = ['Pendiente', 'Confirmado', 'En camino', 'Entregado', 'Cancelado'];
 
const DEFAULT_NAV_ORDER = ['catalogo', 'favoritos', 'carrito', 'mis-pedidos', 'pedidos', 'venta', 'mis-ventas', 'todas-ventas', 'productos', 'usuarios', 'configuracion', 'acerca'];
const DEFAULT_THEME = { bg: '#0d0f14', card: '#1a1e28', accent: '#00f0ff', accent2: '#b455ff', brand: '#00f0ff', text: '#e8eaf0' };
 
// ================= UTILIDADES =================
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('base64');
}
 
function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'desconocida').toString().split(',')[0].trim();
}
 
function loadUsers() {
  if (!fs.existsSync(usersFile)) {
    const owner = {
      id: 1,
      name: 'Diego',
      email: OWNER_EMAIL,
      password: hashPassword(OWNER_PASSWORD),
      role: 'owner',
      status: 'approved',
      emailVerified: true,
      ip: 'sistema',
      createdAt: new Date()
    };
    fs.writeFileSync(usersFile, JSON.stringify([owner], null, 2));
    return [owner];
  }
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  let changed = false;
 
  users.forEach(u => {
    if (u.emailVerified === undefined) { u.emailVerified = true; changed = true; }
    if (u.ip === undefined) { u.ip = 'desconocida (cuenta previa)'; changed = true; }
    if (u.points === undefined) { u.points = 0; changed = true; }
    if (u.sessionsInvalidatedAt === undefined) { u.sessionsInvalidatedAt = 0; changed = true; }
  });
 
  const ownerExists = users.some(u => u.email === OWNER_EMAIL);
  if (!ownerExists) {
    users.push({
      id: Math.max(...users.map(u => u.id), 0) + 1,
      name: 'Diego',
      email: OWNER_EMAIL,
      password: hashPassword(OWNER_PASSWORD),
      role: 'owner',
      status: 'approved',
      emailVerified: true,
      ip: 'sistema',
      createdAt: new Date()
    });
    changed = true;
  }
 
  if (changed) saveUsers(users);
  return users;
}
 
function loadSales() {
  if (!fs.existsSync(salesFile)) {
    fs.writeFileSync(salesFile, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(salesFile, 'utf8'));
}
 
function loadOrders() {
  if (!fs.existsSync(ordersFile)) {
    fs.writeFileSync(ordersFile, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
}
 
function loadCategories() {
  if (!fs.existsSync(categoriesFile)) {
    const seed = [{ id: 1, name: 'Vapos', icon: '💨', createdAt: new Date() }];
    fs.writeFileSync(categoriesFile, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(categoriesFile, 'utf8'));
}
 
function loadProducts() {
  if (!fs.existsSync(productsFile)) {
    const desc = {
      'Priv Bar': 'Vaper desechable de alto rendimiento, sabor intenso y larga duración. 6000 puffs aprox.',
      'Solaris': 'Vaper premium con nube densa y sabor equilibrado de principio a fin. 8000 puffs aprox.',
      'Just': 'Vaper compacto, ideal para uso diario con excelente relación calidad-precio. 5000 puffs aprox.'
    };
    const seed = [
      { id: 1, categoryId: 1, name: 'Priv Bar Triple Mango', description: desc['Priv Bar'], price: 25000, stock: 50, image: null, createdAt: new Date() },
      { id: 2, categoryId: 1, name: 'Priv Bar Triple Apple', description: desc['Priv Bar'], price: 25000, stock: 50, image: null, createdAt: new Date() },
      { id: 3, categoryId: 1, name: 'Priv Bar Watermelon Kiwi', description: desc['Priv Bar'], price: 25000, stock: 50, image: null, createdAt: new Date() },
      { id: 4, categoryId: 1, name: 'Solaris Mango', description: desc['Solaris'], price: 32000, stock: 50, image: null, createdAt: new Date() },
      { id: 5, categoryId: 1, name: 'Solaris Strawberry', description: desc['Solaris'], price: 32000, stock: 50, image: null, createdAt: new Date() },
      { id: 6, categoryId: 1, name: 'Solaris Kiwi', description: desc['Solaris'], price: 32000, stock: 50, image: null, createdAt: new Date() },
      { id: 7, categoryId: 1, name: 'Just Watermelon', description: desc['Just'], price: 22000, stock: 50, image: null, createdAt: new Date() },
      { id: 8, categoryId: 1, name: 'Just Watermelon ICE', description: desc['Just'], price: 22000, stock: 50, image: null, createdAt: new Date() }
    ];
    fs.writeFileSync(productsFile, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(productsFile, 'utf8'));
}
 
function loadSettings() {
  if (!fs.existsSync(settingsFile)) {
    const seed = {
      lowStockThreshold: 5,
      storeName: 'Vapos Web',
      aboutContent: '',
      navOrder: DEFAULT_NAV_ORDER,
      theme: DEFAULT_THEME,
      pointsPerThousand: 1
    };
    fs.writeFileSync(settingsFile, JSON.stringify(seed, null, 2));
    return seed;
  }
  const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  let changed = false;
  if (settings.lowStockThreshold === undefined) { settings.lowStockThreshold = 5; changed = true; }
  if (settings.storeName === undefined) { settings.storeName = 'Vapos Web'; changed = true; }
  if (settings.aboutContent === undefined) { settings.aboutContent = ''; changed = true; }
  if (settings.navOrder === undefined) { settings.navOrder = DEFAULT_NAV_ORDER; changed = true; }
  if (settings.theme === undefined) { settings.theme = DEFAULT_THEME; changed = true; }
  if (settings.pointsPerThousand === undefined) { settings.pointsPerThousand = 1; changed = true; }
  if (changed) saveSettings(settings);
  return settings;
}
 
function loadRequests() {
  if (!fs.existsSync(requestsFile)) {
    fs.writeFileSync(requestsFile, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(requestsFile, 'utf8'));
}
 
function loadAudit() {
  if (!fs.existsSync(auditFile)) {
    fs.writeFileSync(auditFile, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(auditFile, 'utf8'));
}
 
function loadFavorites() {
  if (!fs.existsSync(favoritesFile)) {
    fs.writeFileSync(favoritesFile, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(favoritesFile, 'utf8'));
}
 
function loadSupport() {
  if (!fs.existsSync(supportFile)) {
    fs.writeFileSync(supportFile, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(supportFile, 'utf8'));
}
 
function loadNotifications() {
  if (!fs.existsSync(notificationsFile)) {
    fs.writeFileSync(notificationsFile, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(notificationsFile, 'utf8'));
}
 
function loadChat() {
  if (!fs.existsSync(chatFile)) {
    fs.writeFileSync(chatFile, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(chatFile, 'utf8'));
}
 
function loadPriceHistory() {
  if (!fs.existsSync(priceHistoryFile)) {
    fs.writeFileSync(priceHistoryFile, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(priceHistoryFile, 'utf8'));
}
 
function loadProductHistory() {
  if (!fs.existsSync(productHistoryFile)) {
    fs.writeFileSync(productHistoryFile, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(productHistoryFile, 'utf8'));
}
 
function loadProductTrash() {
  if (!fs.existsSync(productTrashFile)) {
    fs.writeFileSync(productTrashFile, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(productTrashFile, 'utf8'));
}
 
function loadSessions() {
  if (!fs.existsSync(sessionsFile)) {
    fs.writeFileSync(sessionsFile, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
}
 
function loadVisits() {
  if (!fs.existsSync(visitsFile)) {
    fs.writeFileSync(visitsFile, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(visitsFile, 'utf8'));
}
 
function saveUsers(users) { fs.writeFileSync(usersFile, JSON.stringify(users, null, 2)); }
function saveSales(sales) { fs.writeFileSync(salesFile, JSON.stringify(sales, null, 2)); }
function saveOrders(orders) { fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2)); }
function saveCategories(c) { fs.writeFileSync(categoriesFile, JSON.stringify(c, null, 2)); }
function saveProducts(p) { fs.writeFileSync(productsFile, JSON.stringify(p, null, 2)); }
function saveSettings(s) { fs.writeFileSync(settingsFile, JSON.stringify(s, null, 2)); }
function saveRequests(r) { fs.writeFileSync(requestsFile, JSON.stringify(r, null, 2)); }
function saveAudit(a) { fs.writeFileSync(auditFile, JSON.stringify(a, null, 2)); }
function saveFavorites(f) { fs.writeFileSync(favoritesFile, JSON.stringify(f, null, 2)); }
function saveSupport(s) { fs.writeFileSync(supportFile, JSON.stringify(s, null, 2)); }
function saveNotifications(n) { fs.writeFileSync(notificationsFile, JSON.stringify(n, null, 2)); }
function saveChat(c) { fs.writeFileSync(chatFile, JSON.stringify(c, null, 2)); }
function savePriceHistory(h) { fs.writeFileSync(priceHistoryFile, JSON.stringify(h, null, 2)); }
function saveProductHistory(h) { fs.writeFileSync(productHistoryFile, JSON.stringify(h, null, 2)); }
function saveProductTrash(t) { fs.writeFileSync(productTrashFile, JSON.stringify(t, null, 2)); }
function saveSessions(s) { fs.writeFileSync(sessionsFile, JSON.stringify(s, null, 2)); }
function saveVisits(v) { fs.writeFileSync(visitsFile, JSON.stringify(v, null, 2)); }
 
// ---- Notificaciones internas ----
// forRole: 'admin_owner' (la ven admins y propietario) o un userId específico (el cliente dueño)
function pushNotification(type, message, forRole) {
  const notifications = loadNotifications();
  notifications.unshift({
    id: Math.max(...notifications.map(n => n.id), 0) + 1,
    type, message, forRole, read: false, createdAt: new Date()
  });
  saveNotifications(notifications.slice(0, 300));
}
 
function maybeAlertLowStock(product) {
  const settings = loadSettings();
  if (product.stock <= settings.lowStockThreshold) {
    pushNotification('stock_bajo', `Stock bajo: "${product.name}" quedó en ${product.stock} unidades`, 'admin_owner');
  }
}
 
// ---- Analítica de sesión: navegador / sistema operativo a partir del User-Agent ----
function parseUserAgent(ua) {
  if (!ua) return { browser: 'Desconocido', os: 'Desconocido' };
  let browser = 'Desconocido';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/OPR\//.test(ua)) browser = 'Opera';
 
  let os = 'Desconocido';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';
 
  return { browser, os };
}
 
// Geolocalización aproximada por IP usando un servicio público gratuito.
// Best-effort: si falla (sin internet, IP local, servicio caído) simplemente no se bloquea el login.
function geoLookup(ip) {
  return new Promise((resolve) => {
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return resolve({ country: 'Local', city: 'Red local' });
    }
    const req = https.get(`https://ip-api.com/json/${ip}?fields=status,country,city`, { timeout: 2500 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.status === 'success') resolve({ country: parsed.country || 'Desconocido', city: parsed.city || 'Desconocido' });
          else resolve({ country: 'Desconocido', city: 'Desconocido' });
        } catch { resolve({ country: 'Desconocido', city: 'Desconocido' }); }
      });
    });
    req.on('error', () => resolve({ country: 'Desconocido', city: 'Desconocido' }));
    req.on('timeout', () => { req.destroy(); resolve({ country: 'Desconocido', city: 'Desconocido' }); });
  });
}
 
async function recordSession(user, req) {
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || '';
  const { browser, os } = parseUserAgent(ua);
  const geo = await geoLookup(ip);
 
  const sessions = loadSessions();
  sessions.unshift({
    id: Math.max(...sessions.map(s => s.id), 0) + 1,
    userId: user.id,
    ip, browser, os,
    country: geo.country, city: geo.city,
    createdAt: new Date()
  });
  saveSessions(sessions.slice(0, 1000));
}
 
function logAudit(type, actor, detail) {
  const audit = loadAudit();
  audit.unshift({
    id: Math.max(...audit.map(a => a.id), 0) + 1,
    type,
    actorId: actor ? actor.id : null,
    actorName: actor ? actor.name : 'Sistema',
    actorEmail: actor ? actor.email : null,
    actorRole: actor ? actor.role : null,
    detail,
    createdAt: new Date()
  });
  saveAudit(audit.slice(0, 500));
}
 
function targetLabelSpanish(type) {
  return { category: 'la categoría', product: 'el producto', sale: 'la venta' }[type] || 'el elemento';
}
 
function executeRequestedAction(request) {
  const { targetType, action, targetId, payload } = request;
 
  if (targetType === 'category' && action === 'delete') {
    const categories = loadCategories();
    const products = loadProducts();
    if (!categories.some(c => c.id === targetId)) return { ok: false, message: 'La categoría ya no existe' };
    if (products.some(p => p.categoryId === targetId)) {
      return { ok: false, message: 'No se puede eliminar: la categoría todavía tiene productos' };
    }
    saveCategories(categories.filter(c => c.id !== targetId));
    return { ok: true };
  }
 
  if (targetType === 'product' && action === 'delete') {
    const products = loadProducts();
    const product = products.find(p => p.id === targetId);
    if (!product) return { ok: false, message: 'El producto ya no existe' };
    if (product.image) {
      const imgPath = path.join(uploadsDir, path.basename(product.image));
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    saveProducts(products.filter(p => p.id !== targetId));
    return { ok: true };
  }
 
  if (targetType === 'product' && action === 'edit') {
    const products = loadProducts();
    const product = products.find(p => p.id === targetId);
    if (!product) return { ok: false, message: 'El producto ya no existe' };
    if (!payload) return { ok: false, message: 'No hay cambios para aplicar' };
 
    if (payload.name && payload.name.trim()) product.name = payload.name.trim();
    if (payload.description && payload.description.trim()) product.description = payload.description.trim();
    if (payload.price !== undefined && payload.price !== '') {
      const priceNum = parseFloat(payload.price);
      if (!isNaN(priceNum) && priceNum > 0) product.price = priceNum;
    }
    if (payload.stock !== undefined && payload.stock !== '') {
      const stockNum = parseInt(payload.stock);
      if (Number.isInteger(stockNum) && stockNum >= 0) product.stock = stockNum;
    }
    if (payload.categoryId) {
      const categories = loadCategories();
      if (categories.some(c => c.id === parseInt(payload.categoryId))) product.categoryId = parseInt(payload.categoryId);
    }
    saveProducts(products);
    return { ok: true };
  }
 
  if (targetType === 'sale' && action === 'delete') {
    const sales = loadSales();
    const sale = sales.find(s => s.id === targetId);
    if (!sale) return { ok: false, message: 'La venta ya no existe' };
    if (sale.proofPath) {
      const filePath = path.join(uploadsDir, path.basename(sale.proofPath));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    if (sale.productId) {
      const products = loadProducts();
      const product = products.find(p => p.id === sale.productId);
      if (product) { product.stock += (sale.quantity || 1); saveProducts(products); }
    }
    saveSales(sales.filter(s => s.id !== targetId));
    return { ok: true };
  }
 
  return { ok: false, message: 'No se pudo procesar la solicitud' };
}
 
function generateToken(user) {
  return Buffer.from(`${user.id}:${user.email}:${Date.now()}`).toString('base64');
}
 
function getUserFromReq(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [userId, , issuedAt] = decoded.split(':');
    const users = loadUsers();
    const user = users.find(u => u.id === parseInt(userId)) || null;
    if (!user) return null;
    if (user.sessionsInvalidatedAt && parseInt(issuedAt) < user.sessionsInvalidatedAt) return null;
    return user;
  } catch {
    return null;
  }
}
 
function requireRole(...roles) {
  return (req, res, next) => {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ message: 'No autorizado' });
    if (!roles.includes(user.role)) return res.status(403).json({ message: 'No tienes permisos para esto' });
    req.user = user;
    next();
  };
}
 
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, points: u.points || 0, createdAt: u.createdAt };
}
 
// ================= AUTH =================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
 
    if (!name || !name.trim() || !email || !email.trim() || !password) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }
    if (name.trim().length < 3) {
      return res.status(400).json({ message: 'El nombre debe tener al menos 3 caracteres' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Correo electrónico inválido' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }
 
    const users = loadUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ message: 'El correo ya está registrado' });
    }
 
    const domainOk = await domainCanReceiveEmail(email.trim().toLowerCase());
    if (!domainOk) {
      return res.status(400).json({ message: 'Ese correo no existe o su dominio no puede recibir correos. Revisa que esté bien escrito.' });
    }
 
    const code = generateCode();
    const newUser = {
      id: Math.max(...users.map(u => u.id), 0) + 1,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashPassword(password),
      role: 'cliente',
      status: 'approved',
      emailVerified: false,
      verificationCode: code,
      verificationExpires: Date.now() + 15 * 60 * 1000,
      ip: getClientIp(req),
      createdAt: new Date()
    };
 
    users.push(newUser);
    saveUsers(users);
 
    try {
      await sendVerificationEmail(newUser.email, newUser.name, code);
    } catch (mailErr) {
      const rolledBack = loadUsers().filter(u => u.id !== newUser.id);
      saveUsers(rolledBack);
      return res.status(500).json({ message: 'No se pudo enviar el correo de verificación. Intenta más tarde o contacta al administrador.' });
    }
 
    res.json({ message: 'Cuenta creada. Revisa tu correo para el código de verificación.', email: newUser.email });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
 
app.post('/api/auth/verify-email', (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Correo y código son obligatorios' });
 
    const users = loadUsers();
    const user = users.find(u => u.email.toLowerCase() === String(email).trim().toLowerCase());
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.emailVerified) return res.status(400).json({ message: 'Este correo ya está verificado' });
    if (!user.verificationCode || user.verificationCode !== String(code).trim()) {
      return res.status(400).json({ message: 'Código incorrecto' });
    }
    if (Date.now() > user.verificationExpires) {
      return res.status(400).json({ message: 'El código expiró, solicita uno nuevo' });
    }
 
    user.emailVerified = true;
    delete user.verificationCode;
    delete user.verificationExpires;
    saveUsers(users);
 
    const token = generateToken(user);
    recordSession(user, req).catch(() => { /* noop */ });
    res.json({ message: 'Correo verificado correctamente', user: { ...publicUser(user), token } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
 
app.post('/api/auth/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Correo obligatorio' });
 
    const users = loadUsers();
    const user = users.find(u => u.email.toLowerCase() === String(email).trim().toLowerCase());
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.emailVerified) return res.status(400).json({ message: 'Este correo ya está verificado' });
 
    const code = generateCode();
    user.verificationCode = code;
    user.verificationExpires = Date.now() + 15 * 60 * 1000;
    saveUsers(users);
 
    await sendVerificationEmail(user.email, user.name, code);
    res.json({ message: 'Código reenviado, revisa tu correo' });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo reenviar el código' });
  }
});
 
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Correo y contraseña son obligatorios' });
    }
 
    const users = loadUsers();
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
 
    if (!user || hashPassword(password) !== user.password) {
      return res.status(400).json({ message: 'Correo o contraseña inválidos' });
    }
 
    if (!user.emailVerified) {
      const code = generateCode();
      user.verificationCode = code;
      user.verificationExpires = Date.now() + 15 * 60 * 1000;
      saveUsers(users);
      try { await sendVerificationEmail(user.email, user.name, code); } catch { /* noop */ }
      return res.status(403).json({ message: 'Debes verificar tu correo. Te enviamos un nuevo código.', needsVerification: true, email: user.email });
    }
 
    const token = generateToken(user);
    recordSession(user, req).catch(() => { /* el registro de sesión nunca debe bloquear el login */ });
    res.json({ message: 'Sesión iniciada', user: { ...publicUser(user), token } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
 
app.get('/api/auth/me', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });
  res.json(publicUser(user));
});
 
// ================= CATEGORÍAS =================
app.get('/api/categories', (req, res) => {
  res.json(loadCategories());
});
 
app.post('/api/categories', requireRole('admin', 'owner'), (req, res) => {
  const { name, icon } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'El nombre de la categoría es obligatorio' });
 
  const categories = loadCategories();
  if (categories.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(400).json({ message: 'Ya existe una categoría con ese nombre' });
  }
 
  const newCat = {
    id: Math.max(...categories.map(c => c.id), 0) + 1,
    name: name.trim(),
    icon: icon && icon.trim() ? icon.trim().slice(0, 4) : '🛍️',
    createdAt: new Date()
  };
  categories.push(newCat);
  saveCategories(categories);
  logAudit('categoria_creada', req.user, `${req.user.name} creó la categoría "${newCat.name}"`);
  res.json({ message: 'Categoría creada', category: newCat });
});
 
app.delete('/api/categories/:id', requireRole('owner'), (req, res) => {
  const id = parseInt(req.params.id);
  const categories = loadCategories();
  const products = loadProducts();
  const category = categories.find(c => c.id === id);
 
  if (products.some(p => p.categoryId === id)) {
    return res.status(400).json({ message: 'No puedes eliminar una categoría que todavía tiene productos' });
  }
 
  const remaining = categories.filter(c => c.id !== id);
  saveCategories(remaining);
  logAudit('categoria_eliminada', req.user, `${req.user.name} eliminó la categoría "${category ? category.name : id}"`);
  res.json({ message: 'Categoría eliminada' });
});
 
// ================= PRODUCTOS =================
app.get('/api/products', (req, res) => {
  const products = loadProducts();
  const categories = loadCategories();
  const withCategory = products.map(p => ({
    ...p,
    categoryName: (categories.find(c => c.id === p.categoryId) || {}).name || 'Sin categoría'
  }));
  res.json(withCategory);
});
 
app.post('/api/products', requireRole('admin', 'owner'), upload.single('image'), (req, res) => {
  try {
    const { name, description, price, stock, categoryId } = req.body;
 
    if (!name || !name.trim() || !description || !description.trim() || !price || stock === undefined || stock === '' || !categoryId) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }
 
    const priceNum = parseFloat(price);
    const stockNum = parseInt(stock);
    if (isNaN(priceNum) || priceNum <= 0) return res.status(400).json({ message: 'El precio debe ser mayor a 0' });
    if (!Number.isInteger(stockNum) || stockNum < 0) return res.status(400).json({ message: 'El stock debe ser un número entero mayor o igual a 0' });
 
    const categories = loadCategories();
    if (!categories.some(c => c.id === parseInt(categoryId))) return res.status(400).json({ message: 'Categoría inválida' });
 
    const products = loadProducts();
    const newProduct = {
      id: Math.max(...products.map(p => p.id), 0) + 1,
      categoryId: parseInt(categoryId),
      name: name.trim(),
      description: description.trim(),
      price: priceNum,
      stock: stockNum,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      createdAt: new Date()
    };
 
    products.push(newProduct);
    saveProducts(products);
    logAudit('producto_creado', req.user, `${req.user.name} creó el producto "${newProduct.name}"`);
    res.json({ message: 'Producto agregado correctamente', product: newProduct });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
 
app.put('/api/products/:id', requireRole('owner'), upload.single('image'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const products = loadProducts();
    const product = products.find(p => p.id === id);
    if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
 
    // Guarda una foto del producto ANTES de tocarlo, para poder restaurar esta versión después.
    const productHistory = loadProductHistory();
    productHistory.unshift({
      id: Math.max(...productHistory.map(h => h.id), 0) + 1,
      productId: product.id,
      snapshot: { ...product },
      editedByName: req.user.name,
      editedAt: new Date()
    });
    saveProductHistory(productHistory.slice(0, 500));
 
    const { name, description, price, stock, categoryId } = req.body;
    const oldPrice = product.price;
 
    if (name !== undefined && name.trim()) product.name = name.trim();
    if (description !== undefined && description.trim()) product.description = description.trim();
 
    if (price !== undefined && price !== '') {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) return res.status(400).json({ message: 'Precio inválido' });
      product.price = priceNum;
    }
 
    if (stock !== undefined && stock !== '') {
      const stockNum = parseInt(stock);
      if (!Number.isInteger(stockNum) || stockNum < 0) return res.status(400).json({ message: 'Stock inválido' });
      product.stock = stockNum;
    }
 
    if (categoryId !== undefined && categoryId !== '') {
      const categories = loadCategories();
      if (!categories.some(c => c.id === parseInt(categoryId))) return res.status(400).json({ message: 'Categoría inválida' });
      product.categoryId = parseInt(categoryId);
    }
 
    if (req.file) {
      if (product.image) {
        const oldPath = path.join(uploadsDir, path.basename(product.image));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      product.image = `/uploads/${req.file.filename}`;
    }
 
    // Si el precio cambió, queda registrado quién lo cambió y cuándo.
    if (product.price !== oldPrice) {
      const priceHistory = loadPriceHistory();
      priceHistory.unshift({
        id: Math.max(...priceHistory.map(h => h.id), 0) + 1,
        productId: product.id,
        productName: product.name,
        oldPrice,
        newPrice: product.price,
        changedByName: req.user.name,
        changedAt: new Date()
      });
      savePriceHistory(priceHistory.slice(0, 1000));
    }
 
    saveProducts(products);
    maybeAlertLowStock(product);
    logAudit('producto_editado', req.user, `${req.user.name} editó el producto "${product.name}"`);
    res.json({ message: 'Producto actualizado', product });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
 
// Muestra el historial de versiones de un producto (para poder restaurar una anterior).
app.get('/api/products/:id/history', requireRole('admin', 'owner'), (req, res) => {
  const id = parseInt(req.params.id);
  const history = loadProductHistory().filter(h => h.productId === id);
  res.json(history);
});
 
// Restaura un producto a como estaba en una versión anterior guardada.
app.post('/api/products/history/:historyId/restore', requireRole('owner'), (req, res) => {
  const historyId = parseInt(req.params.historyId);
  const history = loadProductHistory();
  const entry = history.find(h => h.id === historyId);
  if (!entry) return res.status(404).json({ message: 'Versión no encontrada' });
 
  const products = loadProducts();
  const product = products.find(p => p.id === entry.productId);
  if (!product) return res.status(404).json({ message: 'El producto ya no existe (revísalo en la papelera)' });
 
  Object.assign(product, entry.snapshot, { id: product.id });
  saveProducts(products);
  logAudit('producto_editado', req.user, `${req.user.name} restauró el producto "${product.name}" a una versión anterior (${new Date(entry.editedAt).toLocaleString('es-CO')})`);
  res.json({ message: 'Producto restaurado a esa versión', product });
});
 
// Muestra el historial de precios de un producto específico.
app.get('/api/products/:id/price-history', requireRole('admin', 'owner'), (req, res) => {
  const id = parseInt(req.params.id);
  const history = loadPriceHistory().filter(h => h.productId === id);
  res.json(history);
});
 
app.delete('/api/products/:id', requireRole('owner'), (req, res) => {
  const id = parseInt(req.params.id);
  const products = loadProducts();
  const product = products.find(p => p.id === id);
  if (!product) return res.status(404).json({ message: 'Producto no encontrado' });
 
  // En vez de borrarlo para siempre, se manda a la papelera por si hay que recuperarlo.
  const trash = loadProductTrash();
  trash.unshift({
    id: Math.max(...trash.map(t => t.id), 0) + 1,
    snapshot: { ...product },
    deletedByName: req.user.name,
    deletedAt: new Date()
  });
  saveProductTrash(trash.slice(0, 300));
 
  const remaining = products.filter(p => p.id !== id);
  saveProducts(remaining);
  logAudit('producto_eliminado', req.user, `${req.user.name} eliminó el producto "${product.name}" (movido a la papelera)`);
  res.json({ message: 'Producto eliminado (puedes restaurarlo desde la papelera)' });
});
 
// ---- Papelera de productos ----
app.get('/api/products/trash', requireRole('admin', 'owner'), (req, res) => {
  res.json(loadProductTrash());
});
 
app.post('/api/products/trash/:id/restore', requireRole('owner'), (req, res) => {
  const id = parseInt(req.params.id);
  const trash = loadProductTrash();
  const entry = trash.find(t => t.id === id);
  if (!entry) return res.status(404).json({ message: 'No encontrado en la papelera' });
 
  const products = loadProducts();
  const restored = { ...entry.snapshot, id: Math.max(...products.map(p => p.id), 0) + 1 };
  products.push(restored);
  saveProducts(products);
 
  saveProductTrash(trash.filter(t => t.id !== id));
  logAudit('producto_creado', req.user, `${req.user.name} restauró desde la papelera el producto "${restored.name}"`);
  res.json({ message: 'Producto restaurado', product: restored });
});
 
// ================= AJUSTES (nombre de la tienda, umbral de stock, acerca de, tema, orden de menú) =================
app.get('/api/settings', (req, res) => {
  res.json(loadSettings());
});
 
app.put('/api/settings', requireRole('owner'), (req, res) => {
  const { lowStockThreshold, storeName, aboutContent, navOrder, theme } = req.body;
  const settings = loadSettings();
 
  if (lowStockThreshold !== undefined) {
    const num = parseInt(lowStockThreshold);
    if (lowStockThreshold === '' || !Number.isInteger(num) || num < 0) {
      return res.status(400).json({ message: 'El umbral debe ser un número entero mayor o igual a 0' });
    }
    settings.lowStockThreshold = num;
  }
 
  if (storeName !== undefined) {
    if (!storeName.trim()) return res.status(400).json({ message: 'El nombre de la tienda no puede estar vacío' });
    settings.storeName = storeName.trim();
  }
 
  if (aboutContent !== undefined) {
    settings.aboutContent = aboutContent;
  }
 
  if (Array.isArray(navOrder) && navOrder.length) {
    settings.navOrder = navOrder;
  }
 
  if (theme && typeof theme === 'object') {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    const merged = { ...settings.theme };
    ['bg', 'card', 'accent', 'accent2', 'brand', 'text'].forEach(key => {
      if (theme[key] && hexRegex.test(theme[key])) merged[key] = theme[key];
    });
    settings.theme = merged;
  }
 
  saveSettings(settings);
  logAudit('ajustes_actualizados', req.user, `${req.user.name} actualizó la configuración de la tienda`);
  res.json({ message: 'Ajustes actualizados', settings });
});
 
// ================= FAVORITOS =================
app.get('/api/favorites/my', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });
  const favorites = loadFavorites().filter(f => f.userId === user.id).map(f => f.productId);
  res.json(favorites);
});
 
app.post('/api/favorites/toggle', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });
 
  const productId = parseInt(req.body.productId);
  if (!productId) return res.status(400).json({ message: 'Producto inválido' });
 
  const favorites = loadFavorites();
  const idx = favorites.findIndex(f => f.userId === user.id && f.productId === productId);
 
  if (idx >= 0) {
    favorites.splice(idx, 1);
    saveFavorites(favorites);
    return res.json({ favorited: false });
  }
 
  favorites.push({ userId: user.id, productId, createdAt: new Date() });
  saveFavorites(favorites);
  res.json({ favorited: true });
});
 
// ================= SOPORTE (buzón de críticas y sugerencias) =================
app.post('/api/support', (req, res) => {
  const { message, contact } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ message: 'Escribe un mensaje antes de enviar' });
 
  const user = getUserFromReq(req);
  const support = loadSupport();
  const entry = {
    id: Math.max(...support.map(s => s.id), 0) + 1,
    message: message.trim().slice(0, 2000),
    contact: (contact || '').trim().slice(0, 200),
    fromName: user ? user.name : 'Anónimo',
    fromEmail: user ? user.email : null,
    createdAt: new Date()
  };
  support.push(entry);
  saveSupport(support);
  res.json({ message: 'Gracias, tu mensaje fue enviado' });
});
 
app.get('/api/support', requireRole('owner'), (req, res) => {
  const support = loadSupport().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(support);
});
 
app.delete('/api/support/:id', requireRole('owner'), (req, res) => {
  const support = loadSupport();
  const remaining = support.filter(s => s.id !== parseInt(req.params.id));
  if (remaining.length === support.length) return res.status(404).json({ message: 'Mensaje no encontrado' });
  saveSupport(remaining);
  res.json({ message: 'Mensaje eliminado' });
});
 
// ================= SOLICITUDES DE PERMISO (admin pide, owner aprueba/rechaza) =================
app.post('/api/requests', requireRole('admin', 'owner'), (req, res) => {
  try {
    const { action, targetType, targetId, targetLabel, payload } = req.body;
 
    if (!['delete', 'edit'].includes(action)) return res.status(400).json({ message: 'Acción inválida' });
    if (!['category', 'product', 'sale'].includes(targetType)) return res.status(400).json({ message: 'Tipo de elemento inválido' });
    if (!targetId) return res.status(400).json({ message: 'Falta el elemento objetivo' });
 
    const requests = loadRequests();
    const newRequest = {
      id: Math.max(...requests.map(r => r.id), 0) + 1,
      action,
      targetType,
      targetId: parseInt(targetId),
      targetLabel: targetLabel || `#${targetId}`,
      payload: payload || null,
      status: 'pendiente',
      requestedById: req.user.id,
      requestedByName: req.user.name,
      createdAt: new Date(),
      resolvedAt: null,
      resolvedByName: null
    };
    requests.push(newRequest);
    saveRequests(requests);
 
    logAudit('solicitud_creada', req.user, `${req.user.name} solicitó ${action === 'delete' ? 'eliminar' : 'modificar'} ${targetLabelSpanish(targetType)} "${newRequest.targetLabel}"`);
 
    res.json({ message: 'Solicitud enviada al propietario', request: newRequest });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
 
app.get('/api/requests', requireRole('owner'), (req, res) => {
  const requests = loadRequests().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(requests);
});
 
app.delete('/api/requests/:id', requireRole('owner'), (req, res) => {
  const requests = loadRequests();
  const remaining = requests.filter(r => r.id !== parseInt(req.params.id));
  if (remaining.length === requests.length) return res.status(404).json({ message: 'Solicitud no encontrada' });
  saveRequests(remaining);
  res.json({ message: 'Solicitud eliminada del historial' });
});
 
app.post('/api/requests/:id/approve', requireRole('owner'), (req, res) => {
  try {
    const requests = loadRequests();
    const request = requests.find(r => r.id === parseInt(req.params.id));
    if (!request) return res.status(404).json({ message: 'Solicitud no encontrada' });
    if (request.status !== 'pendiente') return res.status(400).json({ message: 'Esta solicitud ya fue resuelta' });
 
    const result = executeRequestedAction(request);
    if (!result.ok) return res.status(400).json({ message: result.message });
 
    request.status = 'aprobada';
    request.resolvedAt = new Date();
    request.resolvedByName = req.user.name;
    saveRequests(requests);
 
    logAudit('solicitud_resuelta', req.user, `${req.user.name} permitió que ${request.requestedByName} ${request.action === 'delete' ? 'eliminara' : 'modificara'} ${targetLabelSpanish(request.targetType)} "${request.targetLabel}"`);
 
    res.json({ message: 'Solicitud aprobada y ejecutada' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
 
app.post('/api/requests/:id/deny', requireRole('owner'), (req, res) => {
  const requests = loadRequests();
  const request = requests.find(r => r.id === parseInt(req.params.id));
  if (!request) return res.status(404).json({ message: 'Solicitud no encontrada' });
  if (request.status !== 'pendiente') return res.status(400).json({ message: 'Esta solicitud ya fue resuelta' });
 
  request.status = 'rechazada';
  request.resolvedAt = new Date();
  request.resolvedByName = req.user.name;
  saveRequests(requests);
 
  logAudit('solicitud_resuelta', req.user, `${req.user.name} rechazó la solicitud de ${request.requestedByName} (${request.action === 'delete' ? 'eliminar' : 'modificar'} ${targetLabelSpanish(request.targetType)} "${request.targetLabel}")`);
 
  res.json({ message: 'Solicitud rechazada' });
});
 
// ================= AUDITORÍA (solo propietario) =================
app.get('/api/audit', requireRole('owner'), (req, res) => {
  let audit = loadAudit();
  const { email, from, to } = req.query;
 
  if (email) {
    audit = audit.filter(a => a.actorEmail && a.actorEmail.toLowerCase() === String(email).toLowerCase());
  }
  if (from) {
    const fromDate = new Date(`${from}T00:00:00`);
    audit = audit.filter(a => new Date(a.createdAt) >= fromDate);
  }
  if (to) {
    const toDate = new Date(`${to}T23:59:59`);
    audit = audit.filter(a => new Date(a.createdAt) <= toDate);
  }
 
  res.json(audit);
});
 
app.delete('/api/audit', requireRole('owner'), (req, res) => {
  saveAudit([]);
  logAudit('auditoria_limpiada', req.user, `${req.user.name} limpió el registro de auditoría`);
  res.json({ message: 'Auditoría limpiada' });
});
 
// ================= VENTAS (admin y owner) =================
app.post('/api/sales/register', requireRole('admin', 'owner'), upload.single('proof'), (req, res) => {
  try {
    const { productId, quantity, paymentMethod, vendedor, saleDate, orderId } = req.body;
 
    // ---- Caso 1: la venta viene de un pedido ya entregado ("Tus pedidos") ----
    if (orderId) {
      const orders = loadOrders();
      const sourceOrder = orders.find(o => o.id === parseInt(orderId));
      if (!sourceOrder) return res.status(400).json({ message: 'Pedido no encontrado' });
      if (sourceOrder.status !== 'Entregado') return res.status(400).json({ message: 'Solo puedes registrar la venta de un pedido ya entregado' });
      if (sourceOrder.convertedToSaleId) return res.status(400).json({ message: 'Este pedido ya fue registrado como venta anteriormente' });
      if (sourceOrder.takenBy !== req.user.id && req.user.role !== 'owner') {
        return res.status(403).json({ message: 'Solo quien tomó este pedido (o el propietario) puede registrar su venta' });
      }
      if (!vendedor || !vendedor.trim() || !saleDate) {
        return res.status(400).json({ message: 'Vendedor y fecha son obligatorios' });
      }
 
      const products = loadProducts();
      const product = products.find(p => p.id === sourceOrder.productId);
 
      const sales = loadSales();
      const newSale = {
        id: Math.max(...sales.map(s => s.id), 0) + 1,
        userId: req.user.id,
        vendedor: vendedor.trim(),
        productId: sourceOrder.productId,
        productName: sourceOrder.productName,
        quantity: sourceOrder.quantity,
        unitPrice: sourceOrder.unitPrice,
        price: sourceOrder.total,
        paymentMethod: sourceOrder.paymentMethod.startsWith('Efectivo') ? 'Efectivo' : 'Electrónico',
        proofPath: sourceOrder.proofPath || null,
        orderId: sourceOrder.id,
        saleDate: new Date(saleDate),
        createdAt: new Date()
      };
      // El stock NO se vuelve a descontar: ya se descontó cuando se creó el pedido.
 
      sales.push(newSale);
      saveSales(sales);
 
      sourceOrder.convertedToSaleId = newSale.id;
      saveOrders(orders);
 
      logAudit('venta_registrada', req.user, `${req.user.name} registró la venta del pedido #${sourceOrder.id} (${sourceOrder.quantity} x "${sourceOrder.productName}")`);
 
      return res.json({ message: 'Venta registrada a partir del pedido', sale: newSale, remainingStock: product ? product.stock : null });
    }
 
    // ---- Caso 2: venta manual normal ----
    if (!productId || !quantity || !paymentMethod || !vendedor || !vendedor.trim() || !saleDate) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }
 
    const qty = parseInt(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
      return res.status(400).json({ message: 'La cantidad debe ser un número entre 1 y 50' });
    }
 
    if (!SALE_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Método de pago inválido' });
    }
 
    const products = loadProducts();
    const product = products.find(p => p.id === parseInt(productId));
    if (!product) return res.status(400).json({ message: 'Producto inválido' });
    if (product.stock < qty) return res.status(400).json({ message: `Solo quedan ${product.stock} unidades disponibles. No se puede registrar una venta por encima del stock.` });
 
    if (paymentMethod === 'Electrónico' && !req.file) {
      return res.status(400).json({ message: 'Debes subir el comprobante de pago electrónico' });
    }
 
    product.stock -= qty;
    saveProducts(products);
 
    const sales = loadSales();
    const newSale = {
      id: Math.max(...sales.map(s => s.id), 0) + 1,
      userId: req.user.id,
      vendedor: vendedor.trim(),
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitPrice: product.price,
      price: product.price * qty,
      paymentMethod,
      proofPath: req.file ? `/uploads/${req.file.filename}` : null,
      saleDate: new Date(saleDate),
      createdAt: new Date()
    };
 
    sales.push(newSale);
    saveSales(sales);
    maybeAlertLowStock(product);
 
    logAudit('venta_registrada', req.user, `${req.user.name} registró la venta de ${qty} x "${product.name}" (${paymentMethod})`);
 
    res.json({ message: 'Venta registrada correctamente', sale: newSale, remainingStock: product.stock });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
 
app.get('/api/sales/my-sales', requireRole('admin', 'owner'), (req, res) => {
  const sales = loadSales()
    .filter(s => s.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sales);
});
 
app.get('/api/sales/all', requireRole('admin', 'owner'), (req, res) => {
  const sales = loadSales().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sales);
});
 
app.delete('/api/sales/delete/:id', requireRole('owner'), (req, res) => {
  const sales = loadSales();
  const idx = sales.findIndex(s => s.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ message: 'Venta no encontrada' });
 
  const sale = sales[idx];
 
  // Si la venta viene de un pedido (orderId), el comprobante es del PEDIDO, no de esta venta:
  // no se borra el archivo, y el stock tampoco se toca aquí (ya se descontó al crear el pedido).
  if (!sale.orderId) {
    if (sale.proofPath) {
      const filePath = path.join(uploadsDir, path.basename(sale.proofPath));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    if (sale.productId) {
      const products = loadProducts();
      const product = products.find(p => p.id === sale.productId);
      if (product) { product.stock += (sale.quantity || 1); saveProducts(products); }
    }
  } else {
    // Libera el pedido para que se pueda volver a registrar como venta si hace falta.
    const orders = loadOrders();
    const order = orders.find(o => o.id === sale.orderId);
    if (order) { order.convertedToSaleId = null; saveOrders(orders); }
  }
 
  sales.splice(idx, 1);
  saveSales(sales);
  logAudit('venta_eliminada', req.user, `${req.user.name} eliminó la venta #${sale.id} (${sale.productName || ''})`);
  res.json({ message: 'Venta eliminada' });
});
 
// ================= PEDIDOS (cualquier usuario autenticado) =================
app.post('/api/orders', upload.single('proof'), (req, res) => {
  try {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ message: 'Debes iniciar sesión para hacer un pedido' });
 
    const { productId, quantity, address, phone, paymentMethod } = req.body;
 
    if (!productId || !quantity || !address || !address.trim() || !phone || !phone.trim() || !paymentMethod) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }
 
    const qty = parseInt(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
      return res.status(400).json({ message: 'La cantidad debe ser un número entre 1 y 50' });
    }
 
    const phoneRegex = /^[0-9+\s-]{7,15}$/;
    if (!phoneRegex.test(phone.trim())) {
      return res.status(400).json({ message: 'Número de teléfono inválido' });
    }
 
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Método de pago inválido' });
    }
 
    const products = loadProducts();
    const product = products.find(p => p.id === parseInt(productId));
    if (!product) return res.status(400).json({ message: 'Producto inválido' });
    if (product.stock < qty) return res.status(400).json({ message: `Solo quedan ${product.stock} unidades disponibles` });
 
    if (paymentMethod === 'Transferencia / Pago electrónico' && !req.file) {
      return res.status(400).json({ message: 'Debes subir el comprobante de pago' });
    }
 
    product.stock -= qty;
    saveProducts(products);
 
    const orders = loadOrders();
    const newOrder = {
      id: Math.max(...orders.map(o => o.id), 0) + 1,
      userId: user.id,
      clienteName: user.name,
      clienteEmail: user.email,
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitPrice: product.price,
      total: product.price * qty,
      address: address.trim(),
      phone: phone.trim(),
      paymentMethod,
      proofPath: req.file ? `/uploads/${req.file.filename}` : null,
      status: 'Pendiente',
      takenBy: null,
      takenByName: null,
      convertedToSaleId: null,
      createdAt: new Date()
    };
 
    orders.push(newOrder);
    saveOrders(orders);
    maybeAlertLowStock(product);
    pushNotification('pedido_nuevo', `Nuevo pedido de ${user.name}: ${qty} x "${product.name}"`, 'admin_owner');
 
    logAudit('pedido_creado', user, `${user.name} hizo un pedido de ${qty} x "${product.name}"`);
 
    res.json({ message: 'Pedido realizado correctamente', order: newOrder, remainingStock: product.stock });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
 
app.get('/api/orders/my-orders', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });
 
  const orders = loadOrders()
    .filter(o => o.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(orders);
});
 
app.get('/api/orders/all', requireRole('admin', 'owner'), (req, res) => {
  const orders = loadOrders().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(orders);
});
 
// Un admin "toma" un pedido para encargarse de él. Nadie más se lo puede quitar
// (solo el propietario puede liberarlo).
app.post('/api/orders/:id/claim', requireRole('admin', 'owner'), (req, res) => {
  const orders = loadOrders();
  const order = orders.find(o => o.id === parseInt(req.params.id));
  if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });
 
  if (order.takenBy && order.takenBy !== req.user.id) {
    return res.status(400).json({ message: `Este pedido ya lo tomó ${order.takenByName}` });
  }
 
  order.takenBy = req.user.id;
  order.takenByName = req.user.name;
  saveOrders(orders);
  logAudit('pedido_tomado', req.user, `${req.user.name} tomó el pedido #${order.id} (${order.clienteName}, "${order.productName}")`);
  res.json({ message: 'Pedido tomado', order });
});
 
// Solo el propietario puede quitarle un pedido a quien lo tomó y dejarlo libre de nuevo.
app.post('/api/orders/:id/release', requireRole('owner'), (req, res) => {
  const orders = loadOrders();
  const order = orders.find(o => o.id === parseInt(req.params.id));
  if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });
 
  const previousOwner = order.takenByName;
  order.takenBy = null;
  order.takenByName = null;
  saveOrders(orders);
  logAudit('pedido_liberado', req.user, `${req.user.name} liberó el pedido #${order.id} (antes lo tenía ${previousOwner || 'nadie'})`);
  res.json({ message: 'Pedido liberado', order });
});
 
// Pedidos que ESTE admin tomó, ya están Entregados, y todavía no se han pasado a "Registrar venta".
app.get('/api/orders/my-deliverable', requireRole('admin', 'owner'), (req, res) => {
  const orders = loadOrders().filter(o =>
    o.takenBy === req.user.id && o.status === 'Entregado' && !o.convertedToSaleId
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(orders);
});
 
const ORDER_EMAIL_SUBJECTS = {
  'Confirmado': (store) => `Tu pedido fue confirmado - ${store}`,
  'En camino': (store) => `Tu pedido va en camino - ${store}`,
  'Entregado': (store) => `Tu pedido fue entregado - ${store}`,
  'Cancelado': (store) => `Tu pedido fue cancelado - ${store}`
};
const ORDER_EMAIL_BODY = {
  'Confirmado': (name, product) => `Hola ${name}, tu pedido de <strong>${product}</strong> fue confirmado. Pronto estará en camino.`,
  'En camino': (name, product) => `Hola ${name}, tu pedido de <strong>${product}</strong> ya va en camino hacia tu dirección.`,
  'Entregado': (name, product) => `Hola ${name}, tu pedido de <strong>${product}</strong> fue entregado con éxito. ¡Gracias por tu compra!`,
  'Cancelado': (name, product) => `Hola ${name}, lamentamos informarte que tu pedido de <strong>${product}</strong> fue cancelado. Si tienes dudas, contáctanos.`
};
 
async function sendOrderStatusEmail(order, status) {
  const storeName = loadSettings().storeName || 'Tu tienda';
  const subjectFn = ORDER_EMAIL_SUBJECTS[status];
  const bodyFn = ORDER_EMAIL_BODY[status];
  if (!subjectFn || !order.clienteEmail) return;
 
  await transporter.sendMail({
    from: `${storeName} <${config.SMTP_USER}>`,
    to: order.clienteEmail,
    subject: subjectFn(storeName),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 30px; background:#0d0f14; color:#e8eaf0; border-radius:14px;">
        <h2 style="color:#00f0ff;">⚡ ${storeName}</h2>
        <p>${bodyFn(order.clienteName, order.productName)}</p>
        <p style="color:#8a8fa3; font-size:12px;">Pedido #${order.id} · Cantidad: ${order.quantity}</p>
      </div>
    `
  });
}
 
app.patch('/api/orders/:id/status', requireRole('admin', 'owner'), async (req, res) => {
  const { status } = req.body;
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Estado inválido' });
  }
 
  const orders = loadOrders();
  const order = orders.find(o => o.id === parseInt(req.params.id));
  if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });
 
  const wasCancelled = order.status === 'Cancelado';
  const willBeCancelled = status === 'Cancelado';
 
  if (!wasCancelled && willBeCancelled) {
    const products = loadProducts();
    const product = products.find(p => p.id === order.productId);
    if (product) { product.stock += order.quantity; saveProducts(products); }
  } else if (wasCancelled && !willBeCancelled) {
    const products = loadProducts();
    const product = products.find(p => p.id === order.productId);
    if (product) {
      if (product.stock < order.quantity) {
        return res.status(400).json({ message: 'No hay stock suficiente para reactivar este pedido' });
      }
      product.stock -= order.quantity;
      saveProducts(products);
    }
  }
 
  const previousStatus = order.status;
  order.status = status;
  saveOrders(orders);
 
  // Puntos de fidelidad: se otorgan una sola vez, cuando el pedido pasa a Entregado.
  if (status === 'Entregado' && previousStatus !== 'Entregado' && !order.pointsAwarded) {
    const settings = loadSettings();
    const earned = Math.floor((order.total / 1000) * (settings.pointsPerThousand || 1));
    if (earned > 0) {
      const users = loadUsers();
      const buyer = users.find(u => u.id === order.userId);
      if (buyer) {
        buyer.points = (buyer.points || 0) + earned;
        saveUsers(users);
        order.pointsAwarded = true;
        saveOrders(orders);
        pushNotification('puntos_otorgados', `${buyer.name} ganó ${earned} puntos por su pedido #${order.id}`, 'admin_owner');
      }
    }
  }
 
  try { await sendOrderStatusEmail(order, status); } catch { /* no bloquea si falla el correo */ }
 
  logAudit('pedido_estado', req.user, `${req.user.name} cambió el pedido #${order.id} (${order.clienteName}, "${order.productName}") de "${previousStatus}" a "${status}"`);
  res.json({ message: 'Estado actualizado', order });
});
 
app.delete('/api/orders/:id', requireRole('owner'), (req, res) => {
  const orders = loadOrders();
  const idx = orders.findIndex(o => o.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ message: 'Pedido no encontrado' });
 
  const order = orders[idx];
 
  if (order.convertedToSaleId) {
    return res.status(400).json({ message: 'Este pedido ya se registró como venta. Elimina esa venta primero si quieres deshacerlo.' });
  }
 
  if (order.proofPath) {
    const filePath = path.join(uploadsDir, path.basename(order.proofPath));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
 
  if (order.status !== 'Cancelado' && order.productId) {
    const products = loadProducts();
    const product = products.find(p => p.id === order.productId);
    if (product) { product.stock += order.quantity; saveProducts(products); }
  }
 
  orders.splice(idx, 1);
  saveOrders(orders);
  logAudit('pedido_eliminado', req.user, `${req.user.name} eliminó el pedido #${order.id} (${order.clienteName}, "${order.productName}")`);
  res.json({ message: 'Pedido eliminado' });
});
 
// ================= USUARIOS (solo propietario) =================
app.get('/api/users/all', requireRole('owner'), (req, res) => {
  const users = loadUsers().map(publicUser);
  res.json(users);
});
 
app.post('/api/users/promote-admin', requireRole('owner'), (req, res) => {
  const users = loadUsers();
  const target = users.find(u => u.id === req.body.userId);
  if (!target) return res.status(404).json({ message: 'Usuario no encontrado' });
  if (target.role === 'owner') return res.status(400).json({ message: 'No puedes modificar al propietario' });
 
  target.role = 'admin';
  saveUsers(users);
  logAudit('usuario_promovido', req.user, `${req.user.name} hizo administrador a ${target.name}`);
  res.json({ message: `${target.name} ahora es administrador` });
});
 
app.post('/api/users/demote-admin', requireRole('owner'), (req, res) => {
  const users = loadUsers();
  const target = users.find(u => u.id === req.body.userId);
  if (!target) return res.status(404).json({ message: 'Usuario no encontrado' });
  if (target.role === 'owner') return res.status(400).json({ message: 'No puedes modificar al propietario' });
 
  target.role = 'cliente';
  saveUsers(users);
  logAudit('usuario_degradado', req.user, `${req.user.name} le quitó el rol de administrador a ${target.name}`);
  res.json({ message: `${target.name} ahora es cliente` });
});
 
app.delete('/api/users/:id', requireRole('owner'), (req, res) => {
  const userId = parseInt(req.params.id);
  const users = loadUsers();
  const target = users.find(u => u.id === userId);
 
  if (!target) return res.status(404).json({ message: 'Usuario no encontrado' });
  if (target.role === 'owner') return res.status(400).json({ message: 'No puedes eliminar al propietario' });
 
  const remaining = users.filter(u => u.id !== userId);
  saveUsers(remaining);
  logAudit('usuario_eliminado', req.user, `${req.user.name} eliminó la cuenta de ${target.name}`);
  res.json({ message: `Cuenta de ${target.name} eliminada` });
});
 
// ================= NOTIFICACIONES INTERNAS =================
app.get('/api/notifications', requireRole('admin', 'owner'), (req, res) => {
  const notifications = loadNotifications().filter(n => n.forRole === 'admin_owner');
  res.json(notifications);
});
 
app.post('/api/notifications/:id/read', requireRole('admin', 'owner'), (req, res) => {
  const notifications = loadNotifications();
  const n = notifications.find(x => x.id === parseInt(req.params.id));
  if (n) { n.read = true; saveNotifications(notifications); }
  res.json({ message: 'Marcada como leída' });
});
 
app.post('/api/notifications/read-all', requireRole('admin', 'owner'), (req, res) => {
  const notifications = loadNotifications();
  notifications.forEach(n => { if (n.forRole === 'admin_owner') n.read = true; });
  saveNotifications(notifications);
  res.json({ message: 'Todas marcadas como leídas' });
});
 
// ================= CHAT DE SOPORTE (actualización cada pocos segundos, no WebSockets) =================
// Cada cliente tiene UNA conversación con "la tienda"; cualquier admin/propietario puede responderla.
app.get('/api/chat/my', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });
  const messages = loadChat().filter(m => m.conversationUserId === user.id);
  res.json(messages);
});
 
app.get('/api/chat/conversations', requireRole('admin', 'owner'), (req, res) => {
  const chat = loadChat();
  const users = loadUsers();
  const conversationIds = [...new Set(chat.map(m => m.conversationUserId))];
  const list = conversationIds.map(uid => {
    const msgs = chat.filter(m => m.conversationUserId === uid).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const last = msgs[msgs.length - 1];
    const user = users.find(u => u.id === uid);
    const unread = msgs.filter(m => m.fromRole === 'cliente' && !m.readByStaff).length;
    return {
      userId: uid,
      userName: user ? user.name : 'Cliente',
      lastMessage: last ? last.text : '',
      lastAt: last ? last.createdAt : null,
      unread
    };
  }).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
  res.json(list);
});
 
app.get('/api/chat/conversations/:userId', requireRole('admin', 'owner'), (req, res) => {
  const uid = parseInt(req.params.userId);
  const chat = loadChat();
  const messages = chat.filter(m => m.conversationUserId === uid);
  messages.forEach(m => { if (m.fromRole === 'cliente') m.readByStaff = true; });
  saveChat(chat);
  res.json(messages);
});
 
app.post('/api/chat/send', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });
 
  const { text, toUserId } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ message: 'Escribe un mensaje' });
 
  const conversationUserId = (user.role === 'cliente') ? user.id : parseInt(toUserId);
  if (!conversationUserId) return res.status(400).json({ message: 'Falta indicar con qué cliente hablas' });
 
  const chat = loadChat();
  const newMsg = {
    id: Math.max(...chat.map(m => m.id), 0) + 1,
    conversationUserId,
    fromRole: user.role,
    fromName: user.name,
    text: text.trim().slice(0, 1000),
    readByStaff: user.role !== 'cliente',
    createdAt: new Date()
  };
  chat.push(newMsg);
  saveChat(chat.slice(-2000));
 
  if (user.role === 'cliente') {
    pushNotification('chat_nuevo', `Nuevo mensaje de chat de ${user.name}`, 'admin_owner');
  }
 
  res.json({ message: 'Enviado', chatMessage: newMsg });
});
 
// ================= FACTURAS EN PDF (recibo, no es factura electrónica DIAN) =================
function buildInvoicePdf(res, { title, storeName, lines, buyerName, buyerContact, date, total, docNumber }) {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${title.replace(/\s+/g, '_')}.pdf"`);
  doc.pipe(res);
 
  doc.fontSize(20).fillColor('#111').text(storeName, { align: 'left' });
  doc.fontSize(10).fillColor('#555').text('Recibo / comprobante de compra — no constituye factura electrónica DIAN', { align: 'left' });
  doc.moveDown();
  doc.fontSize(14).fillColor('#111').text(title);
  doc.fontSize(10).fillColor('#555').text(`Documento N.° ${docNumber}`);
  doc.text(`Fecha: ${new Date(date).toLocaleString('es-CO')}`);
  doc.moveDown();
  doc.fontSize(11).fillColor('#111').text(`Cliente / receptor: ${buyerName}`);
  if (buyerContact) doc.text(`Contacto: ${buyerContact}`);
  doc.moveDown();
 
  doc.fontSize(11).fillColor('#111');
  doc.text('Producto', 50, doc.y, { continued: true, width: 220 });
  doc.text('Cant.', 270, doc.y, { continued: true, width: 60 });
  doc.text('Precio unit.', 330, doc.y, { continued: true, width: 100 });
  doc.text('Subtotal', 430, doc.y);
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
  doc.moveDown(0.5);
 
  lines.forEach(l => {
    doc.text(l.name, 50, doc.y, { continued: true, width: 220 });
    doc.text(String(l.qty), 270, doc.y, { continued: true, width: 60 });
    doc.text(`$${l.unitPrice.toLocaleString('es-CO')}`, 330, doc.y, { continued: true, width: 100 });
    doc.text(`$${l.subtotal.toLocaleString('es-CO')}`, 430, doc.y);
    doc.moveDown(0.3);
  });
 
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
  doc.moveDown(0.5);
  doc.fontSize(13).fillColor('#111').text(`Total: $${total.toLocaleString('es-CO')}`, { align: 'right' });
 
  doc.end();
}
 
app.get('/api/orders/:id/invoice', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });
 
  const order = loadOrders().find(o => o.id === parseInt(req.params.id));
  if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });
  if (user.role === 'cliente' && order.userId !== user.id) return res.status(403).json({ message: 'No autorizado' });
 
  const storeName = loadSettings().storeName || 'Tienda';
  buildInvoicePdf(res, {
    title: `Recibo de pedido #${order.id}`,
    storeName,
    lines: [{ name: order.productName, qty: order.quantity, unitPrice: order.unitPrice, subtotal: order.total }],
    buyerName: order.clienteName,
    buyerContact: order.phone,
    date: order.createdAt,
    total: order.total,
    docNumber: `PED-${order.id}`
  });
});
 
app.get('/api/sales/:id/invoice', requireRole('admin', 'owner'), (req, res) => {
  const sale = loadSales().find(s => s.id === parseInt(req.params.id));
  if (!sale) return res.status(404).json({ message: 'Venta no encontrada' });
 
  const storeName = loadSettings().storeName || 'Tienda';
  buildInvoicePdf(res, {
    title: `Recibo de venta #${sale.id}`,
    storeName,
    lines: [{ name: sale.productName, qty: sale.quantity || 1, unitPrice: sale.unitPrice || sale.price, subtotal: sale.price }],
    buyerName: sale.vendedor,
    buyerContact: '',
    date: sale.saleDate,
    total: sale.price,
    docNumber: `VEN-${sale.id}`
  });
});
 
// ================= PANEL DE SEGURIDAD (sesiones propias) =================
app.get('/api/security/sessions', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });
  const sessions = loadSessions().filter(s => s.userId === user.id).slice(0, 20);
  res.json(sessions);
});
 
app.post('/api/security/close-all-sessions', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });
 
  const users = loadUsers();
  const target = users.find(u => u.id === user.id);
  target.sessionsInvalidatedAt = Date.now();
  saveUsers(users);
 
  logAudit('ajustes_actualizados', user, `${user.name} cerró todas sus sesiones activas`);
  res.json({ message: 'Todas tus sesiones fueron cerradas. Debes iniciar sesión de nuevo.' });
});
 
// ================= PUNTOS DE FIDELIDAD =================
app.get('/api/points/my', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });
  res.json({ points: user.points || 0, pointsPerThousand: loadSettings().pointsPerThousand || 1 });
});
 
// ================= RECOMENDACIONES =================
// Sugiere productos de las mismas categorías que el cliente ya ha pedido antes, que no haya comprado todavía.
app.get('/api/recommendations', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.json([]);
 
  const orders = loadOrders().filter(o => o.userId === user.id);
  if (!orders.length) return res.json([]);
 
  const products = loadProducts();
  const boughtProductIds = new Set(orders.map(o => o.productId));
  const boughtCategoryIds = new Set(
    orders.map(o => (products.find(p => p.id === o.productId) || {}).categoryId).filter(Boolean)
  );
 
  const recommended = products
    .filter(p => boughtCategoryIds.has(p.categoryId) && !boughtProductIds.has(p.id) && p.stock > 0)
    .slice(0, 6);
 
  res.json(recommended);
});
 
// ================= VISITAS / ESTADÍSTICAS (para las gráficas) =================
app.post('/api/track/visit', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const visits = loadVisits();
  const entry = visits.find(v => v.date === today);
  if (entry) entry.count += 1;
  else visits.push({ date: today, count: 1 });
  saveVisits(visits.slice(-90));
  res.json({ ok: true });
});
 
app.get('/api/stats/overview', requireRole('admin', 'owner'), (req, res) => {
  const { from, to } = req.query;
  const fromDate = from ? new Date(`${from}T00:00:00`) : null;
  const toDate = to ? new Date(`${to}T23:59:59`) : null;
  const inRange = (d) => (!fromDate || new Date(d) >= fromDate) && (!toDate || new Date(d) <= toDate);
 
  const sales = loadSales().filter(s => inRange(s.saleDate));
  const orders = loadOrders().filter(o => inRange(o.createdAt));
  const visits = loadVisits().filter(v => inRange(v.date)).sort((a, b) => a.date.localeCompare(b.date));
 
  // Ventas por día (últimos 14 días con datos dentro del rango elegido)
  const byDay = {};
  [...sales.map(s => ({ date: s.saleDate, total: s.price })), ...orders.filter(o => o.status !== 'Cancelado').map(o => ({ date: o.createdAt, total: o.total }))]
    .forEach(entry => {
      const day = new Date(entry.date).toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + entry.total;
    });
  const salesByDay = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).slice(-30)
    .map(([date, total]) => ({ date, total }));
 
  // Ingresos por producto (top 8)
  const byProduct = {};
  [...sales, ...orders.filter(o => o.status !== 'Cancelado')].forEach(entry => {
    const name = entry.productName || 'Sin nombre';
    byProduct[name] = (byProduct[name] || 0) + (entry.price || entry.total || 0);
  });
  const revenueByProduct = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, total]) => ({ name, total }));
 
  // Distribución de estados de pedidos (para ver el "flujo"/"tránsito" de pedidos)
  const statusCounts = {};
  ORDER_STATUSES.forEach(s => { statusCounts[s] = 0; });
  orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
 
  res.json({
    salesByDay,
    revenueByProduct,
    statusCounts,
    visits: visits.slice(-30),
    totals: {
      totalRevenue: sales.reduce((s, x) => s + x.price, 0) + orders.filter(o => o.status !== 'Cancelado').reduce((s, x) => s + x.total, 0),
      totalOrders: orders.length,
      totalSales: sales.length,
      pendingOrders: orders.filter(o => o.status === 'Pendiente').length
    }
  });
});
 
app.listen(PORT, () => {
  console.log(`🚀 Servidor Vapos Web corriendo en http://localhost:${PORT}`);
  if (config.SMTP_USER === 'TU_CORREO@gmail.com') {
    console.log('⚠️  Todavía no configuraste el envío de correos. Edita config.js con tus credenciales SMTP.');
  }
});