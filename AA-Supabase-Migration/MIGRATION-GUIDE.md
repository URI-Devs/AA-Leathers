# AA Leathers → Supabase migration guide

Your zip was **not modified**. This folder contains everything to migrate it:

| What | Where |
|---|---|
| Database + security (3 SQL files) | `sql/` |
| Every file that must change, already migrated | `changed-files/` (copy over your files) |
| The exact line-by-line differences | `changes.diff` |
| What changed and why, per file | section 4 below |

---

## 1. Where does the original key go?

**File:** `js/supabase-config.js` — one line:

```js
const SUPABASE_URL = 'https://zqyjqhbzzhwwcynhaygv.supabase.co';          // already set to your project
const SUPABASE_KEY = 'PASTE-YOUR-ORIGINAL-PUBLISHABLE-KEY-HERE';          // ← put it here
```

Get it from: Supabase Dashboard → **Project Settings → API Keys → Publishable key** (`sb_publishable_...`).

- The publishable key is **meant to be public** (it ships in browser code). Your data is protected by the database rules in `sql/1-schema.sql`, not by hiding this key.
- **Never** put the *secret* key (`sb_secret_...` / `service_role`) in any file of the website. That key skips all security.

---

## 2. State of your project (what I found) and what had to change

Your project is in good shape: clear pages, shared `AA` data object, the new reviews / variant images / order-details / hidden admin entry all work. Moving to a real database exposed **five things that must change**, because they only worked while everything lived in one browser:

