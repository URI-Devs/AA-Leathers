/* ============================================================
   AA LEATHERS — ACCOUNT PAGE (user-profile.html)
   FR-09 Customer Account, FR-08 Wishlist, FR-15 Order Tracking
   ============================================================ */

const statusClass = {
  Pending: 'status-pending', Confirmed: 'status-confirmed', Processing: 'status-processing',
  Shipped: 'status-shipped', Delivered: 'status-delivered', Cancelled: 'status-cancelled',
};

function trackMyOrder(orderID) {
  const user = AA.session();
  const order = user && AA.orders().find(item => item.orderID === orderID && item.userID === user.userID);
  const resultEl = document.getElementById('orderTrackResult');
  const modalEl = document.getElementById('orderTrackModal');
  if (!resultEl || !modalEl || !order) return;
  resultEl.innerHTML = `
    <div class="order-track-head">
      <div><span class="sec-label">Order tracking</span><strong id="orderTrackTitle">Track your order</strong></div>
    </div>
    <div class="order-track-status">
      <div class="status-pill ${statusClass[order.status] || ''}">${esc(order.status)}</div>
      <div class="ohc-total">${AA.money(order.totalAmount)}</div>
    </div>
    <p class="section-note"><strong>Order ID:</strong> ${esc(order.orderID)}</p>
    <p class="section-note">Placed ${AA.fmtDate(order.orderDate)} · ${esc(order.paymentMethod)} · ${order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} item(s)</p>
  `;
  modalEl.hidden = false;
  document.body.classList.add('order-track-open');
}

function closeOrderTracking() {
  const modalEl = document.getElementById('orderTrackModal');
  if (modalEl) modalEl.hidden = true;
  document.body.classList.remove('order-track-open');
}

function renderAccount() {
  const user = AA.session();
  if (!user) {
    document.getElementById('loggedOutMsg').style.display = 'block';
    document.getElementById('accWrap').style.display = 'none';
    return;
  }
  document.getElementById('loggedOutMsg').style.display = 'none';
  document.getElementById('accWrap').style.display = 'grid';

  document.getElementById('accAvatar').textContent = user.name.charAt(0).toUpperCase();
  document.getElementById('accName').textContent = user.name;
  document.getElementById('accEmail').textContent = user.email || user.phone;
  document.getElementById('accJoined').textContent = 'Member since ' + AA.fmtDate(user.joined);
  document.getElementById('overviewName').textContent = user.name.split(' ')[0] || 'there';
  document.getElementById('addressName').textContent = user.name || '—';
  document.getElementById('addressPhone').textContent = user.phone || 'No phone saved';
  document.getElementById('addressText').textContent = user.address || 'No address saved yet.';
  document.getElementById('securityEmail').textContent = user.email || 'your account email';
  document.getElementById('securityStatus').textContent = 'Email verification is managed by Supabase Auth.';

  document.getElementById('pfName').value = user.name || '';
  document.getElementById('pfPhone').value = user.phone || '';
  document.getElementById('pfEmail').value = user.email || '';
  document.getElementById('pfAddress').value = user.address || '';

  renderOrders(user);
  renderWishlist();
  renderAccountStats(user);
  renderMyReviews(user);
  applyAccountTheme(localStorage.getItem('aa_account_theme') || 'dark');
}

