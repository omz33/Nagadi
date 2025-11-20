// /Js/adminQuotations.js
import {
  requireAdminGuard, hasPermission, PERMISSIONS, getQuotes, findQuoteById, adminReplyToQuote,
  adminAskForClarification, adminApproveFinal, alertModal, getUser, changeQuoteStatus, QUOTE_STATUS,
  openTextSheet, formatMoney, deleteQuote
} from './app.js';

function quoteCard(q) {
  const hasReply = !!q.adminReply;
  const priceLine = hasReply
    ? `<div class="proj-meta">
         <b>Grand:</b> ${formatMoney(q.adminReply.grandTotal||0)}
         &nbsp; • &nbsp;<b>Delivery:</b> ${formatMoney(q.adminReply.deliveryCost||0)}
         &nbsp; • &nbsp;<b>Discount:</b> ${formatMoney(q.adminReply.discount||0)}
       </div>`
    : `<div class="proj-meta muted">No pricing yet</div>`;
  return `
    <div class="proj-card" data-open="${q.id}">
      <div class="proj-img" style="display:flex;align-items:center;justify-content:center;color:#fff;background:#1a2430">📄</div>
      <div class="proj-info">
        <div class="proj-name">#${q.id}</div>
        <div class="proj-meta">Project: ${q.projectName}</div>
        <div class="proj-meta">Location: ${q.projectLocation || '-'}</div>
        <div class="proj-meta">Client: ${q.clientFirstName} ${q.clientLastName} — <span class="muted">${q.clientEmail}</span> — <span class="muted">${q.phone || '-'}</span></div>
        <div class="proj-meta">Status: <b>${q.status}</b></div>
        ${priceLine}
      </div>
    </div>
  `;
}

function detailHeaderHtml(q) {
  return `
    <div class="cart-group">
      <div class="cart-group-title">Request #${q.id}</div>
      <div class="breakdown" style="margin-top:8px">
        <div class="line"><span>Client</span><b>${q.clientFirstName} ${q.clientLastName}</b></div>
        <div class="line"><span>Email</span><b>${q.clientEmail}</b></div>
        <div class="line"><span>Phone</span><b>${q.phone || '-'}</b></div>
        <div class="line"><span>Company</span><b>${q.companyName || '-'}</b></div>
        <div class="line"><span>Project</span><b>${q.projectName}</b></div>
        <div class="line"><span>Location</span><b>${q.projectLocation || '-'}</b></div>
        <div class="line"><span>Status</span><b>${q.status}</b></div>
      </div>
    </div>
  `;
}

function itemsListHtml(q) {
  return q.items.map(it=>`
    <div class="cart-card">
      <div class="cart-info">
        <div class="title">${it.name}</div>
        <div class="meta"><div>Qty: <b>${it.qty}</b></div> <div>Unit: <b>${it.unit||'-'}</b></div></div>
        <div class="dims">${it.specs||''}</div>
      </div>
    </div>
  `).join('');
}

function pricingEditorHtml(q) {
  const byId = {};
  if (q.adminReply?.perItem) q.adminReply.perItem.forEach(pi => byId[pi.id] = pi);
  const lines = q.items.map(it => {
    const old = byId[it.id] || {};
    return `
      <div class="row" style="gap:10px; align-items:stretch">
        <div class="field" style="flex:2">
          <label class="label">${it.name} (Qty: ${it.qty})</label>
          <input type="text" value="${(old.notes||'')}" data-note="${it.id}" placeholder="Notes (optional)" />
        </div>
        <div class="field" style="flex:1">
          <label class="label">Unit Price</label>
          <input type="number" step="0.01" value="${(old.unitPrice ?? 0)}" data-price="${it.id}" />
        </div>
      </div>
    `;
  }).join('');

  const delv = q.adminReply?.deliveryCost ?? 0;
  const disc = q.adminReply?.discount ?? 0;
  const notes= q.adminReply?.overallNotes || '';
  const valid= q.adminReply?.validUntil || '';

  return `
    <div class="section" id="replyFormWrap">
      <h4>Generate / Update Quotation</h4>
      <div id="itemsPriceWrap">${lines}</div>
      <div class="two-inline" style="margin-top:10px">
        <div class="field">
          <label class="label">Delivery Cost</label>
          <input id="rf_delivery" type="number" step="0.01" value="${delv}" />
        </div>
        <div class="field">
          <label class="label">Discount</label>
          <input id="rf_discount" type="number" step="0.01" value="${disc}" />
        </div>
      </div>
      <div class="two-inline" style="margin-top:10px">
        <div class="field">
          <label class="label">Offer Valid Until</label>
          <input id="rf_valid" type="date" value="${valid}" />
        </div>
        <div class="field">
          <label class="label">Overall Comment / Notes</label>
          <input id="rf_notes" type="text" value="${notes}" placeholder="Optional note visible to client" />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn good" id="btnSendQuote">Send Quotation</button>
      </div>
    </div>
  `;
}

