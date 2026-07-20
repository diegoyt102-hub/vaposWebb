const API = '/api';
let currentUser = null;
let catalog = [];
let categories = [];
let pendingVerifyEmail = null;
let settings = { lowStockThreshold: 5, storeName: 'Tienda', aboutContent: '', navOrder: [], theme: {}, pointsPerThousand: 1 };
let allUsers = [];
let myFavorites = [];
let cart = [];
let chatPollTimer = null;
let currentChatConversationUserId = null;
let notifPollTimer = null;
let charts = {};
 
const DEFAULT_NAV_ORDER = ['catalogo', 'favoritos', 'carrito', 'mis-pedidos', 'puntos', 'seguridad', 'pedidos', 'venta', 'mis-ventas', 'todas-ventas', 'productos', 'estadisticas', 'usuarios', 'configuracion', 'acerca'];
const DEFAULT_THEME = { bg: '#0d0f14', card: '#1a1e28', accent: '#00f0ff', accent2: '#b455ff', brand: '#00f0ff', text: '#e8eaf0' };
const LIGHT_THEME = { bg: '#f2f4f8', card: '#ffffff', accent: '#0891b2', accent2: '#7c3aed', brand: '#0891b2', text: '#1a1e28' };
const PALETTES = [
  { bg: '#0d0f14', card: '#1a1e28', accent: '#00f0ff', accent2: '#b455ff', brand: '#00f0ff', text: '#e8eaf0' },
  { bg: '#120a18', card: '#231030', accent: '#ff4fd8', accent2: '#b455ff', brand: '#ff4fd8', text: '#f2e8fb' },
  { bg: '#081410', card: '#122c22', accent: '#4dffb4', accent2: '#2dffc0', brand: '#4dffb4', text: '#e8f5ee' },
  { bg: '#170e08', card: '#2b1a0f', accent: '#ffb84d', accent2: '#ff8a4d', brand: '#ffb84d', text: '#f5ece0' },
  { bg: '#0a0e18', card: '#141c2e', accent: '#4d9fff', accent2: '#4dc9ff', brand: '#4d9fff', text: '#e8eef8' }
];
 
const TABS_BY_ROLE = {
  cliente: [
    { id: 'catalogo', label: '🛍️ Catálogo' },
    { id: 'favoritos', label: '❤️ Favoritos' },
    { id: 'carrito', label: '🛒 Carrito' },
    { id: 'mis-pedidos', label: '📦 Mis pedidos' },
    { id: 'puntos', label: '🏆 Puntos' },
    { id: 'acerca', label: 'ℹ️ Acerca de' }
  ],
  admin: [
    { id: 'catalogo', label: '🛍️ Catálogo' },
    { id: 'favoritos', label: '❤️ Favoritos' },
    { id: 'carrito', label: '🛒 Carrito' },
    { id: 'mis-pedidos', label: '📦 Mis pedidos' },
    { id: 'pedidos', label: '🚚 Pedidos de clientes' },
    { id: 'venta', label: '🧾 Registrar venta' },
    { id: 'mis-ventas', label: '📋 Mis ventas' },
    { id: 'productos', label: '🗂️ Productos' },
    { id: 'estadisticas', label: '📊 Estadísticas' },
    { id: 'seguridad', label: '🛡️ Seguridad' },
    { id: 'acerca', label: 'ℹ️ Acerca de' }
  ],
  owner: [
    { id: 'catalogo', label: '🛍️ Catálogo' },
    { id: 'favoritos', label: '❤️ Favoritos' },
    { id: 'carrito', label: '🛒 Carrito' },
    { id: 'mis-pedidos', label: '📦 Mis pedidos' },
    { id: 'pedidos', label: '🚚 Pedidos de clientes' },
    { id: 'venta', label: '🧾 Registrar venta' },
    { id: 'mis-ventas', label: '📋 Mis ventas' },
    { id: 'todas-ventas', label: '💰 Todas las ventas' },
    { id: 'productos', label: '🗂️ Productos' },
    { id: 'estadisticas', label: '📊 Estadísticas' },
    { id: 'seguridad', label: '🛡️ Seguridad' },
    { id: 'usuarios', label: '👑 Panel propietario' },
    { id: 'configuracion', label: '⚙️ Configuración' },
    { id: 'acerca', label: 'ℹ️ Acerca de' }
  ]
};
 
const ALL_TAB_LABELS = {
  catalogo: '🛍️ Catálogo', favoritos: '❤️ Favoritos', carrito: '🛒 Carrito', 'mis-pedidos': '📦 Mis pedidos',
  puntos: '🏆 Puntos', seguridad: '🛡️ Seguridad', pedidos: '🚚 Pedidos de clientes', venta: '🧾 Registrar venta',
  'mis-ventas': '📋 Mis ventas', 'todas-ventas': '💰 Todas las ventas', productos: '🗂️ Productos',
  estadisticas: '📊 Estadísticas', usuarios: '👑 Panel propietario', configuracion: '⚙️ Configuración', acerca: 'ℹ️ Acerca de'
};
 
const PAYMENT_METHODS = ['Efectivo contraentrega', 'Transferencia / Pago electrónico'];
const ORDER_STATUSES = ['Pendiente', 'Confirmado', 'En camino', 'Entregado', 'Cancelado'];
const STATUS_CLASS = {
  'Pendiente': 'status-pendiente', 'Confirmado': 'status-confirmado', 'En camino': 'status-camino',
  'Entregado': 'status-entregado', 'Cancelado': 'status-cancelado'
};
 
document.addEventListener('DOMContentLoaded', () => {
  loadCatalog();
  loadSettings();
  fetch(`${API}/track/visit`, { method: 'POST' }).catch(() => {});
  initDarkMode();
 
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  if (token && user) {
    currentUser = JSON.parse(user);
    enterApp();
    syncUserRole();
    setInterval(syncUserRole, 15000);
  } else {
    showAuth();
  }
 
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
  document.getElementById('verifyForm').addEventListener('submit', handleVerify);
  document.getElementById('saleForm').addEventListener('submit', handleSaleSubmit);
  document.getElementById('saleProduct').addEventListener('change', updateSalePrice);
  document.getElementById('salePaymentMethod').addEventListener('change', togglePaymentProof);
  document.getElementById('categoryForm').addEventListener('submit', handleCategorySubmit);
  document.getElementById('productForm').addEventListener('submit', handleProductSubmit);
  document.getElementById('settingsForm').addEventListener('submit', handleSettingsSubmit);
  document.getElementById('supportForm').addEventListener('submit', handleSupportSubmit);
  document.getElementById('cartCheckoutForm').addEventListener('submit', handleCartCheckout);
  document.getElementById('cartPaymentMethod').addEventListener('change', toggleCartProof);
  document.getElementById('chatForm').addEventListener('submit', handleChatSend);
  document.getElementById('productModal').addEventListener('click', (e) => { if (e.target.id === 'productModal') closeProductModal(); });
  document.getElementById('editProductModal').addEventListener('click', (e) => { if (e.target.id === 'editProductModal') closeEditProductModal(); });
  document.getElementById('supportModal').addEventListener('click', (e) => { if (e.target.id === 'supportModal') closeSupportModal(); });
  document.addEventListener('click', (e) => {
    const notifWrap = document.querySelector('.notif-wrap');
    if (notifWrap && !notifWrap.contains(e.target)) document.getElementById('notifPanel').classList.remove('open');
    const accountWrap = document.querySelector('.account-wrap');
    if (accountWrap && !accountWrap.contains(e.target)) document.getElementById('accountPanel')?.classList.remove('open');
  });
 
  bindThemeInputs();
  renderPaletteSwatches();
});
 
// Revisa el rol/estado del usuario cada 15s. Si el token ya no es válido
// (por ejemplo, porque el propietario eliminó la cuenta), se cierra la sesión sola.
async function syncUserRole() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
 
    if (res.status === 401) {
      alert('Tu sesión ya no es válida (es posible que tu cuenta haya sido eliminada o que hayas cerrado sesión desde otro lugar).');
      forceLogout();
      return;
    }
    if (!res.ok) return;
 
    const fresh = await res.json();
    if (fresh.role !== currentUser.role || fresh.name !== currentUser.name || fresh.points !== currentUser.points) {
      currentUser = { ...currentUser, ...fresh };
      localStorage.setItem('user', JSON.stringify(currentUser));
      renderNav();
      renderAccountPanel();
 
      const allowedTabs = orderedTabsForRole(currentUser.role).map(t => t.id);
      const activeSection = document.querySelector('.tab-section.active');
      const activeTab = activeSection ? activeSection.id.replace('tab-', '') : null;
      if (activeTab && !allowedTabs.includes(activeTab)) switchAppTab('catalogo');
    }
  } catch { /* noop */ }
}
 
// ================= AUTH VIEWS =================
function showAuth() {
  document.getElementById('authWrapper').style.display = 'flex';
  document.getElementById('appWrapper').classList.remove('active');
  document.getElementById('navbar').classList.remove('active');
  stopChatPolling();
  stopNotifPolling();
  switchAuthTab('login');
}
 
function enterApp() {
  document.getElementById('authWrapper').style.display = 'none';
  document.getElementById('appWrapper').classList.add('active');
  document.getElementById('navbar').classList.add('active');
  renderNav();
  renderAccountPanel();
  renderCatalogGrid();
  loadCart();
  loadMyFavorites();
  switchAppTab('catalogo');
  startNotifPolling();
}
 
function switchAuthTab(tab) {
  document.getElementById('authTabsWrap').style.display = tab === 'verify' ? 'none' : 'flex';
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('loginForm').classList.toggle('active', tab === 'login');
  document.getElementById('registerForm').classList.toggle('active', tab === 'register');
  document.getElementById('verifyForm').classList.toggle('active', tab === 'verify');
  clearAlert('authAlert');
}
 
// ================= LOGIN / REGISTER / VERIFY =================
async function handleLogin(e) {
  e.preventDefault();
  const emailEl = document.getElementById('loginEmail');
  const passEl = document.getElementById('loginPassword');
  const email = emailEl.value.trim();
  const password = passEl.value;
 
  clearFieldErrors([emailEl, passEl]);
 
  if (!email || !password) {
    markInvalid([emailEl, passEl].filter(el => !el.value.trim()));
    return showAlert('authAlert', 'Completa todos los campos', 'error');
  }
 
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
 
    if (!res.ok) {
      if (data.needsVerification) {
        pendingVerifyEmail = data.email;
        document.getElementById('verifyEmailLabel').textContent = data.email;
        switchAuthTab('verify');
        return showAlert('authAlert', 'Te enviamos un código nuevo, revisa tu correo', 'error');
      }
      return showAlert('authAlert', data.message, 'error');
    }
 
    currentUser = data.user;
    localStorage.setItem('token', data.user.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    enterApp();
  } catch {
    showAlert('authAlert', 'No se pudo conectar con el servidor', 'error');
  }
}
 
async function handleRegister(e) {
  e.preventDefault();
  const nameEl = document.getElementById('registerName');
  const emailEl = document.getElementById('registerEmail');
  const passEl = document.getElementById('registerPassword');
 
  const name = nameEl.value.trim();
  const email = emailEl.value.trim();
  const password = passEl.value;
 
  clearFieldErrors([nameEl, emailEl, passEl]);
 
  const invalids = [];
  if (name.length < 3) invalids.push(nameEl);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalids.push(emailEl);
  if (password.length < 6) invalids.push(passEl);
 
  if (invalids.length) {
    markInvalid(invalids);
    return showAlert('authAlert', 'Revisa los campos: nombre (mín. 3), correo válido y contraseña (mín. 6 caracteres)', 'error');
  }
 
  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
 
    if (!res.ok) return showAlert('authAlert', data.message, 'error');
 
    pendingVerifyEmail = data.email;
    document.getElementById('verifyEmailLabel').textContent = data.email;
    document.getElementById('registerForm').reset();
    switchAuthTab('verify');
  } catch {
    showAlert('authAlert', 'No se pudo conectar con el servidor', 'error');
  }
}
 
