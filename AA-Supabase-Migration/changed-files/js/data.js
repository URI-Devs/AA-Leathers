/* ============================================================
   AA LEATHERS — SHARED DATA LAYER  (Supabase version)

   How it works:
   - Products, categories, delivery charges (and, when a page asks,
     reviews / orders / customers) are loaded from Supabase ONCE per
     page by `await AA.init({...})` and kept in a small in-memory
     cache. After that, the render code reads them with the same
     synchronous calls as before: AA.products(), AA.reviews(), ...
   - Writing data (orders, reviews, inventory...) is done with the
     async methods below (AA.placeOrder, AA.saveReview, ...).
   - The cart and wishlist stay in localStorage (per-device on purpose).
   - Real protection lives in the database (Row Level Security) — see
     supabase/1-schema.sql. Nothing in this file is "trusted".
   ============================================================ */

const AA = {
  KEYS: { CART: 'aa_cart', WISHLIST: 'aa_wishlist' },

  // in-memory cache (filled by AA.init)
  _products: [], _categories: [], _deliveryCharges: [],
  _reviews: [], _orders: [], _customers: [],
  _profile: null,          // the logged-in person's profile (customer OR admin), or null
  sessionReady: null,      // promise: resolves once we know who is logged in


  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : (fallback !== undefined ? fallback : null);
    } catch (e) { return fallback !== undefined ? fallback : null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full/unavailable */ }
  },
  uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },
  money(n) {
    n = Number(n) || 0;
    return 'Rs. ' + n.toLocaleString('en-PK');
  },
  todayISO() { return new Date().toISOString(); },
  fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch (e) { return iso; }
  },
  // Returns inner HTML for a product's thumbnail: an uploaded photo if present,
  // else a minimalist gold wallet mark that matches the site's theme.
  WALLET_SVG: '<svg viewBox="0 0 64 64" class="wallet-icon-svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="16" width="52" height="36" rx="4"/><path d="M6 27h52"/><rect x="38" y="30" width="16" height="11" rx="2"/><circle cx="46" cy="35.5" r="1.7" fill="currentColor" stroke="none"/></svg>',
  productThumb(p, cls) {
    cls = cls || 'wallet-icon';
    if (p.images && p.images.length && p.images[0]) {
      return `<img src="${p.images[0]}" alt="${esc ? esc(p.name) : p.name}" style="width:100%;height:100%;object-fit:cover">`;
    }
    return `<span class="${cls}">${AA.WALLET_SVG}</span>`;
  },

  // Compresses an image file to a small JPEG data URL (for localStorage-friendly storage).
  compressImage(file, maxDim, quality) {
    maxDim = maxDim || 500; quality = quality || 0.72;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxDim) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else if (height > maxDim) { width = Math.round(width * (maxDim / height)); height = maxDim; }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  // ============================================================
  // MAPPERS (database row -> the object shapes your pages already use)
  // ============================================================
  _mapProfile(r) { return { userID: r.id, name: r.name || '', phone: r.phone || '', email: r.email || '', address: r.address || '', role: r.role, joined: r.created_at }; },
  _mapProduct(r) {
    return { productID: r.product_id, name: r.name, articleNo: r.article_no, categoryID: r.category_id,
      description: r.description || '', price: Number(r.price), variants: r.variants || [], images: r.images || [], active: r.active };
  },
  _mapReview(r) {
    return { reviewID: r.review_id, productID: r.product_id, customerID: r.user_id, customerName: r.customer_name,
      rating: r.rating, comment: r.comment, createdAt: r.created_at, updatedAt: r.updated_at };
  },
  _mapOrder(r) {
    return { orderID: r.order_id, userID: r.user_id, customerName: r.customer_name, customerEmail: r.customer_email || '',
      customerPhone: r.customer_phone, deliveryAddress: r.delivery_address, region: r.region, items: r.items || [],
      subtotal: Number(r.subtotal), deliveryCharge: Number(r.delivery_charge), totalAmount: Number(r.total_amount),
      paymentMethod: r.payment_method, paymentStatus: r.payment_status,
      paymentProof: r.payment_proof_path || null,        // a storage PATH; use AA.paymentProofUrl() to view it
      status: r.status, orderDate: r.order_date };
  },
  _friendlyError(error) {
    if (!error) return null;
    if (error.code === '42501') return 'You are not allowed to do that.';
    if (error.code === '23505') return 'That already exists.';
    return error.message || 'Something went wrong. Please try again.';
  },

  // ============================================================
  // LOADING  — call once at the start of every page
  // ============================================================
  async loadSession() {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { AA._profile = null; return null; }
      const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      AA._profile = (!error && data) ? AA._mapProfile(data) : null;
    } catch (e) { AA._profile = null; }
    return AA._profile;
  },
  async loadProducts() {
    const { data, error } = await sb.from('products').select('*').order('name');
    if (error) { console.error('loadProducts', error); return false; }
    AA._products = data.map(AA._mapProduct); return true;
  },
  async loadCategories() {
    const { data, error } = await sb.from('categories').select('*').order('name');
    if (error) { console.error('loadCategories', error); return false; }
    AA._categories = data.map(r => ({ categoryID: r.category_id, name: r.name })); return true;
  },
  async loadDeliveryCharges() {
    const { data, error } = await sb.from('delivery_charges').select('*').order('amount');
    if (error) { console.error('loadDeliveryCharges', error); return false; }
    AA._deliveryCharges = data.map(r => ({ chargeID: r.charge_id, region: r.region, amount: Number(r.amount) })); return true;
  },
  async loadReviews() {
    const { data, error } = await sb.from('reviews').select('*').order('created_at', { ascending: true });
    if (error) { console.error('loadReviews', error); return false; }
    AA._reviews = data.map(AA._mapReview); return true;
  },
  // For a customer this returns THEIR orders; for the admin it returns ALL orders (database decides).
  async loadOrders() {
    const { data, error } = await sb.from('orders').select('*').order('order_date', { ascending: true });
    if (error) { console.error('loadOrders', error); return false; }
    AA._orders = data.map(AA._mapOrder); return true;
  },
  async loadCustomers() {   // admin only
    const { data, error } = await sb.from('profiles').select('*').eq('role', 'customer').order('created_at', { ascending: true });
    if (error) { console.error('loadCustomers', error); return false; }
    AA._customers = data.map(AA._mapProfile); return true;
  },
  // usage:  await AA.init();   or   await AA.init({ reviews: true, orders: true, customers: true });
  async init(opts) {
    opts = opts || {};
    await AA.sessionReady;
    const jobs = [AA.loadProducts(), AA.loadCategories(), AA.loadDeliveryCharges()];
    if (opts.reviews) jobs.push(AA.loadReviews());
    if (opts.orders) jobs.push(AA.loadOrders());
    if (opts.customers) jobs.push(AA.loadCustomers());
    const results = await Promise.all(jobs);
    if (results.includes(false) && typeof toast === 'function') {
      toast('Could not load the latest data. Please refresh the page.', 'danger');
    }
    AA.updateCartBadge();
  },

  // ============================================================
  // SYNC GETTERS (read the cache — same names your pages already use)
  // ============================================================
  products() { return AA._products; },
  productById(id) { return AA._products.find(p => p.productID === id); },
  categories() { return AA._categories; },
  categoryName(id) { const c = AA._categories.find(c => c.categoryID === id); return c ? c.name : 'Uncategorised'; },
  deliveryCharges() { return AA._deliveryCharges; },
  deliveryChargeFor(region) {
    const d = AA._deliveryCharges.find(d => d.region === region);
    return d ? d.amount : (AA._deliveryCharges[0] ? AA._deliveryCharges[0].amount : 0);
  },
  reviews() { return AA._reviews; },
  orders() { return AA._orders; },
  orderById(id) { return AA._orders.find(o => o.orderID === id); },
  users() { return AA._customers; },
  session() { return AA._profile && AA._profile.role !== 'admin' ? AA._profile : null; },
  adminSession() { return AA._profile && AA._profile.role === 'admin' ? AA._profile : null; },

  cart() { return AA.get(AA.KEYS.CART, []); },
  saveCart(list) { AA.set(AA.KEYS.CART, list); AA.updateCartBadge(); },
  cartCount() { return AA.cart().reduce((s, i) => s + i.quantity, 0); },
  updateCartBadge() {
    document.querySelectorAll('[data-cart-count]').forEach(el => { el.textContent = AA.cartCount(); });
  },
  wishlist() { return AA.get(AA.KEYS.WISHLIST, []); },
  saveWishlist(list) { AA.set(AA.KEYS.WISHLIST, list); },

  // Re-checks the saved cart against the live catalog (prices change, items sell out).
  // Returns a list of human-readable notes to show the customer.
  refreshCart() {
    const notes = [];
    const next = [];
    AA.cart().forEach(line => {
      const p = AA.productById(line.productID);
      const v = p && p.variants.find(v => v.variantID === line.variantID);
      if (!p || !p.active || !v) { notes.push(line.name + ' is no longer available and was removed from your cart.'); return; }
      if (v.stock <= 0) { notes.push(p.name + ' (' + v.color + ') is out of stock and was removed.'); return; }
      if (line.quantity > v.stock) { notes.push('Only ' + v.stock + ' left of ' + p.name + ' (' + v.color + '); quantity reduced.'); line.quantity = v.stock; }
      if (line.price !== p.price) { notes.push('The price of ' + p.name + ' changed to ' + AA.money(p.price) + '.'); line.price = p.price; }
      line.name = p.name; line.images = p.images;
      next.push(line);
    });
    if (notes.length) AA.saveCart(next);
    return notes;
  },

  // ============================================================
  // CUSTOMER AUTH (Supabase Auth — passwords are hashed by Supabase)
  // ============================================================
  async signUp({ name, email, password }) {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
    if (error) return { error: error.message };
    // Supabase hides "already registered" by returning a user with no identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: 'An account with this email already exists.' };
    }
    if (!data.session) return { error: null, needsConfirmation: true };   // email-confirmation is ON
    await AA.loadSession();
    return { error: null };
  },
  async signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message === 'Invalid login credentials' ? 'Invalid email or password.' : error.message };
    await AA.loadSession();
    return { error: null };
  },
  async signOut() { await sb.auth.signOut(); AA._profile = null; },
  async updateProfile(fields) {          // { name, phone, address }
    if (!AA._profile) return { error: 'Please log in again.' };
    const { data, error } = await sb.from('profiles').update(fields).eq('id', AA._profile.userID).select().single();
    if (error) return { error: AA._friendlyError(error) };
    AA._profile = AA._mapProfile(data);
    return { error: null };
  },

  // ADMIN auth: a normal Supabase user whose profile role is 'admin'. There is no admin password in the code.
  async adminSignIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { error: 'Invalid admin credentials.' };
    await AA.loadSession();
    if (!AA.adminSession()) { await AA.signOut(); return { error: 'Invalid admin credentials.' }; }
    return { error: null };
  },
  // NOTE: this only decides what the page *shows*. The database refuses admin data to non-admins anyway.
  async requireAdmin() {
    await AA.sessionReady;
    if (!AA.adminSession()) { location.href = 'admin-login.html'; return null; }
    return AA.adminSession();
  },
  async updateAdminPassword(password) {
    const { error } = await sb.auth.updateUser({ password });
    return { error: error ? error.message : null };
  },

  // ============================================================
  // ORDERS
  // ============================================================
  _dataUrlToBlob(dataUrl) {
    const [head, b64] = dataUrl.split(',');
    const mime = (head.match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const bin = atob(b64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  },
  // o = { name, phone, address, region, method, proofFile }
  // The server recomputes prices / delivery / stock from the cart lines — we only send ids + quantities.
  async placeOrder(o) {
    let proofPath = null;
    if (o.method !== 'COD') {
      if (!o.proofFile) return { error: 'Please upload your payment screenshot.' };
      let blob;
      try { blob = AA._dataUrlToBlob(await AA.compressImage(o.proofFile, 1400, 0.8)); }
      catch (e) { return { error: 'That file is not a valid image. Please upload a screenshot (JPG/PNG).' }; }
      const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : AA.uid('p');
      proofPath = 'proofs/' + id + '.jpg';
      const up = await sb.storage.from('payment-proofs').upload(proofPath, blob, { contentType: 'image/jpeg' });
      if (up.error) return { error: 'Could not upload your screenshot. Please try again.' };
    }
    const items = AA.cart().map(i => ({ productID: i.productID, variantID: i.variantID, quantity: i.quantity }));
    const { data, error } = await sb.rpc('place_order', {
      p_customer_name: o.name, p_customer_phone: o.phone, p_delivery_address: o.address,
      p_region: o.region, p_payment_method: o.method, p_payment_proof_path: proofPath, p_items: items,
    });
    if (error) return { error: error.message };
    return { error: null, orderID: data };
  },
  // Guest-friendly lookup by Order ID (no login needed). Returns null if not found.
  async trackOrder(orderID) {
    const { data, error } = await sb.rpc('track_order_public', { p_order_id: orderID });
    if (error || !data || !data.length) return null;
    const r = data[0];
    return { orderID: r.order_id, status: r.status, paymentStatus: r.payment_status, paymentMethod: r.payment_method,
      totalAmount: Number(r.total_amount), orderDate: r.order_date, items: r.items || [] };
  },
  async _updateOrder(orderID, fields) {
    const { data, error } = await sb.from('orders').update(fields).eq('order_id', orderID).select().maybeSingle();
    if (error) return { error: AA._friendlyError(error) };
    if (!data) return { error: 'Order not found or you are not allowed to change it.' };
    const idx = AA._orders.findIndex(o => o.orderID === orderID);
    if (idx >= 0) AA._orders[idx] = AA._mapOrder(data);
    return { error: null };
  },
  updateOrderStatus(orderID, status) { return AA._updateOrder(orderID, { status }); },
  verifyPayment(orderID, approve) {
    return AA._updateOrder(orderID, approve
      ? { payment_status: 'Verified', status: 'Confirmed' }
      : { payment_status: 'Rejected', status: 'Cancelled' });
  },
  // Payment screenshots are private. This makes a link that works for 2 minutes (admin only).
  async paymentProofUrl(path) {
    if (!path) return null;
    const { data, error } = await sb.storage.from('payment-proofs').createSignedUrl(path, 120);
    return error ? null : data.signedUrl;
  },

  // ============================================================
  // REVIEWS
  // ============================================================
  async saveReview(productID, rating, comment) {
    const user = AA.session();
    if (!user) return { error: 'Please log in to submit a review.' };
    const existing = AA._reviews.find(r => r.productID === productID && r.customerID === user.userID);
    const res = existing
      ? await sb.from('reviews').update({ rating, comment }).eq('review_id', existing.reviewID).select().maybeSingle()
      : await sb.from('reviews').insert({ product_id: productID, user_id: user.userID, rating, comment }).select().maybeSingle();
    if (res.error) {
      if (res.error.code === '42501') return { error: 'You can review a product after you have ordered it.' };
      return { error: AA._friendlyError(res.error) };
    }
    await AA.loadReviews();
    return { error: null, updated: !!existing };
  },
  async deleteReview(reviewID) {      // admin
    const { data, error } = await sb.from('reviews').delete().eq('review_id', reviewID).select();
    if (error) return { error: AA._friendlyError(error) };
    if (!data.length) return { error: 'Review not found or not allowed.' };
    AA._reviews = AA._reviews.filter(r => r.reviewID !== reviewID);
    return { error: null };
  },

  // ============================================================
  // ADMIN: categories, products, delivery charges
  // ============================================================
  async saveCategory(name) {
    const { error } = await sb.from('categories').insert({ category_id: AA.uid('cat'), name });
    if (error) return { error: AA._friendlyError(error) };
    await AA.loadCategories(); return { error: null };
  },
  async deleteCategory(categoryID) {
    const { error } = await sb.from('categories').delete().eq('category_id', categoryID);
    if (error) return { error: AA._friendlyError(error) };
    await AA.loadCategories(); return { error: null };
  },
  // Photos picked in the admin form are still "data:" URLs in memory. Before saving we upload
  // them to the public product-images bucket and store only the short https URL in the database.
  async _uploadIfNeeded(src, folder) {
    if (!src || !String(src).startsWith('data:')) return src || '';
    const blob = AA._dataUrlToBlob(src);
    const path = folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
    const { error } = await sb.storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (error) throw new Error('Image upload failed: ' + error.message);
    return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  },
  // product = { productID?, name, articleNo, categoryID, description, price, variants, images, active }
  async saveProduct(product, isNew) {
    try {
      const folder = product.productID || product.articleNo;
      const images = [];
      for (const img of (product.images || [])) images.push(await AA._uploadIfNeeded(img, folder));
      const variants = [];
      for (const v of (product.variants || [])) variants.push({ ...v, image: await AA._uploadIfNeeded(v.image, folder) });
      const row = { name: product.name, article_no: product.articleNo, category_id: product.categoryID || null,
        description: product.description, price: product.price, variants, images, active: product.active };
      const res = isNew
        ? await sb.from('products').insert({ product_id: product.productID || product.articleNo, ...row })
        : await sb.from('products').update(row).eq('product_id', product.productID);
      if (res.error) return { error: res.error.code === '23505' ? 'A product with that article number already exists.' : AA._friendlyError(res.error) };
    } catch (e) { return { error: e.message }; }
    await AA.loadProducts(); return { error: null };
  },
  async setProductActive(productID, active) {
    const { error } = await sb.from('products').update({ active }).eq('product_id', productID);
    if (error) return { error: AA._friendlyError(error) };
    await AA.loadProducts(); return { error: null };
  },
  async deleteProduct(productID) {
    const { error } = await sb.from('products').delete().eq('product_id', productID);
    if (error) return { error: AA._friendlyError(error) };
    await AA.loadProducts(); return { error: null };
  },
  async saveDeliveryCharges(list) {     // list = [{ chargeID, amount }]
    const results = await Promise.all(list.map(d => sb.from('delivery_charges').update({ amount: d.amount }).eq('charge_id', d.chargeID)));
    const failed = results.find(r => r.error);
    if (failed) return { error: AA._friendlyError(failed.error) };
    await AA.loadDeliveryCharges(); return { error: null };
  },
  async addDeliveryRegion(region, amount) {
    const { error } = await sb.from('delivery_charges').insert({ charge_id: AA.uid('dc'), region, amount });
    if (error) return { error: error.code === '23505' ? 'That region already exists.' : AA._friendlyError(error) };
    await AA.loadDeliveryCharges(); return { error: null };
  },

  // ============================================================
  // CONTACT FORM
  // ============================================================
  async sendContactMessage(name, contact, message) {
    const { error } = await sb.from('contact_messages').insert({ name, contact, message });
    return { error: error ? 'Could not send your message. Please try again.' : null };
  },
};

// Start working out who is logged in straight away; pages wait for it via `await AA.init()`.
AA.sessionReady = AA.loadSession();
