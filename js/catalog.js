/* ============================================================
   AA LEATHERS — CATALOG (products.html)
   FR-04 Search, FR-05 Filter/Sort, FR-06 Variants,
   FR-07 Add to Cart, FR-08 Wishlist, FR-18 Reviews
   ============================================================ */

let activeCategory = 'all';
let pdCurrentProduct = null;
let pdSelectedColor = null;
let pdQtyVal = 1;
let pdGalleryIndex = 0;

function renderCategoryFilters() {
  const wrap = document.getElementById('categoryFilters');
  const cats = AA.categories();
  const all = [{ categoryID: 'all', name: 'All' }, ...cats];
  wrap.innerHTML = all.map(c =>
    `<button class="filter-btn${c.categoryID === activeCategory ? ' active' : ''}" data-cat="${c.categoryID}">${esc(c.name)}</button>`
  ).join('');
  qsa('.filter-btn', wrap).forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      renderCategoryFilters();
      renderGrid();
    });
  });
}

function getFilteredSortedProducts() {
  const search = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  const sort = document.getElementById('sortSelect').value;
  let list = AA.products().filter(p => p.active);
  if (activeCategory !== 'all') list = list.filter(p => p.categoryID === activeCategory);
  if (search) {
    list = list.filter(p =>
      p.name.toLowerCase().includes(search) || p.articleNo.toLowerCase().includes(search)
    );
  }
  if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
  else if (sort === 'name-asc') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function totalStock(p) { return p.variants.reduce((s, v) => s + v.stock, 0); }

function productReviewSummary(productID) {
  const reviews = AA.reviews().filter(review => review.productID === productID);
  return {
    count: reviews.length,
    average: reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length : 0,
  };
}

function productRatingMarkup(productID) {
  const summary = productReviewSummary(productID);
  if (!summary.count) return '';
  const rounded = Math.round(summary.average);
  return `<div class="pc-rating">${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)} <span>${summary.average.toFixed(1)} (${summary.count})</span></div>`;
}

function renderGrid() {
  const grid = document.getElementById('shopGrid');
  const list = getFilteredSortedProducts();
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><strong>No wallets found</strong><p>Try a different search or category.</p></div>';
    return;
  }
  grid.innerHTML = list.map(p => `
    <div class="product-card">
      <div class="pc-img" onclick="openDetail('${p.productID}')">
        ${totalStock(p) <= 0 ? '<div class="pc-badge" style="background:var(--danger)">Out of Stock</div>' : ''}
        ${AA.productThumb(p)}
      </div>
      <div class="pc-body">
        <div class="pc-cat">${esc(AA.categoryName(p.categoryID))}</div>
        <div class="pc-name" onclick="openDetail('${p.productID}')" style="cursor:pointer">${esc(p.name)}</div>
        <div class="pc-desc">${esc(p.description.slice(0, 70))}${p.description.length > 70 ? '…' : ''}</div>
        ${productRatingMarkup(p.productID)}
        <div class="pc-foot">
          <div class="pc-price">${AA.money(p.price)}</div>
          <button class="pc-add" onclick="quickAdd('${p.productID}')">Add</button>
        </div>
        <div class="pc-view" onclick="openDetail('${p.productID}')">View Details</div>
      </div>
    </div>
  `).join('');
}

function quickAdd(productID) {
  const p = AA.productById(productID);
  if (!p) return;
  const variant = p.variants.find(v => v.stock > 0);
  if (!variant) { toast('This product is currently out of stock', 'danger'); return; }
  addToCart(p, variant, 1);
}

function addToCart(product, variant, qty) {
  const cart = AA.cart();
  const existing = cart.find(i => i.productID === product.productID && i.variantID === variant.variantID);
  if (existing) existing.quantity += qty;
  else {
    cart.push({
      cartItemId: AA.uid('ci'), productID: product.productID, variantID: variant.variantID,
      name: product.name, color: variant.color, size: variant.size, price: product.price,
      images: product.images, quantity: qty,
    });
  }
  AA.saveCart(cart);
  toast(product.name + ' added to cart', 'success');
}

function openDetail(productID) {
  const p = AA.productById(productID);
  if (!p) return;
  pdCurrentProduct = p;
  pdQtyVal = 1;
  pdGalleryIndex = 0;
  const colors = [...new Set(p.variants.map(v => v.color))];
  pdSelectedColor = null;

  document.getElementById('shopView').style.display = 'none';
  document.getElementById('detailView').style.display = 'block';
  renderPdGallery();
  document.getElementById('pdCategory').textContent = AA.categoryName(p.categoryID);
  document.getElementById('pdName').textContent = p.name;
  document.getElementById('pdArticle').textContent = 'Article No: ' + p.articleNo;
  document.getElementById('pdPrice').textContent = AA.money(p.price);
  document.getElementById('pdDescription').textContent = p.description;
  document.getElementById('pdQty').textContent = pdQtyVal;

  renderPdColors();
  renderPdSize();
  renderPdStock();
  renderPdReviews();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  history.replaceState(null, '', '#' + p.productID);
}

