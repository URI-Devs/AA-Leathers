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

function closeVerificationModal() {
  const modal = document.getElementById('verificationModal');
  if (modal) modal.hidden = true;
}

function openVerificationModal(email) {
  const modal = document.getElementById('verificationModal');
  if (!modal) return;
  document.getElementById('verificationEmail').textContent = email;
  document.getElementById('verificationMessage').textContent = '';
  modal.hidden = false;
  document.getElementById('verificationResend').focus();
}

async function resendVerificationEmail() {
  const email = document.getElementById('verificationEmail').textContent;
  const button = document.getElementById('verificationResend');
  const message = document.getElementById('verificationMessage');
  if (!email || button.disabled) return;
  button.disabled = true;
  button.textContent = 'Sending…';
  const result = await AA.resendVerification(email);
  message.textContent = result.error || 'A new verification email has been sent.';
  message.style.color = result.error ? 'var(--danger)' : 'var(--success)';
  button.disabled = false;
  button.textContent = 'Resend verification email';
}

function continueAsGuestAfterVerification() {
  closeVerificationModal();
  location.href = 'products.html';
}

function prepareVerificationLogin() {
  closeVerificationModal();
  switchAuthTab('login');
  document.getElementById('loginId').value = document.getElementById('verificationEmail').textContent;
  document.getElementById('loginId').focus();
  document.getElementById('loginError').textContent = 'After clicking the email link, log in here. Verification is confirmed by Supabase.';
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
  const email = document.getElementById('loginId').value.trim().toLowerCase();
  const error = document.getElementById('loginError');
  if (!email) {
    error.textContent = 'Enter your email first, then click Forgot password.';
    return;
  }
  error.textContent = 'Sending password reset email…';
  AA.requestPasswordReset(email).then(result => {
    error.textContent = result.error || 'If an account exists for that email, a password reset link has been sent.';
  });
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
    openVerificationModal(email);
    return;
  }
  toast('Account created — welcome, ' + name.split(' ')[0], 'success');
  location.href = 'index.html';
}

if (location.hash === '#register') switchAuthTab('signup');

document.getElementById('verificationClose').addEventListener('click', closeVerificationModal);
document.getElementById('verificationLater').addEventListener('click', continueAsGuestAfterVerification);
document.getElementById('verificationLogin').addEventListener('click', prepareVerificationLogin);
document.getElementById('verificationResend').addEventListener('click', resendVerificationEmail);
