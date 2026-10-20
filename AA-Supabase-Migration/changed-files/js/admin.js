/* ============================================================
   AA LEATHERS — ADMIN DASHBOARD (admin.html)
   FR-13 Manual Payment Verification, FR-15/19 Order Management,
   FR-17 Delivery Charges
   ============================================================ */

// (admin check + data loading happen in the boot block at the bottom of this file)

const STATUS_OPTIONS = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const statusClass2 = {
  Pending: 'status-pending', Confirmed: 'status-confirmed', Processing: 'status-processing',
  Shipped: 'status-shipped', Delivered: 'status-delivered', Cancelled: 'status-cancelled',
};

function switchAdminTab(name) {
  ['orders', 'delivery', 'customers', 'reviews'].forEach(n => {
    document.getElementById('tab' + n.charAt(0).toUpperCase() + n.slice(1)).classList.toggle('active', n === name);
    document.getElementById('section-' + n).classList.toggle('active', n === name);
  });
}

function renderStats() {
  const orders = AA.orders();
  document.getElementById('statProducts').textContent = AA.products().length;
  document.getElementById('statOrders').textContent = orders.length;
  document.getElementById('statUsers').textContent = AA.users().length;
  const revenue = orders.filter(o => o.status !== 'Cancelled').reduce((s, o) => s + o.totalAmount, 0);
  document.getElementById('statRevenue').textContent = revenue.toLocaleString('en-PK');
}