function showAccPanel(name, link) {
  qsa('.acc-nav a[data-panel]').forEach(a => a.classList.remove('active'));
  link.classList.add('active');
  qsa('.acc-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
}

async function saveProfile() {
  const user = AA.session();
  if (!user) return;
  const name = document.getElementById('pfName').value.trim();
  if (name.length < 2) { toast('Please enter your name', 'danger'); return; }
  const result = await AA.updateProfile({
    name,
    phone: document.getElementById('pfPhone').value.trim(),
    address: document.getElementById('pfAddress').value.trim(),
  });                                           // email is not editable here (it is your login)
  if (result.error) { toast(result.error, 'danger'); return; }
  toast('Profile updated', 'success');
  renderAccount();
}

function renderOrders(user) {
  const orders = AA.orders().filter(o => o.userID === user.userID).reverse();
  const wrap = document.getElementById('ordersList');
  renderRecentOrders(orders);
  if (!orders.length) { wrap.innerHTML = '<div class="acc-empty"><strong>No orders yet</strong><p>Your next everyday essential is waiting.</p><a class="btn-gold" href="products.html">Explore Wallets</a></div>'; return; }
  wrap.innerHTML = orders.map(orderCard).join('');
}

function orderCard(o) {
  return `<div class="order-hist-card"><div class="ohc-row"><div><div class="ohc-id">${esc(o.orderID)}</div><div class="ohc-items">${o.items.map(i => esc(i.name) + ' × ' + i.quantity).join(', ')}</div><div class="ohc-meta">${AA.fmtDate(o.orderDate)} · ${esc(o.paymentMethod)}</div></div><div class="ohc-right"><div class="status-pill ${statusClass[o.status] || ''}">${esc(o.status)}</div><div class="ohc-total">${AA.money(o.totalAmount)}</div><button type="button" class="track-order-btn" onclick="trackMyOrder('${esc(o.orderID)}')">Track My Order</button></div></div></div>`;
}

function renderRecentOrders(orders) {
  const wrap = document.getElementById('recentOrders');
  if (wrap) wrap.innerHTML = orders.length ? orders.slice(0, 5).map(orderCard).join('') : '<p class="section-note">No orders yet. Explore our wallet collection to get started.</p>';
}

function renderAccountStats(user) {
  const orders = AA.orders().filter(o => o.userID === user.userID);
  document.getElementById('statOrders').textContent = orders.length;
  document.getElementById('statProgress').textContent = orders.filter(o => !['Delivered', 'Cancelled'].includes(o.status)).length;
  document.getElementById('statDelivered').textContent = orders.filter(o => o.status === 'Delivered').length;
  document.getElementById('statWishlist').textContent = AA.wishlist().length;
}

function renderMyReviews(user) {
  const list = AA.reviews().filter(r => r.customerID === user.userID);
  const wrap = document.getElementById('myReviewsList');
  if (!wrap) return;
  wrap.innerHTML = list.length ? list.map(r => `<div class="acc-content-card"><div class="review-stars">${'★'.repeat(Number(r.rating))}${'☆'.repeat(5 - Number(r.rating))}</div><p>${esc(r.comment)}</p><span class="section-note">${AA.fmtDate(r.createdAt)}</span></div>`).join('') : '<div class="acc-empty"><strong>No reviews yet</strong><p>After ordering, share your experience on the product page.</p><a class="btn-gold" href="products.html">Browse Wallets</a></div>';
}

function applyAccountTheme(theme) {
  const value = ['light', 'dark', 'system'].includes(theme) ? theme : 'dark';
  document.documentElement.dataset.accountTheme = value;
  qsa('[data-theme-choice]').forEach(button => button.classList.toggle('selected', button.dataset.themeChoice === value));
}

function setAccountTheme(theme) {
  localStorage.setItem('aa_account_theme', theme);
  applyAccountTheme(theme);
}

function sendAccountVerification() {
  const user = AA.session();
  if (!user || !user.email) return;
  AA.resendVerification(user.email).then(result => toast(result.error || 'Verification email sent.', result.error ? 'danger' : 'success'));
}

function requestAccountPasswordReset() {
  const user = AA.session();
  if (!user || !user.email) return;
  AA.requestPasswordReset(user.email).then(result => toast(result.error || 'Password reset email sent.', result.error ? 'danger' : 'success'));
}

function renderWishlist() {
  const ids = AA.wishlist();
  const wrap = document.getElementById('wishlistGrid');
  if (!ids.length) { wrap.innerHTML = '<p class="section-note">Your wishlist is empty.</p>'; return; }
  const products = ids.map(id => AA.productById(id)).filter(Boolean);
  wrap.innerHTML = products.map(p => `
    <div class="wish-card">
      <button class="wish-remove" onclick="removeWishlist('${p.productID}')">✕</button>
      <div class="wish-name">${esc(p.name)}</div>
      <div class="wish-price">${AA.money(p.price)}</div>
      <button class="wish-btn" onclick="location.href='products.html#${p.productID}'">View Product</button>
    </div>
  `).join('');
}

function removeWishlist(productID) {
  AA.saveWishlist(AA.wishlist().filter(id => id !== productID));
  renderWishlist();
}

async function doLogout() {
  await AA.signOut();
  toast('Logged out');
  renderAccount();
}

AA.init({ orders: true, reviews: true }).then(renderAccount);   // customers only receive THEIR OWN data (database rules)