function pricingSummaryHtml(q) {
  if (!q.adminReply) return '';
  const r = q.adminReply;
  return `
    <div class="section">
      <h4>Pricing Summary</h4>
      <div class="breakdown">
        <div class="line"><span>Delivery</span><b>${formatMoney(r.deliveryCost||0)}</b></div>
        <div class="line"><span>Discount</span><b>${formatMoney(r.discount||0)}</b></div>
        <div class="sum line"><span>Grand Total</span><b>${formatMoney(r.grandTotal||0)}</b></div>
        <div class="line"><span>Valid Until</span><b>${r.validUntil || '-'}</b></div>
        ${r.overallNotes ? `<div class="line"><span>Notes</span><b>${r.overallNotes}</b></div>` : ''}
      </div>
    </div>
  `;
}

function messagesHtml(q) {
  if (!q.messages?.length) return '<div class="muted">No messages yet.</div>';
  return q.messages.map(m=>`
    <div class="cart-card">
      <div class="cart-info">
        <div class="title">${m.author === 'admin' ? 'Admin' : 'Client'} — ${new Date(m.at).toLocaleString()}</div>
        <div>${m.text || ''}</div>
      </div>
    </div>
  `).join('');
}

function detailTemplate(q) {
  const itemsHtml = itemsListHtml(q);
  const canReply  = hasPermission(getUser(), PERMISSIONS.viewReplyQuotes);
  const canApprove= hasPermission(getUser(), PERMISSIONS.approveFinalQuote);

  const showSend = (q.status === QUOTE_STATUS.Pending || q.status === QUOTE_STATUS.NeedsRevision) && canReply;
  const showClarApprove = q.status === QUOTE_STATUS.NeedsRevision;

  return `
    ${detailHeaderHtml(q)}

    <div class="cart-group">
      <div class="cart-group-title">Items</div>
      <div class="cart-items">${itemsHtml}</div>
    </div>

    ${q.adminReply ? pricingSummaryHtml(q) : ''}

    ${showSend ? pricingEditorHtml(q) : ''}

    <div class="form-actions" id="detailActions">
      <button class="btn" id="btnDeleteQuote" style="background:#fff; border-color:#c6534e; color:#c6534e">Delete Request</button>
      <button class="btn" id="btnAskClar" style="display:${showClarApprove ? '' : 'none'}">Ask for Clarification</button>
      <button class="btn good" id="btnApproveFinal" style="display:${showClarApprove && canApprove ? '' : 'none'}">Approve Final (Admin)</button>
    </div>

    <div class="cart-group">
      <div class="cart-group-title">Conversation</div>
      <div id="msgList">${messagesHtml(q)}</div>
    </div>
  `;
}

let selectedId = null;

