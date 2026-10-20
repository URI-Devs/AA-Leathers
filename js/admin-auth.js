/* ============================================================
   AA LEATHERS — ADMIN AUTH
   The admin is a normal Supabase Auth user whose profile has
   role = 'admin' (created once with sql/3-make-admin.sql).
   There is NO password in this code any more.
   ============================================================ */

async function doAdminLogin() {
  const errEl = document.getElementById('adminLoginError');
  const email = document.getElementById('adminUsername').value.trim().toLowerCase();
  const password = document.getElementById('adminPassword').value;
  if (!email || !password) { errEl.textContent = 'Please enter the admin email and password.'; return; }
  errEl.textContent = '';
  const { error } = await AA.adminSignIn(email, password);
  if (error) { errEl.textContent = error; return; }
  toast('Welcome', 'success');
  location.href = 'admin.html';
}

// Admin pages call this once data has loaded. (It only controls what is SHOWN;
// the database itself refuses admin data to anyone who is not the admin.)
function requireAdmin() { return AA.requireAdmin(); }

async function doAdminLogout() {
  await AA.signOut();
  location.href = 'admin-login.html';
}
