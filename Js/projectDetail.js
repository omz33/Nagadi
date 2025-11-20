// /Js/projectDetail.js
import {
  isLoggedIn,
  getUser,
  alertModal,
  updateHeader,
  getProjectsForUser,
  saveProjectsForUser,
  getCart,
  removeFromCart,
  confirmModal,
  fillCitySelect
} from './app.js';

// ---------- helpers: URL param ----------
function getQueryParam(name) {
  const params = new URLSearchParams(location.search);
  return params.get(name);
}

// ---------- logout helpers ----------
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
        <div class="modal-content">Are you sure you want to log out?</div>
        <div class="modal-actions">
          <button class="btn" id="logoutNo">No</button>
          <button class="btn primary" id="logoutYes">Yes</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    function close(val){ overlay.remove(); resolve(val); }
    overlay.addEventListener('click', (e)=>{ if (e.target === overlay) close(false); });
    overlay.querySelector('#logoutNo').addEventListener('click', ()=>close(false));
    overlay.querySelector('#logoutYes').addEventListener('click', ()=>close(true));
  });
}

// ---------- file -> base64 ----------
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(''); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- PAGE INIT ----------
if (!isLoggedIn()) {
  location.href = './login.html?next=projectDetail.html';
} else {
  const u = getUser();

  // sidebar nav
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  const sidebarLinks = document.querySelectorAll('.sidebar-link[data-go]');
  sidebarLinks.forEach(btn => {
    btn.addEventListener('click', () => {
      const dest = btn.getAttribute('data-go');
      if (!dest) return;
      location.href = dest;
    });
  });
  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', async () => {
      const should = await openLogoutModal();
      if (should) logoutCurrentUser();
    });
  }

  // refs
  const form            = document.getElementById('editProjectForm');
  const projErrEl       = form.querySelector('#projErr');
  const imgInput        = form.querySelector('#projectImage');
  const imgPreview      = form.querySelector('#imgPreview');
  const companyEl       = form.querySelector('#projectCompany');
  const nameEl          = form.querySelector('#projectName');
  const dateEl          = form.querySelector('#projectDate');
  const locationEl      = form.querySelector('#projectLocation');
  const backBtn         = form.querySelector('#backToProjects');
  const deleteBtn       = form.querySelector('#deleteProjectBtn');

  // cart section refs
  const projCartEmptyEl = document.getElementById('projCartEmpty');
  const projCartItemsEl = document.getElementById('projCartItems');

  // current project
  const projectId = getQueryParam('id');
  let allProjects = getProjectsForUser(u);
  let currentProject = allProjects.find(p => p.id === projectId);

  if (!currentProject) {
    alert('Project not found');
    location.href = './projects.html';
  }

  // fill cities + form
  fillCitySelect(locationEl, { value: currentProject.location || '' });

  function fillFormFromProject(p) {
    if (p.image) imgPreview.style.backgroundImage = `url('${p.image}')`;
    companyEl.value  = p.companyName || u.companyName || '';
    nameEl.value     = p.name || '';
    dateEl.value     = p.date || '';
    // location select set already by fillCitySelect
  }
  fillFormFromProject(currentProject);

  // ---- render cart items that belong to this project ----
  function renderProjectCartItems() {
    const projectCartItems = getCart().filter(item => {
      const pid = item.projectId || '__later';
      return pid === projectId;
    });

    projCartItemsEl.innerHTML = '';

    if (!projectCartItems.length) {
      projCartEmptyEl.style.display = 'block';
      return;
    }
    projCartEmptyEl.style.display = 'none';

    for (const it of projectCartItems) {
      const card = document.createElement('div');
      card.className = 'cart-card';

      const info = document.createElement('div');
      info.className = 'cart-info';
      info.innerHTML = `
        <div class="title">${it.product}</div>
        <div class="meta">
          <div>Material: <b>${it.params.material}</b></div>
          <div>Qty: <b>${it.params.qty}</b></div>
          ${it.params.units ? `<div>Units: <b>${it.params.units}</b></div>` : ''}
          ${it.params.mix ? `<div>Mix: <b>${it.params.mix}</b></div>` : ''}
        </div>
        <div class="dims">${it.summaryHTML || ''}</div>
        <div class="dims">${it.summaryHTML2 || ''}</div>
      `;

      const controls = document.createElement('div');
      controls.className = 'cart-price';
      controls.innerHTML = `<button class="btn" data-id="${it.id}">Remove</button>`;

      card.appendChild(info);
      card.appendChild(controls);
      projCartItemsEl.appendChild(card);
    }

    // wire remove buttons in this project cart section
    projCartItemsEl.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmModal('Remove this item from the cart?', {
          title: 'Remove item',
          okText: 'Remove',
          cancelText: 'Cancel'
        });
        if (!ok) return;
        removeFromCart(btn.dataset.id);
        renderProjectCartItems();
      });
    });
  }
  renderProjectCartItems();

  // preview لو غيّر الصورة
  imgInput.addEventListener('change', async () => {
    const file = imgInput.files && imgInput.files[0];
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    imgPreview.style.backgroundImage = `url('${dataUrl}')`;
  });

  // back -> projects list
  backBtn.addEventListener('click', () => { location.href = './projects.html'; });

  // delete project flow
  deleteBtn.addEventListener('click', async () => {
    const yes = await (async ()=>confirm('Delete this project permanently?'))();
    if (!yes) return;
    allProjects = allProjects.filter(p => p.id !== projectId);
    saveProjectsForUser(u, allProjects);
    await alertModal('Project deleted.', 'Deleted');
    location.href = './projects.html';
  });

  // Save Changes
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    projErrEl.style.display = 'none';
    projErrEl.textContent   = '';

    const newName  = nameEl.value.trim();
    const newDate  = dateEl.value;
    const newCity  = locationEl.value;
    const newComp  = companyEl.value.trim();
    let   newImage = currentProject.image || '';

    if (!newName) {
      projErrEl.style.display = 'block';
      projErrEl.textContent   = 'Project name is required.';
      return;
    }

    const file = imgInput.files && imgInput.files[0];
    if (file) newImage = await readFileAsDataURL(file);

    currentProject.name        = newName;
    currentProject.date        = newDate || '';
    currentProject.location    = newCity || '';
    currentProject.companyName = newComp || currentProject.companyName;
    currentProject.image       = newImage;

    const idx = allProjects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      allProjects[idx] = currentProject;
      saveProjectsForUser(u, allProjects);
    }

    await alertModal('Project has been updated.', 'Saved');
    location.href = './projects.html';
  });
}
