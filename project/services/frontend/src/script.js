// =============================================
//   Saud's Store — Storefront Application Logic
// =============================================

'use strict';

// ── State ──
let allProducts = [];
let filteredProducts = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let sessionToken = localStorage.getItem('user_token');
let sessionUser = localStorage.getItem('user_username');
let activeFilter = 'All';
let cartOpen = false;
let checkoutCartItems = [];
let currentSlide = 0;
let slideInterval;

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  updateUserUI();
  fetchProducts();
  renderCart();
  startCountdown();
  startSlider();
});

// ── Hero Slider ──
function startSlider() {
  slideInterval = setInterval(nextSlide, 4500);
}

function goToSlide(n) {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.dot');
  if (!slides.length) return;
  slides[currentSlide].classList.remove('active');
  if (dots[currentSlide]) dots[currentSlide].classList.remove('active');
  currentSlide = (n + slides.length) % slides.length;
  slides[currentSlide].classList.add('active');
  if (dots[currentSlide]) dots[currentSlide].classList.add('active');
}

function nextSlide() { goToSlide(currentSlide + 1); }
function prevSlide() {
  clearInterval(slideInterval);
  goToSlide(currentSlide - 1);
  slideInterval = setInterval(nextSlide, 4500);
}


// ── Auth ──
function updateUserUI() {
  const loginBtn = document.getElementById('login-btn');
  const userDisplay = document.getElementById('user-display');
  if (sessionToken && sessionUser) {
    loginBtn.style.display = 'none';
    userDisplay.style.display = 'flex';
    userDisplay.title = `Signed in as ${sessionUser} — Click to sign out`;
  } else {
    loginBtn.style.display = 'flex';
    userDisplay.style.display = 'none';
  }
}

function openLoginModal() {
  document.getElementById('login-modal').classList.add('open');
  document.getElementById('modal-username').focus();
}

function closeLoginModal() {
  document.getElementById('login-modal').classList.remove('open');
  document.getElementById('login-error').style.display = 'none';
}

async function login() {
  const username = document.getElementById('modal-username').value.trim();
  const password = document.getElementById('modal-password').value.trim();
  const errorDiv = document.getElementById('login-error');
  errorDiv.style.display = 'none';

  const btn = document.querySelector('#login-modal .form-submit');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…';
  btn.disabled = true;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    if (data.role !== 'user') throw new Error('Access denied. Please use the Admin Panel for admin access.');
    sessionToken = data.token;
    sessionUser = data.username;
    localStorage.setItem('user_token', sessionToken);
    localStorage.setItem('user_username', sessionUser);
    closeLoginModal();
    updateUserUI();
    showToast(`Welcome back, ${sessionUser}! 👋`, 'success');
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.style.display = 'block';
  } finally {
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    btn.disabled = false;
  }
}

function logout() {
  sessionToken = null; sessionUser = null;
  localStorage.removeItem('user_token');
  localStorage.removeItem('user_username');
  updateUserUI();
  showToast('You have been signed out.', 'info');
}

// ── Products ──
async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Failed to fetch products');
    allProducts = await res.json();
    filteredProducts = [...allProducts];
    renderProducts(filteredProducts);
    const t = document.getElementById('product-count-text');
    if (t) t.textContent = `${allProducts.length} products available`;
  } catch (err) {
    const grid = document.getElementById('products-grid');
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted)"><i class="fas fa-exclamation-triangle" style="font-size:2rem;display:block;margin-bottom:12px;color:var(--primary)"></i>Could not load products. Make sure the API service is running.</div>`;
  }
}