async function handleVerify(e) {
  e.preventDefault();
  const codeEl = document.getElementById('verifyCode');
  const code = codeEl.value.trim();
 
  clearFieldErrors([codeEl]);
 
  if (!/^\d{6}$/.test(code)) {
    markInvalid([codeEl]);
    return showAlert('authAlert', 'Ingresa el código de 6 dígitos', 'error');
  }
 
  try {
    const res = await fetch(`${API}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingVerifyEmail, code })
    });
    const data = await res.json();
 
    if (!res.ok) return showAlert('authAlert', data.message, 'error');
 
    currentUser = data.user;
    localStorage.setItem('token', data.user.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    document.getElementById('verifyForm').reset();
    enterApp();
  } catch {
    showAlert('authAlert', 'No se pudo conectar con el servidor', 'error');
  }
}
 
async function resendCode() {
  if (!pendingVerifyEmail) return;
  const btn = document.getElementById('resendBtn');
  btn.disabled = true;
  btn.textContent = 'Enviando...';
 
  try {
    const res = await fetch(`${API}/auth/resend-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingVerifyEmail })
    });
    const data = await res.json();
    showAlert('authAlert', data.message, res.ok ? 'success' : 'error');
  } catch {
    showAlert('authAlert', 'No se pudo reenviar el código', 'error');
  }
 
  setTimeout(() => { btn.disabled = false; btn.textContent = 'Reenviar código'; }, 20000);
}
 
function logout() {
  if (!confirm('¿Cerrar tu sesión?')) return;
  forceLogout();
}
 
// Se usa cuando el servidor ya invalidó la sesión (cuenta eliminada, token vencido, etc.)
// No pide confirmación porque la sesión ya no es válida de todas formas.
function forceLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  document.getElementById('loginForm').reset();
  document.getElementById('registerForm').reset();
  document.getElementById('accountPanel')?.classList.remove('open');
  showAuth();
}
 
// ================= CUENTA (menú desplegable en vez del botón "Salir") =================
function renderAccountPanel() {
  if (!currentUser) return;
  const roleLabel = { cliente: 'Cliente', admin: 'Admin', owner: 'Propietario' }[currentUser.role];
  document.getElementById('accountNameDisplay').textContent = currentUser.name;
  document.getElementById('accountEmailDisplay').textContent = currentUser.email;
  const roleBadge = document.getElementById('accountRoleDisplay');
  roleBadge.textContent = roleLabel;
  roleBadge.className = `role-badge ${currentUser.role}`;
}
 
function toggleAccountPanel() {
  document.getElementById('accountPanel').classList.toggle('open');
  document.getElementById('notifPanel').classList.remove('open');
}
 
function goToSecurityFromAccount() {
  document.getElementById('accountPanel').classList.remove('open');
  switchAppTab('seguridad');
}
 
// ================= NAV =================
function renderNav() {
  document.getElementById('navUserName').textContent = currentUser.name;
  const roleLabel = { cliente: 'Cliente', admin: 'Admin', owner: 'Propietario' }[currentUser.role];
  const roleBadge = document.getElementById('navUserRole');
  roleBadge.textContent = roleLabel;
  roleBadge.className = `role-badge ${currentUser.role}`;
 
  const tabs = orderedTabsForRole(currentUser.role);
  const navTabs = document.getElementById('navTabs');
  navTabs.innerHTML = tabs.map(t =>
    `<button class="nav-tab" data-tab="${t.id}" onclick="switchAppTab('${t.id}')">${t.label}</button>`
  ).join('');
 
  updateCartBadge();
  updateFavCountBadge();
}
 
function orderedTabsForRole(role) {
  const tabs = TABS_BY_ROLE[role] || TABS_BY_ROLE.cliente;
  const order = (settings.navOrder && settings.navOrder.length) ? settings.navOrder : DEFAULT_NAV_ORDER;
  return [...tabs].sort((a, b) => {
    const ia = order.indexOf(a.id); const ib = order.indexOf(b.id);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}
 
function switchAppTab(tabId) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  const section = document.getElementById(`tab-${tabId}`);
  if (section) section.classList.add('active');
 
  if (tabId === 'venta') prepareSaleForm();
  if (tabId === 'mis-ventas') loadMySales();
  if (tabId === 'todas-ventas') loadAllSales();
  if (tabId === 'usuarios') { loadUsers(); loadRequests(); loadAudit(); loadSupportList(); }
  if (tabId === 'mis-pedidos') loadMyOrders();
  if (tabId === 'pedidos') loadAllOrders();
  if (tabId === 'productos') loadProductManagement();
  if (tabId === 'configuracion') loadSettingsForm();
  if (tabId === 'acerca') renderAbout();
  if (tabId === 'favoritos') renderFavoritesGrid();
  if (tabId === 'carrito') renderCartTable();
  if (tabId === 'puntos') loadPoints();
  if (tabId === 'seguridad') loadSecuritySessions();
  if (tabId === 'estadisticas') loadStats();
}
 
// ================= MODO OSCURO / CLARO =================
function initDarkMode() {
  const saved = localStorage.getItem('darkMode');
  if (saved === 'light') applyLightMode();
}
 
function toggleDarkMode() {
  const isLight = document.body.classList.contains('light-mode');
  if (isLight) { applyTheme(settings.theme || DEFAULT_THEME); document.body.classList.remove('light-mode'); localStorage.setItem('darkMode', 'dark'); document.getElementById('darkModeBtn').textContent = '🌙'; }
  else applyLightMode();
}
 
function applyLightMode() {
  applyTheme(LIGHT_THEME);
  document.body.classList.add('light-mode');
  localStorage.setItem('darkMode', 'light');
  const btn = document.getElementById('darkModeBtn');
  if (btn) btn.textContent = '☀️';
}
 
// ================= AJUSTES =================
async function loadSettings() {
  try {
    const res = await fetch(`${API}/settings`);
    settings = await res.json();
    applyBranding();
    if (localStorage.getItem('darkMode') !== 'light') applyTheme(settings.theme || DEFAULT_THEME);
    if (document.getElementById('appWrapper').classList.contains('active')) {
      renderNav();
      renderCatalogGrid();
      const productosTab = document.getElementById('tab-productos');
      if (productosTab && productosTab.classList.contains('active')) renderAdminProductGrid();
      const acercaTab = document.getElementById('tab-acerca');
      if (acercaTab && acercaTab.classList.contains('active')) renderAbout();
    }
  } catch {
    applyBranding();
    applyTheme(DEFAULT_THEME);
  }
}
 
function applyBranding() {
  const name = settings.storeName || 'Tienda';
  document.title = name;
  const navBrand = document.getElementById('navBrandName');
  const authBrand = document.getElementById('authBrandName');
  if (navBrand) navBrand.textContent = name;
  if (authBrand) authBrand.textContent = name;
}
 
function applyTheme(theme) {
  const t = { ...DEFAULT_THEME, ...(theme || {}) };
  const root = document.documentElement.style;
  root.setProperty('--bg', t.bg);
  root.setProperty('--card', t.card);
  root.setProperty('--neon-cyan', t.accent);
  root.setProperty('--neon-purple', t.accent2);
  root.setProperty('--brand-color', t.brand);
  root.setProperty('--text', t.text);
}
 
function loadSettingsForm() {
  document.getElementById('lowStockThreshold').value = settings.lowStockThreshold;
  document.getElementById('storeName').value = settings.storeName || '';
  document.getElementById('aboutContentInput').value = settings.aboutContent || '';
  document.getElementById('pointsPerThousand').value = settings.pointsPerThousand || 1;
  const t = { ...DEFAULT_THEME, ...(settings.theme || {}) };
  setThemeInputs(t);
  renderNavOrderList();
}
 
async function handleSettingsSubmit(e) {
  e.preventDefault();
  const thresholdEl = document.getElementById('lowStockThreshold');
  const storeNameEl = document.getElementById('storeName');
  const aboutEl = document.getElementById('aboutContentInput');
  const pointsEl = document.getElementById('pointsPerThousand');
 
  clearFieldErrors([thresholdEl, storeNameEl]);
 
  const invalids = [];
  const value = parseInt(thresholdEl.value);
  if (thresholdEl.value === '' || !Number.isInteger(value) || value < 0) invalids.push(thresholdEl);
  if (!storeNameEl.value.trim()) invalids.push(storeNameEl);
 
  if (invalids.length) {
    markInvalid(invalids);
    return showAlert('settingsAlert', 'Revisa los campos marcados', 'error');
  }
 
  await saveSettingsToServer({
    lowStockThreshold: value,
    storeName: storeNameEl.value.trim(),
    aboutContent: aboutEl.value,
    pointsPerThousand: parseInt(pointsEl.value) || 1
  }, 'Ajustes guardados correctamente');
}
 
function bindThemeInputs() {
  const map = [['themeBg', 'themeBgHex'], ['themeCard', 'themeCardHex'], ['themeAccent', 'themeAccentHex'],
  ['themeAccent2', 'themeAccent2Hex'], ['themeBrand', 'themeBrandHex'], ['themeText', 'themeTextHex']];
  map.forEach(([colorId, hexId]) => {
    const colorEl = document.getElementById(colorId);
    const hexEl = document.getElementById(hexId);
    if (!colorEl || !hexEl) return;
    colorEl.addEventListener('input', () => { hexEl.value = colorEl.value; previewThemeFromInputs(); });
    hexEl.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hexEl.value)) { colorEl.value = hexEl.value; previewThemeFromInputs(); }
    });
  });
}
 
function setThemeInputs(t) {
  document.getElementById('themeBg').value = t.bg; document.getElementById('themeBgHex').value = t.bg;
  document.getElementById('themeCard').value = t.card; document.getElementById('themeCardHex').value = t.card;
  document.getElementById('themeAccent').value = t.accent; document.getElementById('themeAccentHex').value = t.accent;
  document.getElementById('themeAccent2').value = t.accent2; document.getElementById('themeAccent2Hex').value = t.accent2;
  document.getElementById('themeBrand').value = t.brand; document.getElementById('themeBrandHex').value = t.brand;
  document.getElementById('themeText').value = t.text; document.getElementById('themeTextHex').value = t.text;
}
 
function readThemeInputs() {
  return {
    bg: document.getElementById('themeBg').value,
    card: document.getElementById('themeCard').value,
    accent: document.getElementById('themeAccent').value,
    accent2: document.getElementById('themeAccent2').value,
    brand: document.getElementById('themeBrand').value,
    text: document.getElementById('themeText').value
  };
}
 
function previewThemeFromInputs() { applyTheme(readThemeInputs()); }
 
function renderPaletteSwatches() {
  const row = document.getElementById('paletteRow');
  if (!row) return;
  row.innerHTML = PALETTES.map((p, i) =>
    `<button type="button" class="palette-swatch" style="background:${p.accent};" title="Paleta ${i + 1}" onclick='applyPalette(${JSON.stringify(p)})'></button>`
  ).join('');
}
 
function applyPalette(p) { setThemeInputs(p); applyTheme(p); }
 
