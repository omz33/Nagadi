// /Js/adminUserDetail.js
import {
  requireAdminGuard, hasPermission, PERMISSIONS, getUsersMap, setUsersMap, alertModal,
  isSuperAdmin, getUser
} from './app.js';

function getParam(name){ return new URLSearchParams(location.search).get(name); }

async function init() {
  const ok = await requireAdminGuard(); if (!ok) return;

  document.querySelectorAll('.sidebar-link[data-go]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ location.href = `./${btn.getAttribute('data-go')}`; });
  });
  document.getElementById('sidebarLogoutBtn').addEventListener('click', ()=>{ localStorage.removeItem('tn_user'); location.href='./index.html'; });

  const email = getParam('email');
  if (!email) { await alertModal('No user specified.', 'Error'); location.href='./adminUsers.html'; return; }

  const map = getUsersMap();
  const rec = map[email.toLowerCase()];
  if (!rec) { await alertModal('User not found.', 'Error'); location.href='./adminUsers.html'; return; }

  // Fill fields
  document.getElementById('ud_firstName').value = rec.firstName || '';
  document.getElementById('ud_lastName').value  = rec.lastName || '';
  document.getElementById('ud_email').value     = rec.email || '';
  document.getElementById('ud_phone').value     = rec.phone || '';
  document.getElementById('ud_idNumber').value  = rec.idNumber || '';
  document.getElementById('ud_location').value  = rec.location || '';

  const permsPanel = {
    manageUsers: document.getElementById('ud_manageUsers'),
    viewReplyQuotes: document.getElementById('ud_viewReply'),
    approveFinalQuote: document.getElementById('ud_approve'),
    addAdmins: document.getElementById('ud_addAdmins')
  };
  const isSA = isSuperAdmin(rec);
  const me = getUser();
  const canEditPerms = hasPermission(me, PERMISSIONS.addAdmins) || isSuperAdmin(me);

  // Set current perms
  permsPanel.manageUsers.checked    = !!rec.permissions?.manageUsers;
  permsPanel.viewReplyQuotes.checked= !!rec.permissions?.viewReplyQuotes;
  permsPanel.approveFinalQuote.checked = !!rec.permissions?.approveFinalQuote;
  permsPanel.addAdmins.checked      = !!rec.permissions?.addAdmins;

  // Super admin is locked
  const note = document.getElementById('permsNote');
  if (isSA) {
    note.textContent = 'This is the Super Admin. Permissions cannot be changed.';
    Object.values(permsPanel).forEach(inp=>{ inp.disabled = true; });
  } else if (!canEditPerms) {
    note.textContent = 'You do not have permission to change roles.';
    Object.values(permsPanel).forEach(inp=>{ inp.disabled = true; });
  } else {
    note.textContent = '';
  }

  document.getElementById('userDetailForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const newEmail = document.getElementById('ud_email').value.trim();
    const newRec = {
      ...rec,
      firstName: document.getElementById('ud_firstName').value.trim(),
      lastName:  document.getElementById('ud_lastName').value.trim(),
      email:     newEmail,
      phone:     document.getElementById('ud_phone').value.trim(),
      idNumber:  document.getElementById('ud_idNumber').value.trim(),
      location:  document.getElementById('ud_location').value.trim()
    };

    // keep admin flag if already admin OR if originally created by admin (we default admins from admin page)
    newRec.isAdmin = rec.isAdmin;

    if (!isSA && canEditPerms) {
      newRec.permissions = {
        manageUsers: permsPanel.manageUsers.checked,
        viewReplyQuotes: permsPanel.viewReplyQuotes.checked,
        approveFinalQuote: permsPanel.approveFinalQuote.checked,
        addAdmins: permsPanel.addAdmins.checked
      };
    }

    // re-key if email changed and unique
    if (newEmail.toLowerCase() !== rec.email.toLowerCase() && map[newEmail.toLowerCase()]) {
      await alertModal('This email is already registered.', 'Error'); return;
    }
    delete map[rec.email.toLowerCase()];
    map[newEmail.toLowerCase()] = newRec;
    setUsersMap(map);

    await alertModal('User updated.', 'Saved');
    location.href = './adminUsers.html';
  });
}
document.addEventListener('DOMContentLoaded', init);
