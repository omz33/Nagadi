// /Js/adminProfile.js
import {
  getUser, isAdmin, requireAdminGuard, canSeeUsersMenu, PERMISSIONS, hasPermission,
  setUser, updateUserProfile, alertModal, changeUserPasswordWithCurrent, fillCitySelect
} from './app.js';

function eyeToggles(root=document){
  root.querySelectorAll('.password-field .eye').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const input = btn.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('shown', show);
    });
  });
}

async function init() {
  const ok = await requireAdminGuard(); if (!ok) return;

  // Sidebar links
  const usersBtn  = document.getElementById('usersMenuBtn');
  const quotesBtn = document.getElementById('quotesMenuBtn');
  if (usersBtn) {
    if (canSeeUsersMenu()) {
      usersBtn.addEventListener('click', ()=>{ location.href='./adminUsers.html'; });
    } else {
      usersBtn.style.display = 'none';
    }
  }
  if (quotesBtn) {
    if (hasPermission(getUser(), PERMISSIONS.viewReplyQuotes)) {
      quotesBtn.addEventListener('click', ()=>{ location.href='./adminQuotations.html'; });
    } else {
      quotesBtn.style.display = 'none';
    }
  }
  const logoutBtn = document.getElementById('sidebarLogoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', ()=>{ localStorage.removeItem('tn_user'); location.href='./index.html'; });

  // Fill profile
  const u = getUser();
  document.getElementById('firstName').value = u.firstName || '';
  document.getElementById('lastName').value  = u.lastName  || '';
  document.getElementById('phone').value     = u.phone     || '';
  document.getElementById('email').value     = u.email     || '';

  // fill cities select (and select current value)
  fillCitySelect(document.getElementById('location'), { value: u.location || '' });

  document.getElementById('adminProfileForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const res = updateUserProfile({
      firstName: document.getElementById('firstName').value.trim(),
      lastName:  document.getElementById('lastName').value.trim(),
      phone:     document.getElementById('phone').value.trim(),
      email:     document.getElementById('email').value.trim(),
      location:  document.getElementById('location').value
    });
    if (!res.ok) { await alertModal(res.msg || 'Update failed', 'Error'); return; }
    setUser(res.user);
    await alertModal('Profile updated successfully.', 'Saved');
  });

  eyeToggles();

  document.getElementById('adminPwForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const cur = document.getElementById('curPw').value;
    const n1 = document.getElementById('newPw').value;
    const n2 = document.getElementById('newPw2').value;
    const res = changeUserPasswordWithCurrent(cur, n1, n2);
    if (!res.ok) { await alertModal(res.msg || 'Password change failed', 'Error'); return; }
    await alertModal('Password changed successfully.', 'Saved');
    document.getElementById('curPw').value = '';
    document.getElementById('newPw').value = '';
    document.getElementById('newPw2').value = '';
  });
}
document.addEventListener('DOMContentLoaded', init);
