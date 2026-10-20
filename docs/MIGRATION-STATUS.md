# AA Leathers Supabase Migration Status

**Last updated:** 13 October 2026

This document records what has been migrated, how the migration works, what has
already been configured in Supabase, and what is still required before launch.

## Current status

The AA Leathers website has been migrated from its localStorage database and
authentication model to Supabase. The existing AA Leathers interface and the
recently added product gallery, reviews, admin order details, payment-proof
viewer, password controls, and hidden admin access have been preserved.

The Supabase database schema, sample catalog, delivery regions, storage buckets,
RLS policies, and the first admin profile have been configured.

The project is not fully production-ready yet because deployment, payment
account details, Supabase Auth redirect/email configuration, and final live
smoke testing remain. Password reset is implemented, but requires that Auth
configuration before it can be verified end-to-end.

## What was completed

### 1. Supabase client configuration

The browser client was added in:

- `js/supabase-config.js`

It contains:

- Supabase project URL
- Supabase publishable key
- No service-role or secret key

The publishable key is safe to use in frontend code because database access is
controlled by Row Level Security (RLS).

### 2. Database and security setup

The following SQL was run in the Supabase SQL Editor:

- `AA-Supabase-Migration/sql/1-schema.sql`
- `AA-Supabase-Migration/sql/2-sample-data.sql`
- `AA-Supabase-Migration/sql/4-customer-state.sql`

The schema created:

- `profiles`
- `categories`
- `products`
- `delivery_charges`
- `orders`
- `reviews`
- `contact_messages`
- `customer_state`

It also created:

- Supabase Auth profile trigger
- Server-side order placement function
- Guest order tracking function
- Review validation trigger
- Cancelled-order stock restoration trigger
- Admin role protection
- Row Level Security policies
- Product image storage policies
- Private payment-proof storage policies

### 3. Catalog and delivery data

The sample data was inserted successfully:

- Six sample products
- Four categories
- Three delivery regions:
  - Sahiwal City
  - Other Cities (Punjab)
  - Rest of Pakistan

Product and delivery data now loads from Supabase instead of localStorage.

### 4. Customer authentication

Customer signup and login now use Supabase Auth.

Implemented behavior:

- Email/password signup
- Email/password login
- Profile creation after signup
- Customer profile loading
- Customer logout
- Profile name, phone, and address updates
- Redirect to the homepage after successful login/signup

Passwords are handled and hashed by Supabase Auth. Passwords are not stored in
the website code or in the public database tables.

When Supabase requires email confirmation, registration now opens an accessible
verification modal with:

- Verification instructions and the destination email
- Resend-verification support with loading and error states
- A login path after the customer verifies through Supabase
- A guest-browsing path for postponing verification

The website displays the 24-hour reminder but does not claim verification or
enforce a deadline in browser code. Any expiry enforcement must remain a
Supabase Auth/email-provider configuration concern unless a future server-side
workflow is added.

### 5. Admin authentication

Admin login now uses the same Supabase Auth system.

Admin access is allowed only when the authenticated user's profile has:

```text
role = admin
```

The first admin was promoted successfully:

```text
ubaidulrehman086@gmail.com
```

The old hardcoded `admin/admin@123` login was removed.

The seven-click hidden AA Leathers logo access remains available, but it only
opens the admin login page. It does not bypass authentication.

### 6. Three-admin support

The database supports up to three real admin accounts.

The limit is enforced inside the database, not in the website UI. A database
trigger prevents a fourth admin from being promoted. A transaction advisory
lock prevents concurrent promotions from bypassing the limit.

To add Admin 2 or Admin 3:

1. Create a real user in Supabase Authentication.
2. Use a strong password.
3. Run the following SQL with that user's email:

```sql
update public.profiles
set role = 'admin'
where email = 'second-admin@example.com';

select id, name, email, role
from public.profiles
where role = 'admin'
order by created_at;
```

There is intentionally no admin-management page in the website.

### 7. Product gallery and variants

The existing product gallery behavior was retained and connected to Supabase
catalog data.

It supports:

- Product images
- Variant images
- Deduplicated slideshow images
- Selecting a color and jumping to the correct image
- Variants without images
- Dynamic slide lookup instead of hardcoded slide numbers
- Admin product and variant image uploads

Product and variant uploads are compressed in the browser to WebP (maximum
dimension 1200px, quality approximately 82%) before upload. New files are
stored under the product's own Storage folder. Replacing a saved image updates
the product row before removing the old referenced object, and deleting a
product removes only image objects whose paths belong to that product folder.

Product images are uploaded to the public `product-images` bucket. Only image
URLs are stored in product records.

### 8. Checkout and orders

Order creation now uses the Supabase `place_order()` database function.

The browser sends only:

- Product ID
- Variant ID
- Quantity
- Customer delivery details
- Selected payment method
- Payment-proof storage path when applicable

The database decides:

- Current product price
- Subtotal
- Delivery charge
- Final total
- Stock availability
- Stock decrement
- Historical order-item snapshot
- Order ID

This prevents price tampering through the browser.

Orders retain historical product names, variants, colors, sizes, prices, and
quantities so later product changes do not alter old orders.

### 9. Payment-proof storage

Payment screenshots use the private `payment-proofs` Supabase Storage bucket.

Implemented behavior:

- JPG, PNG, and WebP validation
- File-size restrictions
- Upload during JazzCash/Easypaisa checkout
- Private storage path saved with the order
- Admin-only signed URL generation
- Temporary signed screenshot links
- Screenshot modal/lightbox in the admin panel
- Missing or invalid screenshot handling

