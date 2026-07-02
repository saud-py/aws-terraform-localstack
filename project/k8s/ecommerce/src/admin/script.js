// =============================================
//   Saud's Store Admin — Dashboard Logic
// =============================================

'use strict';

let adminToken = sessionStorage.getItem('admin_token');
let adminUser = sessionStorage.getItem('admin_user');
let currentSection = 'dashboard';
let refreshInterval;

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  if (adminToken && adminUser) {
    showDashboard();
  }
});

// ── Auth ──
async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value.trim();
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  const btn = document.querySelector('.login-btn');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating…';
  btn.disabled = true;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    if (data.role !== 'admin') throw new Error('Access denied. This panel is for administrators only.');
    adminToken = data.token;
    adminUser = data.username;
    sessionStorage.setItem('admin_token', adminToken);
    sessionStorage.setItem('admin_user', adminUser);
    showDashboard();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In to Dashboard';
    btn.disabled = false;
  }
}

function logout() {
  adminToken = null; adminUser = null;
  sessionStorage.clear();
  clearInterval(refreshInterval);
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'flex';
  const av = document.getElementById('admin-avatar');
  const nm = document.getElementById('admin-name');
  if (av) av.textContent = (adminUser || 'A').charAt(0).toUpperCase();
  if (nm) nm.textContent = adminUser || 'Admin';
  refreshAll();
  refreshInterval = setInterval(refreshAll, 30000);
  updateRefreshTime();
}

// ── Navigation ──
function navigate(section) {
  currentSection = section;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sEl = document.getElementById(`section-${section}`);
  if (sEl) sEl.classList.add('active');
  const nEl = [...document.querySelectorAll('.nav-item')].find(n => n.textContent.trim().toLowerCase().startsWith(section));
  if (nEl) nEl.classList.add('active');
  const titleEl = document.getElementById('page-title');
  const titles = { dashboard: 'Dashboard', orders: 'Orders', payments: 'Payment Ledger', inventory: 'Inventory', alerts: 'System Alerts' };
  if (titleEl) titleEl.textContent = titles[section] || section;

  // Lazy load sections on navigate
  if (section === 'orders') loadOrders();
  if (section === 'payments') loadPayments();
  if (section === 'inventory') loadInventory();
  if (section === 'alerts') renderAlerts();
}

// ── Data Loading ──
async function refreshAll() {
  updateRefreshTime();
  await Promise.allSettled([loadStats(), loadRecentOrders(), loadAlertsDash()]);
}

async function loadStats() {
  try {
    const [ordersRes, paymentsRes, productsRes] = await Promise.all([
      fetch('/api/orders').catch(() => null),
      fetch('/api/payments/ledger').catch(() => null),
      fetch('/api/products').catch(() => null)
    ]);

    let orders = [], payments = [], products = [];
    if (ordersRes && ordersRes.ok) orders = await ordersRes.json().catch(() => []);
    if (paymentsRes && paymentsRes.ok) payments = await paymentsRes.json().catch(() => []);
    if (productsRes && productsRes.ok) products = await productsRes.json().catch(() => []);

    const revenue = payments.filter(p => p.status === 'SUCCESS').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const inStock = products.filter(p => (p.stock || 0) > 0).length;

    setEl('stat-revenue', `$${revenue.toFixed(2)}`);
    setEl('stat-revenue-sub', `↑ ${payments.filter(p => p.status === 'SUCCESS').length} successful transactions`);
    setEl('stat-orders', orders.length);
    setEl('stat-orders-sub', `↑ ${orders.filter(o => o.status === 'PENDING').length} pending`);
    setEl('stat-payments', payments.length);
    setEl('stat-payments-sub', `${payments.filter(p => p.status === 'SUCCESS').length} succeeded · ${payments.filter(p => p.status === 'FAILED').length} failed`);
    setEl('stat-products', inStock);
    setEl('stat-products-sub', `${products.length} total, ${products.filter(p => p.stock <= 5 && p.stock > 0).length} low stock`);

    // Badge update
    const orderBadge = document.getElementById('orders-badge');
    if (orderBadge) orderBadge.textContent = orders.filter(o => o.status === 'PENDING').length;

    // Revenue chart
    renderRevenueChart(payments);
  } catch (err) {
    console.error('Stats load error:', err);
  }
}

