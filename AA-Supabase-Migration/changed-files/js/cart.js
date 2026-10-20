/* ============================================================
   AA LEATHERS — CART & CHECKOUT (cart.html)
   FR-07 Cart, FR-10 Guest Checkout, FR-11 Checkout,
   FR-12 Payment Methods, FR-13 Manual Payment Verification,
   FR-14 Order Placement, FR-17 Delivery Charges
   ============================================================ */

let checkoutState = { region: '', method: '', proofFile: null, proofFileName: '' };

function renderCart() {
  const cart = AA.cart();
  const wrap = document.getElementById('cartContent');
  if (!cart.length) {
    wrap.innerHTML = `<div class="cart-empty"><strong>Your cart is empty</strong><p>Browse our collection to find your next wallet.</p>
      <a href="products.html" class="btn-gold" style="text-decoration:none;display:inline-block">Shop Now</a></div>`;
    return;
  }
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  wrap.innerHTML = `
    <div class="cart-layout">
      <div>
        <div class="cart-table-head">
          <div class="cart-col-head"></div>
          <div class="cart-col-head">Item</div>
          <div class="cart-col-head">Quantity</div>
          <div class="cart-col-head">Price</div>
          <div class="cart-col-head"></div>
        </div>
        <div id="cartRows"></div>
      </div>
      <div class="order-sum">
        <div class="os-title">Order Summary</div>
        <div class="os-row"><div class="os-lbl">Subtotal</div><div class="os-val">${AA.money(subtotal)}</div></div>
        <div class="os-row"><div class="os-lbl">Delivery</div><div class="os-val">Calculated at checkout</div></div>
        <div class="os-total-row"><div class="os-total-lbl">Estimated Total</div><div class="os-total-val">${AA.money(subtotal)}</div></div>
        <button class="checkout-btn" onclick="startCheckout()">Proceed to Checkout</button>
      </div>
    </div>
  `;
  const rowsWrap = document.getElementById('cartRows');
  rowsWrap.innerHTML = cart.map(item => `
    <div class="cart-row">
      <div class="cart-thumb">${AA.productThumb(item)}</div>
      <div>
        <div class="cart-item-name">${esc(item.name)}</div>
        <div class="cart-item-cat">${esc(item.color)} · ${esc(item.size)}</div>
      </div>
      <div class="qty-mini">
        <button onclick="changeCartQty('${item.cartItemId}',-1)">−</button>
        <span>${item.quantity}</span>
        <button onclick="changeCartQty('${item.cartItemId}',1)">+</button>
      </div>
      <div class="cart-item-price">${AA.money(item.price * item.quantity)}</div>
      <button class="cart-remove" onclick="removeCartItem('${item.cartItemId}')">✕</button>
    </div>
  `).join('');
}

function changeCartQty(id, delta) {
  const cart = AA.cart();
  const item = cart.find(i => i.cartItemId === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) return removeCartItem(id);
  AA.saveCart(cart);
  renderCart();
}

function removeCartItem(id) {
  AA.saveCart(AA.cart().filter(i => i.cartItemId !== id));
  renderCart();
}

/* ---------- Checkout flow ---------- */
function startCheckout() {
  if (!AA.cart().length) { toast('Your cart is empty', 'danger'); return; }
  document.getElementById('cartView').style.display = 'none';
  document.getElementById('checkoutView').style.display = 'block';

  const user = AA.session();
  if (user) {
    document.getElementById('custName').value = user.name || '';
    document.getElementById('custPhone').value = user.phone || '';
    document.getElementById('custAddress').value = user.address || '';
  }
  const regionSel = document.getElementById('custRegion');
  regionSel.innerHTML = AA.deliveryCharges().map(d => `<option value="${esc(d.region)}">${esc(d.region)} — ${AA.money(d.amount)}</option>`).join('');
  checkoutState.region = regionSel.value;
  regionSel.onchange = () => { checkoutState.region = regionSel.value; renderCoSidebar(); };

  goToStep(1);
  renderCoSidebar();
}

