/* ============================================================
   AA LEATHERS — CUSTOMER AUTH (login.html)
   FR-09 Customer Account, FR-10 Guest Checkout
   ============================================================ */

function switchAuthTab(which) {
  document.getElementById('tabLogin').classList.toggle('active', which === 'login');
  document.getElementById('tabSignup').classList.toggle('active', which === 'signup');
  document.getElementById('loginSection').classList.toggle('active', which === 'login');
  document.getElementById('signupSection').classList.toggle('active', which === 'signup');
}

async function doLogin() {
  const id = document.getElementById('loginId').value.trim().toLowerCase();
  const pw = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  if (!id || !pw) { errEl.textContent = 'Please enter your email and password.'; return; }
  errEl.textContent = '';
  const { error } = await AA.signIn(id, pw);
  if (error) { errEl.textContent = error; return; }
  toast('Welcome back, ' + (AA.session() ? AA.session().name.split(' ')[0] : ''), 'success');
  location.href = 'index.html';
}

function showForgotPasswordMessage() {
  const error = document.getElementById('loginError');
  if (error) error.textContent = 'Password reset is not available yet. Please contact AA Leathers support.';
}

async function doSignup() {
  const name = document.getElementById('suName').value.trim();
  const email = document.getElementById('suEmail').value.trim().toLowerCase();
  const password = document.getElementById('suPassword').value;
  const confirmPassword = document.getElementById('suConfirmPassword').value;
  const errEl = document.getElementById('signupError');

  if (!name || !email || !password || !confirmPassword) { errEl.textContent = 'Full name, email and both password fields are required.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Please enter a valid email address.'; return; }
  if (password.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; return; }
  if (password !== confirmPassword) { errEl.textContent = 'Passwords do not match.'; return; }
  errEl.textContent = '';

  const result = await AA.signUp({ name, email, password });
  if (result.error) { errEl.textContent = result.error; return; }
  if (result.needsConfirmation) {            // only if "Confirm email" is ON in Supabase
    errEl.style.color = 'var(--success)';
    errEl.textContent = 'Account created. Please check your email and click the confirmation link, then log in.';
    return;
  }
  toast('Account created — welcome, ' + name.split(' ')[0], 'success');
  location.href = 'index.html';
}

if (location.hash === '#register') switchAuthTab('signup');