async function saveThemeOnly() {
  const theme = readThemeInputs();
  await saveSettingsToServer({ theme }, 'Colores guardados');
}
 
function resetTheme() { setThemeInputs(DEFAULT_THEME); applyTheme(DEFAULT_THEME); }
 
function renderNavOrderList() {
  const container = document.getElementById('navOrderList');
  if (!container) return;
  const order = (settings.navOrder && settings.navOrder.length) ? [...settings.navOrder] : [...DEFAULT_NAV_ORDER];
  container.dataset.order = JSON.stringify(order);
 
  container.innerHTML = order.map((id, idx) => `
    <div class="nav-order-item">
      <span>${ALL_TAB_LABELS[id] || id}</span>
      <div class="order-arrows">
        <button type="button" class="order-arrow-btn" ${idx === 0 ? 'disabled' : ''} onclick="moveNavOrderItem(${idx}, -1)">↑</button>
        <button type="button" class="order-arrow-btn" ${idx === order.length - 1 ? 'disabled' : ''} onclick="moveNavOrderItem(${idx}, 1)">↓</button>
      </div>
    </div>
  `).join('');
}
 
function moveNavOrderItem(index, direction) {
  const container = document.getElementById('navOrderList');
  const order = JSON.parse(container.dataset.order);
  const target = index + direction;
  if (target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  settings.navOrder = order;
  renderNavOrderList();
}
 
async function saveNavOrderOnly() {
  const container = document.getElementById('navOrderList');
  const order = JSON.parse(container.dataset.order);
  await saveSettingsToServer({ navOrder: order }, 'Orden del menú guardado');
}
 
async function saveSettingsToServer(payload, successMsg) {
  try {
    const res = await fetch(`${API}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return showAlert('settingsAlert', data.message, 'error');
 
    settings = data.settings;
    applyBranding();
    if (localStorage.getItem('darkMode') !== 'light') applyTheme(settings.theme);
    renderNav();
    showAlert('settingsAlert', successMsg, 'success');
    renderCatalogGrid();
    if (document.getElementById('tab-productos').classList.contains('active')) renderAdminProductGrid();
  } catch {
    showAlert('settingsAlert', 'No se pudo conectar con el servidor', 'error');
  }
}
 
// ================= ACERCA DE =================
function renderAbout() {
  const nameEl = document.getElementById('aboutStoreName');
  const contentEl = document.getElementById('aboutContent');
  if (nameEl) nameEl.textContent = settings.storeName || '';
  if (contentEl) {
    contentEl.textContent = settings.aboutContent && settings.aboutContent.trim()
      ? settings.aboutContent
      : 'Todavía no hay información para mostrar aquí.';
  }
}
 
// ================= CATÁLOGO =================
async function loadCatalog() {
  try {
    const [prodRes, catRes] = await Promise.all([fetch(`${API}/products`), fetch(`${API}/categories`)]);
    catalog = await prodRes.json();
    categories = await catRes.json();
    if (document.getElementById('appWrapper').classList.contains('active')) {
      renderCatalogGrid();
      loadRecommendations();
    }
  } catch {
    catalog = [];
    categories = [];
  }
}
 
function renderCatalogGrid() {
  const wrap = document.getElementById('catalogByCategory');
  if (!wrap) return;
  if (!catalog.length) {
    wrap.innerHTML = '<div class="empty-state">No hay productos disponibles por ahora.</div>';
    return;
  }
 
  const query = (document.getElementById('catalogSearch')?.value || '').trim().toLowerCase();
  renderSearchSuggestions(query);
 
  const filtered = query
    ? catalog.filter(p => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query))
    : catalog;
 
  const grouped = categories.map(cat => ({
    category: cat,
    items: filtered.filter(p => p.categoryId === cat.id)
  })).filter(g => g.items.length);
 
  if (!grouped.length) {
    wrap.innerHTML = '<div class="empty-state">No hay productos que coincidan con tu búsqueda.</div>';
    return;
  }
 
  wrap.innerHTML = grouped.map(g => `
    <div class="category-block">
      <h2 class="category-title">${g.category.icon || '🛍️'} ${g.category.name}</h2>
      <div class="catalog-grid">
        ${g.items.map(p => renderProductCard(p)).join('')}
      </div>
    </div>
  `).join('');
}
 
// Buscador con autocompletado: sugiere nombres de productos mientras se escribe.
function renderSearchSuggestions(query) {
  const box = document.getElementById('searchSuggestions');
  if (!box) return;
  if (!query) { box.innerHTML = ''; box.classList.remove('open'); return; }
 
  const matches = catalog.filter(p => p.name.toLowerCase().includes(query)).slice(0, 6);
  if (!matches.length) { box.classList.remove('open'); return; }
 
  box.innerHTML = matches.map(p => `<div class="suggestion-item" onclick="selectSuggestion(${p.id})">${p.name}</div>`).join('');
  box.classList.add('open');
}
 
function selectSuggestion(productId) {
  const p = catalog.find(x => x.id === productId);
  document.getElementById('catalogSearch').value = p ? p.name : '';
  document.getElementById('searchSuggestions').classList.remove('open');
  renderCatalogGrid();
}
 
async function loadRecommendations() {
  const block = document.getElementById('recommendationsBlock');
  if (!block || !currentUser) return;
  try {
    const res = await fetch(`${API}/recommendations`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const items = await res.json();
    if (!items.length) { block.innerHTML = ''; return; }
    block.innerHTML = `
      <div class="category-block">
        <h2 class="category-title">🤖 Recomendado para ti</h2>
        <div class="catalog-grid">${items.map(p => renderProductCard(p)).join('')}</div>
      </div>
    `;
  } catch { block.innerHTML = ''; }
}
 
function renderProductCard(p) {
  const outOfStock = p.stock <= 0;
  const isLow = !outOfStock && p.stock <= settings.lowStockThreshold;
  const isFav = myFavorites.includes(p.id);
  const imgHtml = p.image
    ? `<img src="${p.image}" class="product-img" alt="${p.name}">`
    : `<div class="product-img product-img-placeholder">💨</div>`;
 
  return `
    <div class="product-card ${outOfStock ? 'out-of-stock' : ''}">
      <button class="fav-toggle ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${p.id})">${isFav ? '❤️' : '🤍'}</button>
      <div onclick="${outOfStock ? '' : `openProductModal(${p.id})`}">
        ${imgHtml}
        <div class="product-body">
          <h3>${p.name}</h3>
          <p class="product-desc-short">${p.description}</p>
          <div class="product-footer">
            <span class="price">$${p.price.toLocaleString('es-CO')}</span>
            ${outOfStock
              ? '<span class="stock-tag out">Agotado</span>'
              : (isLow ? `<span class="stock-tag low">Quedan ${p.stock}</span>` : `<span class="stock-tag ok">Disponible</span>`)}
          </div>
        </div>
      </div>
    </div>
  `;
}
 
function openProductModal(id) {
  const p = catalog.find(x => x.id === id);
  if (!p || p.stock <= 0) return;
 
  const imgHtml = p.image ? `<img src="${p.image}" class="modal-img" alt="${p.name}">` : '';
 
  document.getElementById('modalContent').innerHTML = `
    ${imgHtml}
    <h2>${p.name}</h2>
    <div class="modal-price">$${p.price.toLocaleString('es-CO')} <span class="modal-unit">c/u</span></div>
    <p class="modal-desc">${p.description}</p>
    <p class="modal-meta">📦 ${p.stock} unidades disponibles</p>
 
    <div id="orderAlert" class="alert"></div>
 
    <div class="field" style="margin-bottom:14px;">
      <label>Cantidad</label>
      <input type="number" id="modalQuantity" min="1" max="${Math.min(p.stock, 50)}" value="1">
    </div>
    <button type="button" class="btn-ghost full" style="margin-bottom:18px;" onclick="addToCart(${p.id})">🛒 Agregar al carrito</button>
 
    <form id="orderForm" class="order-form" data-product-id="${p.id}" data-price="${p.price}" data-stock="${p.stock}">
      <p class="card-title" style="margin:0;">O pide este producto directamente:</p>
      <div class="field">
        <label>Dirección de entrega</label>
        <input type="text" id="orderAddress" placeholder="Calle, número, barrio, ciudad">
      </div>
      <div class="field">
        <label>Teléfono de contacto</label>
        <input type="text" id="orderPhone" placeholder="Ej: 3001234567">
      </div>
      <div class="field">
        <label>Método de pago</label>
        <select id="orderPaymentMethod" required>
          <option value="">-- Seleccionar método --</option>
          ${PAYMENT_METHODS.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
      </div>
      <div class="field" id="orderProofField" style="display:none;">
        <label>Comprobante de pago</label>
        <input type="file" id="orderProof" accept="image/*">
      </div>
      <div class="order-total-row">
        <span>Total</span>
        <span id="orderTotal">$${p.price.toLocaleString('es-CO')}</span>
      </div>
      <button type="submit" class="btn-neon full">Confirmar pedido</button>
    </form>
  `;
 
  document.getElementById('productModal').classList.add('active');
  attachOrderFormListeners();
}
 
function closeProductModal() { document.getElementById('productModal').classList.remove('active'); }
 
function attachOrderFormListeners() {
  const modalQtyEl = document.getElementById('modalQuantity');
  const paymentEl = document.getElementById('orderPaymentMethod');
  const form = document.getElementById('orderForm');
  if (modalQtyEl) modalQtyEl.addEventListener('input', updateOrderTotal);
  if (paymentEl) paymentEl.addEventListener('change', toggleOrderProof);
  if (form) form.addEventListener('submit', handleOrderSubmit);
}
 
function updateOrderTotal() {
  const form = document.getElementById('orderForm');
  const price = parseInt(form.dataset.price);
  const stock = parseInt(form.dataset.stock);
  let qty = parseInt(document.getElementById('modalQuantity').value) || 1;
  if (qty < 1) qty = 1;
  if (qty > stock) qty = stock;
  if (qty > 50) qty = 50;
  document.getElementById('orderTotal').textContent = `$${(price * qty).toLocaleString('es-CO')}`;
}
 
function toggleOrderProof() {
  const method = document.getElementById('orderPaymentMethod').value;
  document.getElementById('orderProofField').style.display = method === 'Transferencia / Pago electrónico' ? 'block' : 'none';
}
 
async function handleOrderSubmit(e) {
  e.preventDefault();
  if (!currentUser) return showAlert('orderAlert', 'Debes iniciar sesión para pedir', 'error');
 
  const form = document.getElementById('orderForm');
  const fields = {
    quantity: document.getElementById('modalQuantity'),
    address: document.getElementById('orderAddress'),
    phone: document.getElementById('orderPhone'),
    paymentMethod: document.getElementById('orderPaymentMethod')
  };
 
  clearFieldErrors(Object.values(fields));
 
  const invalids = [];
  if (!fields.quantity.value || parseInt(fields.quantity.value) < 1) invalids.push(fields.quantity);
  if (!fields.address.value.trim()) invalids.push(fields.address);
  if (!/^[0-9+\s-]{7,15}$/.test(fields.phone.value.trim())) invalids.push(fields.phone);
  if (!fields.paymentMethod.value) invalids.push(fields.paymentMethod);
 
  const proofFile = document.getElementById('orderProof')?.files[0];
  if (fields.paymentMethod.value === 'Transferencia / Pago electrónico' && !proofFile) {
    invalids.push(document.getElementById('orderProof'));
  }
 
  if (invalids.length) {
    markInvalid(invalids);
    return showAlert('orderAlert', 'Completa todos los campos correctamente', 'error');
  }
 
  const formData = new FormData();
  formData.append('productId', form.dataset.productId);
  formData.append('quantity', fields.quantity.value);
  formData.append('address', fields.address.value.trim());
  formData.append('phone', fields.phone.value.trim());
  formData.append('paymentMethod', fields.paymentMethod.value);
  if (proofFile) formData.append('proof', proofFile);
 
  try {
    const res = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentUser.token}` },
      body: formData
    });
    const data = await res.json();
 
    if (!res.ok) return showAlert('orderAlert', data.message, 'error');
 
    showAlert('orderAlert', '¡Pedido realizado! Puedes ver su estado en "Mis pedidos"', 'success');
    loadCatalog();
    setTimeout(closeProductModal, 1200);
  } catch {
    showAlert('orderAlert', 'No se pudo conectar con el servidor', 'error');
  }
}
 