async function loadRecentOrders() {
  const tbody = document.getElementById('dash-orders-table');
  if (!tbody) return;
  try {
    const res = await fetch('/api/orders');
    const orders = res.ok ? await res.json() : [];
    if (!orders.length) { tbody.innerHTML = `<tr><td colspan="5" class="table-loading">No orders yet</td></tr>`; return; }
    const recent = [...orders].slice(-8).reverse();
    tbody.innerHTML = recent.map(o => `
      <tr>
        <td style="font-family:monospace;font-size:0.82rem;">${(o.order_id || o.orderId || '—').substring(0, 12)}…</td>
        <td>${o.product_id || '—'}</td>
        <td>${o.quantity || 1}</td>
        <td><span class="status ${(o.status || 'PENDING').toLowerCase()}">${o.status || 'PENDING'}</span></td>
        <td style="color:var(--text-muted);font-size:0.8rem;">${formatDate(o.created_at)}</td>
      </tr>`).join('');
  } catch { tbody.innerHTML = `<tr><td colspan="5" class="table-loading" style="color:var(--primary)">Error loading orders</td></tr>`; }
}

async function loadOrders() {
  const tbody = document.getElementById('orders-table');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="table-loading"><i class="fas fa-spinner fa-spin"></i> Loading…</td></tr>`;
  try {
    const res = await fetch('/api/orders');
    const orders = res.ok ? await res.json() : [];
    if (!orders.length) { tbody.innerHTML = `<tr><td colspan="6" class="table-loading">No orders found</td></tr>`; return; }
    tbody.innerHTML = [...orders].reverse().map(o => `
      <tr>
        <td style="font-family:monospace;font-size:0.8rem;">${o.order_id || o.orderId || '—'}</td>
        <td>${o.product_id || '—'}</td>
        <td>${o.quantity || 1}</td>
        <td>$${(parseFloat(o.amount) || 0).toFixed(2)}</td>
        <td><span class="status ${(o.status || 'PENDING').toLowerCase()}">${o.status || 'PENDING'}</span></td>
        <td style="font-size:0.8rem;color:var(--text-muted);">${formatDate(o.created_at)}</td>
      </tr>`).join('');
  } catch { tbody.innerHTML = `<tr><td colspan="6" class="table-loading" style="color:var(--primary)">Error loading orders</td></tr>`; }
}

async function loadPayments() {
  const tbody = document.getElementById('payments-table');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" class="table-loading"><i class="fas fa-spinner fa-spin"></i> Loading…</td></tr>`;
  try {
    const res = await fetch('/api/payments/ledger');
    const payments = res.ok ? await res.json() : [];
    if (!payments.length) { tbody.innerHTML = `<tr><td colspan="7" class="table-loading">No payments found</td></tr>`; return; }
    tbody.innerHTML = [...payments].reverse().map(p => `
      <tr>
        <td style="font-family:monospace;font-size:0.8rem;">${(p.payment_id || '—').substring(0, 14)}…</td>
        <td style="font-family:monospace;font-size:0.8rem;">${(p.order_id || '—').substring(0, 12)}…</td>
        <td style="font-weight:700;color:var(--success);">$${(parseFloat(p.amount) || 0).toFixed(2)}</td>
        <td>${p.product_id || '—'}</td>
        <td>${p.quantity || 1}</td>
        <td><span class="status ${(p.status || 'PENDING').toLowerCase()}">${p.status || 'PENDING'}</span></td>
        <td style="font-size:0.8rem;color:var(--text-muted);">${formatDate(p.created_at)}</td>
      </tr>`).join('');
  } catch { tbody.innerHTML = `<tr><td colspan="7" class="table-loading" style="color:var(--primary)">Error loading payments</td></tr>`; }
}

async function loadInventory() {
  const container = document.getElementById('inventory-list');
  if (!container) return;
  container.innerHTML = `<div class="table-loading"><i class="fas fa-spinner fa-spin"></i> Loading…</div>`;
  try {
    const res = await fetch('/api/products');
    const products = res.ok ? await res.json() : [];
    if (!products.length) { container.innerHTML = `<div class="table-loading">No products found</div>`; return; }
    container.innerHTML = products.map(p => {
      const stockClass = p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : 'ok';
      const stockLabel = p.stock <= 0 ? '⚠ Out of Stock' : p.stock <= 5 ? `⚠ Low: ${p.stock}` : `✓ ${p.stock} in stock`;
      return `<div class="inventory-item">
        <img class="inv-img" src="${p.image || ''}" alt="${p.name}" onerror="this.style.display='none'">
        <div class="inv-info"><div class="inv-name">${p.name}</div><div class="inv-cat">${p.category || 'Uncategorized'}</div></div>
        <div class="inv-stock ${stockClass}">${stockLabel}</div>
        <div class="inv-price">$${(parseFloat(p.price) || 0).toFixed(2)}</div>
      </div>`;
    }).join('');
  } catch { container.innerHTML = `<div class="table-loading" style="color:var(--primary)">Error loading inventory</div>`; }
}

