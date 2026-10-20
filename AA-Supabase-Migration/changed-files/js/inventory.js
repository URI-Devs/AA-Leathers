/* ============================================================
   AA LEATHERS — INVENTORY MANAGER (admin-inventory.html)
   FR-01 Product Management, FR-02 Product Info, FR-03 Categories,
   FR-06 Variants, FR-16 Inventory/Stock, FR-20 Multiple Images
   ============================================================ */

let formVariants = [];
let formImages = [];

function renderCategoryChips() {
  const cats = AA.categories();
  document.getElementById('categoryChips').innerHTML = cats.map(c => `
    <span class="status-pill status-confirmed" style="display:inline-flex;align-items:center;gap:.5rem">
      ${esc(c.name)}
      <button onclick="deleteCategory('${c.categoryID}')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.7rem">✕</button>
    </span>
  `).join('') || '<span class="section-note">No categories yet.</span>';

  const sel = document.getElementById('productCategory');
  sel.innerHTML = cats.map(c => `<option value="${c.categoryID}">${esc(c.name)}</option>`).join('');
}

async function addCategory() {
  const name = document.getElementById('newCategoryName').value.trim();
  if (!name) { toast('Enter a category name', 'danger'); return; }
  const result = await AA.saveCategory(name);
  if (result.error) { toast(result.error, 'danger'); return; }
  document.getElementById('newCategoryName').value = '';
  renderCategoryChips();
  toast('Category added', 'success');
}

async function deleteCategory(id) {
  const inUse = AA.products().some(p => p.categoryID === id);
  if (inUse) { toast('Cannot delete — products are using this category', 'danger'); return; }
  const result = await AA.deleteCategory(id);
  if (result.error) { toast(result.error, 'danger'); return; }
  renderCategoryChips();
}

/* ---------- Variant builder ---------- */
function renderVariantsTable() {
  const tbody = document.getElementById('variantsTbody');
  if (!formVariants.length) { tbody.innerHTML = '<tr><td colspan="5" class="center-note">No variants added yet.</td></tr>'; return; }
  tbody.innerHTML = formVariants.map((v, idx) => `
    <tr><td>${esc(v.color)}</td><td>${esc(v.size)}</td><td>${v.stock}</td>
    <td>
      <div class="variant-image-control">
        <label class="nav-btn variant-image-button">Upload Picture
          <input type="file" accept="image/*" data-variant-image="${idx}" hidden>
        </label>
        ${v.image ? `<img class="variant-image-preview" src="${v.image}" alt="${esc(v.color)} variant preview">` : '<span class="variant-image-empty">No image</span>'}
      </div>
    </td>
    <td><button class="tbl-btn del" onclick="removeVariantRow(${idx})">Remove</button></td></tr>
  `).join('');
  qsa('[data-variant-image]', tbody).forEach(input => input.addEventListener('change', uploadVariantImage));
}

async function uploadVariantImage(event) {
  const input = event.currentTarget;
  const idx = Number(input.dataset.variantImage);
  const file = input.files[0];
  if (!file || !formVariants[idx]) return;
  try {
    formVariants[idx].image = await AA.compressImage(file, 500, 0.72);
    renderVariantsTable();
  } catch (e) {
    toast('Could not read that image', 'danger');
  }
  input.value = '';
}

function addVariantRow() {
  const color = document.getElementById('variantColor').value.trim();
  const size = document.getElementById('variantSize').value.trim();
  const stock = Number(document.getElementById('variantStock').value) || 0;
  if (!color || !size) { toast('Enter both color and size', 'danger'); return; }
  formVariants.push({ variantID: AA.uid('v'), color, size, stock, image: '' });
  document.getElementById('variantColor').value = '';
  document.getElementById('variantSize').value = '';
  document.getElementById('variantStock').value = '';
  renderVariantsTable();
}

function removeVariantRow(idx) {
  formVariants.splice(idx, 1);
  renderVariantsTable();
}

/* ---------- Image upload ---------- */
document.getElementById('productImages').addEventListener('change', async function () {
  const files = Array.from(this.files);
  for (const file of files) {
    try {
      const dataUrl = await AA.compressImage(file, 500, 0.72);
      formImages.push(dataUrl);
    } catch (e) { /* skip unreadable file */ }
  }
  this.value = '';
  renderImagePreviews();
});

function renderImagePreviews() {
  const wrap = document.getElementById('imagePreviews');
  wrap.innerHTML = formImages.map((src, idx) => `
    <div style="position:relative">
      <img src="${src}" style="width:64px;height:64px;object-fit:cover;border:1px solid rgba(201,168,76,0.3)">
      <button onclick="removeImage(${idx})" style="position:absolute;top:-6px;right:-6px;background:var(--danger);color:#fff;border:none;width:18px;height:18px;border-radius:50%;cursor:pointer;font-size:.6rem;line-height:1">✕</button>
    </div>
  `).join('');
}