async function init() {
  const ok = await requireAdminGuard(); if (!ok) return;
  if (!hasPermission(getUser(), PERMISSIONS.viewReplyQuotes)) {
    await alertModal('Unauthorized: you cannot view quotations.', 'Access Denied');
    location.href='./adminProfile.html'; return;
  }

  // sidebar go
  document.querySelectorAll('.sidebar-link[data-go]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ location.href = `./${btn.getAttribute('data-go')}`; });
  });
  const logout = document.getElementById('sidebarLogoutBtn');
  if (logout) logout.addEventListener('click', ()=>{ localStorage.removeItem('tn_user'); location.href='./index.html'; });

  renderList();
}

function renderList() {
  const grid = document.getElementById('quotesGrid');
  const arr = getQuotes().slice().sort((a,b)=> (b.updatedAt||'').localeCompare(a.updatedAt||''));
  grid.innerHTML = arr.map(q=>quoteCard(q)).join('');

  grid.querySelectorAll('[data-open]').forEach(card=>{
    card.addEventListener('click', ()=>{
      const id = card.getAttribute('data-open');
      openDetail(id);
    });
  });

  // clear detail if nothing selected or after delete
  const det = document.getElementById('detailSection');
  if (selectedId && !findQuoteById(selectedId)) {
    det.innerHTML = '';
    det.style.display = 'none';
    selectedId = null;
  }
}

function openDetail(id) {
  selectedId = id;
  const q = findQuoteById(id);
  const det = document.getElementById('detailSection');
  det.style.display = '';
  det.innerHTML = detailTemplate(q);

  // wire actions:
  const btnSend = document.getElementById('btnSendQuote');
  if (btnSend) {
    btnSend.onclick = async ()=>{
      const data = collectReplyPayload(q);
      const me = getUser();
      adminReplyToQuote(q.id, data, me.email);
      await alertModal('Quotation sent to client.', 'Done');
      openDetail(q.id);
      renderList();
    };
  }

  const btnAsk = document.getElementById('btnAskClar');
  if (btnAsk) {
    btnAsk.onclick = async ()=>{
      const text = await openTextSheet({
        title:'Ask for Clarification',
        label:'Write your clarification message',
        placeholder:'Please clarify the thickness / delivery address ...',
        okText:'Send'
      });
      if (text === null || text === '') return;
      const me = getUser();
      adminAskForClarification(q.id, text, me.email);
      await alertModal('Clarification requested.', 'Done');
      openDetail(q.id);
      renderList();
    };
  }

  const btnApprove = document.getElementById('btnApproveFinal');
  if (btnApprove) {
    btnApprove.onclick = async ()=>{
      const me = getUser();
      adminApproveFinal(q.id, me.email);
      await alertModal('Quotation marked as Approved.', 'Done');
      openDetail(q.id);
      renderList();
    };
  }

  const btnDelete = document.getElementById('btnDeleteQuote');
  if (btnDelete) {
    btnDelete.onclick = async ()=>{
      const yes = await confirm('Delete this request permanently?');
      if (!yes) return;
      deleteQuote(q.id);
      await alertModal('Request deleted.', 'Deleted');
      selectedId = null;
      renderList();
      const det = document.getElementById('detailSection');
      det.innerHTML = '';
      det.style.display = 'none';
    };
  }

  // Optional: set In Review when opened the first time from Pending
  if (q.status === QUOTE_STATUS.Pending) {
    changeQuoteStatus(q.id, QUOTE_STATUS.InReview, getUser().email);
    renderList();
  }
}

function collectReplyPayload(q) {
  const perItem = q.items.map(it => {
    const price = document.querySelector(`input[data-price="${it.id}"]`)?.value;
    const note  = document.querySelector(`input[data-note="${it.id}"]`)?.value;
    return { id: it.id, unitPrice: Number(price)||0, notes: note||'' };
  });
  const delivery = Number(document.getElementById('rf_delivery')?.value) || 0;
  const discount = Number(document.getElementById('rf_discount')?.value) || 0;
  const notes    = document.getElementById('rf_notes')?.value || '';
  const valid    = document.getElementById('rf_valid')?.value || null;

  return { perItem, deliveryCost: delivery, discount, overallNotes: notes, validUntil: valid };
}

document.addEventListener('DOMContentLoaded', init);
