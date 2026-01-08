// /Js/app.js  --- core state (auth, users, perms, quotes, cart, header helpers)

const CART_KEY   = 'tn_cart';
const USERS_KEY  = 'tn_users';     // map emailLower -> user record
const USER_KEY   = 'tn_user';      // current session user
const QUOTES_KEY = 'tn_quotes';    // array of quotation requests

// ---- Super Admin (immutable) ----
const SUPER_ADMIN_EMAIL = 'admin@gmail.com';

export const PERMISSIONS = {
  manageUsers: 'manageUsers',
  addAdmins: 'addAdmins',
  viewReplyQuotes: 'viewReplyQuotes',
  approveFinalQuote: 'approveFinalQuote'
};

/* ---------------------------------
   Saudi Cities (shared) + helper to fill a <select>
----------------------------------*/
export const SAUDI_CITIES = [
  'Riyadh','Jeddah','Mecca','Medina','Dammam','Khobar','Dhahran','Tabuk','Abha','Khamis Mushait',
  'Taif','Hail','Jazan','Najran','Al Qassim','Yanbu','Buraidah','Arar','Sakaka','Al Bahah'
];
export function getSaudiCities(){ return SAUDI_CITIES.slice(); }
export function fillCitySelect(selectEl, { value = '', includePlaceholder = true } = {}) {
  if (!selectEl) return;
  const ph = includePlaceholder ? '<option value="" disabled selected>Select city…</option>' : '';
  selectEl.innerHTML = ph + SAUDI_CITIES.map(c=>`<option value="${c}">${c}</option>`).join('');
  if (value) selectEl.value = value;
}