function goToStep(step) {
  ['Delivery', 'Payment', 'Review'].forEach((name, idx) => {
    document.getElementById('panel' + name).classList.toggle('active', idx === step - 1);
  });
  [1, 2, 3].forEach(n => {
    const tab = document.getElementById('step' + n + 'Tab');
    tab.classList.toggle('active', n === step);
    tab.classList.toggle('done', n < step);
  });
  if (step === 3) renderReview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectPayment(method) {
  checkoutState.method = method;
  ['COD', 'JazzCash', 'Easypaisa'].forEach(m => {
    document.getElementById('radio-' + m).classList.toggle('on', m === method);
    document.querySelector(`.pay-opt[data-method="${m}"]`).classList.toggle('selected', m === method);
  });
  const box = document.getElementById('manualPayBox');
  if (method === 'JazzCash' || method === 'Easypaisa') {
    box.style.display = 'block';
    document.getElementById('payAccountNumber').textContent = method === 'JazzCash' ? '0300-1234567' : '0300-7654321';
  } else {
    box.style.display = 'none';
  }
}

document.getElementById('paymentProof').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Please choose an image (screenshot) file', 'danger'); this.value = ''; return; }
  checkoutState.proofFile = file;                 // uploaded to Supabase Storage when the order is placed
  checkoutState.proofFileName = file.name;
  document.getElementById('proofFileName').textContent = 'Selected: ' + file.name;
});

function renderCoSidebar() {
  const cart = AA.cart();
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const delivery = AA.deliveryChargeFor(checkoutState.region);
  document.getElementById('coSumItems').innerHTML = cart.map(i => `
    <div class="co-sum-item"><div class="co-sum-iname">${esc(i.name)} × ${i.quantity}</div><div class="co-sum-iprice">${AA.money(i.price * i.quantity)}</div></div>
  `).join('');
  document.getElementById('coSubtotal').textContent = AA.money(subtotal);
  document.getElementById('coDelivery').textContent = AA.money(delivery);
  document.getElementById('coTotal').textContent = AA.money(subtotal + delivery);
}

function renderReview() {
  renderCoSidebar();
  const name = document.getElementById('custName').value || '—';
  const phone = document.getElementById('custPhone').value || '—';
  const address = document.getElementById('custAddress').value || '—';
  document.getElementById('reviewSummary').innerHTML = `
    <p class="section-note"><strong>Name:</strong> ${esc(name)}</p>
    <p class="section-note"><strong>Phone:</strong> ${esc(phone)}</p>
    <p class="section-note"><strong>Address:</strong> ${esc(address)}</p>
    <p class="section-note"><strong>Region:</strong> ${esc(checkoutState.region)}</p>
    <p class="section-note"><strong>Payment Method:</strong> ${esc(checkoutState.method || 'Not selected')}</p>
    ${(checkoutState.method === 'JazzCash' || checkoutState.method === 'Easypaisa')
      ? `<p class="section-note"><strong>Payment Proof:</strong> ${checkoutState.proofFileName ? esc(checkoutState.proofFileName) : '<span style="color:var(--danger)">Not uploaded yet</span>'}</p>`
      : ''}
  `;
}

let placingOrder = false;
async function placeOrder() {
  if (placingOrder) return;                       // stop double-clicks creating two orders
  const name = document.getElementById('custName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  const address = document.getElementById('custAddress').value.trim();
  if (!name || !phone || !address) { toast('Please fill in your delivery details', 'danger'); goToStep(1); return; }
  if (!checkoutState.method) { toast('Please select a payment method', 'danger'); goToStep(2); return; }
  if ((checkoutState.method === 'JazzCash' || checkoutState.method === 'Easypaisa') && !checkoutState.proofFile) {
    toast('Please upload your payment screenshot', 'danger'); goToStep(2); return;
  }

  placingOrder = true;
  const btn = document.querySelector('.co-place-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Placing order…'; }

  // The server re-checks prices, delivery charge and stock — we only send what the customer chose.
  const result = await AA.placeOrder({
    name, phone, address, region: checkoutState.region,
    method: checkoutState.method, proofFile: checkoutState.proofFile,
  });

  placingOrder = false;
  if (btn) { btn.disabled = false; btn.textContent = 'Place Order'; }
  if (result.error) { toast(result.error, 'danger'); return; }

  const isCOD = checkoutState.method === 'COD';
  AA.saveCart([]);
  document.getElementById('checkoutView').style.display = 'none';
  document.getElementById('confirmView').style.display = 'block';
  document.getElementById('confirmOrderId').textContent = 'Order ID: ' + result.orderID;
  document.getElementById('confirmMsg').textContent = isCOD
    ? 'Thank you! Your Cash on Delivery order is confirmed and will be prepared for delivery. Save your Order ID to track it.'
    : 'Thank you! We\'ll verify your payment shortly. Save your Order ID — you can check your order status anytime with it.';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Load the live catalog first, fix any out-of-date items in the saved cart, then draw the cart.
AA.init().then(() => {
  const notes = AA.refreshCart();
  notes.forEach(n => toast(n));
  renderCart();
});
