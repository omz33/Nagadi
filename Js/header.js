// /Js/header.js - mounts header.html and wires nav
import { updateHeader } from './app.js';

async function mountHeader() {
  const host = document.getElementById('site-header');
  if (!host) return;
  try {
    const res = await fetch('./header.html', { cache: 'no-store' });
    host.innerHTML = await res.text();

    // mobile toggle
    const toggle = host.querySelector('.nav-toggle');
    const nav = host.querySelector('.main-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const exp = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!exp));
        nav.classList.toggle('open', !exp);
      });
    }
// داخل mountHeader في Js/header.js
if (!document.querySelector('link[rel="icon"]')) {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = '../assets/logo.png'; // مسار الأيقونة
  document.head.appendChild(link);
}

    updateHeader();
  } catch (e) {
    console.error('Failed to mount header:', e);
  }
}

document.addEventListener('DOMContentLoaded', mountHeader);
