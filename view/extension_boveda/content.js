// content.js — HackUDC Zero-Knowledge Vault

(function () {
  'use strict';

  const BADGE_CLASS = 'clavegal-icon';
  const WRAP_CLASS  = 'cg-wrap';
  const DROP_ID     = 'cg-autofill-drop';

  // ─── 1. INYECTAR BADGE EN CAMPOS PASSWORD ─────────────────
  function injectIcon(input) {
    if (!input || input.type !== 'password') return;
    if (input.dataset.clavegal === '1') return;
    input.dataset.clavegal = '1';

    const wrapper = document.createElement('span');
    wrapper.className = WRAP_CLASS;
    const display = getComputedStyle(input).display;
    wrapper.style.cssText = `position:relative;display:${display === 'block' ? 'block' : 'inline-block'};`;
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = BADGE_CLASS;
    badge.setAttribute('aria-label', 'Autocompletar con Bóveda');
    badge.innerHTML = `
      <span class="cg-lock-icon">
        <svg width="11" height="13" viewBox="0 0 11 13" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="5.5" width="9" height="7" rx="2" stroke="currentColor" stroke-width="1.3"/>
          <path d="M3.5 5.5V3.5a2 2 0 014 0v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <circle cx="5.5" cy="9" r="1" fill="currentColor"/>
        </svg>
      </span>
      <span style="font-size:13px;letter-spacing:.04em;">VAULT</span>
    `;

    badge.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      badge.classList.add('cg-press');
      setTimeout(() => badge.classList.remove('cg-press'), 220);

      const ripple = document.createElement('span');
      ripple.className = 'cg-ripple';
      const r = badge.getBoundingClientRect();
      ripple.style.left = `${ev.clientX - r.left}px`;
      ripple.style.top  = `${ev.clientY - r.top}px`;
      badge.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);

      handleBadgeClick(input);
    });

    badge.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); badge.click(); }
    });

    wrapper.appendChild(badge);

    // Dropdown al enfocar el campo (mismo comportamiento que el badge)
    input.addEventListener('focus', () => requestAndShowDrop(input));
    input.addEventListener('blur',  () => setTimeout(removeAutofillDrop, 180));
  }

  // ─── 2. ESCÁNER DE DOM (SPA-safe) ─────────────────────────
  function scan() {
    document.querySelectorAll('input[type="password"]:not([data-clavegal])').forEach(injectIcon);
  }
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scan();

  // ─── 3. LÓGICA DEL BADGE ──────────────────────────────────
  function handleBadgeClick(input) {
    chrome.runtime.sendMessage(
      { type: 'GET_CREDENTIALS', hostname: location.hostname },
      (response) => {
        if (chrome.runtime.lastError) response = null;

        if (response && response.found && response.items.length > 0) {
          if (response.items.length === 1) {
            // Una sola credencial → rellenar directamente
            fillPassword(input, response.items[0].password);
          } else {
            // Varias → mostrar selector
            showAutofillDrop(input, response.items);
          }
        } else {
          // Sin sesión o sin credenciales → abrir el popup
          chrome.runtime.sendMessage({ type: 'OPEN_VAULT', domain: location.hostname });
        }
      }
    );
  }

  // ─── 4. DROPDOWN AL ENFOCAR ───────────────────────────────
  function requestAndShowDrop(input) {
    chrome.runtime.sendMessage(
      { type: 'GET_CREDENTIALS', hostname: location.hostname },
      (response) => {
        if (chrome.runtime.lastError || !response || !response.found) return;
        showAutofillDrop(input, response.items);
      }
    );
  }

  function showAutofillDrop(input, items) {
    removeAutofillDrop();
    if (!items || items.length === 0) return;

    const rect = input.getBoundingClientRect();
    const drop = document.createElement('div');
    drop.id = DROP_ID;
    drop.className = 'cg-autofill-drop';
    drop.style.cssText =
      `top:${rect.bottom + 4}px;left:${rect.left}px;min-width:${Math.max(rect.width, 220)}px`;

    drop.innerHTML = `
      <div class="cg-autofill-header">🔐 Credenciales guardadas</div>
      ${items.map((item, i) => `
        <div class="cg-autofill-item" data-idx="${i}">
          <span class="cg-autofill-icon">🔑</span>
          <div class="cg-autofill-info">
            <div class="cg-autofill-site">${escapeHtml(item.site)}</div>
            <div class="cg-autofill-pass">••••••••</div>
          </div>
          <button class="cg-autofill-fill-btn" type="button">Rellenar</button>
        </div>
      `).join('')}
    `;

    document.body.appendChild(drop);

    drop.querySelectorAll('.cg-autofill-item').forEach((el, i) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault(); // evita que el input pierda foco antes del click
        fillPassword(input, items[i].password);
        removeAutofillDrop();
      });
    });
  }

  function removeAutofillDrop() {
    const el = document.getElementById(DROP_ID);
    if (el) el.remove();
  }

  // ─── 5. UTILS ──────────────────────────────────────────────
  function fillPassword(input, value) {
    // Setter nativo para compatibilidad con React / Vue / Angular
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input',  { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ─── 6. DETECCIÓN DE FORMULARIOS CON CONTRASEÑA ────────────
  function dismissSaveToast(toast) {
    if (!toast) return;
    toast.classList.remove('cg-toast-visible');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }

  function showSaveToast(hostname, password) {
    const existing = document.getElementById('cg-save-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'cg-save-toast';
    toast.className = 'cg-save-toast';
    toast.innerHTML = `
      <div class="cg-toast-header">
        <span class="cg-toast-logo">🛡️</span>
        <span class="cg-toast-title">VoidVault</span>
        <button class="cg-toast-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="cg-toast-body">¿Guardar la contraseña de <strong>${escapeHtml(hostname)}</strong> en tu bóveda?</div>
      <div class="cg-toast-actions">
        <button class="cg-toast-btn cg-toast-save">Guardar</button>
        <button class="cg-toast-btn cg-toast-ignore">Ignorar</button>
      </div>
    `;

    document.body.appendChild(toast);

    // Doble rAF para asegurar que el transition se aplica
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('cg-toast-visible'));
    });

    const autoDismiss = setTimeout(() => dismissSaveToast(toast), 15000);

    toast.querySelector('.cg-toast-close').addEventListener('click', () => {
      clearTimeout(autoDismiss);
      dismissSaveToast(toast);
    });

    toast.querySelector('.cg-toast-ignore').addEventListener('click', () => {
      clearTimeout(autoDismiss);
      dismissSaveToast(toast);
    });

    toast.querySelector('.cg-toast-save').addEventListener('click', () => {
      clearTimeout(autoDismiss);
      dismissSaveToast(toast);
      chrome.runtime.sendMessage({ type: 'SAVE_CREDENTIAL_PROMPT', site: hostname, password });
    });
  }

  function listenForPasswordForms() {
    document.addEventListener('submit', (ev) => {
      const form = ev.target;
      if (!form || form.tagName !== 'FORM') return;

      const passInputs = form.querySelectorAll('input[type="password"]');
      if (passInputs.length === 0) return;

      // Tomar la primera contraseña no vacía
      let password = '';
      for (const inp of passInputs) {
        if (inp.value) { password = inp.value; break; }
      }
      if (!password) return;

      const hostname = location.hostname.replace(/^www\./, '');
      showSaveToast(hostname, password);
    }, true); // fase de captura para que se ejecute antes de la navegación
  }

  listenForPasswordForms();

})();