// ================= FAVORITOS =================
async function loadMyFavorites() {
  try {
    const res = await fetch(`${API}/favorites/my`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    myFavorites = await res.json();
    updateFavCountBadge();
    renderCatalogGrid();
  } catch { myFavorites = []; }
}
 
async function toggleFavorite(productId) {
  try {
    const res = await fetch(`${API}/favorites/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ productId })
    });
    const data = await res.json();
    if (data.favorited) myFavorites.push(productId);
    else myFavorites = myFavorites.filter(id => id !== productId);
    updateFavCountBadge();
    renderCatalogGrid();
    const favTab = document.getElementById('tab-favoritos');
    if (favTab && favTab.classList.contains('active')) renderFavoritesGrid();
  } catch { /* noop */ }
}
 
function updateFavCountBadge() {
  const badge = document.getElementById('favCount');
  if (!badge) return;
  if (myFavorites.length) { badge.textContent = myFavorites.length; badge.style.display = 'flex'; }
  else badge.style.display = 'none';
}
 
function renderFavoritesGrid() {
  const grid = document.getElementById('favoritesGrid');
  const items = catalog.filter(p => myFavorites.includes(p.id));
  if (!items.length) { grid.innerHTML = '<div class="empty-state">Todavía no tienes productos favoritos. Toca el corazón en cualquier producto del catálogo.</div>'; return; }
  grid.innerHTML = items.map(p => renderProductCard(p)).join('');
}
 
// ================= CARRITO =================
function cartKey() { return `cart_${currentUser ? currentUser.id : 'anon'}`; }
function loadCart() { try { cart = JSON.parse(localStorage.getItem(cartKey())) || []; } catch { cart = []; } updateCartBadge(); }
function saveCart() { localStorage.setItem(cartKey(), JSON.stringify(cart)); updateCartBadge(); }
 
function updateCartBadge() {
  const badge = document.getElementById('cartCount');
  if (!badge) return;
  const count = cart.reduce((sum, i) => sum + i.quantity, 0);
  if (count) { badge.textContent = count; badge.style.display = 'flex'; }
  else badge.style.display = 'none';
}
 
function addToCart(productId) {
  const p = catalog.find(x => x.id === productId);
  if (!p) return;
  const qtyInput = document.getElementById('modalQuantity');
  let qty = parseInt(qtyInput?.value) || 1;
  if (qty < 1) qty = 1;
  if (qty > p.stock) qty = p.stock;
 
  const existing = cart.find(i => i.productId === productId);
  if (existing) existing.quantity = Math.min(existing.quantity + qty, p.stock);
  else cart.push({ productId, quantity: qty });
 
  saveCart();
  const alertEl = document.getElementById('orderAlert');
  if (alertEl) showAlert('orderAlert', 'Producto agregado al carrito 🛒', 'success');
}
 
function renderCartTable() {
  const container = document.getElementById('cartTable');
  const checkoutCard = document.getElementById('cartCheckoutCard');
 
  if (!cart.length) {
    container.innerHTML = '<div class="empty-state">Tu carrito está vacío. Agrega productos desde el catálogo.</div>';
    checkoutCard.style.display = 'none';
    return;
  }
 
  let total = 0;
  const rows = cart.map((item, idx) => {
    const p = catalog.find(x => x.id === item.productId);
    if (!p) return '';
    const subtotal = p.price * item.quantity;
    total += subtotal;
    return `
      <tr>
        <td>${p.name}</td>
        <td>$${p.price.toLocaleString('es-CO')}</td>
        <td>
          <div class="qty-controls">
            <button type="button" class="qty-btn" onclick="changeCartQty(${idx}, -1)">−</button>
            <span>${item.quantity}</span>
            <button type="button" class="qty-btn" onclick="changeCartQty(${idx}, 1)">+</button>
          </div>
        </td>
        <td>$${subtotal.toLocaleString('es-CO')}</td>
        <td><button class="btn-sm delete" onclick="removeCartItem(${idx})">Quitar</button></td>
      </tr>
    `;
  }).join('');
 
  container.innerHTML = `<table>
    <thead><tr><th>Producto</th><th>Precio</th><th>Cantidad</th><th>Subtotal</th><th>Acción</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
 
  checkoutCard.style.display = 'block';
  document.getElementById('cartTotal').textContent = `$${total.toLocaleString('es-CO')}`;
}
 
function changeCartQty(idx, delta) {
  const item = cart[idx];
  const p = catalog.find(x => x.id === item.productId);
  let newQty = item.quantity + delta;
  if (newQty < 1) { cart.splice(idx, 1); }
  else { if (p && newQty > p.stock) newQty = p.stock; item.quantity = newQty; }
  saveCart();
  renderCartTable();
}
 
function removeCartItem(idx) { cart.splice(idx, 1); saveCart(); renderCartTable(); }
 
function toggleCartProof() {
  const method = document.getElementById('cartPaymentMethod').value;
  document.getElementById('cartProofField').style.display = method === 'Transferencia / Pago electrónico' ? 'block' : 'none';
}
 
async function handleCartCheckout(e) {
  e.preventDefault();
  if (!cart.length) return;
 
  const fields = {
    address: document.getElementById('cartAddress'),
    phone: document.getElementById('cartPhone'),
    paymentMethod: document.getElementById('cartPaymentMethod')
  };
  clearFieldErrors(Object.values(fields));
 
  const invalids = [];
  if (!fields.address.value.trim()) invalids.push(fields.address);
  if (!/^[0-9+\s-]{7,15}$/.test(fields.phone.value.trim())) invalids.push(fields.phone);
  if (!fields.paymentMethod.value) invalids.push(fields.paymentMethod);
 
  const proofFile = document.getElementById('cartProof').files[0];
  if (fields.paymentMethod.value === 'Transferencia / Pago electrónico' && !proofFile) {
    invalids.push(document.getElementById('cartProof'));
  }
 
  if (invalids.length) {
    markInvalid(invalids);
    return showAlert('cartAlert', 'Completa todos los campos correctamente', 'error');
  }
 
  let successCount = 0;
  for (const item of cart) {
    const formData = new FormData();
    formData.append('productId', item.productId);
    formData.append('quantity', item.quantity);
    formData.append('address', fields.address.value.trim());
    formData.append('phone', fields.phone.value.trim());
    formData.append('paymentMethod', fields.paymentMethod.value);
    if (proofFile) formData.append('proof', proofFile);
 
    try {
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUser.token}` },
        body: formData
      });
      if (res.ok) successCount++;
    } catch { /* continúa */ }
  }
 
  if (successCount === cart.length) {
    showAlert('cartAlert', '¡Todos los pedidos del carrito fueron enviados!', 'success');
    cart = [];
    saveCart();
    document.getElementById('cartCheckoutForm').reset();
  } else if (successCount > 0) {
    showAlert('cartAlert', `Se enviaron ${successCount} de ${cart.length} pedidos. Revisa el stock de los demás.`, 'error');
  } else {
    showAlert('cartAlert', 'No se pudo procesar el carrito', 'error');
  }
 
  loadCatalog();
  renderCartTable();
}
 
// ================= PUNTOS =================
async function loadPoints() {
  try {
    const res = await fetch(`${API}/points/my`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const data = await res.json();
    document.getElementById('pointsBalance').textContent = data.points;
  } catch {
    document.getElementById('pointsBalance').textContent = '—';
  }
}
 
// ================= SEGURIDAD =================
async function loadSecuritySessions() {
  const container = document.getElementById('sessionsTable');
  try {
    const res = await fetch(`${API}/security/sessions`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const sessions = await res.json();
    if (!sessions.length) { container.innerHTML = '<div class="empty-state">Todavía no hay sesiones registradas</div>'; return; }
 
    container.innerHTML = `<table>
      <thead><tr><th>Fecha</th><th>IP</th><th>País</th><th>Ciudad</th><th>Navegador</th><th>Sistema operativo</th></tr></thead>
      <tbody>
        ${sessions.map(s => `
          <tr>
            <td>${new Date(s.createdAt).toLocaleString('es-CO')}</td>
            <td>${s.ip}</td>
            <td>${s.country}</td>
            <td>${s.city}</td>
            <td>${s.browser}</td>
            <td>${s.os}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  } catch {
    container.innerHTML = '<div class="empty-state">Error al cargar las sesiones</div>';
  }
}
 
async function closeAllSessions() {
  if (!confirm('Vas a cerrar todas tus sesiones activas, incluida esta. Tendrás que iniciar sesión de nuevo. ¿Continuar?')) return;
  try {
    await fetch(`${API}/security/close-all-sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentUser.token}` }
    });
  } catch { /* noop */ }
  forceLogout();
}
 
// ================= REGISTRAR VENTA =================
function prepareSaleForm() {
  const productSelect = document.getElementById('saleProduct');
  productSelect.innerHTML = '<option value="">-- Seleccionar producto --</option>' +
    catalog.map(p => `<option value="${p.id}" data-price="${p.price}" data-stock="${p.stock}">${p.name} (stock: ${p.stock})</option>`).join('');
  document.getElementById('saleDate').value = new Date().toISOString().split('T')[0];
  clearOrderSource();
}
 
// El tope de cantidad SIEMPRE es el stock real del producto elegido — nunca se puede
// vender más de lo que hay, así no hace falta esperar al error del servidor para saberlo.
function updateSalePrice() {
  const select = document.getElementById('saleProduct');
  const qtyEl = document.getElementById('saleQuantity');
  const selected = select.options[select.selectedIndex];
  const stock = selected ? parseInt(selected.dataset.stock) || 0 : 0;
 
  qtyEl.max = stock > 0 ? stock : 1;
  if (parseInt(qtyEl.value) > stock) qtyEl.value = stock > 0 ? stock : 1;
}
 
function togglePaymentProof() {
  const method = document.getElementById('salePaymentMethod').value;
  document.getElementById('proofField').style.display = method === 'Electrónico' ? 'block' : 'none';
}
 
// ---- "Tus pedidos": registrar la venta de un pedido ya entregado, sin volver a tocar el stock ----
async function openMyDeliveredOrders() {
  document.getElementById('myOrdersModal').classList.add('active');
  const list = document.getElementById('myDeliverableList');
  list.innerHTML = '<div class="empty-state">Cargando...</div>';
  try {
    const res = await fetch(`${API}/orders/my-deliverable`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const orders = await res.json();
    if (!orders.length) { list.innerHTML = '<div class="empty-state">No tienes pedidos entregados pendientes de registrar. Primero debes "Tomar" un pedido en "Pedidos de clientes" y marcarlo como Entregado.</div>'; return; }
 
    list.innerHTML = orders.map(o => `
      <div class="deliverable-item" onclick="selectDeliverableOrder(${o.id})">
        <div class="info">
          <strong>${o.productName}</strong> × ${o.quantity}
          <small>${o.clienteName} · $${o.total.toLocaleString('es-CO')} · ${new Date(o.createdAt).toLocaleDateString('es-CO')}</small>
        </div>
        <span class="claim-badge">Pedido #${o.id}</span>
      </div>
    `).join('');
  } catch {
    list.innerHTML = '<div class="empty-state">Error al cargar tus pedidos</div>';
  }
}
 
function closeMyDeliveredOrders() { document.getElementById('myOrdersModal').classList.remove('active'); }
 
async function selectDeliverableOrder(orderId) {
  try {
    const res = await fetch(`${API}/orders/my-deliverable`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const orders = await res.json();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
 
    prepareSaleFormFieldsForOrder(order);
    closeMyDeliveredOrders();
  } catch { /* noop */ }
}
 
function prepareSaleFormFieldsForOrder(order) {
  document.getElementById('saleOrderId').value = order.id;
  document.getElementById('fromOrderId').textContent = order.id;
  document.getElementById('fromOrderBanner').style.display = 'flex';
 
  const productSelect = document.getElementById('saleProduct');
  productSelect.value = order.productId;
  productSelect.disabled = true;
 
  const qtyEl = document.getElementById('saleQuantity');
  qtyEl.value = order.quantity;
  qtyEl.disabled = true;
 
  document.getElementById('saleVendedor').value = currentUser.name;
  document.getElementById('saleDate').value = new Date().toISOString().split('T')[0];
 
  const paymentSelect = document.getElementById('salePaymentMethod');
  paymentSelect.value = order.paymentMethod.startsWith('Efectivo') ? 'Efectivo' : 'Electrónico';
  paymentSelect.disabled = true;
  document.getElementById('proofField').style.display = 'none';
}
 
function clearOrderSource() {
  document.getElementById('saleOrderId').value = '';
  document.getElementById('fromOrderBanner').style.display = 'none';
  document.getElementById('saleProduct').disabled = false;
  document.getElementById('saleQuantity').disabled = false;
  document.getElementById('salePaymentMethod').disabled = false;
}
 
async function handleSaleSubmit(e) {
  e.preventDefault();
 
  const orderId = document.getElementById('saleOrderId').value;
 
  const fields = {
    vendedor: document.getElementById('saleVendedor'),
    saleDate: document.getElementById('saleDate')
  };
  if (!orderId) {
    fields.productId = document.getElementById('saleProduct');
    fields.quantity = document.getElementById('saleQuantity');
    fields.paymentMethod = document.getElementById('salePaymentMethod');
  }
 
  clearFieldErrors(Object.values(fields));
 
  const invalids = Object.values(fields).filter(el => !el.value.trim());
  const proofFile = document.getElementById('saleProof').files[0];
 
  if (!orderId && fields.paymentMethod.value === 'Electrónico' && !proofFile) {
    invalids.push(document.getElementById('saleProof'));
  }
 
  if (invalids.length) {
    markInvalid(invalids);
    return showAlert('saleAlert', 'Completa todos los campos obligatorios', 'error');
  }
 
  const formData = new FormData();
  if (orderId) {
    formData.append('orderId', orderId);
  } else {
    formData.append('productId', fields.productId.value);
    formData.append('quantity', fields.quantity.value);
    formData.append('paymentMethod', fields.paymentMethod.value);
    if (proofFile) formData.append('proof', proofFile);
  }
  formData.append('vendedor', fields.vendedor.value.trim());
  formData.append('saleDate', fields.saleDate.value);
 
  try {
    const res = await fetch(`${API}/sales/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentUser.token}` },
      body: formData
    });
    const data = await res.json();
 
    if (!res.ok) return showAlert('saleAlert', data.message, 'error');
 
    let msg = 'Venta registrada correctamente';
    if (typeof data.remainingStock === 'number' && data.remainingStock <= settings.lowStockThreshold) {
      msg += ` — ⚠️ quedan solo ${data.remainingStock} unidades de este producto`;
    }
    showAlert('saleAlert', msg, 'success');
    document.getElementById('saleForm').reset();
    prepareSaleForm();
    document.getElementById('proofField').style.display = 'none';
    loadCatalog();
  } catch {
    showAlert('saleAlert', 'No se pudo conectar con el servidor', 'error');
  }
}
 
// ================= MIS VENTAS / TODAS LAS VENTAS =================
async function loadMySales() {
  const container = document.getElementById('mySalesTable');
  try {
    const res = await fetch(`${API}/sales/my-sales`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const mode = currentUser.role === 'owner' ? 'owner' : 'admin';
    container.innerHTML = renderSalesTable(await res.json(), mode);
  } catch {
    container.innerHTML = '<div class="empty-state">Error al cargar tus ventas</div>';
  }
}
 
async function loadAllSales() {
  const container = document.getElementById('allSalesTable');
  try {
    const res = await fetch(`${API}/sales/all`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    container.innerHTML = renderSalesTable(await res.json(), currentUser.role === 'owner' ? 'owner' : 'none');
  } catch {
    container.innerHTML = '<div class="empty-state">Error al cargar las ventas</div>';
  }
}
 
function renderSalesTable(sales, mode) {
  if (!sales.length) return '<div class="empty-state">No hay ventas registradas todavía</div>';
  const showAction = mode === 'owner' || mode === 'admin';
 
  return `<table>
    <thead><tr>
      <th>Vendedor</th><th>Producto</th><th>Cant.</th><th>Total</th><th>Método</th><th>Comprobante</th><th>Origen</th><th>Fecha</th><th>Factura</th>${showAction ? '<th>Acción</th>' : ''}
    </tr></thead>
    <tbody>
      ${sales.map(s => `
        <tr>
          <td>${s.vendedor}</td>
          <td>${s.productName || s.product || '—'}</td>
          <td>${s.quantity || 1}</td>
          <td>$${(s.price || 0).toLocaleString('es-CO')}</td>
          <td><span class="badge ${s.paymentMethod === 'Efectivo' ? 'efectivo' : 'electronico'}">${s.paymentMethod}</span></td>
          <td>${s.proofPath ? `<a class="proof-link" href="${s.proofPath}" target="_blank">Ver</a>` : '—'}</td>
          <td>${s.orderId ? `<span class="claim-badge">Pedido #${s.orderId}</span>` : 'Manual'}</td>
          <td>${new Date(s.saleDate).toLocaleDateString('es-CO')}</td>
          <td><a class="proof-link" href="${API}/sales/${s.id}/invoice" target="_blank">📄 PDF</a></td>
          ${mode === 'owner' ? `<td><button class="btn-sm delete" onclick="deleteSale(${s.id})">Eliminar</button></td>` : ''}
          ${mode === 'admin' ? `<td><button class="btn-sm delete" onclick="requestDeleteSale(${s.id}, '${(s.productName || '').replace(/'/g, "\\'")}')">Solicitar eliminación</button></td>` : ''}
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}
 
async function deleteSale(id) {
  if (!confirm('¿Eliminar esta venta? El stock se restaurará.')) return;
  try {
    const res = await fetch(`${API}/sales/delete/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${currentUser.token}` } });
    if (res.ok) { loadAllSales(); loadCatalog(); }
  } catch { /* noop */ }
}
 
async function requestDeleteSale(id, label) {
  if (!confirm(`¿Solicitar al propietario la eliminación de la venta "${label}"?`)) return;
  try {
    const res = await fetch(`${API}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ action: 'delete', targetType: 'sale', targetId: id, targetLabel: label })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message);
    alert('Solicitud enviada. El propietario debe aprobarla.');
    loadMySales();
  } catch {
    alert('No se pudo conectar con el servidor');
  }
}
 
// ================= MIS PEDIDOS / PEDIDOS DE CLIENTES =================
async function loadMyOrders() {
  const container = document.getElementById('myOrdersTable');
  try {
    const res = await fetch(`${API}/orders/my-orders`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    container.innerHTML = renderOrdersTable(await res.json(), false);
  } catch {
    container.innerHTML = '<div class="empty-state">Error al cargar tus pedidos</div>';
  }
}
 
async function loadAllOrders() {
  const container = document.getElementById('ordersTable');
  try {
    const res = await fetch(`${API}/orders/all`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    container.innerHTML = renderOrdersTable(await res.json(), true);
  } catch {
    container.innerHTML = '<div class="empty-state">Error al cargar los pedidos</div>';
  }
}
 
function renderOrdersTable(orders, isManager) {
  if (!orders.length) return '<div class="empty-state">No hay pedidos todavía</div>';
 
  return `<table>
    <thead><tr>
      <th>Cliente</th><th>Producto</th><th>Cant.</th><th>Total</th>
      <th>Dirección</th><th>Teléfono</th><th>Pago</th><th>Comprobante</th><th>Fecha</th><th>Factura</th><th>Estado</th>${isManager ? '<th>Responsable</th><th>Acción</th>' : ''}
    </tr></thead>
    <tbody>
      ${orders.map(o => `
        <tr>
          <td>${o.clienteName}</td>
          <td>${o.productName || o.product || '—'}</td>
          <td>${o.quantity}</td>
          <td>$${o.total.toLocaleString('es-CO')}</td>
          <td>${o.address}</td>
          <td>${o.phone}</td>
          <td><span class="badge ${o.paymentMethod.startsWith('Efectivo') ? 'efectivo' : 'electronico'}">${o.paymentMethod}</span></td>
          <td>${o.proofPath ? `<a class="proof-link" href="${o.proofPath}" target="_blank">Ver</a>` : '—'}</td>
          <td>${new Date(o.createdAt).toLocaleDateString('es-CO')}</td>
          <td><a class="proof-link" href="${API}/orders/${o.id}/invoice" target="_blank">📄 PDF</a></td>
          <td>${renderStatusCell(o, isManager)}</td>
          ${isManager ? `<td>${renderClaimCell(o)}</td><td>${currentUser.role === 'owner' ? `<button class="btn-sm delete" onclick="deleteOrder(${o.id})">Eliminar</button>` : '—'}</td>` : ''}
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}
 
// Nadie más puede tomar un pedido que ya está tomado (solo el propietario puede liberarlo).
function renderClaimCell(order) {
  if (!order.takenBy) {
    return `<button class="btn-sm promote" onclick="claimOrder(${order.id})">Tomar pedido</button>`;
  }
  if (order.takenBy === currentUser.id) {
    return `<span class="claim-badge">Lo tomaste tú</span>`;
  }
  if (currentUser.role === 'owner') {
    return `<span class="claim-badge">${order.takenByName}</span> <button class="btn-sm delete" onclick="releaseOrder(${order.id})">Liberar</button>`;
  }
  return `<span class="claim-badge">${order.takenByName}</span>`;
}
 
async function claimOrder(orderId) {
  try {
    const res = await fetch(`${API}/orders/${orderId}/claim`, { method: 'POST', headers: { Authorization: `Bearer ${currentUser.token}` } });
    const data = await res.json();
    if (!res.ok) { alert(data.message); }
    loadAllOrders();
  } catch { /* noop */ }
}
 
async function releaseOrder(orderId) {
  if (!confirm('¿Liberar este pedido? Cualquier admin podrá tomarlo de nuevo.')) return;
  try {
    await fetch(`${API}/orders/${orderId}/release`, { method: 'POST', headers: { Authorization: `Bearer ${currentUser.token}` } });
    loadAllOrders();
  } catch { /* noop */ }
}
 
function renderStatusCell(order, isManager) {
  if (isManager) return renderStatusSelect(order);
  if (order.status === 'Entregado' || order.status === 'Cancelado') {
    const cls = order.status === 'Entregado' ? 'stamp-entregado' : 'stamp-cancelado';
    return `<div class="status-stamp ${cls}">${order.status}</div>`;
  }
  return `<span class="status-badge ${STATUS_CLASS[order.status]}">${order.status}</span>`;
}
 
function renderStatusSelect(order) {
  const stampClass = (order.status === 'Entregado' || order.status === 'Cancelado') ? 'select-stamp' : '';
  return `<select class="status-select ${STATUS_CLASS[order.status]} ${stampClass}" onchange="updateOrderStatus(${order.id}, this.value)">
    ${ORDER_STATUSES.map(s => `<option value="${s}" ${s === order.status ? 'selected' : ''}>${s}</option>`).join('')}
  </select>`;
}
 
async function updateOrderStatus(orderId, status) {
  try {
    const res = await fetch(`${API}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message); loadAllOrders(); return; }
 
    loadAllOrders();
    loadCatalog();
  } catch { /* noop */ }
}
 
async function deleteOrder(orderId) {
  if (!confirm('¿Eliminar este pedido?')) return;
  try {
    const res = await fetch(`${API}/orders/${orderId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${currentUser.token}` } });
    if (res.ok) { loadAllOrders(); loadCatalog(); }
  } catch { /* noop */ }
}
 
// ================= GESTIÓN DE PRODUCTOS =================
async function loadProductManagement() {
  await loadCatalog();
  renderCategoryOptions();
  renderCategoryList();
  renderAdminProductGrid();
  loadTrash();
}
 
function renderCategoryOptions() {
  const select = document.getElementById('productCategory');
  select.innerHTML = '<option value="">-- Seleccionar categoría --</option>' +
    categories.map(c => `<option value="${c.id}">${c.icon || ''} ${c.name}</option>`).join('');
}
 
function renderCategoryList() {
  const list = document.getElementById('categoryList');
  if (!categories.length) { list.innerHTML = ''; return; }
 
  list.innerHTML = categories.map(c => {
    const count = catalog.filter(p => p.categoryId === c.id).length;
    let actionBtn = '';
    if (currentUser.role === 'owner') {
      actionBtn = `<button class="btn-sm delete" onclick="deleteCategory(${c.id})">Eliminar</button>`;
    } else if (currentUser.role === 'admin') {
      actionBtn = `<button class="btn-sm demote" onclick="requestDeleteCategory(${c.id}, '${c.name.replace(/'/g, "\\'")}')">Solicitar eliminación</button>`;
    }
    return `<div class="category-row">
      <span>${c.icon || '🛍️'} ${c.name} <span class="category-count">(${count})</span></span>
      ${actionBtn}
    </div>`;
  }).join('');
}
 
async function requestDeleteCategory(id, name) {
  if (!confirm(`¿Solicitar al propietario la eliminación de la categoría "${name}"?`)) return;
  try {
    const res = await fetch(`${API}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ action: 'delete', targetType: 'category', targetId: id, targetLabel: name })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message);
    alert('Solicitud enviada. El propietario debe aprobarla.');
  } catch {
    alert('No se pudo conectar con el servidor');
  }
}
 
function renderAdminProductGrid() {
  const grid = document.getElementById('adminProductGrid');
  if (!grid) return;
  if (!catalog.length) { grid.innerHTML = '<div class="empty-state">No has agregado productos todavía</div>'; return; }
 
  grid.innerHTML = catalog.map(p => {
    const imgHtml = p.image ? `<img src="${p.image}" class="product-img" alt="${p.name}">` : `<div class="product-img product-img-placeholder">💨</div>`;
    const isLow = p.stock > 0 && p.stock <= settings.lowStockThreshold;
    const isOwner = currentUser.role === 'owner';
    const actions = isOwner
      ? `<button class="btn-sm promote" onclick="openEditProductModal(${p.id})">Editar</button>
         <button class="btn-sm delete" onclick="deleteProduct(${p.id})">Eliminar</button>`
      : `<button class="btn-sm promote" onclick="openEditProductModal(${p.id})">Solicitar edición</button>
         <button class="btn-sm delete" onclick="requestDeleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')">Solicitar eliminación</button>`;
    return `
      <div class="product-card admin-card">
        ${imgHtml}
        <div class="product-body">
          <h3>${p.name}</h3>
          <p class="product-desc-short">${p.categoryName}</p>
          <div class="product-footer">
            <span class="price">$${p.price.toLocaleString('es-CO')}</span>
            <span class="stock-tag ${p.stock <= 0 ? 'out' : (isLow ? 'low' : 'ok')}">Stock: ${p.stock}</span>
          </div>
          <div class="admin-card-actions">${actions}</div>
        </div>
      </div>
    `;
  }).join('');
}
 
async function requestDeleteProduct(id, name) {
  if (!confirm(`¿Solicitar al propietario la eliminación de "${name}"?`)) return;
  try {
    const res = await fetch(`${API}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ action: 'delete', targetType: 'product', targetId: id, targetLabel: name })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message);
    alert('Solicitud enviada. El propietario debe aprobarla.');
  } catch {
    alert('No se pudo conectar con el servidor');
  }
}
 
async function handleCategorySubmit(e) {
  e.preventDefault();
  const nameEl = document.getElementById('categoryName');
  const iconEl = document.getElementById('categoryIcon');
 
  clearFieldErrors([nameEl]);
  if (!nameEl.value.trim()) {
    markInvalid([nameEl]);
    return showAlert('categoryAlert', 'El nombre de la categoría es obligatorio', 'error');
  }
 
  try {
    const res = await fetch(`${API}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ name: nameEl.value.trim(), icon: iconEl.value.trim() })
    });
    const data = await res.json();
    if (!res.ok) return showAlert('categoryAlert', data.message, 'error');
 
    showAlert('categoryAlert', 'Categoría creada', 'success');
    document.getElementById('categoryForm').reset();
    await loadCatalog();
    renderCategoryOptions();
    renderCategoryList();
  } catch {
    showAlert('categoryAlert', 'No se pudo conectar con el servidor', 'error');
  }
}
 
async function deleteCategory(id) {
  if (!confirm('¿Eliminar esta categoría?')) return;
  try {
    const res = await fetch(`${API}/categories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${currentUser.token}` } });
    const data = await res.json();
    if (!res.ok) return alert(data.message);
    await loadCatalog();
    renderCategoryOptions();
    renderCategoryList();
  } catch { /* noop */ }
}
 
async function handleProductSubmit(e) {
  e.preventDefault();
 
  const fields = {
    categoryId: document.getElementById('productCategory'),
    name: document.getElementById('productName'),
    description: document.getElementById('productDescription'),
    price: document.getElementById('productPrice'),
    stock: document.getElementById('productStock')
  };
 
  clearFieldErrors(Object.values(fields));
 
  const invalids = [];
  if (!fields.categoryId.value) invalids.push(fields.categoryId);
  if (!fields.name.value.trim()) invalids.push(fields.name);
  if (!fields.description.value.trim()) invalids.push(fields.description);
  if (!fields.price.value || parseFloat(fields.price.value) <= 0) invalids.push(fields.price);
  if (fields.stock.value === '' || parseInt(fields.stock.value) < 0) invalids.push(fields.stock);
 
  if (invalids.length) {
    markInvalid(invalids);
    return showAlert('productAlert', 'Completa todos los campos correctamente', 'error');
  }
 
  const formData = new FormData();
  formData.append('categoryId', fields.categoryId.value);
  formData.append('name', fields.name.value.trim());
  formData.append('description', fields.description.value.trim());
  formData.append('price', fields.price.value);
  formData.append('stock', fields.stock.value);
  const imgFile = document.getElementById('productImage').files[0];
  if (imgFile) formData.append('image', imgFile);
 
  try {
    const res = await fetch(`${API}/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentUser.token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) return showAlert('productAlert', data.message, 'error');
 
    showAlert('productAlert', 'Producto agregado correctamente', 'success');
    document.getElementById('productForm').reset();
    await loadCatalog();
    renderAdminProductGrid();
  } catch {
    showAlert('productAlert', 'No se pudo conectar con el servidor', 'error');
  }
}
 
function openEditProductModal(id) {
  const p = catalog.find(x => x.id === id);
  if (!p) return;
  const isOwner = currentUser.role === 'owner';
 
  document.getElementById('editProductContent').innerHTML = `
    <h2>${isOwner ? 'Editar producto' : 'Solicitar edición de producto'}</h2>
    ${!isOwner ? '<p class="modal-meta">Estos cambios solo se aplicarán si el propietario los aprueba. La imagen no se puede cambiar por esta vía.</p>' : ''}
    <div id="editProductAlert" class="alert"></div>
    <form id="editProductForm" class="order-form" data-id="${p.id}">
      <div class="field">
        <label>Nombre</label>
        <input type="text" id="editName" value="${p.name.replace(/"/g, '&quot;')}">
      </div>
      <div class="field">
        <label>Descripción</label>
        <textarea id="editDescription" rows="3">${p.description}</textarea>
      </div>
      <div class="field">
        <label>Precio</label>
        <input type="number" id="editPrice" min="1" value="${p.price}">
      </div>
      <div class="field">
        <label>Stock</label>
        <input type="number" id="editStock" min="0" value="${p.stock}">
      </div>
      ${isOwner ? `
      <div class="field">
        <label>Nueva imagen (opcional)</label>
        <input type="file" id="editImage" accept="image/*">
      </div>` : ''}
      <button type="submit" class="btn-neon full">${isOwner ? 'Guardar cambios' : 'Enviar solicitud'}</button>
    </form>
    ${isOwner ? `<div id="priceHistoryBlock" class="history-block"></div>` : ''}
  `;
 
  document.getElementById('editProductModal').classList.add('active');
  document.getElementById('editProductForm').addEventListener('submit', isOwner ? handleEditProductSubmit : handleRequestEditProductSubmit);
  if (isOwner) loadPriceHistoryForProduct(p.id);
}
 
async function loadPriceHistoryForProduct(productId) {
  const block = document.getElementById('priceHistoryBlock');
  try {
    const res = await fetch(`${API}/products/${productId}/price-history`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const history = await res.json();
    if (!history.length) { block.innerHTML = '<p class="card-title" style="margin-top:18px;">📈 Sin cambios de precio registrados</p>'; return; }
 
    block.innerHTML = `
      <p class="card-title" style="margin-top:18px;">📈 Historial de precios</p>
      ${history.map(h => `
        <div class="history-row">
          <span>$${h.oldPrice.toLocaleString('es-CO')} → $${h.newPrice.toLocaleString('es-CO')}</span>
          <span class="category-count">${h.changedByName} · ${new Date(h.changedAt).toLocaleString('es-CO')}</span>
        </div>
      `).join('')}
    `;
  } catch { block.innerHTML = ''; }
}
 
function closeEditProductModal() { document.getElementById('editProductModal').classList.remove('active'); }
 
async function handleEditProductSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const id = form.dataset.id;
 
  const formData = new FormData();
  formData.append('name', document.getElementById('editName').value.trim());
  formData.append('description', document.getElementById('editDescription').value.trim());
  formData.append('price', document.getElementById('editPrice').value);
  formData.append('stock', document.getElementById('editStock').value);
  const imgFile = document.getElementById('editImage').files[0];
  if (imgFile) formData.append('image', imgFile);
 
  try {
    const res = await fetch(`${API}/products/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${currentUser.token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) return showAlert('editProductAlert', data.message, 'error');
 
    await loadCatalog();
    renderAdminProductGrid();
    closeEditProductModal();
  } catch {
    showAlert('editProductAlert', 'No se pudo conectar con el servidor', 'error');
  }
}
 
async function handleRequestEditProductSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const id = form.dataset.id;
  const p = catalog.find(x => x.id === parseInt(id));
 
  const payload = {
    name: document.getElementById('editName').value.trim(),
    description: document.getElementById('editDescription').value.trim(),
    price: document.getElementById('editPrice').value,
    stock: document.getElementById('editStock').value
  };
 
  try {
    const res = await fetch(`${API}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ action: 'edit', targetType: 'product', targetId: id, targetLabel: p ? p.name : `#${id}`, payload })
    });
    const data = await res.json();
    if (!res.ok) return showAlert('editProductAlert', data.message, 'error');
 
    showAlert('editProductAlert', 'Solicitud enviada al propietario', 'success');
    setTimeout(closeEditProductModal, 1200);
  } catch {
    showAlert('editProductAlert', 'No se pudo conectar con el servidor', 'error');
  }
}
 
