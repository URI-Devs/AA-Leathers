(async function () {
  await AA.init({ reviews: true });
  const grid = document.getElementById('featuredGrid');
  if (grid) {
    const featured = AA.products().filter(p => p.active).slice(0, 3);
    grid.innerHTML = featured.map(p => `
      <div class="hcard" onclick="location.href='products.html#${p.productID}'">
        <div class="hcard-img">${AA.productThumb(p)}</div>
        <div class="hcard-body">
          <div class="hcard-cat">${esc(AA.categoryName(p.categoryID))}</div>
          <div class="hcard-name">${esc(p.name)}</div>
          <div class="hcard-desc">${esc(p.description.slice(0, 80))}${p.description.length > 80 ? '…' : ''}</div>
          <div class="hcard-foot">
            <div class="hcard-price">${AA.money(p.price)}</div>
            <button class="hcard-add" onclick="event.stopPropagation();location.href='products.html#${p.productID}'">View</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  const reviewsGrid = document.getElementById('reviewsGrid');
  if (reviewsGrid) {
    const reviews = AA.reviews().slice(-3).reverse();          // the 3 newest real reviews
    if (!reviews.length) reviewsGrid.closest('section').style.display = 'none';   // no reviews yet -> hide the block
    reviewsGrid.innerHTML = reviews.map(r => `
      <div class="review-card">
        <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
        <div class="review-quote-mark">"</div>
        <div class="review-text">${esc(r.comment)}</div>
        <div class="review-author">${esc(r.customerName)}</div>
        <div class="review-loc">Verified Buyer</div>
      </div>
    `).join('');
  }
})();