// ── Alerts ──
const systemAlerts = [
  { type: 'warning', icon: '🔥', title: 'CPU Spike Detected', detail: 'API pod exceeded 80% CPU for 5 minutes. SNS notification sent to saud.ali@kissht.com.', time: '2 min ago' },
  { type: 'info', icon: '📦', title: 'Auto-scale Event', detail: 'Karpenter provisioned 1 additional node for api deployment (replicas: 4→5).', time: '8 min ago' },
  { type: 'critical', icon: '⚠️', title: 'Low Stock Alert', detail: 'Product stock levels below threshold for 3 items. Review inventory.', time: '15 min ago' },
  { type: 'info', icon: '✅', title: 'ArgoCD Sync Complete', detail: 'ecommerce-platform successfully synced to HEAD. All services healthy.', time: '22 min ago' },
  { type: 'info', icon: '🔄', title: 'Secrets Refreshed', detail: 'AWS Secrets Manager rotated credentials for dev-ecommerce-secrets.', time: '1 hr ago' },
];

function loadAlertsDash() {
  const el = document.getElementById('dash-alerts');
  if (!el) return;
  const alertBadge = document.getElementById('alerts-badge');
  if (alertBadge) alertBadge.textContent = systemAlerts.filter(a => a.type !== 'info').length;
  el.innerHTML = systemAlerts.slice(0, 4).map(a => `
    <div class="alert-item alert-${a.type === 'critical' ? 'critical' : a.type === 'warning' ? 'warning' : 'info'}">
      <span class="alert-icon">${a.icon}</span>
      <div class="alert-text"><h5>${a.title}</h5><p>${a.detail}</p></div>
      <span class="alert-time">${a.time}</span>
    </div>`).join('');
}

function renderAlerts() {
  const el = document.getElementById('full-alerts');
  if (el) el.innerHTML = systemAlerts.map(a => `
    <div class="alert-item alert-${a.type === 'critical' ? 'critical' : a.type === 'warning' ? 'warning' : 'info'}">
      <span class="alert-icon">${a.icon}</span>
      <div class="alert-text"><h5>${a.title}</h5><p>${a.detail}</p></div>
      <span class="alert-time">${a.time}</span>
    </div>`).join('');

  const health = document.getElementById('system-health');
  if (health) health.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${[
        { label: 'API Service', status: 'Healthy', color: 'var(--success)', icon: '🟢' },
        { label: 'Auth Service', status: 'Healthy', color: 'var(--success)', icon: '🟢' },
        { label: 'Payment Service', status: 'Healthy', color: 'var(--success)', icon: '🟢' },
        { label: 'Worker (SQS)', status: 'Healthy', color: 'var(--success)', icon: '🟢' },
        { label: 'LocalStack', status: 'Running', color: 'var(--success)', icon: '🟢' },
        { label: 'DynamoDB', status: 'Available', color: 'var(--success)', icon: '🟢' },
        { label: 'SNS Alerts', status: 'Active → saud.ali@kissht.com', color: 'var(--info)', icon: '🔔' },
        { label: 'Karpenter', status: 'Active (4 nodes)', color: 'var(--info)', icon: '⚡' },
      ].map(s => `<div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:0.875rem;">${s.icon} ${s.label}</span>
        <span style="font-size:0.78rem;font-weight:600;color:${s.color};">${s.status}</span>
      </div>`).join('')}
    </div>`;
}

// ── Charts ──
function renderRevenueChart(payments) {
  const el = document.getElementById('revenue-chart');
  if (!el) return;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
  const mockRevenue = [120, 340, 180, 520, 290, 640, 0];
  // Add real payment amounts to 'Today'
  mockRevenue[6] = payments.filter(p => p.status === 'SUCCESS').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const max = Math.max(...mockRevenue, 1);

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:4px;padding:16px 22px 20px;">
      ${days.map((day, i) => `
        <div class="revenue-row">
          <div class="revenue-label">${day}</div>
          <div class="revenue-bar-wrap">
            <div class="revenue-bar" style="width:${((mockRevenue[i] / max) * 100).toFixed(1)}%"></div>
          </div>
          <div class="revenue-val">$${mockRevenue[i].toFixed(0)}</div>
        </div>`).join('')}
    </div>`;
}

// ── Utilities ──
function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function formatDate(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ts; }
}

function updateRefreshTime() {
  const el = document.getElementById('refresh-time');
  if (el) el.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Enter key support for login
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') doLogin();
});