function renderPdColors() {
  const p = pdCurrentProduct;
  const colors = [...new Set(p.variants.map(v => v.color))];
  const swatchColor = { Black: '#1a1a1a', Brown: '#6b4423', 'Dark Brown': '#3b2415', Tan: '#c9a878' };
  const wrap = document.getElementById('pdColors');
  wrap.innerHTML = colors.map(c => `
    <div class="color-swatch${c === pdSelectedColor ? ' active' : ''}" title="${esc(c)}"
         style="background:${swatchColor[c] || '#8B6914'}" data-color="${esc(c)}"></div>
  `).join('');
  qsa('.color-swatch', wrap).forEach(sw => {
    sw.addEventListener('click', () => {
      pdSelectedColor = sw.dataset.color;
      renderPdColors();
      renderPdSize();
      renderPdStock();
      const variant = currentVariant();
      const variantIndex = galleryImages().findIndex(item => item.src === variant?.image);
      if (variantIndex >= 0) {
        pdGalleryIndex = variantIndex;
        renderPdGallery();
      }
    });
  });
}

function renderPdSize() {
  const p = pdCurrentProduct;
  const sizes = pdSelectedColor
    ? [...new Set(p.variants.filter(v => v.color === pdSelectedColor).map(v => v.size))]
    : [];
  const sel = document.getElementById('pdSize');
  sel.innerHTML = sizes.length
    ? sizes.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')
    : '<option value="">Select a color first</option>';
  sel.disabled = !pdSelectedColor;
  sel.onchange = () => { renderPdGallery(); renderPdStock(); };
  renderPdGallery();
}

function currentVariant() {
  const p = pdCurrentProduct;
  if (!pdSelectedColor) return null;
  const size = document.getElementById('pdSize').value;
  return p.variants.find(v => v.color === pdSelectedColor && v.size === size);
}

function renderPdStock() {
  const v = currentVariant();
  const el = document.getElementById('pdStock');
  if (!v) { el.textContent = 'Select a variant'; el.className = 'pd-instock'; }
  else if (v.stock <= 0) { el.textContent = 'Out of Stock'; el.className = 'pd-instock badge-outstock'; }
  else { el.textContent = v.stock + ' in stock'; el.className = 'pd-instock badge-instock'; }
}

function productGalleryImages() {
  return galleryImages().map(item => item.src);
}

function galleryImages() {
  const images = [];
  const seen = new Set();
  const add = (src, variant) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    images.push({ src, variant: variant || null });
  };
  (pdCurrentProduct.images || []).forEach(src => add(src));
  (pdCurrentProduct.variants || []).forEach(variant => add(variant.image, variant));
  return images;
}

function renderPdGallery() {
  if (!pdCurrentProduct) return;
  const variant = currentVariant();
  const variantImage = variant && variant.image ? variant.image : '';
  const images = galleryImages().map(item => item.src);
  const main = variantImage || images[pdGalleryIndex] || images[0];
  const viewer = document.getElementById('pdIcon');
  if (main) viewer.innerHTML = `<img src="${main}" alt="${esc(pdCurrentProduct.name)}" class="pd-main-image">`;
  else viewer.innerHTML = AA.productThumb(pdCurrentProduct);

  const controls = document.getElementById('pdGalleryControls');
  controls.innerHTML = images.length < 2 ? '' :
    `<button type="button" class="pd-gallery-arrow" data-gallery-prev aria-label="Previous product image">‹</button>` +
    images.map((src, idx) =>
      `<button type="button" class="pd-gallery-thumb${idx === pdGalleryIndex ? ' active' : ''}" data-gallery-index="${idx}"><img src="${src}" alt="Product image ${idx + 1}"></button>`
    ).join('') +
    `<button type="button" class="pd-gallery-arrow" data-gallery-next aria-label="Next product image">›</button>`;
  const showGalleryImage = (index) => {
    pdGalleryIndex = (index + images.length) % images.length;
    viewer.innerHTML = `<img src="${images[pdGalleryIndex]}" alt="${esc(pdCurrentProduct.name)}" class="pd-main-image">`;
    qsa('.pd-gallery-thumb', controls).forEach(item => item.classList.toggle('active', Number(item.dataset.galleryIndex) === pdGalleryIndex));
  };
  const previous = controls.querySelector('[data-gallery-prev]');
  const next = controls.querySelector('[data-gallery-next]');
  if (previous) previous.addEventListener('click', () => showGalleryImage(pdGalleryIndex - 1));
  if (next) next.addEventListener('click', () => showGalleryImage(pdGalleryIndex + 1));
  qsa('[data-gallery-index]', controls).forEach(button => button.addEventListener('click', () => {
    showGalleryImage(Number(button.dataset.galleryIndex));
  }));
}