async function deleteProduct(id) {
  if (!confirm('¿Eliminar este producto? Podrás restaurarlo desde la papelera.')) return;
  try {
    const res = await fetch(`${API}/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${currentUser.token}` } });
    if (res.ok) { await loadCatalog(); renderAdminProductGrid(); loadTrash(); }
  } catch { /* noop */ }
}
 
// ---- Papelera ----
async function loadTrash() {
  const container = document.getElementById('trashTable');
  if (!container) return;
  try {
    const res = await fetch(`${API}/products/trash`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const trash = await res.json();
    if (!trash.length) { container.innerHTML = '<div class="empty-state">La papelera está vacía</div>'; return; }
 
    container.innerHTML = `<table>
      <thead><tr><th>Producto</th><th>Precio</th><th>Eliminado por</th><th>Fecha</th>${currentUser.role === 'owner' ? '<th>Acción</th>' : ''}</tr></thead>
      <tbody>
        ${trash.map(t => `
          <tr>
            <td>${t.snapshot.name}</td>
            <td>$${t.snapshot.price.toLocaleString('es-CO')}</td>
            <td>${t.deletedByName}</td>
            <td>${new Date(t.deletedAt).toLocaleString('es-CO')}</td>
            ${currentUser.role === 'owner' ? `<td><button class="btn-sm promote" onclick="restoreFromTrash(${t.id})">Restaurar</button></td>` : ''}
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  } catch {
    container.innerHTML = '<div class="empty-state">Error al cargar la papelera</div>';
  }
}
 
async function restoreFromTrash(id) {
  if (!confirm('¿Restaurar este producto?')) return;
  try {
    const res = await fetch(`${API}/products/trash/${id}/restore`, { method: 'POST', headers: { Authorization: `Bearer ${currentUser.token}` } });
    if (res.ok) { await loadCatalog(); renderAdminProductGrid(); loadTrash(); }
  } catch { /* noop */ }
}
 
// ================= USUARIOS =================
async function loadUsers() {
  const container = document.getElementById('usersTable');
  try {
    const res = await fetch(`${API}/users/all`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const users = await res.json();
    allUsers = users;
    populateAuditEmailFilter();
 
    if (!users.length) { container.innerHTML = '<div class="empty-state">No hay usuarios</div>'; return; }
 
    container.innerHTML = `<table>
      <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Acción</th></tr></thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td><span class="role-badge ${u.role}">${{ cliente: 'Cliente', admin: 'Admin', owner: 'Propietario' }[u.role]}</span></td>
            <td>${renderUserAction(u)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  } catch {
    container.innerHTML = '<div class="empty-state">Error al cargar usuarios</div>';
  }
}
 
function renderUserAction(u) {
  if (u.role === 'owner') return '<span class="category-count">Protegido — nadie puede modificarlo desde aquí</span>';
  const roleBtn = u.role === 'admin'
    ? `<button class="btn-sm demote" onclick="demoteUser(${u.id})">Quitar admin</button>`
    : `<button class="btn-sm promote" onclick="promoteUser(${u.id})">Hacer admin</button>`;
  const deleteBtn = `<button class="btn-sm delete" onclick="deleteUser(${u.id}, '${u.name.replace(/'/g, "\\'")}')">Eliminar</button>`;
  return `<div class="action-group">${roleBtn}${deleteBtn}</div>`;
}
 
// Si un usuario tiene role "owner" (por ejemplo porque alguien lo editó a mano en users.json),
// el servidor bloquea cualquier intento de modificarlo desde aquí — es una protección a propósito.
// Antes esto fallaba en silencio; ahora se avisa con claridad.
async function promoteUser(userId) {
  try {
    const res = await fetch(`${API}/users/promote-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ userId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.message || 'No se pudo cambiar el rol'); return; }
    loadUsers();
  } catch {
    alert('No se pudo conectar con el servidor');
  }
}
 
async function demoteUser(userId) {
  try {
    const res = await fetch(`${API}/users/demote-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ userId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.message || 'No se pudo cambiar el rol'); return; }
    loadUsers();
  } catch {
    alert('No se pudo conectar con el servidor');
  }
}
 
async function deleteUser(userId, name) {
  if (!confirm(`¿Eliminar la cuenta de ${name}? Esta acción no se puede deshacer.`)) return;
  try {
    const res = await fetch(`${API}/users/${userId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${currentUser.token}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.message || `No se pudo eliminar (código ${res.status})`); return; }
    loadUsers();
  } catch {
    alert('No se pudo conectar con el servidor para eliminar la cuenta');
  }
}
 
// ================= SOLICITUDES PENDIENTES =================
const REQUEST_TYPE_LABEL = { category: 'Categoría', product: 'Producto', sale: 'Venta' };
const REQUEST_STATUS_LABEL = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' };
const REQUEST_STATUS_CLASS = { pendiente: 'electronico', aprobada: 'efectivo', rechazada: 'rechazada' };
 
async function loadRequests() {
  const container = document.getElementById('requestsTable');
  if (!container) return;
  try {
    const res = await fetch(`${API}/requests`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const requests = await res.json();
    container.innerHTML = renderRequestsTable(requests);
  } catch {
    container.innerHTML = '<div class="empty-state">Error al cargar las solicitudes</div>';
  }
}
 
function renderRequestsTable(requests) {
  if (!requests.length) return '<div class="empty-state">No hay solicitudes todavía</div>';
 
  return `<table>
    <thead><tr>
      <th>Solicitó</th><th>Acción</th><th>Elemento</th><th>Estado</th><th>Fecha</th><th>Resuelta por</th><th>Decisión</th><th></th>
    </tr></thead>
    <tbody>
      ${requests.map(r => `
        <tr>
          <td>${r.requestedByName}</td>
          <td>${r.action === 'delete' ? 'Eliminar' : 'Modificar'}</td>
          <td>${REQUEST_TYPE_LABEL[r.targetType] || r.targetType}: ${r.targetLabel}</td>
          <td><span class="badge ${REQUEST_STATUS_CLASS[r.status]}">${REQUEST_STATUS_LABEL[r.status]}</span></td>
          <td>${new Date(r.createdAt).toLocaleString('es-CO')}</td>
          <td>${r.resolvedByName || '—'}</td>
          <td>${r.status === 'pendiente' ? `
            <div class="action-group">
              <button class="btn-sm promote" onclick="resolveRequest(${r.id}, 'approve')">Permitir</button>
              <button class="btn-sm delete" onclick="resolveRequest(${r.id}, 'deny')">Rechazar</button>
            </div>` : '—'}</td>
          <td><button class="btn-sm delete" onclick="deleteRequestEntry(${r.id})">🗑️</button></td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}
 
async function deleteRequestEntry(id) {
  if (!confirm('¿Quitar esta solicitud del historial?')) return;
  try {
    await fetch(`${API}/requests/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${currentUser.token}` } });
    loadRequests();
  } catch { /* noop */ }
}
 
async function resolveRequest(id, decision) {
  const confirmMsg = decision === 'approve'
    ? '¿Permitir esta solicitud? La acción se ejecutará de inmediato.'
    : '¿Rechazar esta solicitud?';
  if (!confirm(confirmMsg)) return;
 
  try {
    const res = await fetch(`${API}/requests/${id}/${decision === 'approve' ? 'approve' : 'deny'}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentUser.token}` }
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message); return; }
 
    loadRequests();
    loadAudit();
    loadCatalog();
    if (document.getElementById('tab-productos').classList.contains('active')) loadProductManagement();
  } catch {
    alert('No se pudo conectar con el servidor');
  }
}
 
// ================= SOPORTE (formulario de una vía) =================
async function openSupportModal() {
  document.getElementById('supportModal').classList.add('active');
  if (currentUser) document.getElementById('supportContact').value = currentUser.email;
}
function closeSupportModal() { document.getElementById('supportModal').classList.remove('active'); }
 
async function handleSupportSubmit(e) {
  e.preventDefault();
  const msgEl = document.getElementById('supportMessage');
  clearFieldErrors([msgEl]);
 
  if (!msgEl.value.trim()) {
    markInvalid([msgEl]);
    return showAlert('supportAlert', 'Escribe un mensaje antes de enviar', 'error');
  }
 
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (currentUser) headers.Authorization = `Bearer ${currentUser.token}`;
 
    const res = await fetch(`${API}/support`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: msgEl.value.trim(), contact: document.getElementById('supportContact').value.trim() })
    });
    const data = await res.json();
    if (!res.ok) return showAlert('supportAlert', data.message, 'error');
 
    showAlert('supportAlert', 'Gracias, tu mensaje fue enviado', 'success');
    document.getElementById('supportForm').reset();
    setTimeout(closeSupportModal, 1200);
  } catch {
    showAlert('supportAlert', 'No se pudo conectar con el servidor', 'error');
  }
}
 
async function loadSupportList() {
  const container = document.getElementById('supportTable');
  if (!container) return;
  try {
    const res = await fetch(`${API}/support`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const entries = await res.json();
    if (!entries.length) { container.innerHTML = '<div class="empty-state">No hay mensajes de soporte todavía</div>'; return; }
 
    container.innerHTML = `<table>
      <thead><tr><th>De</th><th>Mensaje</th><th>Contacto</th><th>Fecha</th><th></th></tr></thead>
      <tbody>
        ${entries.map(s => `
          <tr>
            <td>${s.fromName}${s.fromEmail ? `<br><span class="category-count">${s.fromEmail}</span>` : ''}</td>
            <td>${s.message}</td>
            <td>${s.contact || '—'}</td>
            <td>${new Date(s.createdAt).toLocaleString('es-CO')}</td>
            <td><button class="btn-sm delete" onclick="deleteSupportEntry(${s.id})">🗑️</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  } catch {
    container.innerHTML = '<div class="empty-state">Error al cargar el soporte</div>';
  }
}
 
async function deleteSupportEntry(id) {
  if (!confirm('¿Eliminar este mensaje de soporte?')) return;
  try {
    await fetch(`${API}/support/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${currentUser.token}` } });
    loadSupportList();
  } catch { /* noop */ }
}
 
// ================= CHAT (actualiza cada 3s mientras está abierto) =================
function openChatPanel() {
  document.getElementById('chatPanel').classList.add('open');
  document.getElementById('chatConversations').style.display = (currentUser && currentUser.role !== 'cliente') ? 'block' : 'none';
 
  if (currentUser && currentUser.role === 'cliente') {
    currentChatConversationUserId = currentUser.id;
    document.getElementById('chatPanelTitle').textContent = '💬 Chat con la tienda';
    loadChatMessages();
  } else if (currentUser) {
    document.getElementById('chatPanelTitle').textContent = '💬 Chat con clientes';
    loadChatConversations();
  }
  startChatPolling();
}
 
function closeChatPanel() {
  document.getElementById('chatPanel').classList.remove('open');
  stopChatPolling();
}
 
function startChatPolling() {
  stopChatPolling();
  chatPollTimer = setInterval(() => {
    if (currentUser && currentUser.role === 'cliente') loadChatMessages();
    else if (currentUser && currentChatConversationUserId) loadChatMessages();
    else if (currentUser) loadChatConversations();
  }, 3000);
}
 
function stopChatPolling() { if (chatPollTimer) { clearInterval(chatPollTimer); chatPollTimer = null; } }
 
async function loadChatConversations() {
  const container = document.getElementById('chatConversations');
  try {
    const res = await fetch(`${API}/chat/conversations`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const list = await res.json();
    if (!list.length) { container.innerHTML = '<div class="empty-state">Sin conversaciones todavía</div>'; return; }
 
    container.innerHTML = list.map(c => `
      <div class="chat-conv-item ${currentChatConversationUserId === c.userId ? 'active' : ''}" onclick="openConversation(${c.userId}, '${c.userName.replace(/'/g, "\\'")}')">
        <span>${c.userName}</span>
        ${c.unread ? `<span class="icon-badge" style="position:static;">${c.unread}</span>` : ''}
      </div>
    `).join('');
  } catch { container.innerHTML = '<div class="empty-state">Error al cargar</div>'; }
}
 
function openConversation(userId, userName) {
  currentChatConversationUserId = userId;
  document.getElementById('chatPanelTitle').textContent = `💬 ${userName}`;
  loadChatMessages();
}
 
async function loadChatMessages() {
  if (!currentChatConversationUserId) return;
  const container = document.getElementById('chatMessages');
  try {
    const url = (currentUser.role === 'cliente')
      ? `${API}/chat/my`
      : `${API}/chat/conversations/${currentChatConversationUserId}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const messages = await res.json();
 
    const wasNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 40;
    container.innerHTML = messages.map(m => `
      <div class="chat-msg ${m.fromRole === 'cliente' ? 'from-client' : 'from-staff'}">
        <span class="chat-msg-name">${m.fromName}</span>
        <span class="chat-msg-text">${m.text}</span>
      </div>
    `).join('') || '<div class="empty-state">Todavía no hay mensajes. ¡Escribe el primero!</div>';
 
    if (wasNearBottom) container.scrollTop = container.scrollHeight;
  } catch { /* noop */ }
}
 
async function handleChatSend(e) {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
 
  const body = { text };
  if (currentUser.role !== 'cliente') {
    if (!currentChatConversationUserId) return alert('Selecciona primero una conversación');
    body.toUserId = currentChatConversationUserId;
  }
 
  try {
    await fetch(`${API}/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify(body)
    });
    input.value = '';
    loadChatMessages();
    if (currentUser.role !== 'cliente') loadChatConversations();
  } catch { /* noop */ }
}
 
// ================= NOTIFICACIONES =================
function startNotifPolling() {
  if (!currentUser || currentUser.role === 'cliente') return;
  stopNotifPolling();
  loadNotifications();
  notifPollTimer = setInterval(loadNotifications, 15000);
}
function stopNotifPolling() { if (notifPollTimer) { clearInterval(notifPollTimer); notifPollTimer = null; } }
 
function toggleNotifPanel() {
  document.getElementById('notifPanel').classList.toggle('open');
  document.getElementById('accountPanel')?.classList.remove('open');
}
 
async function loadNotifications() {
  if (!currentUser || currentUser.role === 'cliente') return;
  try {
    const res = await fetch(`${API}/notifications`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const notifications = await res.json();
    renderNotifList(notifications);
    const unread = notifications.filter(n => !n.read).length;
    const badge = document.getElementById('notifCount');
    if (unread) { badge.textContent = unread; badge.style.display = 'flex'; }
    else badge.style.display = 'none';
  } catch { /* noop */ }
}
 
function renderNotifList(notifications) {
  const list = document.getElementById('notifList');
  if (!notifications.length) { list.innerHTML = '<div class="empty-state">Sin notificaciones</div>'; return; }
 
  list.innerHTML = notifications.slice(0, 20).map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead(${n.id})">
      <span>${n.message}</span>
      <span class="category-count">${new Date(n.createdAt).toLocaleString('es-CO')}</span>
    </div>
  `).join('');
}
 
async function markNotifRead(id) {
  try {
    await fetch(`${API}/notifications/${id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${currentUser.token}` } });
    loadNotifications();
  } catch { /* noop */ }
}
 
async function markAllNotifsRead() {
  try {
    await fetch(`${API}/notifications/read-all`, { method: 'POST', headers: { Authorization: `Bearer ${currentUser.token}` } });
    loadNotifications();
  } catch { /* noop */ }
}
 
// ================= ESTADÍSTICAS (gráficas) =================
async function loadStats() {
  try {
    const from = document.getElementById('statsFilterFrom')?.value || '';
    const to = document.getElementById('statsFilterTo')?.value || '';
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
 
    const res = await fetch(`${API}/stats/overview?${params.toString()}`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const data = await res.json();
    renderStatsCards(data.totals);
    renderChart('chartSalesByDay', 'line', data.salesByDay.map(d => d.date), [{ label: 'Ventas ($)', data: data.salesByDay.map(d => d.total), borderColor: '#00f0ff', backgroundColor: 'rgba(0,240,255,0.15)', tension: 0.3, fill: true }]);
    renderChart('chartOrderStatus', 'doughnut', Object.keys(data.statusCounts), [{ data: Object.values(data.statusCounts), backgroundColor: ['#ffcf5c', '#00f0ff', '#b455ff', '#4dffb4', '#ff5c7a'] }]);
    renderChart('chartRevenueByProduct', 'bar', data.revenueByProduct.map(p => p.name), [{ label: 'Ingresos ($)', data: data.revenueByProduct.map(p => p.total), backgroundColor: '#b455ff' }]);
    renderChart('chartVisits', 'bar', data.visits.map(v => v.date), [{ label: 'Visitas', data: data.visits.map(v => v.count), backgroundColor: '#4dffb4' }]);
  } catch { /* noop */ }
}
 
function clearStatsFilter() {
  document.getElementById('statsFilterFrom').value = '';
  document.getElementById('statsFilterTo').value = '';
  loadStats();
}
 
function renderStatsCards(totals) {
  const container = document.getElementById('statsCards');
  container.innerHTML = `
    <div class="stat-card"><span class="stat-value">$${totals.totalRevenue.toLocaleString('es-CO')}</span><span class="stat-label">Ingresos totales</span></div>
    <div class="stat-card"><span class="stat-value">${totals.totalOrders}</span><span class="stat-label">Pedidos totales</span></div>
    <div class="stat-card"><span class="stat-value">${totals.totalSales}</span><span class="stat-label">Ventas registradas</span></div>
    <div class="stat-card"><span class="stat-value">${totals.pendingOrders}</span><span class="stat-label">Pedidos pendientes</span></div>
  `;
}
 
function renderChart(canvasId, type, labels, datasets) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;
  if (charts[canvasId]) charts[canvasId].destroy();
 
  charts[canvasId] = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: getComputedStyle(document.body).getPropertyValue('--text') || '#e8eaf0' } } },
      scales: type === 'doughnut' ? {} : {
        x: { ticks: { color: '#8a8fa3' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#8a8fa3' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}
 
// ================= AUDITORÍA =================
const AUDIT_LABELS = {
  categoria_creada: '📂 Categoría creada', categoria_eliminada: '🗑️ Categoría eliminada',
  producto_creado: '📦 Producto creado', producto_editado: '✏️ Producto editado', producto_eliminado: '🗑️ Producto eliminado',
  venta_registrada: '🧾 Venta registrada', venta_eliminada: '🗑️ Venta eliminada',
  pedido_creado: '🛒 Pedido creado', pedido_estado: '🚚 Estado de pedido actualizado', pedido_eliminado: '🗑️ Pedido eliminado',
  pedido_tomado: '📌 Pedido tomado', pedido_liberado: '🔓 Pedido liberado',
  solicitud_creada: '🔔 Solicitud creada', solicitud_resuelta: '✅ Solicitud resuelta',
  usuario_promovido: '⬆️ Usuario promovido', usuario_degradado: '⬇️ Usuario degradado', usuario_eliminado: '🗑️ Usuario eliminado',
  ajustes_actualizados: '⚙️ Ajustes actualizados', auditoria_limpiada: '🧹 Auditoría limpiada'
};
 
function populateAuditEmailFilter() {
  const select = document.getElementById('auditFilterEmail');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">-- Todas las personas --</option>' +
    allUsers.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('');
  select.value = current;
}
 
async function loadAudit() {
  const container = document.getElementById('auditTable');
  if (!container) return;
  try {
    const email = document.getElementById('auditFilterEmail')?.value || '';
    const from = document.getElementById('auditFilterFrom')?.value || '';
    const to = document.getElementById('auditFilterTo')?.value || '';
 
    const params = new URLSearchParams();
    if (email) params.set('email', email);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
 
    const res = await fetch(`${API}/audit?${params.toString()}`, { headers: { Authorization: `Bearer ${currentUser.token}` } });
    const audit = await res.json();
    container.innerHTML = renderAuditTable(audit);
  } catch {
    container.innerHTML = '<div class="empty-state">Error al cargar la auditoría</div>';
  }
}
 
function applyAuditFilter() { loadAudit(); }
 
function clearAuditFilter() {
  document.getElementById('auditFilterEmail').value = '';
  document.getElementById('auditFilterFrom').value = '';
  document.getElementById('auditFilterTo').value = '';
  loadAudit();
}
 
async function clearAuditLog() {
  if (!confirm('¿Borrar TODO el historial de auditoría? Esta acción no se puede deshacer.')) return;
  try {
    await fetch(`${API}/audit`, { method: 'DELETE', headers: { Authorization: `Bearer ${currentUser.token}` } });
    loadAudit();
  } catch { /* noop */ }
}
 
function renderAuditTable(entries) {
  if (!entries.length) return '<div class="empty-state">No hay actividad que coincida con el filtro</div>';
 
  return `<table>
    <thead><tr><th>Evento</th><th>Quién</th><th>Detalle</th><th>Fecha y hora</th></tr></thead>
    <tbody>
      ${entries.map(a => `
        <tr>
          <td>${AUDIT_LABELS[a.type] || a.type}</td>
          <td>${a.actorName}${a.actorEmail ? `<br><span class="category-count">${a.actorEmail}</span>` : ''}</td>
          <td>${a.detail}</td>
          <td>${new Date(a.createdAt).toLocaleString('es-CO')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}
 
// ================= HELPERS =================
function showAlert(id, message, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = `alert ${type} show`;
  setTimeout(() => el.classList.remove('show'), 4500);
}
 
function clearAlert(id) {
  const el = document.getElementById(id);
  if (el) el.className = 'alert';
}
 
function markInvalid(elements) { elements.forEach(el => el.classList.add('invalid')); }
function clearFieldErrors(elements) { elements.forEach(el => el.classList.remove('invalid')); }
 