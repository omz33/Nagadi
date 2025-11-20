// /Js/index.js
import { updateHeader, alertModal } from './app.js';

const q = s => document.querySelector(s);
const qa = s => Array.from(document.querySelectorAll(s));

console.debug("Catalog loaded");

const searchInput = q('#searchInput');
const cards = qa('.card');
const pills = qa('.pill');

function applyFilters(){
  const term = (searchInput.value||'').trim().toLowerCase();
  const activeTag = pills.find(p=>p.classList.contains('active'))?.dataset.tag || 'all';

  cards.forEach(card=>{
    const tags = (card.dataset.tags||'').toLowerCase();
    const title = (card.querySelector('h3')?.textContent||'').toLowerCase();
    const text = (card.querySelector('p')?.textContent||'').toLowerCase();
    const matchTerm = !term || title.includes(term) || text.includes(term) || tags.includes(term);
    const matchTag  = activeTag==='all' || tags.includes(activeTag);
    card.style.display = (matchTerm && matchTag) ? '' : 'none';
  });
}

searchInput?.addEventListener('input', applyFilters);
pills.forEach(p=>{
  p.addEventListener('click', ()=>{
    pills.forEach(x=>x.classList.remove('active'));
    p.classList.add('active');
    applyFilters();
  });
});
pills.find(p=>p.dataset.tag==='all')?.classList.add('active');

q('#contactBtn')?.addEventListener('click', async (e)=>{
  e.preventDefault();
  await alertModal('Contact sales: sales@tnagadi.example • +966-xxx-xxxx', 'Contact');
});

document.addEventListener('DOMContentLoaded', updateHeader);