function renderPdReviews() {
  const list = AA.reviews().filter(r => r.productID === pdCurrentProduct.productID);
  const wrap = document.getElementById('pdReviews');
  const user = AA.session();
  const summary = productReviewSummary(pdCurrentProduct.productID);
  const mine = user && list.find(review => review.customerID === user.userID);
  const averageStars = summary.count ? `${'★'.repeat(Math.round(summary.average))}${'☆'.repeat(5 - Math.round(summary.average))}` : '☆☆☆☆☆';
  wrap.innerHTML = `
    <div class="review-summary">
      <div class="review-average">${summary.average ? summary.average.toFixed(1) : '0.0'} <span>★</span></div>
      <div class="review-summary-copy"><div class="review-stars">${averageStars}</div><div>Based on ${summary.count} review${summary.count === 1 ? '' : 's'}</div></div>
    </div>
    <div class="review-form-card">
      <h3>${mine ? 'Edit Your Review' : 'Write a Review'}</h3>
      <div class="review-form-label">Your Rating</div>
      <div class="review-rating-input" role="radiogroup" aria-label="Your rating">
        ${[1, 2, 3, 4, 5].map(rating => `<button type="button" class="review-star-choice${mine && mine.rating >= rating ? ' selected' : ''}" data-rating="${rating}" aria-label="${rating} star${rating === 1 ? '' : 's'}">${mine && mine.rating >= rating ? '★' : '☆'}</button>`).join('')}
      </div>
      <textarea class="review-textarea" id="reviewComment" maxlength="500" placeholder="Share your experience with this product...">${mine ? esc(mine.comment) : ''}</textarea>
      <div class="review-form-footer"><span class="review-form-message" id="reviewFormMessage"></span><button type="button" class="admin-form-btn" id="submitReviewBtn">${mine ? 'Update Review' : 'Submit Review'}</button></div>
    </div>
    <div class="review-list">
      ${list.length ? list.map(review => `
        <article class="product-review">
          <div class="product-review-head"><strong>${esc(review.customerName || 'Customer')}</strong><span>${AA.fmtDate(review.createdAt || review.date)}</span></div>
          <div class="review-stars">${'★'.repeat(Number(review.rating))}${'☆'.repeat(5 - Number(review.rating))}</div>
          <p>${esc(review.comment)}</p>
        </article>
      `).join('') : '<p class="section-note">No reviews yet. Be the first to share your experience.</p>'}
    </div>
  `;
  let selectedRating = mine ? Number(mine.rating) : 0;
  const ratingButtons = qsa('.review-star-choice', wrap);
  ratingButtons.forEach(button => button.addEventListener('click', () => {
    selectedRating = Number(button.dataset.rating);
    ratingButtons.forEach(star => {
      const active = Number(star.dataset.rating) <= selectedRating;
      star.classList.toggle('selected', active);
      star.textContent = active ? '★' : '☆';
    });
  }));
  document.getElementById('submitReviewBtn').addEventListener('click', () => saveProductReview(selectedRating));
}

async function saveProductReview(rating) {
  const message = document.getElementById('reviewFormMessage');
  const user = AA.session();
  if (!user) {
    message.innerHTML = 'Please <a href="login.html">login</a> to submit a review.';
    message.className = 'review-form-message error';
    return;
  }
  const comment = document.getElementById('reviewComment').value.trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    message.textContent = 'Please select a rating from 1 to 5 stars.';
    message.className = 'review-form-message error';
    return;
  }
  if (comment.length < 3 || comment.length > 500) {
    message.textContent = 'Please write between 3 and 500 characters.';
    message.className = 'review-form-message error';
    return;
  }
  const btn = document.getElementById('submitReviewBtn');
  btn.disabled = true;
  const result = await AA.saveReview(pdCurrentProduct.productID, rating, comment);
  btn.disabled = false;
  if (result.error) {
    message.textContent = result.error;
    message.className = 'review-form-message error';
    return;
  }
  renderPdReviews();
  renderGrid();
  toast(result.updated ? 'Review updated' : 'Review submitted', 'success');
}

function pdChangeQty(delta) {
  pdQtyVal = Math.max(1, pdQtyVal + delta);
  document.getElementById('pdQty').textContent = pdQtyVal;
}

function pdAddToCart() {
  const v = currentVariant();
  if (!v || v.stock <= 0) { toast('Selected variant is out of stock', 'danger'); return; }
  if (pdQtyVal > v.stock) { toast('Only ' + v.stock + ' left in stock', 'danger'); return; }
  addToCart(pdCurrentProduct, v, pdQtyVal);
}

function pdAddToWishlist() {
  const wishlist = AA.wishlist();
  if (!wishlist.includes(pdCurrentProduct.productID)) {
    wishlist.push(pdCurrentProduct.productID);
    AA.saveWishlist(wishlist);
    toast('Added to wishlist', 'success');
  } else {
    toast('Already in your wishlist');
  }
}

function showShop() {
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('shopView').style.display = 'block';
  history.replaceState(null, '', 'products.html');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('searchInput').addEventListener('input', renderGrid);
document.getElementById('sortSelect').addEventListener('change', renderGrid);

// Load products / categories / reviews from Supabase, then draw the page.
document.getElementById('shopGrid').innerHTML = '<div class="center-note" style="grid-column:1/-1">Loading wallets…</div>';
AA.init({ reviews: true }).then(() => {
  renderCategoryFilters();
  renderGrid();

  // Deep link support: products.html#AA101
  if (location.hash) {
    const id = location.hash.slice(1);
    if (AA.productById(id)) openDetail(id);
  }
});
