// /Js/cart.js
import {
  getCart, setCart, removeFromCart, isLoggedIn, requireLogin, updateHeader,
  confirmModal, alertModal, getUser, getProjectsForUser, isAdmin,
  createQuotationFromCartGroup, clearCart
} from './app.js';

function render() {
  updateHeader();

  const wrapEmpty = document.getElementById('cartEmpty');
  const wrapList = document.getElementById('cartList');
  const groupsDiv = document.getElementById('projectGroups');

  const items = getCart();
  const has = items.length > 0;

  wrapEmpty.style.display = has ? 'none' : 'block';
  wrapList.style.display  = has ? 'block' : 'none';

  if (!has) { groupsDiv.innerHTML = ''; return; }

  const grouped = {};
  for (const it of items) {
    const pid = it.projectId || '__later';
    if (!grouped[pid]) grouped[pid] = [];
    grouped[pid].push(it);
  }

  const user = getUser();
  const projects = getProjectsForUser(user);
  const nameById = {};
  projects.forEach(p => { nameById[p.id] = p.name || '(Project)'; });

  function buildProjectOptionsHtml(currentPid) {
    const current = currentPid || '__later';
    let html = `<option value="__later"${current==='__later'?' selected':''}>Select later</option>`;
    projects.forEach(p => {
      const sel = current === p.id ? ' selected' : '';
      const nm  = p.name || '(Project)';
      html += `<option value="${p.id}"${sel}>${nm}</option>`;
    });
    return html;
  }

  groupsDiv.innerHTML = '';

  Object.keys(grouped).forEach(pid => {
    const projItems = grouped[pid];
    const groupEl = document.createElement('div');
    groupEl.className = 'cart-group';

    const titleTxt = pid === '__later' ? 'Select project later' : (nameById[pid] || '(Project)');
    const titleEl = document.createElement('h3');
    titleEl.className = 'cart-group-title';
    titleEl.textContent = titleTxt;
    groupEl.appendChild(titleEl);

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'cart-items';

    projItems.forEach(it => {
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
      controls.innerHTML = `
        <label style="display:block;font-size:12px;font-weight:500;margin-bottom:4px;">Change project</label>
        <select class="projChange" data-id="${it.id}" style="width:100%;max-width:180px;border-radius:8px;padding:6px 8px;border:1px solid rgba(0,0,0,0.25);margin-bottom:8px;">
          ${buildProjectOptionsHtml(it.projectId || '__later')}
        </select>
        <button class="btn" data-remove="${it.id}">Remove</button>
      `;

      card.appendChild(info);
      card.appendChild(controls);
      itemsDiv.appendChild(card);
    });

    groupEl.appendChild(itemsDiv);

    const footer = document.createElement('div');
    footer.className = 'cart-footer';
    footer.innerHTML = `
      <div style="display:flex; gap:10px; flex-wrap:wrap">
        <button class="btn group-clear" data-proj="${pid}">Clear cart</button>
        <button class="btn primary group-quote" data-proj="${pid}">Request a quotation</button>
      </div>
    `;
    groupEl.appendChild(footer);

    groupsDiv.appendChild(groupEl);
  });

  groupsDiv.querySelectorAll('button[data-remove]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmModal('Remove this item from the cart?', {
        title: 'Remove item', okText: 'Remove', cancelText: 'Cancel'
      });
      if (ok) { removeFromCart(btn.dataset.remove); render(); }
    });
  });

  groupsDiv.querySelectorAll('select.projChange').forEach(sel => {
    sel.addEventListener('change', () => {
      const itemId = sel.getAttribute('data-id');
      const newPid = sel.value || '__later';
      const newItems = getCart().map(ci => ci.id === itemId ? { ...ci, projectId: newPid } : ci);
      setCart(newItems);
      render();
    });
  });

  groupsDiv.querySelectorAll('.group-clear').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmModal('Clear ALL cart items?', {
        title: 'Clear cart', okText: 'Clear', cancelText: 'Cancel'
      });
      if (!ok) return;
      clearCart();
      render();
    });
  });

  groupsDiv.querySelectorAll('.group-quote').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!isLoggedIn()) return requireLogin();
      if (isAdmin(getUser())) {
        await alertModal('you are admin you cant send', 'Not allowed');
        return;
      }
      const projId = btn.getAttribute('data-proj');
      const res = createQuotationFromCartGroup(projId);
      if (!res.ok) {
        await alertModal(res.msg || 'Failed to submit request.', 'Error');
        return;
      }
      // تفريغ السلة بالكامل بعد الإرسال
      clearCart();
      render();
      await alertModal('Quotation request submitted. Your cart has been cleared.', 'Request submitted');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => { render(); });