| # | Problem in current code | Fix |
|---|---|---|
| 1 | **Admin password `admin@123` is written in the JavaScript.** Anyone can open the file and read it. With a real database it would also give the database no way to know who is admin. | Admin is now a real Supabase login (email + password, stored hashed by Supabase). The code has no password. Your 7-click hidden entry stays, but it's only a convenience — the real protection is the login. |
| 2 | **Prices, delivery charge and total are calculated in the browser and sent to the shop.** Anyone can open the console and order a wallet for Rs. 1. | New database function `place_order()` recalculates everything on the server (price, delivery, stock) and is the *only* way to create an order. Direct inserts are blocked. |
| 3 | Variant/product images are saved as huge base64 text inside the product row. | Images are uploaded to Supabase Storage; only a short URL is stored. Faster pages, small database. |
| 4 | Contact form shows "we'll get back to you" but **sends nothing**. | Messages are saved to a `contact_messages` table. Read them in Supabase → Table Editor. |
| 5 | Home page says "Verified Buyer" but anyone logged in could review. | Database now only allows a review from someone who ordered that product (cancelled orders don't count). Fake seed reviews are **not** loaded. |

Also added: stock goes **back** when an order is cancelled / payment rejected (your code never returned it), stale carts are refreshed from the live catalog, double-click on "Place Order" can't create two orders, payment screenshots are private (admin sees them through 2-minute links), upload size/type limits (2 MB / 3 MB, JPG/PNG/WebP only).

---

## 3. Setup steps (about 20 minutes)

**A. Database**
1. Supabase Dashboard → **SQL Editor → New query**.
2. Paste all of `sql/1-schema.sql` → **Run**. (Should say "Success". Run it only once.)
3. Paste `sql/2-sample-data.sql` → **Run** *(optional but the delivery regions in it are needed for checkout — keep those 3 rows even if you delete the sample products later)*.

**B. Auth settings** (Dashboard → Authentication)
- **Sign In / Providers → Email → "Confirm email"**: your signup form logs the customer straight in, so turn this **OFF** for now. (Supabase's free built-in email sender is limited to a few emails per hour, so confirmation mails would fail under real traffic. If you turn it ON later, the code already shows "check your email" — but add your own SMTP first.)
- **Minimum password length**: set to **8** (the signup page already requires 8).
- **URL Configuration → Site URL**: set to your final website address once deployed.

**Customer state migration:** after the original schema, run
`sql/4-customer-state.sql`. It adds RLS-protected cross-device cart and wishlist
state for authenticated customers. Guest carts remain local until login.

**C. Create the admin account**
1. Authentication → Users → **Add user → Create new user**. Use *your* email and a **strong** password. Tick **Auto Confirm User**.
2. Open `sql/3-make-admin.sql`, put that same email in it, run it. It must show exactly **one row** with role `admin`.
3. The database allows up to three admins and the website can never promote anyone — only this SQL can.

**D. Put the files in your project**
1. Copy everything from `changed-files/` over your project (same folder structure).
2. Edit `js/supabase-config.js` → paste your key (section 1).
3. In the **other 7 HTML pages** (`index, products, cart, login, about, admin, admin-inventory`) add these two lines **directly above** `<script src="js/data.js"></script>`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/supabase-config.js"></script>
```
(The 4 pages in `changed-files/` already have them.)

**E. Replace placeholders before real customers see the site**
- `js/cart.js` line ~117: JazzCash `0300-1234567` and Easypaisa `0300-7654321` → **your real account numbers** (customers will send money to these!). Also the "Account Title" text in `cart.html` line ~91.
- `contact.html` lines ~53–55: phone, email, address.

---

## 4. File-by-file: what changed and where

Every page script now follows **one rule**: start with `await AA.init(...)` (loads data and finds out who is logged in), then draw. After that, the code reads `AA.products()`, `AA.reviews()` etc. exactly as before.

### `js/data.js` — replaced entirely
- **Kept untouched:** `money, uid, fmtDate, productThumb, compressImage, WALLET_SVG`, plus guest cart/wishlist fallback behavior.
- **Removed:** the localStorage database, seed data, `users/admins/session` storage, and every `saveX()` function.
- **Added:**
  - `AA.init({reviews, orders, customers})` — loads from Supabase once per page.
  - Same-name read functions: `products(), categories(), deliveryCharges(), reviews(), orders(), users(), session(), adminSession()`.
  - Async actions: `signUp, signIn, signOut, updateProfile, adminSignIn, requireAdmin, placeOrder, trackOrder, updateOrderStatus, verifyPayment, paymentProofUrl, saveReview, deleteReview, saveProduct, setProductActive, deleteProduct, saveCategory, deleteCategory, saveDeliveryCharges, addDeliveryRegion, sendContactMessage, refreshCart`.
- Order of data: orders/reviews arrive oldest-first so your existing `.reverse()` calls still show newest first.

### `js/supabase-config.js` — new (section 1).

### `js/ui.js` — 2 small edits
```js
// before
renderAccountMenu(accToggle, accDropdown);
// after  (wait until we know who is logged in)
AA.sessionReady.then(() => renderAccountMenu(accToggle, accDropdown));
```
Logout handler became `async` and calls `await AA.signOut()` instead of `AA.adminLogout()/AA.logout()`.
Your 7-clicks-on-the-logo hidden admin entry is untouched. `toast()` now sets the message with `textContent` (it used `innerHTML`; messages can contain product names or server text).

### `js/auth.js`
`doLogin()` and `doSignup()` are `async` and call `AA.signIn()` / `AA.signUp()`. Signup sends only name + email + password (your form). Login field is **email** (a phone number can't log in any more — Supabase logs in with email). Everything else (password toggle, forgot-password message, `#register` hash) is yours, unchanged.

### `js/home.js`
Wrapped in `(async function(){ await AA.init({reviews:true}); ... })()`. Testimonials show the 3 newest **real** reviews and the whole block hides itself when there are none.

### `js/catalog.js`
- Bottom of file: `renderCategoryFilters(); renderGrid();` now runs inside `AA.init({reviews:true}).then(...)`, with a "Loading wallets…" line meanwhile.
- `saveProductReview()` is `async` → `AA.saveReview()`. If the customer never ordered the product they see: *"You can review a product after you have ordered it."*
- Everything else (variants, gallery, ratings UI, cart add, wishlist) is yours, unchanged.

### `js/cart.js`
- Payment screenshot: keep the `File` itself (`checkoutState.proofFile`) instead of a base64 string.
- `placeOrder()` is now the server version:

```js
const result = await AA.placeOrder({
  name, phone, address, region: checkoutState.region,
  method: checkoutState.method, proofFile: checkoutState.proofFile,
});
if (result.error) { toast(result.error, 'danger'); return; }
// result.orderID comes from the server
```
  It sends only **product id + variant id + quantity**; price, delivery and stock are decided by the database.
- Bottom: `AA.init().then(() => { AA.refreshCart().forEach(n => toast(n)); renderCart(); })`.

### `js/account.js`
`trackOrder()` → `await AA.trackOrder(id)` (works for guests; returns status/items/total only — never name, phone or address). `saveProfile()` / `doLogout()` are `async`. Email is read-only (it is the login). A customer only ever receives **their own** orders from the database.

### `js/admin-auth.js` — replaced
No password in code. `doAdminLogin()` → `AA.adminSignIn(email, password)`. Same file still exports `requireAdmin()` and `doAdminLogout()`.

### `js/admin.js`
- Top `requireAdmin();` removed; bottom now: `await AA.init({orders, customers, reviews}); if (!(await AA.requireAdmin())) return; render...`.
- Became `async`: `saveOrderDetailsStatus, viewPaymentProof, verifyPayment, updateOrderStatus, saveDeliveryCharges, addDeliveryRegion, deleteReview`.
- `viewPaymentProof()` asks for a private 2-minute link: `await AA.paymentProofUrl(order.paymentProof)`.

### `js/inventory.js`
`addCategory, deleteCategory, saveProduct, toggleActive, deleteProduct` are `async`. In `saveProduct` the in-memory photos (still `data:` images in the form) are uploaded to Storage by `AA.saveProduct()` before saving. Boot block at the bottom like admin.js.

### HTML pages
- `admin-login.html`: label "Username" → "Admin email" (field id unchanged).
- `admin-profile.html`: inline script now async; password change goes to Supabase Auth; email is read-only.
- `contact.html`: `sendContact()` saves the message (`AA.sendContactMessage`).
- `user-profile.html`: `pfEmail` input gets `disabled`.
- All 11 pages: the two `<script>` lines above.

---

## 5. Deploy (free)

1. Put the project folder on **GitHub**, connect it to **Cloudflare Pages**, **Netlify** or **Vercel** — all free, HTTPS included, no build step (it is plain HTML/JS).
2. Set the final URL in Supabase → Authentication → URL Configuration → **Site URL**.
3. Domain: ~PKR 1,500–3,500/year (`.com`/`.pk`) — this is where most of your PKR 5,000 goes.

**Free plan limits (checked Oct 2026):** 500 MB database, ~1 GB file storage, **5 GB traffic/month**, 50,000 monthly users. 100 products + hundreds of orders is a small fraction of that. *(Correction: earlier I said 2 GB traffic — it is 5 GB.)* A free project **pauses after about 1 week with no activity** — if the shop is quiet, open it once a week or the first customer will wait ~1 minute. Pro is $25/month (~PKR 7,000) — only if the shop outgrows free.

---

## 6. What was tested — and what was not

**Tested (67 checks, all passed, no JavaScript errors):** your migrated pages in a real browser, using the real `supabase-js` library, talking to a real PostgREST server over a real Postgres database with your exact `1-schema.sql` and its security rules. Covered: catalog loading, guest + customer checkout (COD, JazzCash with screenshot), server-side pricing, stock decrement/restore, guest order tracking, signup/profile, verified-buyer reviews and editing, admin login (and that `admin/admin@123` is rejected), payment approval/rejection with private screenshot viewing, delivery charges, inventory CRUD with photo upload, contact form, plus attack attempts (fake orders, price tampering, self-promotion to admin, reading other people's orders/profiles/messages/payment proofs, uploading to product images, opening admin pages as guest/customer) — all refused.

**Not tested:** against *your actual* Supabase project (I can't reach it), and Supabase's own Auth and Storage servers were replaced by a stand-in that applies the same storage rules. So do this **10-minute smoke test** after setup:
1. Open the shop → products show.
2. Sign up a test customer → place a COD order → note the Order ID.
3. Track that Order ID while logged out.
4. Place a JazzCash order with a screenshot.
5. Log in at `admin-login.html` (or click the logo 7 times quickly to reveal the admin bar) → see both orders → open the screenshot → approve it.
6. Add a product with a photo → it shows in the shop.
7. As the test customer, leave a review on a product you ordered.

If anything fails, open the browser console (F12) and send me the red error text.

---

## 7. Known limits (fine for launch, good to know)

- **Forgot password** is still just a message. Supabase supports reset emails, but it needs your own email sender set up first.
- **No order notification to you.** Check the admin dashboard daily (or ask me to add a WhatsApp/email alert later).
- **Wishlist and cart live in the customer's browser** (by design — they don't follow the customer to another device).
- **Editing a product's stock in the admin form** replaces the stock with what the form shows. If an order arrives while you have the form open, reload the page before saving stock changes.
- **Deleting a product** leaves its photos in Storage (harmless, small).
- **Backups:** don't rely on the free plan for backups — export your orders now and then (Table Editor → `orders` → Export CSV).
- The shop is protected against the common attacks, but this is a small-shop setup: no rate-limiting or bot protection on signup / contact form. If spam appears, add a CAPTCHA (Supabase supports one) later.