function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  if (!products.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted)"><i class="fas fa-search" style="font-size:2rem;display:block;margin-bottom:12px;opacity:0.4"></i>No products found</div>`;
    return;
  }

  const ratings = { 5: '★★★★★', 4.5: '★★★★½', 4: '★★★★☆', 3.5: '★★★½☆', 3: '★★★☆☆' };

  grid.innerHTML = products.map(p => {
    const isOut = p.stock <= 0;
    const isLow = p.stock > 0 && p.stock <= 5;
    const img = p.image || 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=400&q=80';
    const rating = (Math.random() * 0.8 + 4.0).toFixed(1);
    const reviews = Math.floor(Math.random() * 400 + 50);
    const badge = p.stock > 0 && p.stock <= 10 ? `<div class="product-badge sale">HOT</div>` : (p.stock > 50 ? `<div class="product-badge new">NEW</div>` : '');
    const oldPrice = (p.price * 1.25).toFixed(2);

    return `
      <div class="product-card" id="product-${p.product_id}">
        <div class="product-card-img">
          <img src="${img}" alt="${p.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=400&q=80'">
          ${badge}
          <div class="product-actions-hover">
            <button class="quick-btn" title="Add to Wishlist" onclick="showToast('Added to wishlist ❤️','info')"><i class="far fa-heart"></i></button>
            <button class="quick-btn" title="Quick View" onclick="showToast('Quick view coming soon!','info')"><i class="fas fa-eye"></i></button>
          </div>
        </div>
        <div class="product-info">
          <div class="product-category">${p.category || 'General'}</div>
          <div class="product-name">${p.name}</div>
          <div class="product-rating">
            <span class="stars">★★★★${parseFloat(rating) >= 4.5 ? '★' : '☆'}</span>
            <span class="rating-count">(${reviews})</span>
          </div>
          ${isOut ? '<div class="stock-out">Out of Stock</div>' : isLow ? `<div class="stock-low">Only ${p.stock} left!</div>` : ''}
          <div class="product-footer">
            <div>
              <span class="product-price">$${p.price.toFixed(2)}</span>
              <span class="product-price-old">$${oldPrice}</span>
            </div>
            <button class="add-cart-btn" title="${isOut ? 'Out of Stock' : 'Add to Cart'}"
              onclick="addToCart('${p.product_id}')" ${isOut ? 'disabled' : ''}>
              <i class="fas fa-${isOut ? 'ban' : 'plus'}"></i>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function filterByCategory(cat) {
  activeFilter = cat;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  const searchVal = (document.getElementById('search-input') || {}).value || '';
  let result = cat === 'All' ? [...allProducts] : allProducts.filter(p => (p.category || '').toLowerCase() === cat.toLowerCase());
  if (searchVal) result = result.filter(p => p.name.toLowerCase().includes(searchVal.toLowerCase()));
  filteredProducts = result;
  renderProducts(result);
  const tab = [...document.querySelectorAll('.filter-tab')].find(t => t.textContent.trim() === cat);
  if (tab) tab.classList.add('active');
  else document.querySelectorAll('.filter-tab')[0].classList.add('active');
  scrollToSection('products');
  const t = document.getElementById('product-count-text');
  if (t) t.textContent = `${result.length} ${cat === 'All' ? '' : cat + ' '}products found`;
}

function filterProducts() {
  const val = (document.getElementById('search-input').value || '').toLowerCase();
  let result = activeFilter === 'All' ? [...allProducts] : allProducts.filter(p => (p.category || '').toLowerCase() === activeFilter.toLowerCase());
  if (val) result = result.filter(p => p.name.toLowerCase().includes(val) || (p.category || '').toLowerCase().includes(val));
  filteredProducts = result;
  renderProducts(result);
  const t = document.getElementById('product-count-text');
  if (t) t.textContent = `${result.length} products found`;
}

// ── Cart ──
function addToCart(productId) {
  if (!sessionToken) { openLoginModal(); showToast('Please sign in to add items to cart', 'info'); return; }
  const product = allProducts.find(p => p.product_id === productId);
  if (!product) return;
  const existing = cart.find(i => i.product_id === productId);
  if (existing) {
    if (existing.qty >= product.stock) { showToast('Maximum stock reached', 'error'); return; }
    existing.qty++;
  } else {
    cart.push({ product_id: productId, name: product.name, price: product.price, image: product.image, qty: 1, stock: product.stock });
  }
  saveCart();
  renderCart();
  showToast(`${product.name} added to cart 🛒`, 'success');
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.product_id !== productId);
  saveCart(); renderCart();
}

function updateQty(productId, delta) {
  const item = cart.find(i => i.product_id === productId);
  if (!item) return;
  item.qty = Math.max(1, Math.min(item.qty + delta, item.stock));
  if (item.qty === 0) { removeFromCart(productId); return; }
  saveCart(); renderCart();
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const footer = document.getElementById('cart-footer');
  const countBadge = document.getElementById('cart-count');
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  if (countBadge) {
    countBadge.textContent = totalItems;
    countBadge.style.display = totalItems > 0 ? 'flex' : 'none';
  }

  if (!cart.length) {
    if (container) container.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">🛒</div><p>Your cart is empty</p><p style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;">Add products to get started</p></div>`;
    if (footer) footer.style.display = 'none';
    return;
  }

  if (footer) footer.style.display = 'block';
  document.getElementById('cart-subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('cart-total').textContent = `$${subtotal.toFixed(2)}`;

  if (container) {
    container.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img class="cart-item-img" src="${item.image || 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=100&q=60'}" alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=100&q=60'">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</div>
          <div class="cart-item-controls">
            <button class="qty-btn" onclick="updateQty('${item.product_id}',-1)">−</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" onclick="updateQty('${item.product_id}',1)">+</button>
            <button class="remove-item" onclick="removeFromCart('${item.product_id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>`).join('');
  }
}

function toggleCart() {
  cartOpen = !cartOpen;
  document.getElementById('cart-sidebar').classList.toggle('open', cartOpen);
  document.getElementById('cart-overlay').classList.toggle('open', cartOpen);
  document.body.style.overflow = cartOpen ? 'hidden' : '';
}

// ── Checkout ──
function openCheckout() {
  if (!sessionToken) { openLoginModal(); showToast('Please sign in to checkout', 'info'); return; }
  if (!cart.length) { showToast('Your cart is empty', 'error'); return; }
  toggleCart();
  checkoutCartItems = [...cart];

  const summaryEl = document.getElementById('checkout-summary');
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  summaryEl.innerHTML = `
    ${cart.map(i => `<div class="checkout-summary-row"><span>${i.name} ×${i.qty}</span><span>$${(i.price * i.qty).toFixed(2)}</span></div>`).join('')}
    <div class="checkout-summary-row total"><span>Total</span><span>$${total.toFixed(2)}</span></div>`;

  document.getElementById('checkout-status').style.display = 'none';
  document.getElementById('checkout-result').style.display = 'none';
  document.getElementById('checkout-error').style.display = 'none';
  document.getElementById('place-order-btn').style.display = 'block';
  document.getElementById('checkout-panel').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  document.getElementById('checkout-panel').classList.remove('open');
  document.body.style.overflow = '';
}

async function placeOrder() {
  const statusEl = document.getElementById('checkout-status');
  const resultEl = document.getElementById('checkout-result');
  const errorEl = document.getElementById('checkout-error');
  const placeBtn = document.getElementById('place-order-btn');

  resultEl.style.display = 'none';
  errorEl.style.display = 'none';
  statusEl.style.display = 'block';
  placeBtn.style.display = 'none';

  const setStep = (steps) => {
    statusEl.innerHTML = steps.map(s => `
      <div class="status-step">
        <div class="status-dot ${s.status}"></div>
        <span style="font-size:0.875rem;">${s.label}</span>
      </div>`).join('');
  };

  // Process each cart item
  let orderIds = []; let totalPaid = 0;
  for (const item of checkoutCartItems) {
    setStep([
      { label: `Creating order for ${item.name}…`, status: 'active' },
      { label: 'Processing payment…', status: '' },
      { label: 'Confirming…', status: '' }
    ]);
    await sleep(500);

    try {
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: item.product_id, quantity: item.qty })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Order failed');

      setStep([
        { label: `Order created for ${item.name}`, status: 'done' },
        { label: 'Processing payment…', status: 'active' },
        { label: 'Confirming…', status: '' }
      ]);
      await sleep(600);

      const payRes = await fetch('/api/payments/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderData.orderId, amount: orderData.amount, product_id: item.product_id, quantity: item.qty })
      });
      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.error || 'Payment failed');

      setStep([
        { label: `Order placed for ${item.name}`, status: 'done' },
        { label: `Payment of $${orderData.amount?.toFixed(2)} processed`, status: 'done' },
        { label: 'Confirmed!', status: 'done' }
      ]);
      orderIds.push(orderData.orderId);
      totalPaid += orderData.amount || 0;
      await sleep(400);
    } catch (err) {
      setStep([{ label: `Error: ${err.message}`, status: 'error' }]);
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
      placeBtn.style.display = 'block';
      return;
    }
  }

  // All done
  statusEl.style.display = 'none';
  resultEl.style.display = 'block';
  document.getElementById('checkout-result-text').innerHTML = `
    <strong>Order IDs:</strong> ${orderIds.join(', ')}<br>
    <strong>Total Paid:</strong> $${totalPaid.toFixed(2)}<br>
    <strong>Status:</strong> Processing — check your Admin Panel for ledger
  `;
  cart = []; saveCart(); renderCart();
  showToast('🎉 Order placed successfully!', 'success');
  await fetchProducts();
}

// ── Countdown Timer ──
function startCountdown() {
  let end = Date.now() + (8 * 3600 + 34 * 60 + 59) * 1000;
  function tick() {
    const diff = Math.max(0, end - Date.now());
    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
    const hEl = document.getElementById('cd-h'); if (hEl) hEl.textContent = h;
    const mEl = document.getElementById('cd-m'); if (mEl) mEl.textContent = m;
    const sEl = document.getElementById('cd-s'); if (sEl) sEl.textContent = s;
  }
  tick(); setInterval(tick, 1000);
}

// ── Utilities ──
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLoginModal();
    closeCheckout();
    if (cartOpen) toggleCart();
  }
});
