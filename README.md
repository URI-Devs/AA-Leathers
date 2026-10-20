# AA Leathers — Website

A multi-page e-commerce website for AA Leathers (leather wallets), rebuilt in the
file structure of the original `mm-main` project, using the visual design from
the `index__3_.html` ("LeatherLux") single-page mockup, and wired up to meet the
functional requirements in the AA Leathers PRD/SDD (FR-01 to FR-20).

The website uses Supabase for authentication, products, orders, reviews,
inventory, payment proofs, customer profiles, and admin data. Guest cart and
wishlist state may remain in browser storage; authenticated customer state is
synchronized to Supabase.

## Pages

| File                     | Purpose                                                              |
|---------------------------|-----------------------------------------------------------------------|
| `index.html`              | Home page — hero, featured products, process steps, reviews          |
| `products.html`           | Shop: category filter, search, sort, product detail (variants, reviews) |
| `cart.html`                | Cart, 3-step checkout (delivery → payment → review), order confirmation |
| `login.html`               | Customer login / sign up / continue as guest                        |
| `user-profile.html`        | Customer profile, order history, wishlist, guest order tracking     |
| `about.html`                | Brand story                                                         |
| `contact.html`              | Contact form & business info                                        |
| `admin-login.html`          | Admin login                                                          |
| `admin.html`                 | Admin dashboard: stats, orders, payment verification, delivery charges, customers |
| `admin-inventory.html`      | Admin: categories, products, variants, images, stock                |
| `admin-profile.html`        | Admin's own account settings                                        |

`css/style.css` and the files in `js/` are shared across every page.

## What was carried over from `index__3_.html`

All of it, as the single shared stylesheet: colours, fonts (Cormorant Garamond /
Montserrat), navbar, buttons, product cards, forms, cart/checkout layout, the
account page, the admin table/stat styling, and the toast notifications.

## What was changed from the original mockup

- **Split into real pages.** The original was a single-page app with JS-toggled
  `.page` sections and no address bar navigation. It's now a true multi-page
  site matching the `mm-main` file list, since that's what you asked to adapt.
- **Admin panel is now full pages, not a modal.** Same CSS classes, used as
  normal page content on `admin.html` / `admin-inventory.html` / `admin-profile.html`.
- **Content changed from "LeatherLux" branding to AA Leathers**, with the
  product catalog, categories and copy matching the PRD (wallets, cardholders,
  travel wallets, slim wallets).
- **Product photography replaced with a simple gold line-art wallet mark**
  (inline SVG). The original used colourful emoji as placeholders, which
  clashed with the dark/gold palette — admins can upload real photos per
  product (compressed client-side) and they'll be used automatically instead.
- **Added mobile responsiveness** (nav collapses to a toggle menu, grids
  collapse to 1–2 columns). The original design had no `@media` rules at all;
  this was necessary to meet the PRD's responsiveness requirement (NFR-11).

## Features intentionally left out (not in the PRD's scope)

These existed in one of the two source projects but aren't functional
requirements in the AA Leathers PRD, so they were left out to keep the build
focused. They'd be reasonable follow-ups if you want them:

- **Maps / GPS delivery address picking** (from `mm-main`) — the PRD only
  asks for a text delivery address and a region-based delivery charge.
- **Promo codes / coupons** (from `mm-main`) — listed in the PRD as a
  *future enhancement*, not a current requirement.
- **3D product viewer / engraving customisation** (from `index__3_.html`) —
  decorative extras not tied to any FR; replaced with the simpler wallet mark
  described above.
- **Password reset flow** — handled through Supabase Auth and `reset-password.html`.

## Remaining setup

Configure the Supabase Auth site URL and redirect URL for
`reset-password.html`, and configure an email provider if password-reset
emails are not delivered by the default project settings. Guest cart and
wishlist data are intentionally retained locally until the customer signs in.

## Local preview

Open `index.html` directly, or serve the folder with any static server, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000/index.html`.
