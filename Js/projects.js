// /Js/projects.js
import {
  isLoggedIn,
  getUser,
  updateHeader
} from './app.js';

// ------------ user-scoped projects ------------
function getUserKey(u) {
  return u.idNumber || u.email || 'defaultUser';
}

function getProjectsForUser(u) {
  const key = 'projects_' + getUserKey(u);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

// ------------ logout logic ------------
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

// ------------ render cards ------------
function renderAllProjects(gridEl, userObj) {
  const projects = getProjectsForUser(userObj);

  let html = `
    <div class="proj-card add-card" id="addProjectCard">
      <div class="add-card-inner">
        <div class="add-plus">+</div>
        <div class="add-text">Add New Project</div>
      </div>
    </div>
  `;

  projects.forEach(p => {
    html += `
      <div class="proj-card" data-id="${p.id}">
        <div class="proj-img"
             style="background-image:url('${p.image || ''}');${p.image ? '' : 'background-color:#d0d4d8;'}"></div>
        <div class="proj-info">
          <div class="proj-name">${p.name || 'Untitled Project'}</div>
          <div class="proj-meta">
            <div>${p.companyName || userObj.companyName || ''}</div>
            <div>${p.location || ''}</div>
          </div>
        </div>
      </div>
    `;
  });

  gridEl.innerHTML = html;

  // زر إضافة مشروع
  const addCard = gridEl.querySelector('#addProjectCard');
  if (addCard) {
    addCard.addEventListener('click', () => {
      location.href = './projectNew.html';
    });
  }

  // كروت المشاريع -> افتح صفحة التفاصيل
  gridEl.querySelectorAll('.proj-card:not(.add-card)').forEach(card => {
    card.addEventListener('click', () => {
      const pid = card.getAttribute('data-id');
      location.href = `./projectDetail.html?id=${encodeURIComponent(pid)}`;
    });
  });
}

// ------------ PAGE INIT ------------
if (!isLoggedIn()) {
  location.href = './login.html?next=projects.html';
} else {
  const u = getUser();

  // sidebar actions
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  const sidebarLinks = document.querySelectorAll('.sidebar-link[data-go]');
  sidebarLinks.forEach(btn => {
    btn.addEventListener('click', () => {
      const dest = btn.getAttribute('data-go');
      if (!dest) return;
      if (dest === 'projects.html') return;
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

  // render
  const gridEl = document.getElementById('projectsGridFull');
  renderAllProjects(gridEl, u);
}
