// /Js/projectNew.js
import {
  isLoggedIn,
  getUser,
  alertModal,
  updateHeader,
  getProjectsForUser,
  saveProjectsForUser,
  fillCitySelect
} from './app.js';

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
  location.href = './login.html?next=projectNew.html';
} else {
  const u = getUser();

  // sidebar
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  const sidebarLinks = document.querySelectorAll('.sidebar-link[data-go]');
  sidebarLinks.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const dest = btn.getAttribute('data-go');
      if (!dest) return;
      location.href = dest;
    });
  });
  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', async ()=>{
      const should = await openLogoutModal();
      if (should) logoutCurrentUser();
    });
  }

  // form refs
  const form       = document.getElementById('newProjectForm');
  const projErrEl  = form.querySelector('#projErr');
  const imgInput   = form.querySelector('#projectImage');
  const imgPreview = form.querySelector('#imgPreview');
  const companyEl  = form.querySelector('#projectCompany');
  const nameEl     = form.querySelector('#projectName');
  const dateEl     = form.querySelector('#projectDate');
  const locationEl = form.querySelector('#projectLocation');
  const cancelBtn  = form.querySelector('#cancelNewProj');

  // fill default company + cities list
  companyEl.value = u.companyName || '';
  fillCitySelect(locationEl);

  // preview image
  imgInput.addEventListener('change', async ()=>{
    const file = imgInput.files && imgInput.files[0];
    if (!file) { imgPreview.style.backgroundImage = ''; return; }
    const dataUrl = await readFileAsDataURL(file);
    imgPreview.style.backgroundImage = `url('${dataUrl}')`;
  });

  // cancel
  cancelBtn.addEventListener('click', ()=>{ location.href = './projects.html'; });

  // submit: create new project for THIS USER ONLY
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    projErrEl.style.display = 'none';
    projErrEl.textContent   = '';

    const projectName  = nameEl.value.trim();
    const projectDate  = dateEl.value;
    const projectCity  = locationEl.value;
    const companyName  = companyEl.value.trim();

    if (!projectName) {
      projErrEl.style.display = 'block';
      projErrEl.textContent   = 'Project name is required.';
      return;
    }

    const file = imgInput.files && imgInput.files[0];
    const dataUrl = await readFileAsDataURL(file);

    const newProject = {
      id: 'p_' + Date.now(),
      image: dataUrl || '',
      companyName: companyName,
      name: projectName,
      date: projectDate || '',
      location: projectCity || ''
    };

    const all = getProjectsForUser(u);
    all.push(newProject);
    saveProjectsForUser(u, all);

    await alertModal('Project has been added.', 'Saved');
    location.href = './projects.html';
  });
}