function renderOrdersTable() {
  const orders = [...AA.orders()].reverse();
  const tbody = document.getElementById('ordersTbody');
  if (!orders.length) { tbody.innerHTML = '<tr><td colspan="8" class="center-note">No orders yet.</td></tr>'; return; }
  tbody.innerHTML = orders.map(o => `
    <tr class="order-row" onclick="openOrderDetails('${o.orderID}')">
      <td><button class="order-id-button" onclick="event.stopPropagation();openOrderDetails('${o.orderID}')">${esc(o.orderID)}</button></td>
      <td>${esc(o.customerName)}<br><span style="font-size:.6rem">${esc(o.customerPhone)}</span></td>
      <td>${AA.money(o.totalAmount)}</td>
      <td>${esc(o.paymentMethod)}</td>
      <td>${esc(o.paymentStatus)}</td>
      <td><span class="status-pill ${statusClass2[o.status] || ''}">${esc(o.status)}</span></td>
      <td>${o.paymentProof ? `<button class="tbl-btn" onclick="event.stopPropagation();viewPaymentProof('${o.orderID}')">View Screenshot</button>` : '—'}</td>
      <td>
        <div class="inline-actions">
          ${o.paymentStatus === 'Awaiting Verification' ? `
            <button class="tbl-btn" onclick="event.stopPropagation();verifyPayment('${o.orderID}',true)">Approve</button>
            <button class="tbl-btn del" onclick="event.stopPropagation();verifyPayment('${o.orderID}',false)">Reject</button>
          ` : ''}
          <select class="co-select" style="width:auto;padding:.3rem .5rem;font-size:.68rem" id="status-${o.orderID}" onclick="event.stopPropagation()">
            ${STATUS_OPTIONS.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <button class="tbl-btn" onclick="event.stopPropagation();updateOrderStatus('${o.orderID}')">Update</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function orderDateTime(order) {
  if (!order.orderDate) return '—';
  const date = new Date(order.orderDate);
  if (Number.isNaN(date.getTime())) return esc(order.orderDate);
  return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} · ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function orderCustomer(order) {
  const user = order.userID ? AA.users().find(u => u.userID === order.userID) : null;
  return {
    name: order.customerName || (user && user.name) || '—',
    email: order.customerEmail || (user && user.email) || '—',
    phone: order.customerPhone || (user && user.phone) || '—',
    address: order.deliveryAddress || (user && user.address) || '—',
    region: order.region || '—',
  };
}

function orderItemImage(item) {
  const product = AA.productById(item.productID);
  const variant = product && product.variants ? product.variants.find(v => v.variantID === item.variantID) : null;
  const image = (variant && variant.image) || (product && product.images && product.images[0]);
  return image
    ? `<img src="${esc(image)}" alt="${esc(item.name || 'Product')}" class="order-item-image" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="order-item-placeholder" style="display:none">${AA.WALLET_SVG}</span>`
    : `<span class="order-item-placeholder">${AA.WALLET_SVG}</span>`;
}

function openOrderDetails(orderID) {
  const order = AA.orderById(orderID);
  const modal = document.getElementById('orderDetailModal');
  if (!order || !modal) return;
  const customer = orderCustomer(order);
  const items = Array.isArray(order.items) ? order.items : [];
  modal.innerHTML = `
    <div class="order-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="orderDetailTitle">
      <button class="payment-proof-close" type="button" aria-label="Close" onclick="closeOrderDetails()">×</button>
      <div class="sec-label">Complete Order</div>
      <h2 id="orderDetailTitle">Order #${esc(order.orderID)}</h2>
      <div class="order-detail-grid">
        <section class="order-detail-card">
          <h3>Order Information</h3>
          <div class="order-detail-lines">
            <div><strong>Order date/time</strong><span>${orderDateTime(order)}</span></div>
            <div><strong>Status</strong><span class="status-pill ${statusClass2[order.status] || ''}">${esc(order.status || 'Pending')}</span></div>
            <div><strong>Payment method</strong><span>${esc(order.paymentMethod || '—')}</span></div>
            <div><strong>Payment status</strong><span>${esc(order.paymentStatus || '—')}</span></div>
          </div>
        </section>
        <section class="order-detail-card">
          <h3>Customer Information</h3>
          <div class="order-detail-lines">
            <div><strong>Name</strong><span>${esc(customer.name)}</span></div>
            <div><strong>Email</strong><span>${esc(customer.email)}</span></div>
            <div><strong>Phone</strong><span>${esc(customer.phone)}</span></div>
            <div><strong>Delivery address</strong><span class="pre-line">${esc(customer.address)}</span></div>
            <div><strong>City / region</strong><span>${esc(customer.region)}</span></div>
          </div>
        </section>
      </div>
      <section class="order-detail-card">
        <h3>Products Ordered</h3>
        <div class="order-items-detail">
          ${items.length ? items.map(item => `
            <article class="order-item-detail">
              <div class="order-item-media">${orderItemImage(item)}</div>
              <div class="order-item-info">
                <h4>${esc(item.name || 'Product')}</h4>
                <p>Article: ${esc((AA.productById(item.productID) || {}).articleNo || item.productID || '—')}</p>
                <p>Color: ${esc(item.color || '—')} · Variant: ${esc(item.color || '—')}${item.size ? ' / ' + esc(item.size) : ''}</p>
                <p>Quantity: ${Number(item.quantity) || 0} · Unit price: ${AA.money(item.price)}</p>
              </div>
              <strong class="order-item-total">${AA.money((Number(item.price) || 0) * (Number(item.quantity) || 0))}</strong>
            </article>
          `).join('') : '<p class="section-note">No product details were saved with this order.</p>'}
        </div>
      </section>
      <div class="order-detail-grid">
        <section class="order-detail-card">
          <h3>Payment Information</h3>
          ${order.paymentProof && (order.paymentMethod === 'JazzCash' || order.paymentMethod === 'Easypaisa')
            ? `<button class="tbl-btn" type="button" onclick="viewPaymentProof('${esc(order.orderID)}')">View Screenshot</button>`
            : '<p class="section-note">' + (order.paymentMethod === 'COD' ? 'Cash on Delivery — no payment screenshot required.' : 'No payment proof uploaded.') + '</p>'}
        </section>
        <section class="order-detail-card">
          <h3>Order Status</h3>
          <div class="order-status-editor">
            <select class="co-select" id="detail-status-${esc(order.orderID)}">
              ${STATUS_OPTIONS.map(status => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
            <button class="admin-form-btn" type="button" onclick="saveOrderDetailsStatus('${esc(order.orderID)}')">Update Status</button>
          </div>
        </section>
      </div>
      <section class="order-detail-card order-total-card">
        <h3>Order Total</h3>
        <div class="order-total-lines">
          <div><span>Subtotal</span><strong>${AA.money(order.subtotal)}</strong></div>
          <div><span>Delivery Charges</span><strong>${AA.money(order.deliveryCharge)}</strong></div>
          <div class="order-grand-total"><span>Total</span><strong>${AA.money(order.totalAmount)}</strong></div>
        </div>
      </section>
    </div>
  `;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  modal.onclick = event => { if (event.target === modal) closeOrderDetails(); };
}

function closeOrderDetails() {
  const modal = document.getElementById('orderDetailModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

async function saveOrderDetailsStatus(orderID) {
  const select = document.getElementById('detail-status-' + orderID);
  if (!select) return;
  const result = await AA.updateOrderStatus(orderID, select.value);
  if (result.error) { toast(result.error, 'danger'); return; }
  renderOrdersTable();
  renderStats();
  openOrderDetails(orderID);
  toast('Order status updated', 'success');
}

async function viewPaymentProof(orderID) {
  const order = AA.orders().find(o => o.orderID === orderID);
  if (!order || !order.paymentProof) {
    toast('Payment screenshot unavailable.', 'danger');
    return;
  }
  // Screenshots are private: ask Supabase for a link that works for 2 minutes (admin only).
  const url = await AA.paymentProofUrl(order.paymentProof);
  let modal = document.getElementById('paymentProofModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'paymentProofModal';
    modal.className = 'payment-proof-modal';
    modal.innerHTML = '<div class="payment-proof-dialog" role="dialog" aria-modal="true"><button class="payment-proof-close" type="button" aria-label="Close">×</button><img alt="Payment proof"><p class="payment-proof-error">Payment screenshot unavailable.</p></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', event => { if (event.target === modal) closePaymentProof(); });
    modal.querySelector('.payment-proof-close').addEventListener('click', closePaymentProof);
  }
  const image = modal.querySelector('img');
  const error = modal.querySelector('.payment-proof-error');
  image.style.display = 'block';
  error.style.display = 'none';
  image.onload = () => { image.style.display = 'block'; error.style.display = 'none'; };
  image.onerror = () => { image.style.display = 'none'; error.style.display = 'block'; };
  if (url) image.src = url; else image.onerror();
  modal.classList.add('open');
}

function closePaymentProof() {
  const modal = document.getElementById('paymentProofModal');
  if (modal) modal.classList.remove('open');
}

async function verifyPayment(orderID, approve) {
  const result = await AA.verifyPayment(orderID, approve);
  if (result.error) { toast(result.error, 'danger'); return; }
  toast(approve ? 'Payment approved — order confirmed' : 'Payment rejected — order cancelled', approve ? 'success' : 'danger');
  renderOrdersTable();
  renderStats();
}

async function updateOrderStatus(orderID) {
  const result = await AA.updateOrderStatus(orderID, document.getElementById('status-' + orderID).value);
  if (result.error) { toast(result.error, 'danger'); renderOrdersTable(); return; }
  toast('Order status updated', 'success');
  renderOrdersTable();
  renderStats();
}

function renderDelivery() {
  const list = AA.deliveryCharges();
  document.getElementById('deliveryFormGrid').innerHTML = list.map(d => `
    <div class="form-group">
      <label class="f-lbl">${esc(d.region)}</label>
      <input class="f-inp" type="number" value="${d.amount}" id="dc-${d.chargeID}">
    </div>
  `).join('') + `<div class="form-group" style="align-self:end"><button class="admin-form-btn" onclick="saveDeliveryCharges()">Save Charges</button></div>`;
}

async function saveDeliveryCharges() {
  const list = AA.deliveryCharges().map(d => ({
    chargeID: d.chargeID,
    amount: Math.max(0, Number(document.getElementById('dc-' + d.chargeID).value) || 0),
  }));
  const result = await AA.saveDeliveryCharges(list);
  if (result.error) { toast(result.error, 'danger'); return; }
  renderDelivery();
  toast('Delivery charges updated', 'success');
}

async function addDeliveryRegion() {
  const name = document.getElementById('newRegionName').value.trim();
  const amount = Number(document.getElementById('newRegionCharge').value) || 0;
  if (!name) { toast('Enter a region name', 'danger'); return; }
  const result = await AA.addDeliveryRegion(name, amount);
  if (result.error) { toast(result.error, 'danger'); return; }
  document.getElementById('newRegionName').value = '';
  document.getElementById('newRegionCharge').value = '';
  renderDelivery();
  toast('Region added', 'success');
}

function renderCustomers() {
  const users = AA.users();
  const orders = AA.orders();
  const tbody = document.getElementById('customersTbody');
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="5" class="center-note">No registered customers yet.</td></tr>'; return; }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${esc(u.name)}</td>
      <td>${esc(u.phone)}</td>
      <td>${esc(u.email || '—')}</td>
      <td>${orders.filter(o => o.userID === u.userID).length}</td>
      <td>${AA.fmtDate(u.joined)}</td>
    </tr>
  `).join('');
}

function renderReviews() {
  const tbody = document.getElementById('reviewsTbody');
  if (!tbody) return;
  const reviews = [...AA.reviews()].reverse();
  if (!reviews.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="center-note">No reviews yet.</td></tr>';
    return;
  }
  tbody.innerHTML = reviews.map(review => {
    const product = AA.productById(review.productID);
    return `<tr>
      <td>${esc(product ? product.name : review.productID)}</td>
      <td>${esc(review.customerName || 'Customer')}</td>
      <td><span class="review-stars">${'★'.repeat(Number(review.rating) || 0)}${'☆'.repeat(5 - (Number(review.rating) || 0))}</span></td>
      <td>${esc(review.comment || '')}</td>
      <td>${AA.fmtDate(review.createdAt || review.date)}</td>
      <td><button class="tbl-btn del" type="button" onclick="deleteReview('${esc(review.reviewID)}')">Delete</button></td>
    </tr>`;
  }).join('');
}

async function deleteReview(reviewID) {
  if (!AA.reviews().find(item => item.reviewID === reviewID)) return;
  if (!window.confirm('Delete this review?')) return;
  const result = await AA.deleteReview(reviewID);
  if (result.error) { toast(result.error, 'danger'); return; }
  renderReviews();
  toast('Review deleted', 'success');
}

// BOOT: load everything the dashboard needs, make sure this is really the admin, then draw.
(async function bootAdminDashboard() {
  await AA.init({ orders: true, customers: true, reviews: true });
  if (!(await AA.requireAdmin())) return;      // not the admin -> sent to admin-login.html
  renderStats();
  renderOrdersTable();
  renderDelivery();
  renderCustomers();
  renderReviews();
})();