function removeImage(idx) {
  formImages.splice(idx, 1);
  renderImagePreviews();
}

/* ---------- Product form ---------- */
function resetProductForm() {
  document.getElementById('productId').value = '';
  document.getElementById('productName').value = '';
  document.getElementById('productArticle').value = '';
  document.getElementById('productPrice').value = '';
  document.getElementById('productActive').value = 'true';
  document.getElementById('productDescription').value = '';
  document.getElementById('formTitle').textContent = 'Add New Product';
  formVariants = [];
  formImages = [];
  renderVariantsTable();
  renderImagePreviews();
}

let savingProduct = false;
async function saveProduct() {
  if (savingProduct) return;
  const id = document.getElementById('productId').value;
  const name = document.getElementById('productName').value.trim();
  const articleNo = document.getElementById('productArticle').value.trim();
  const categoryID = document.getElementById('productCategory').value;
  const price = Number(document.getElementById('productPrice').value) || 0;
  const active = document.getElementById('productActive').value === 'true';
  const description = document.getElementById('productDescription').value.trim();

  if (!name || !articleNo || !categoryID || !price) { toast('Please fill in name, article number, category and price', 'danger'); return; }
  if (!formVariants.length) { toast('Add at least one variant (color/size/stock)', 'danger'); return; }

  savingProduct = true;
  toast('Saving… uploading photos can take a few seconds');
  // New photos are still in-memory "data:" images; AA.saveProduct uploads them to Storage first.
  const result = await AA.saveProduct({
    productID: id || articleNo, name, articleNo, categoryID, price, active,
    description, variants: formVariants, images: formImages,
  }, !id);
  savingProduct = false;
  if (result.error) { toast(result.error, 'danger'); return; }
  toast(id ? 'Product updated' : 'Product added', 'success');
  resetProductForm();
  renderInventoryTable();
}

function editProduct(id) {
  const p = AA.productById(id);
  if (!p) return;
  document.getElementById('productId').value = p.productID;
  document.getElementById('productName').value = p.name;
  document.getElementById('productArticle').value = p.articleNo;
  document.getElementById('productCategory').value = p.categoryID;
  document.getElementById('productPrice').value = p.price;
  document.getElementById('productActive').value = String(!!p.active);
  document.getElementById('productDescription').value = p.description || '';
  formVariants = JSON.parse(JSON.stringify(p.variants || []));
  formImages = JSON.parse(JSON.stringify(p.images || []));
  renderVariantsTable();
  renderImagePreviews();
  document.getElementById('formTitle').textContent = 'Edit Product — ' + p.name;
  window.scrollTo({ top: 300, behavior: 'smooth' });
}

async function toggleActive(id) {
  const p = AA.productById(id);
  if (!p) return;
  const result = await AA.setProductActive(id, !p.active);
  if (result.error) { toast(result.error, 'danger'); return; }
  renderInventoryTable();
}

async function deleteProduct(id) {
  if (!confirm('Delete this product permanently?')) return;
  const result = await AA.deleteProduct(id);
  if (result.error) { toast(result.error, 'danger'); return; }
  renderInventoryTable();
  toast('Product deleted');
}

function renderInventoryTable() {
  const products = AA.products();
  const tbody = document.getElementById('inventoryTbody');
  if (!products.length) { tbody.innerHTML = '<tr><td colspan="7" class="center-note">No products yet.</td></tr>'; return; }
  tbody.innerHTML = products.map(p => {
    const stock = (p.variants || []).reduce((s, v) => s + v.stock, 0);
    return `
    <tr>
      <td style="width:48px"><div style="width:40px;height:40px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--dark3)">${AA.productThumb(p)}</div></td>
      <td>${esc(p.name)}<br><span style="font-size:.6rem">${esc(p.articleNo)}</span></td>
      <td>${esc(AA.categoryName(p.categoryID))}</td>
      <td>${AA.money(p.price)}</td>
      <td class="${stock > 0 ? 'badge-instock' : 'badge-outstock'}">${stock}</td>
      <td>${p.active ? '<span class="status-pill status-confirmed">Active</span>' : '<span class="status-pill status-cancelled">Inactive</span>'}</td>
      <td>
        <div class="inline-actions">
          <button class="tbl-btn" onclick="editProduct('${p.productID}')">Edit</button>
          <button class="tbl-btn" onclick="toggleActive('${p.productID}')">${p.active ? 'Deactivate' : 'Activate'}</button>
          <button class="tbl-btn del" onclick="deleteProduct('${p.productID}')">Delete</button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

// BOOT: load data, make sure this is really the admin, then draw the page.
(async function bootInventory() {
  await AA.init();
  if (!(await AA.requireAdmin())) return;
  renderCategoryChips();
  renderVariantsTable();
  renderImagePreviews();
  renderInventoryTable();
})();
