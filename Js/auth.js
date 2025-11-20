// /Js/auth.js
import {
  getUsersMap, setUsersMap, setUser, alertModal, updateHeader, isAdmin
} from './app.js';

function setupEyeToggles(root = document) {
  root.querySelectorAll('.password-field .eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('shown', show);
    });
  });
}
function getNextPage() {
  const p = new URLSearchParams(location.search).get('next');
  return p || null;
}

// LOGIN
function initLogin() {
  const form = document.getElementById('loginForm');
  if (!form) return;
  setupEyeToggles(form);
  const errEl = form.querySelector('#err');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errEl.style.display = 'none'; errEl.textContent = '';

    const email    = form.querySelector('#email').value.trim();
    const password = form.querySelector('#password').value;

    const map = getUsersMap();
    const rec = map[email.toLowerCase()];
    if (!rec || rec.password !== password) {
      errEl.style.display = 'block';
      errEl.textContent = 'Invalid email or password.';
      return;
    }

    setUser(rec);
    updateHeader();

    const nextPage = getNextPage();
    if (nextPage) location.href = `./${nextPage}`;
    else location.href = isAdmin(rec) ? './adminProfile.html' : './profile.html';
  });
}

// SIGNUP
function initSignup() {
  const form = document.getElementById('signupForm');
  if (!form) return;
  setupEyeToggles(form);
  const errEl = form.querySelector('#err');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errEl.style.display = 'none'; errEl.textContent = '';

    const firstName    = form.querySelector('#firstName').value.trim();
    const lastName     = form.querySelector('#lastName').value.trim();
    const idNumber     = form.querySelector('#idNumber').value.trim();
    const phone        = form.querySelector('#phone').value.trim();
    const email        = form.querySelector('#email').value.trim();
    const companyName  = form.querySelector('#companyName').value.trim();
    const companyType  = form.querySelector('#companyType').value;
    const pw1          = form.querySelector('#password').value;
    const pw2          = form.querySelector('#password2').value;

    if (!firstName || !lastName || !idNumber || !phone || !email || !companyName || !companyType || !pw1 || !pw2) {
      errEl.style.display = 'block'; errEl.textContent = 'Please fill all required fields.'; return;
    }
    if (pw1.length < 6) { errEl.style.display = 'block'; errEl.textContent = 'Password must be at least 6 characters.'; return; }
    if (pw1 !== pw2) { errEl.style.display = 'block'; errEl.textContent = 'Passwords do not match.'; return; }

    const map = getUsersMap();
    const key = email.toLowerCase();
    if (map[key]) { errEl.style.display = 'block'; errEl.textContent = 'This email is already registered.'; return; }

    const newUser = {
      firstName, lastName, idNumber, phone, email, companyName, companyType,
      password: pw1,
      location: '',
      isAdmin: false,
      permissions: {}
    };

    map[key] = newUser;
    setUsersMap(map);
    setUser(newUser);
    updateHeader();

    alertModal('Account created successfully.', 'Welcome').then(() => {
      location.href = './profile.html';
    });
  });
}

initLogin();
initSignup();
