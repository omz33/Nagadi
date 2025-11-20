// /Js/myRequests.js
import {
  getUser, isAdmin, quotesForUser, findQuoteById, clientMarkSeen, clientApproveQuote, clientRequestRevision,
  alertModal, formatMoney, openTextSheet, QUOTE_STATUS
} from './app.js';

function card(q) {
  return `
    <div class="proj-card" data-open="${q.id}">
      <div class="proj-img" style="display:flex;align-items:center;justify-content:center;color:#fff;background:#4a5b38">📄</div>
      <div class="proj-info">
        <div class="proj-name">#${q.id}</div>
        <div class="proj-meta">Project: ${q.projectName}</div>
        <div class="proj-meta">Location: ${q.projectLocation || '-'}</div>
        <div class="proj-meta">Date: ${new Date(q.createdAt).toLocaleDateString()}</div>
        <div class="proj-meta">Status: <b>${q.status}</b> ${q.clientUnread ? '<span class="tag" style="border-color:#c6534e;color:#c6534e">NEW</span>' : ''}</div>
      </div>
    </div>
  `;
}

function clientQuoteHtml(q) {
  const reply = q.adminReply;
  if (!reply) {
    return `
      <div class="cart-group">
        <div class="cart-group-title">Request #${q.id} — ${q.projectName}</div>
        <div class="muted small">Project Location: ${q.projectLocation || '-'}</div>
        <div class="muted">No quotation yet. Status: ${q.status}</div>
      </div>
    `;
  }
  const priceMap = Object.fromEntries(reply.perItem.map(x=>[x.id, x]));
  const itemsHtml = q.items.map((it)=>{
    const p = priceMap[it.id] || { unitPrice:0, notes:'' };
    const subtotal = (Number(it.qty)||0) * (Number(p.unitPrice)||0);
    return `
      <div class="cart-card">
        <div class="cart-info">
          <div class="title">${it.name}</div>
          <div class="meta"><div>Qty: <b>${it.qty}</b></div> <div>Unit: <b>${it.unit||'-'}</b></div></div>
          <div class="dims">${it.specs||''}</div>
          <div class="muted">Unit Price: <b>${formatMoney(p.unitPrice||0)}</b> &nbsp; | &nbsp; Subtotal: <b>${formatMoney(subtotal)}</b></div>
          ${p.notes ? `<div class="muted">Notes: ${p.notes}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const totals = `
    <div class="breakdown" style="margin-top:8px">
      <div class="line"><span>Delivery Cost</span><b>${formatMoney(reply.deliveryCost||0)}</b></div>
      <div class="line"><span>Discount</span><b>${formatMoney(reply.discount||0)}</b></div>
      <div class="sum line"><span>Grand Total</span><b>${formatMoney(reply.grandTotal||0)}</b></div>
      <div class="line"><span>Offer Valid Until</span><b>${reply.validUntil || '-'}</b></div>
      <div class="line"><span>Status</span><b>${q.status}</b></div>
      ${reply.overallNotes ? `<div class="line"><span>Notes</span><b>${reply.overallNotes}</b></div>` : ''}
    </div>
  `;

  return `
    <div class="cart-group">
      <div class="cart-group-title">Request #${q.id} — ${q.projectName}</div>
      <div class="muted small">Project Location: ${q.projectLocation || '-'}</div>
      <div class="cart-items">${itemsHtml}</div>
      ${totals}
    </div>
  `;
}

function messagesHtml(q) {
  if (!q.messages?.length) return '<div class="muted">No messages yet.</div>';
  return q.messages.map(m=>`
    <div class="cart-card">
      <div class="cart-info">
        <div class="title">${m.author === 'admin' ? 'Admin' : 'You'} — ${new Date(m.at).toLocaleString()}</div>
        <div>${m.text || ''}</div>
      </div>
    </div>
  `).join('');
}

function detailTemplate(q) {
  const canAct = !!q.adminReply && q.status === QUOTE_STATUS.Quoted;
  return `
    <div class="cart-group">
      <div id="clientView">${clientQuoteHtml(q)}</div>
    </div>

    <div class="form-actions" id="clientActions" style="display:${canAct ? 'flex' : 'none'}">
      <button class="btn good" id="btnClientApprove">Approve this Quotation</button>
      <button class="btn" id="btnClientRev">Request Revision</button>
    </div>

    <div class="cart-group" style="margin-top:10px">
      <div class="cart-group-title">Conversation</div>
      <div id="msgList">${messagesHtml(q)}</div>
    </div>
  `;
}

let selId = null;

function guard() {
  const u = getUser();
  if (!u) { location.href='./login.html?next=myRequests.html'; return false; }
  if (isAdmin(u)) { location.href='./adminProfile.html'; return false; }
  return true;
}

async function init() {
  if (!guard()) return;

  // sidebar go
  document.querySelectorAll('.sidebar-link[data-go]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ location.href = `./${btn.getAttribute('data-go')}`; });
  });
  const logout = document.getElementById('sidebarLogoutBtn');
  if (logout) logout.addEventListener('click', ()=>{ localStorage.removeItem('tn_user'); location.href='./index.html'; });

  const u = getUser();
  renderList(u.email);
}

function renderList(email) {
  const arr = quotesForUser(email).slice().sort((a,b)=> (b.updatedAt||'').localeCompare(a.updatedAt||''));
  document.getElementById('reqsGrid').innerHTML = arr.map(card).join('');

  document.querySelectorAll('[data-open]').forEach(c=>{
    c.addEventListener('click', ()=>{
      const id = c.getAttribute('data-open');
      openDetail(id);
    });
  });
}

function openDetail(id) {
  selId = id;
  const q = findQuoteById(id);
  const det = document.getElementById('detailSection');
  det.style.display = '';
  det.innerHTML = detailTemplate(q);

  clientMarkSeen(id);

  const btnApprove = document.getElementById('btnClientApprove');
  const btnRev     = document.getElementById('btnClientRev');

  if (btnApprove) {
    btnApprove.onclick = async ()=>{
      const u = getUser();
      clientApproveQuote(id, u.email);
      await alertModal('Quotation approved. Thank you!', 'Approved');
      openDetail(id);
      renderList(u.email);
    };
  }

  if (btnRev) {
    btnRev.onclick = async ()=>{
      const text = await openTextSheet({
        title:'Request Revision',
        label:'What should we change?',
        placeholder:'e.g., Change location to Tabuk, adjust diameter ...',
        okText:'Send'
      });
      if (text === null || text === '') return;
      const u = getUser();
      clientRequestRevision(id, text, u.email);
      await alertModal('Revision requested. We will respond soon.', 'Sent');
      openDetail(id);
      renderList(u.email);
    };
  }
}

document.addEventListener('DOMContentLoaded', init);