COD orders do not require or display a payment screenshot.

The checkout payment step now shows the configured JazzCash/Easypaisa account,
exact payable total, instructions, screenshot preview, and a clear return path
to choose COD. Uploading proof still leaves payment pending until admin
verification.

### 10. Reviews and ratings

Reviews now use the Supabase `reviews` table.

Implemented behavior:

- One review per customer per product
- Review editing
- 1–5 star rating
- Comment validation
- Customer name display without exposing email
- Review date
- Average rating and count
- Admin review listing
- Admin review deletion

The database allows reviews only from customers who ordered the product in a
non-cancelled order.

### 11. Admin order management

The admin panel retains the complete order detail view.

It displays:

- Order ID
- Date and time
- Status
- Payment method/status
- Payment proof
- Customer name
- Email
- Phone
- Delivery address
- Region
- Every ordered product
- Product image
- Article number
- Variant/color/size
- Quantity
- Saved unit price
- Item total
- Subtotal
- Delivery charges
- Final total

Admin status changes and payment verification now update Supabase.

### 12. Inventory and images

Admin inventory operations now use Supabase:

- Add product
- Edit product
- Activate/deactivate product
- Delete product
- Add/edit/delete categories
- Update prices
- Update variants and stock
- Upload product images
- Upload variant images

Product images are stored in Supabase Storage instead of as large base64 values
inside localStorage records.

### 13. Contact form

The contact form now stores submissions in the Supabase
`contact_messages` table.

Only admins can read those messages through database policies.

### 14. Cart and wishlist

Guest cart and wishlist remain in localStorage as temporary device-local state.
After customer authentication, the state is loaded from and saved to the
RLS-protected `customer_state` table so it can follow the customer across
devices. Run `AA-Supabase-Migration/sql/4-customer-state.sql` in the existing
Supabase project before relying on this synchronization.

Before checkout, the cart is refreshed against the current Supabase catalog so
removed products, changed prices, and unavailable variants are handled.

## Files integrated into the main project

Main migrated files include:

- `js/data.js`
- `js/supabase-config.js`
- `js/auth.js`
- `js/admin-auth.js`
- `js/cart.js`
- `js/catalog.js`
- `js/admin.js`
- `js/inventory.js`
- `js/account.js`
- `js/home.js`
- `js/ui.js`

Supabase client/config scripts were added to the required HTML pages.

The original migration reference files remain in:

- `AA-Supabase-Migration/changed-files/`
- `AA-Supabase-Migration/sql/`
- `AA-Supabase-Migration/changes.diff`
- `AA-Supabase-Migration/MIGRATION-GUIDE.md`

## Validation already completed

Completed checks:

- JavaScript syntax checks with `node --check`
- VS Code diagnostics on migrated core files
- Git whitespace validation with `git diff --check`
- Supabase schema execution
- Sample catalog execution
- Admin profile promotion
- Storefront loading from Supabase
- Customer password Show/Hide controls
- Supabase script loading on all required pages

## Remaining work

### 1. Create additional admins if needed

Admin 2 and Admin 3 still need to be created as real Supabase Auth users and
promoted through SQL. Placeholder admin credentials should not be added to
frontend code.

### 2. Configure email authentication

Choose the desired Supabase Authentication behavior:

- Disable email confirmation for immediate signup login, or
- Keep confirmation enabled and configure a proper email provider

The application already handles the confirmation-required response.

### 3. Configure password reset

The application now calls Supabase password reset and includes
`reset-password.html`. It still requires:

- Correct production redirect URL
- Email provider/SMTP configuration

### 4. Replace payment account placeholders

The migration files still contain demo payment numbers:

```text
JazzCash: 0300-1234567
Easypaisa: 0300-7654321
```

Replace them in:

- `js/cart.js`
- `cart.html`

Also update the account-title text shown at checkout.

### 5. Configure production URL

After deployment, set the deployed website URL in:

**Supabase Dashboard → Authentication → URL Configuration → Site URL**

Redirect URLs should also be configured for signup and password reset.

### 6. Deploy the website

The project is plain HTML/CSS/JavaScript and can be deployed to:

- Cloudflare Pages
- Netlify
- Vercel
- GitHub Pages with suitable Supabase redirect configuration

No build step is required.

### 7. Perform the final live smoke test

Test against the actual Supabase project:

1. Open the storefront and verify products load.
2. Create a test customer account.
3. Place a COD order.
4. Track the order while logged out.
5. Place a JazzCash or Easypaisa order with a screenshot.
6. Log in as admin.
7. Open the order details.
8. View the private payment screenshot.
9. Approve or reject the payment.
10. Add or edit a product image.
11. Place or use a valid customer order.
12. Submit a review for the purchased product.
13. Test review editing and duplicate prevention.
14. Test desktop and mobile layouts.

## Known limitations

- Password reset requires Supabase email/redirect configuration.
- Guest cart and wishlist remain device-local; authenticated customer cart and
  wishlist synchronize through `customer_state`.
- No automatic WhatsApp, email, or order notification exists.
- Deleted product records may leave unused product images in Storage.
- No rate limiting or CAPTCHA is currently configured for signup/contact forms.
- The project has not yet been deployed to a production domain.
- Final end-to-end production smoke testing is still required.

## Security notes

- Never place a Supabase secret/service-role key in frontend files.
- The publishable key belongs in browser code.
- Admin passwords belong only to Supabase Auth.
- Admin promotion should be done through SQL or the Supabase dashboard.
- Payment proofs remain private and are viewed through signed URLs.
- RLS policies are the actual database security boundary.
