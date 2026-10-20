/* ============================================================
   AA LEATHERS — ACCOUNT PAGE (user-profile.html)
   FR-09 Customer Account, FR-08 Wishlist, FR-15 Order Tracking
   ============================================================ */

const statusClass = {
  Pending: 'status-pending', Confirmed: 'status-confirmed', Processing: 'status-processing',
  Shipped: 'status-shipped', Delivered: 'status-delivered', Cancelled: 'status-cancelled',
};

async function trackOrder() {
  const id = document.getElementById('trackOrderId').value.trim().toUpperCase();
  const resultEl = document.getElementById('trackResult');
  if (!id) { resultEl.innerHTML = '<p class="section-note" style="color:var(--danger)">Please enter an Order ID.</p>'; return; }
  const order = await AA.trackOrder(id);      // works for guests too (no login needed)
  if (!order) { resultEl.innerHTML = '<p class="section-note" style="color:var(--danger)">No order found with that ID.</p>'; return; }
  resultEl.innerHTML = `
    <div class="order-hist-card">
      <div class="ohc-row">
        <div>
          <div class="ohc-id">${esc(order.orderID)}</div>
          <div class="ohc-items">${order.items.map(i => esc(i.name) + ' × ' + i.quantity).join(', ')}</div>
          <div class="ohc-meta">${AA.fmtDate(order.orderDate)} · ${esc(order.paymentMethod)}</div>
        </div>
        <div class="ohc-right">
          <div class="status-pill ${statusClass[order.status] || ''}">${esc(order.status)}</div>
          <div class="ohc-total">${AA.money(order.totalAmount)}</div>
        </div>
      </div>
    </div>
  `;
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

  document.getElementById('pfName').value = user.name || '';
  document.getElementById('pfPhone').value = user.phone || '';
  document.getElementById('pfEmail').value = user.email || '';
  document.getElementById('pfAddress').value = user.address || '';

  renderOrders(user);
  renderWishlist();
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
  if (!orders.length) { wrap.innerHTML = '<p class="section-note">You have not placed any orders yet.</p>'; return; }
  wrap.innerHTML = orders.map(o => `
    <div class="order-hist-card">
      <div class="ohc-row">
        <div>
          <div class="ohc-id">${esc(o.orderID)}</div>
          <div class="ohc-items">${o.items.map(i => esc(i.name) + ' × ' + i.quantity).join(', ')}</div>
          <div class="ohc-meta">${AA.fmtDate(o.orderDate)} · ${esc(o.paymentMethod)}</div>
        </div>
        <div class="ohc-right">
          <div class="status-pill ${statusClass[o.status] || ''}">${esc(o.status)}</div>
          <div class="ohc-total">${AA.money(o.totalAmount)}</div>
        </div>
      </div>
    </div>
  `).join('');
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

AA.init({ orders: true }).then(renderAccount);   // customers only receive THEIR OWN orders (database rule)
