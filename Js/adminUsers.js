// /Js/adminUsers.js
import {
  requireAdminGuard, canSeeUsersMenu, hasPermission, PERMISSIONS, getUsersMap, setUsersMap,
  alertModal, getUser, isSuperAdmin, fillCitySelect
} from './app.js';

function cardForUser(u) {
  const perms = u.isAdmin ? [
    u.permissions?.manageUsers ? 'Manage Users' : null,
    u.permissions?.viewReplyQuotes ? 'Quotations' : null,
    u.permissions?.approveFinalQuote ? 'Approve Final' : null,
    u.permissions?.addAdmins ? 'Add Admins' : null
  ].filter(Boolean) : ['(regular)'];

  const isSA = isSuperAdmin(u);
  const tags = perms.length ? perms.map(p=>`<span class="tag">${p}</span>`).join(' ') : '<span class="tag">No perms</span>';

  const actions = `
    <div class="actions" style="margin-top:8px">
      <a class="btn" href="./adminUserDetail.html?email=${encodeURIComponent(u.email)}">Open</a>
      <button class="btn danger" data-del="${u.email}">Delete</button>
    </div>
  `;

  const loc = u.location || '-';
  return `
    <div class="proj-card">
      <div class="proj-img" style="display:flex;align-items:center;justify-content:center;color:#fff;background:#2f3d4c">👤</div>
      <div class="proj-info">
        <div class="proj-name">${u.firstName || ''} ${u.lastName || ''} ${isSA ? '⭐' : ''}</div>
        <div class="proj-meta">Email: ${u.email}</div>
        <div class="proj-meta">Phone: ${u.phone || '-'}</div>
        <div class="proj-meta">Location: ${loc}</div>
        <div class="tags" style="margin-top:8px">${tags}</div>
        ${actions}
      </div>
    </div>
  `;
}

async function init() {
  const ok = await requireAdminGuard(); if (!ok) return;
  if (!canSeeUsersMenu()) { await alertModal('Unauthorized: no Users permissions.', 'Access Denied'); location.href='./adminProfile.html'; return; }

  document.querySelectorAll('.sidebar-link[data-go]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ location.href = `./${btn.getAttribute('data-go')}`; });
  });
  document.getElementById('sidebarLogoutBtn').addEventListener('click', ()=>{ localStorage.removeItem('tn_user'); location.href='./index.html'; });

  // Sections visibility
  const canAdd = hasPermission(getUser(), PERMISSIONS.addAdmins);
  const canManage = hasPermission(getUser(), PERMISSIONS.manageUsers) || isSuperAdmin(getUser());
  if (canAdd) document.getElementById('addUserSection').style.display = '';
  if (canManage) document.getElementById('listUsersSection').style.display = '';

  // Add New User form
  if (canAdd) {
    fillCitySelect(document.getElementById('au_location'));
    document.getElementById('addUserForm').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const firstName = document.getElementById('au_firstName').value.trim();
      const lastName  = document.getElementById('au_lastName').value.trim();
      const email     = document.getElementById('au_email').value.trim();
      const password  = document.getElementById('au_password').value;
      const idNumber  = document.getElementById('au_idNumber').value.trim();
      const phone     = document.getElementById('au_phone').value.trim();
      const location  = document.getElementById('au_location').value;

      if (!firstName || !lastName || !email || !password || !idNumber || !location) {
        await alertModal('Please fill all required fields.', 'Error'); return;
      }
      const map = getUsersMap();
      const key = email.toLowerCase();
      if (map[key]) { await alertModal('This email is already registered.', 'Error'); return; }

      const perms = {
        manageUsers: document.getElementById('p_manageUsers').checked,
        viewReplyQuotes: document.getElementById('p_viewReply').checked,
        approveFinalQuote: document.getElementById('p_approve').checked,
        addAdmins: document.getElementById('p_addAdmins').checked
      };

      map[key] = {
        firstName, lastName, idNumber, phone, email, password,
        companyName: '', companyType: 'Admin-Created',
        location, isAdmin: true, permissions: perms
      };
      setUsersMap(map);
      await alertModal('User created successfully. (Marked as Admin)', 'Created');
      location.reload();
    });
  }

  // Load current users
  if (canManage) {
    const grid = document.getElementById('usersGrid');
    const map = getUsersMap();
    const users = Object.values(map);
    grid.innerHTML = users.map(u => cardForUser(u)).join('');

    // delete
    grid.querySelectorAll('button[data-del]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const email = btn.getAttribute('data-del');
        if (email.toLowerCase() === 'omar.zakarneh44@gmail.com') {
          await alertModal('you cant delete this admin', 'Protected'); return;
        }
        const ok = await alertModal('Delete this user?', 'Confirm').then(()=>true);
        if (!ok) return;
        const m = getUsersMap();
        delete m[email.toLowerCase()];
        setUsersMap(m);
        await alertModal('User deleted.', 'Done');
        location.reload();
      });
    });
  } else {
    document.getElementById('usersGrid')?.closest('section')?.remove();
  }
}
document.addEventListener('DOMContentLoaded', init);
