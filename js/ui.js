/* ============================================================
   AA LEATHERS — SHARED UI BEHAVIOUR
   Navbar scroll state, mobile menu, account dropdown, toasts.
   Runs on every page (included after data.js).
   ============================================================ */

(function () {
  // Navbar scroll shadow
  const navbar = document.getElementById('navbar');
  if (navbar) {
    const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll);
  }

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  }

  // Account menu
  const accToggle = document.getElementById('accountToggle');
  const accDropdown = document.getElementById('accountDropdown');
  if (accToggle && accDropdown) {
    AA.sessionReady.then(() => renderAccountMenu(accToggle, accDropdown));   // wait until we know who is logged in
    accToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      accDropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => accDropdown.classList.remove('open'));
  }

  AA.updateCartBadge();

  // The admin entry point is intentionally undiscoverable in customer UI.
  qsa('.nav-logo').forEach(logo => logo.addEventListener('click', (event) => {
    const now = Date.now();
    const state = AA.get('aa_hidden_admin_clicks', { count: 0, lastClick: 0 });
    const count = now - state.lastClick > 2500 ? 1 : state.count + 1;
    if (count === 7) {
      event.preventDefault();
      AA.set('aa_hidden_admin_clicks', { count: 0, lastClick: 0 });
      showHiddenAdminBar();
    } else if (/\/index\.html$/.test(location.pathname) || location.pathname.endsWith('/')) {
      event.preventDefault();
    }
    if (count !== 7) AA.set('aa_hidden_admin_clicks', { count, lastClick: now });
  }));
})();

function renderAccountMenu(toggle, dropdown) {
  const user = AA.session();
  const admin = AA.adminSession();
  const label = toggle.querySelector('#accountLabel');
  if (label) label.textContent = admin ? 'Admin' : user ? user.name.split(' ')[0] : 'Account';
  dropdown.innerHTML = admin
    ? '<a href="admin.html">My Account</a><a href="#" data-admin-logout>Logout</a>'
    : user
    ? '<a href="user-profile.html">My Account</a><a href="#" data-customer-logout>Logout</a>'
    : '<a href="login.html">Login</a><a href="login.html#register">Create Account</a>';
  const logout = dropdown.querySelector('[data-customer-logout], [data-admin-logout]');
  if (logout) logout.addEventListener('click', async (event) => {
    event.preventDefault();
    await AA.signOut();
    renderAccountMenu(toggle, dropdown);
    dropdown.classList.remove('open');
    if (typeof renderAccount === 'function') renderAccount();
    toast('Logged out', 'success');
  });
}

function showHiddenAdminBar() {
  let bar = document.getElementById('hiddenAdminBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'hiddenAdminBar';
    bar.className = 'hidden-admin-bar';
    bar.innerHTML = '<div><strong>Admin Access</strong><span>Restricted store management</span></div><div class="hidden-admin-actions"><button type="button" class="nav-btn solid" data-hidden-admin-login>Admin Login</button><button type="button" class="hidden-admin-close" aria-label="Close">×</button></div>';
    document.body.appendChild(bar);
    bar.querySelector('[data-hidden-admin-login]').addEventListener('click', () => { location.href = 'admin-login.html'; });
    bar.querySelector('.hidden-admin-close').addEventListener('click', () => {
      bar.remove();
      AA.set('aa_hidden_admin_clicks', { count: 0, lastClick: 0 });
    });
  }
  bar.classList.add('open');
}

/* ---------- Toast notifications ---------- */
function toast(msg, type) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' toast-' + type : '');
  el.innerHTML = '<span class="toast-icon">' + (type === 'success' ? '✓' : type === 'danger' ? '✕' : '✦') + '</span><span></span>';
  el.lastChild.textContent = msg;   // textContent, not innerHTML: messages may contain product names or server text
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 2600);
}

function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  button.textContent = showing ? 'Show password' : 'Hide password';
}

function themedConfirm(message, title) {
  return new Promise(resolve => {
    let modal = document.getElementById('themeConfirmModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'themeConfirmModal';
      modal.className = 'theme-confirm-modal';
      modal.innerHTML = `
        <div class="theme-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="themeConfirmTitle">
          <button type="button" class="theme-confirm-close" aria-label="Close confirmation">×</button>
          <div class="sec-label">Admin action</div>
          <h2 id="themeConfirmTitle"></h2>
          <p class="theme-confirm-message"></p>
          <div class="theme-confirm-actions">
            <button type="button" class="theme-confirm-cancel">Cancel</button>
            <button type="button" class="theme-confirm-delete">Delete</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    modal.querySelector('#themeConfirmTitle').textContent = title || 'Delete product';
    modal.querySelector('.theme-confirm-message').textContent = message;
    modal.hidden = false;

    const finish = result => {
      modal.hidden = true;
      modal.querySelector('.theme-confirm-cancel').onclick = null;
      modal.querySelector('.theme-confirm-delete').onclick = null;
      modal.querySelector('.theme-confirm-close').onclick = null;
      resolve(result);
    };
    modal.querySelector('.theme-confirm-cancel').onclick = () => finish(false);
    modal.querySelector('.theme-confirm-close').onclick = () => finish(false);
    modal.querySelector('.theme-confirm-delete').onclick = () => finish(true);
    modal.querySelector('.theme-confirm-delete').focus();
  });
}

/* ---------- Small helpers shared by pages ---------- */
function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function esc(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
