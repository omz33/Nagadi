// /Js/profile.js
import {
  isLoggedIn,
  getUser,
  updateUserProfile,
  changeUserPassword,
  alertModal,
  updateHeader
} from './app.js';

// --- Logout flow ---
function logoutCurrentUser() {
  localStorage.removeItem('currentUser');
  updateHeader();
  location.href = './login.html';
}

function openLogoutModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true" style="max-width:360px">
        <div class="modal-title">Log out</div>
        <div class="modal-content">
          Are you sure you want to log out?
        </div>
        <div class="modal-actions">
          <button class="btn" id="logoutNo">No</button>
          <button class="btn primary" id="logoutYes">Yes</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    function close(val) {
      overlay.remove();
      resolve(val);
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });
    overlay.querySelector('#logoutNo').addEventListener('click', () => close(false));
    overlay.querySelector('#logoutYes').addEventListener('click', () => close(true));
  });
}

// --- Change password modal ---
function openPasswordModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true" style="max-width:360px">
        <div class="modal-title">Change Password</div>

        <div class="modal-content" style="display:grid; gap:10px">
          <div class="field password-field">
            <div class="label">New password</div>
            <input type="password" id="newPw" minlength="6" placeholder="New password" />
            <button type="button" class="eye" aria-label="Show password">👁</button>
          </div>

          <div class="field password-field">
            <div class="label">Re-enter password</div>
            <input type="password" id="newPw2" minlength="6" placeholder="Re-enter password" />
            <button type="button" class="eye" aria-label="Show password">👁</button>
          </div>

          <div id="pwErr" class="error" style="display:none"></div>
        </div>

        <div class="modal-actions">
          <button class="btn" id="pwCancel">Cancel</button>
          <button class="btn primary" id="pwSave">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    function setupEyes(scope) {
      scope.querySelectorAll('.password-field .eye').forEach(btn => {
        btn.addEventListener('click', () => {
          const input = btn.parentElement.querySelector('input');
          const show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          btn.classList.toggle('shown', show);
        });
      });
    }
    setupEyes(overlay);

    const pwErr    = overlay.querySelector('#pwErr');
    const newPwEl  = overlay.querySelector('#newPw');
    const newPw2El = overlay.querySelector('#newPw2');
    const cancelEl = overlay.querySelector('#pwCancel');
    const saveEl   = overlay.querySelector('#pwSave');

    function setErr(msg) {
      if (msg) {
        pwErr.style.display = 'block';
        pwErr.textContent   = msg;
      } else {
        pwErr.style.display = 'none';
        pwErr.textContent   = '';
      }
    }

    function close(val) {
      overlay.remove();
      resolve(val);
    }

    cancelEl.addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });

    saveEl.addEventListener('click', () => {
      const p1 = newPwEl.value.trim();
      const p2 = newPw2El.value.trim();

      if (p1.length < 6) {
        setErr('Password must be at least 6 characters.');
        return;
      }
      if (p1 !== p2) {
        setErr('Passwords do not match.');
        return;
      }

      close(p1);
    });
  });
}

// --- PAGE INIT ---
if (!isLoggedIn()) {
  location.href = './login.html?next=profile.html';
} else {
  const u = getUser();

  // sidebar nav buttons
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  const sidebarLinks = document.querySelectorAll('.sidebar-link[data-go]');
  sidebarLinks.forEach(btn => {
    btn.addEventListener('click', () => {
      const dest = btn.getAttribute('data-go');
      if (!dest) return;
      if (dest === 'profile.html') return;
      location.href = dest;
    });
  });

  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', async () => {
      const should = await openLogoutModal();
      if (should) {
        logoutCurrentUser();
      }
    });
  }

  // form refs
  const form            = document.getElementById('profileForm');
  const errEl           = form.querySelector('#err');
  const firstNameEl     = form.querySelector('#firstName');
  const lastNameEl      = form.querySelector('#lastName');
  const phoneEl         = form.querySelector('#phone');
  const emailEl         = form.querySelector('#email');
  const idNumEl         = form.querySelector('#idNumber');
  const companyNameEl   = form.querySelector('#companyName');
  const companyTypeEl   = form.querySelector('#companyType');
  const changePwBtn     = form.querySelector('#changePwBtn');

  // populate form with user data
  firstNameEl.value    = u.firstName    || '';
  lastNameEl.value     = u.lastName     || '';
  phoneEl.value        = u.phone        || '';
  emailEl.value        = u.email        || '';
  idNumEl.value        = u.idNumber     || '';
  companyNameEl.value  = u.companyName  || '';
  companyTypeEl.value  = u.companyType  || '';

  // Save profile
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.style.display = 'none';
    errEl.textContent   = '';

    const data = {
      firstName:    firstNameEl.value.trim(),
      lastName:     lastNameEl.value.trim(),
      phone:        phoneEl.value.trim(),
      email:        emailEl.value.trim(),
      companyName:  companyNameEl.value.trim(),
      companyType:  companyTypeEl.value
      // idNumber read-only
    };

    const res = updateUserProfile(data);

    if (!res || !res.ok) {
      errEl.style.display = 'block';
      errEl.textContent   = (res && res.msg) || 'Could not save.';
      return;
    }

    updateHeader();
    await alertModal('Your profile has been updated.', 'Saved');
  });

  // Change password
  changePwBtn.addEventListener('click', async () => {
    const newPass = await openPasswordModal();
    if (!newPass) return; // cancel

    const r = changeUserPassword(newPass);
    if (!r || !r.ok) {
      await alertModal((r && r.msg) || 'Could not update password.', 'Error');
      return;
    }

    await alertModal('Your password has been updated.', 'Password changed');
  });
}