/* ---------------------------------
   Modal helpers (alert/confirm + generic sheet)
----------------------------------*/
let __modalRoot = null;
function ensureModalRoot() {
  if (__modalRoot) return __modalRoot;
  const div = document.createElement('div');
  div.id = 'ui-modal';
  div.className = 'modal hidden';
  div.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-title" id="modalTitle"></div>
      <div class="modal-content"></div>
      <div class="modal-actions"></div>
    </div>
  `;
  document.body.appendChild(div);
  __modalRoot = div;
  return __modalRoot;
}
function showModal({ title = '', message = '', html = '', buttons = [] } = {}) {
  ensureModalRoot();
  const titleEl    = __modalRoot.querySelector('.modal-title');
  const contentEl  = __modalRoot.querySelector('.modal-content');
  const actionsEl  = __modalRoot.querySelector('.modal-actions');

  titleEl.textContent = title || '';
  if (html) contentEl.innerHTML = html; else contentEl.textContent = message || '';
  actionsEl.innerHTML = '';

  return new Promise((resolve) => {
    const close = (value) => {
      __modalRoot.classList.add('hidden');
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);

    buttons.forEach((b) => {
      const btn = document.createElement('button');
      btn.className = `btn ${b.role === 'primary' ? 'primary' : ''}`;
      btn.textContent = b.text || 'OK';
      btn.addEventListener('click', () => close(b.returnValue));
      actionsEl.appendChild(btn);
    });
    __modalRoot.onclick = (e) => { if (e.target === __modalRoot) close(null); };
    __modalRoot.classList.remove('hidden');
    setTimeout(() => actionsEl.querySelector('button')?.focus(), 0);
  });
}
export function alertModal(message, title = 'Notice', opts = {}) {
  const { okText = 'OK' } = opts;
  return showModal({
    title, message,
    buttons: [{ text: okText, role: 'primary', returnValue: true }]
  }).then(() => {});
}
export function confirmModal(message, options = {}) {
  const { title = 'Confirm', okText = 'OK', cancelText = 'Cancel' } = options;
  return showModal({
    title, message,
    buttons: [
      { text: cancelText, returnValue: false },
      { text: okText, role: 'primary', returnValue: true }
    ]
  }).then(v => !!v);
}

// شاشة إدخال نص صغيرة (sheet)
export function openTextSheet({ title='Message', label='Message', placeholder='Type here...', okText='Send' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true" style="max-width:480px">
        <div class="modal-title">${title}</div>
        <div class="modal-content">
          <label class="label" style="display:block;margin-bottom:6px">${label}</label>
          <textarea id="sheetText" rows="5" style="width:100%;border:1px solid var(--border);border-radius:12px;padding:10px"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn" id="sheetCancel">Cancel</button>
          <button class="btn primary" id="sheetOk">${okText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const ta = overlay.querySelector('#sheetText');
    ta.placeholder = placeholder;

    function close(val){ overlay.remove(); resolve(val); }
    overlay.addEventListener('click', (e)=>{ if (e.target === overlay) close(null); });
    overlay.querySelector('#sheetCancel').addEventListener('click', ()=>close(null));
    overlay.querySelector('#sheetOk').addEventListener('click', ()=>close(ta.value.trim()));
    ta.focus();
  });
}

/* ---------------------------------
   Helpers
----------------------------------*/
function validEmail(str) { return /\S+@\S+\.\S+/.test(str); }
function digitsOnly(str){ return /^[0-9]+$/.test(str || ''); }

function cartKeyForUser(email) { return `${CART_KEY}:${String(email || '').toLowerCase()}`; }
function moveCartEmail(oldEmail, newEmail) {
  if (!oldEmail || !newEmail) return;
  const oldKey = cartKeyForUser(oldEmail);
  const newKey = cartKeyForUser(newEmail);
  if (oldKey === newKey) return;
  const oldCartJson = localStorage.getItem(oldKey);
  if (oldCartJson !== null) {
    localStorage.setItem(newKey, oldCartJson);
    localStorage.removeItem(oldKey);
  }
}
function migrateLegacyCartToUser(email) {
  try {
    const legacy = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (Array.isArray(legacy) && legacy.length) {
      localStorage.setItem(cartKeyForUser(email), JSON.stringify(legacy));
      localStorage.removeItem(CART_KEY);
    }
  } catch { /* ignore */ }
}

/* ---------------------------------
   Users map + Super Admin seeding
----------------------------------*/
export function getUsersMap() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); }
  catch { return {}; }
}
export function setUsersMap(map) {
  localStorage.setItem(USERS_KEY, JSON.stringify(map));
}
function seedSuperAdmin() {
  const map = getUsersMap();
  const key = SUPER_ADMIN_EMAIL.toLowerCase();
  if (!map[key]) {
    map[key] = {
      firstName: 'Omar',
      lastName: 'Zakarneh',
      idNumber: 'ADM-0001',
      phone: '0000000000',
      email: SUPER_ADMIN_EMAIL,
      companyName: 'T.Nagadi',
      companyType: 'Admin',
      location: 'Riyadh',
      password: 'admin12345',
      isAdmin: true,
      permissions: {
        [PERMISSIONS.manageUsers]: true,
        [PERMISSIONS.addAdmins]: true,
        [PERMISSIONS.viewReplyQuotes]: true,
        [PERMISSIONS.approveFinalQuote]: true
      }
    };
    setUsersMap(map);
  }
}
seedSuperAdmin();

/* ---------------------------------
   CURRENT USER session
----------------------------------*/
export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
  catch { return null; }
}
export function isLoggedIn() { return !!getUser(); }
export function setUser(userObj) {
  if (userObj) {
    localStorage.setItem(USER_KEY, JSON.stringify(userObj));
    migrateLegacyCartToUser(userObj.email);
  } else {
    localStorage.removeItem(USER_KEY);
  }
  updateHeader();
}

export function isSuperAdmin(uParam) {
  const u = uParam || getUser();
  return (u?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}
export function isAdmin(uParam) {
  const u = uParam || getUser();
  return !!u?.isAdmin;
}
export function hasPermission(uParam, permKey) {
  const u = uParam || getUser();
  if (!u?.isAdmin) return false;
  if (isSuperAdmin(u)) return true;
  return !!u?.permissions?.[permKey];
}
export function canSeeUsersMenu(uParam) {
  const u = uParam || getUser();
  return hasPermission(u, PERMISSIONS.manageUsers) || hasPermission(u, PERMISSIONS.addAdmins) || isSuperAdmin(u);
}
export async function requireAdminGuard() {
  if (!isAdmin()) {
    await alertModal('Unauthorized: admins only.', 'Access Denied');
    location.href = './index.html';
    return false;
  }
  return true;
}
export async function requirePermissionGuard(permKey) {
  if (!hasPermission(getUser(), permKey)) {
    await alertModal('Unauthorized: insufficient permissions.', 'Access Denied');
    location.href = isAdmin() ? './adminProfile.html' : './index.html';
    return false;
  }
  return true;
}

/* ---------------------------------
   Profile mutations
----------------------------------*/
export function updateUserProfile(partial) {
  const current = getUser();
  if (!current) return { ok:false, msg:'Not logged in.' };

  const newFirst = (partial.firstName ?? current.firstName ?? '').trim();
  const newLast  = (partial.lastName  ?? current.lastName  ?? '').trim();
  const newPhone = (partial.phone     ?? current.phone     ?? '').trim();
  const newEmail = (partial.email     ?? current.email     ?? '').trim();
  const newLocation = (partial.location ?? current.location ?? '').trim();

  if (!newFirst || !newLast || !newEmail) return { ok:false, msg:'Please fill all required fields.' };
  if (!validEmail(newEmail)) return { ok:false, msg:'Please enter a valid email.' };
  if (newPhone && !digitsOnly(newPhone)) return { ok:false, msg:'Phone number must be digits only.' };

  const map = getUsersMap();
  const oldEmailLower = (current.email || '').toLowerCase();
  const newEmailLower = newEmail.toLowerCase();

  if (newEmailLower !== oldEmailLower && map[newEmailLower]) {
    return { ok:false, msg:'This email is already registered.' };
  }

  const updatedUser = {
    ...current,
    firstName: newFirst,
    lastName:  newLast,
    phone:     newPhone,
    email:     newEmail,
    location:  newLocation
  };

  if (isSuperAdmin(current)) {
    updatedUser.isAdmin = true;
    updatedUser.permissions = {
      [PERMISSIONS.manageUsers]: true,
      [PERMISSIONS.addAdmins]: true,
      [PERMISSIONS.viewReplyQuotes]: true,
      [PERMISSIONS.approveFinalQuote]: true
    };
  }

  if (newEmailLower !== oldEmailLower) {
    moveCartEmail(current.email, newEmail);
    delete map[oldEmailLower];
    map[newEmailLower] = updatedUser;
  } else {
    map[oldEmailLower] = updatedUser;
  }

  setUsersMap(map);
  setUser(updatedUser);
  return { ok:true, user: updatedUser };
}

export function changeUserPasswordWithCurrent(currentPw, newPw, confirmPw) {
  const user = getUser();
  if (!user) return { ok:false, msg:'Not logged in.' };
  if (!currentPw) return { ok:false, msg:'Please enter current password.' };
  if (!newPw || newPw.length < 6) return { ok:false, msg:'Password must be at least 6 characters.' };
  if (newPw !== confirmPw) return { ok:false, msg:'New passwords do not match.' };

  const map = getUsersMap();
  const rec = map[(user.email || '').toLowerCase()];
  if (!rec) return { ok:false, msg:'Account record not found.' };
  if (rec.password !== currentPw) return { ok:false, msg:'Current password is incorrect.' };

  map[(user.email || '').toLowerCase()] = { ...rec, password: newPw };
  setUsersMap(map);
  setUser({ ...user, password: newPw });

  return { ok:true };
}

/* ---------------------------------
   PROJECTS per user
----------------------------------*/
export function getUserKey(u) { return u?.idNumber || u?.email || 'defaultUser'; }
export function getProjectsForUser(uParam) {
  const u = uParam || getUser();
  const key = 'projects_' + getUserKey(u);
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}
export function saveProjectsForUser(uParam, arr) {
  const u = uParam || getUser();
  const key = 'projects_' + getUserKey(u);
  localStorage.setItem(key, JSON.stringify(arr));
}

/* ---------------------------------
   CART (per-user)
----------------------------------*/
function getActiveCartKey() {
  const u = getUser();
  if (!u?.email) return null;
  return cartKeyForUser(u.email);
}
export function getCart() {
  const key = getActiveCartKey();
  if (!key) return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}
export function setCart(items) {
  const key = getActiveCartKey();
  if (!key) { console.warn('setCart with no logged-in user'); return; }
  localStorage.setItem(key, JSON.stringify(items));
  updateHeader();
}
export function clearCart() {
  const key = getActiveCartKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify([]));
  updateHeader();
}
export async function addToCart(item) {
  if (!isLoggedIn()) return requireLogin();

  const u = getUser();
  if (isAdmin(u)) {
    await alertModal('you are admin you cant add items', 'Not allowed');
    return;
  }

  const projects = getProjectsForUser(u);
  const chosenProjectId = await openProjectAssignModal(projects);
  if (!chosenProjectId) return;

  const items = getCart();
  items.push({ ...item, projectId: chosenProjectId });
  setCart(items);

  await alertModal('Added to cart.', 'Added');
}
export function removeFromCart(id) { setCart(getCart().filter(x => x.id !== id)); }
export function formatMoney(n) {
  if (isNaN(n)) return '—';
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------------------------------
   Quotes (Requests) store
----------------------------------*/
export function getQuotes() {
  try { return JSON.parse(localStorage.getItem(QUOTES_KEY) || '[]'); }
  catch { return []; }
}
export function saveQuotes(arr) { localStorage.setItem(QUOTES_KEY, JSON.stringify(arr)); }

function genQuoteId() {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth()+1).padStart(2,'0');
  const d = String(t.getDate()).padStart(2,'0');
  const seq = Math.floor(Math.random()*9000 + 1000);
  return `Q${y}${m}${d}-${seq}`;
}
function nowIso(){ return new Date().toISOString(); }

export const QUOTE_STATUS = {
  Pending: 'Pending',
  InReview: 'In Review',
  Quoted: 'Quoted',
  NeedsRevision: 'Needs Revision',
  Approved: 'Approved',
  Rejected: 'Closed / Rejected'
};

export function createQuotationFromCartGroup(projectId) {
  const u = getUser();
  if (!u) return { ok:false, msg:'Not logged in.' };

  const itemsAll = getCart();
  const items = itemsAll.filter(it => (it.projectId || '__later') === projectId);
  if (!items.length) return { ok:false, msg:'No items in this project group.' };

  const reqItems = items.map((it, idx) => ({
    id: it.id || `item-${idx+1}`,
    name: it.product,
    qty: Number(it.params?.qty) || 1,
    unit: it.params?.units || '',
    specs: (it.summaryHTML || '') + (it.summaryHTML2 ? ' ' + it.summaryHTML2 : '')
  }));

  const projects = getProjectsForUser(u);
  const projectRec = projectId === '__later' ? null : projects.find(p=>p.id===projectId);
  const projectName = projectRec ? (projectRec.name || '(Project)') : '(Unassigned)';
  // *** IMPORTANT: use the project's location (fallback to user location) ***
  const projectLocation = projectRec?.location || u.location || '';

  const rec = {
    id: genQuoteId(),
    clientEmail: u.email,
    clientFirstName: u.firstName,
    clientLastName: u.lastName,
    phone: u.phone,
    companyName: u.companyName || '',
    companyType: u.companyType || '',
    projectName,
    projectLocation,  // <<— fixed source
    items: reqItems,
    clientNotes: '',
    status: QUOTE_STATUS.Pending,
    statusHistory: [{ from: null, to: QUOTE_STATUS.Pending, at: nowIso(), by: u.email }],
    adminReply: null,
    messages: [],
    clientUnread: false,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  const arr = getQuotes();
  arr.push(rec);
  saveQuotes(arr);
  return { ok:true, id: rec.id };
}

export function findQuoteById(id) {
  return getQuotes().find(q => q.id === id);
}
export function updateQuote(id, mutatorFn) {
  const arr = getQuotes();
  const idx = arr.findIndex(q => q.id === id);
  if (idx === -1) return { ok:false, msg:'Quote not found' };
  const q = arr[idx];
  const updated = mutatorFn({ ...q }) || q;
  updated.updatedAt = nowIso();
  arr[idx] = updated;
  saveQuotes(arr);
  return { ok:true, quote: updated };
}
export function changeQuoteStatus(id, newStatus, byEmail) {
  return updateQuote(id, (q) => {
    if (q.status !== newStatus) {
      q.statusHistory.push({ from: q.status, to: newStatus, at: nowIso(), by: byEmail });
      q.status = newStatus;
    }
    return q;
  });
}
export function adminReplyToQuote(id, replyPayload, adminEmail) {
  const ok = updateQuote(id, (q) => {
    q.adminReply = {
      perItem: (replyPayload.perItem || []).map(r => ({
        id: r.id,
        unitPrice: Number(r.unitPrice) || 0,
        notes: r.notes || ''
      })),
      deliveryCost: Number(replyPayload.deliveryCost) || 0,
      discount: Number(replyPayload.discount) || 0,
      overallNotes: replyPayload.overallNotes || '',
      validUntil: replyPayload.validUntil || null
    };

    const mapPrice = Object.fromEntries(q.adminReply.perItem.map(x => [x.id, x.unitPrice]));
    const subtotals = q.items.map(it => (Number(it.qty)||0) * (mapPrice[it.id] || 0));
    const sum = subtotals.reduce((a,b)=>a+b, 0);
    const grand = Math.max(0, sum + q.adminReply.deliveryCost - q.adminReply.discount);
    q.adminReply.subtotals = subtotals;
    q.adminReply.grandTotal = grand;

    q.messages.push({ author:'admin', byEmail:adminEmail, text:'Quotation sent.', at: nowIso() });
    q.clientUnread = true;
    return q;
  }).ok;
  if (ok) changeQuoteStatus(id, QUOTE_STATUS.Quoted, adminEmail);
  return ok;
}
export function adminAskForClarification(id, text, adminEmail) {
  const ok = updateQuote(id, (q) => {
    q.messages.push({ author:'admin', byEmail:adminEmail, text: text || 'Need clarification.', at: nowIso() });
    q.clientUnread = true;
    return q;
  }).ok;
  if (ok) changeQuoteStatus(id, QUOTE_STATUS.NeedsRevision, adminEmail);
  return ok;
}
export function adminApproveFinal(id, adminEmail) {
  const ok = updateQuote(id, (q)=>q).ok;
  if (ok) changeQuoteStatus(id, QUOTE_STATUS.Approved, adminEmail);
  return ok;
}
export function clientMarkSeen(id) {
  return updateQuote(id, (q) => { q.clientUnread = false; return q; });
}
export function clientApproveQuote(id, clientEmail) {
  const ok = updateQuote(id, (q)=>{ q.messages.push({author:'client', byEmail:clientEmail, text:'Approved by client.', at: nowIso()}); return q; }).ok;
  if (ok) changeQuoteStatus(id, QUOTE_STATUS.Approved, clientEmail);
  return ok;
}
export function clientRequestRevision(id, text, clientEmail) {
  const ok = updateQuote(id, (q)=>{ q.messages.push({author:'client', byEmail:clientEmail, text:text||'', at: nowIso()}); return q; }).ok;
  if (ok) changeQuoteStatus(id, QUOTE_STATUS.NeedsRevision, clientEmail);
  return ok;
}
export function quotesForUser(email) {
  const em = (email || '').toLowerCase();
  return getQuotes().filter(q => (q.clientEmail || '').toLowerCase() === em);
}
export function deleteQuote(id) {
  const arr = getQuotes();
  const newArr = arr.filter(q => q.id !== id);
  saveQuotes(newArr);
  return { ok:true };
}

/* ---------------------------------
   Navigation helpers
----------------------------------*/
export async function requireLogin() {
  const here = location.pathname.split('/').pop() || 'index.html';
  const go = await confirmModal('Please log in first to continue.', {
    title: 'Login required', okText: 'Go to Login', cancelText: 'Cancel'
  });
  if (go) location.href = `./login.html?next=${encodeURIComponent(here)}`;
  return false;
}

/* ---------------------------------
   Header updater
----------------------------------*/
export function updateHeader() {
  const countEl     = document.getElementById('cartCount');
  const loginLink   = document.getElementById('loginLink');
  const cartLink    = document.getElementById('cartLink');
  const profileLink = document.getElementById('profileLink');

  if (countEl) countEl.textContent = getCart().length;

  const logged = isLoggedIn();
  const u = getUser();

  if (profileLink) {
    if (logged) {
      profileLink.style.display = '';
      profileLink.setAttribute('href', isAdmin(u) ? './adminProfile.html' : './profile.html');
    } else {
      profileLink.style.display = 'none';
    }
  }

  if (loginLink) {
    loginLink.textContent = logged ? 'Logout' : 'Login';
    loginLink.onclick = async (e) => {
      if (!logged) return; // normal nav
      e.preventDefault();
      const ok = await confirmModal('Are you sure you want to log out?', {
        title: 'Logout', okText: 'Logout', cancelText: 'Cancel'
      });
      if (ok) {
        setUser(null);
        location.href = './index.html';
      }
    };
    if (!logged) loginLink.setAttribute('href', './login.html');
    else loginLink.setAttribute('href', '#');
  }

  if (cartLink) cartLink.setAttribute('href', './cart.html');
}

/* ---------------------------------
   Project-assign modal when adding to cart
----------------------------------*/
function openProjectAssignModal(projectsArr) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    let optsHtml = `<option value="__later">Select later</option>`;
    projectsArr.forEach(p => { optsHtml += `<option value="${p.id}">${p.name || '(Project)'}</option>`; });
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true" style="max-width:360px">
        <div class="modal-title">For which project?</div>
        <div class="modal-content">
          <label class="label" style="margin-bottom:6px;display:block;">Project</label>
          <select id="projPick" style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(0,0,0,0.25);background:#fff;">
            ${optsHtml}
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn" id="projCancel">Cancel</button>
          <button class="btn primary" id="projAdd">Add</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    function close(val) { overlay.remove(); resolve(val); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    overlay.querySelector('#projCancel').addEventListener('click', () => close(null));
    overlay.querySelector('#projAdd').addEventListener('click', () => {
      const sel = overlay.querySelector('#projPick').value || '__later';
      close(sel);
    });
  });
}

// auto run on pages that import this file
document.addEventListener('DOMContentLoaded', updateHeader);
