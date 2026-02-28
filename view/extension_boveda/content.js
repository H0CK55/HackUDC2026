// content.js — HackUDC Zero-Knowledge Vault
// Inyecta badge 🔒 en campos password + overlay animado

(function () {
  'use strict';

  const BADGE_CLASS = 'clavegal-icon';
  const WRAP_CLASS  = 'cg-wrap';
  const OVERLAY_ID  = 'cg-overlay-root';

  // ─── 1. INYECTAR BADGE EN CAMPOS PASSWORD ─────────────────
  function injectIcon(input) {
    if (!input || input.type !== 'password') return;
    if (input.dataset.clavegal === '1') return;
    input.dataset.clavegal = '1';

    // Wrapper relativo
    const wrapper = document.createElement('span');
    wrapper.className = WRAP_CLASS;
    const display = getComputedStyle(input).display;
    wrapper.style.cssText = `position:relative;display:${display === 'block' ? 'block' : 'inline-block'};`;

    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    // Badge con icono SVG
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = BADGE_CLASS;
    badge.setAttribute('aria-label', 'Abrir Bóveda');
    badge.innerHTML = `
      <span class="cg-lock-icon">
        <svg width="11" height="13" viewBox="0 0 11 13" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="5.5" width="9" height="7" rx="2" stroke="currentColor" stroke-width="1.3"/>
          <path d="M3.5 5.5V3.5a2 2 0 014 0v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <circle cx="5.5" cy="9" r="1" fill="currentColor"/>
        </svg>
      </span>
      <span style="font-size:11px;letter-spacing:.04em;">VAULT</span>
    `;

    badge.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      // Animación press + ripple
      badge.classList.add('cg-press');
      setTimeout(() => badge.classList.remove('cg-press'), 220);

      const ripple = document.createElement('span');
      ripple.className = 'cg-ripple';
      const rect = badge.getBoundingClientRect();
      ripple.style.left = `${ev.clientX - rect.left}px`;
      ripple.style.top  = `${ev.clientY - rect.top}px`;
      badge.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);

      openVaultOverlay(location.hostname);
    });

    badge.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        badge.click();
      }
    });

    wrapper.appendChild(badge);
  }

  // ─── 2. ESCÁNER DE DOM (SPA-safe) ─────────────────────────
  function scan() {
    document
      .querySelectorAll('input[type="password"]:not([data-clavegal])')
      .forEach(injectIcon);
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scan();

  // ─── 3. OVERLAY ANIMADO ────────────────────────────────────
  function openVaultOverlay(domain) {
    if (document.getElementById(OVERLAY_ID)) return;

    const host = document.createElement('div');
    host.id = OVERLAY_ID;
    document.body.appendChild(host);

    // Inyectar estilos del overlay directamente (por si acaso)
    const style = document.createElement('style');
    style.textContent = `
      #${OVERLAY_ID} * { box-sizing: border-box; margin: 0; padding: 0; }
    `;
    host.appendChild(style);

    // ── Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'cg-backdrop';

    // ── Panel
    const panel = document.createElement('div');
    panel.className = 'cg-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'HackUDC Zero-Knowledge Vault');

    panel.innerHTML = buildPanelHTML(domain);

    // ── Overlay container
    const overlay = document.createElement('div');
    overlay.className = 'cg-overlay';
    overlay.appendChild(backdrop);
    overlay.appendChild(panel);
    host.appendChild(overlay);

    // ── Función de cierre con animación de salida
    function close() {
      panel.classList.remove('cg-in');
      backdrop.classList.remove('cg-in');
      panel.style.transform = 'translateY(12px) scale(.97)';
      panel.style.opacity = '0';
      backdrop.style.opacity = '0';
      backdrop.style.backdropFilter = 'blur(0px)';

      setTimeout(() => {
        if (host.parentNode) host.parentNode.removeChild(host);
      }, 280);
    }

    // ── Entrada animada
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        backdrop.classList.add('cg-in');
        panel.classList.add('cg-in');
      });
    });

    // ── Eventos de cierre
    backdrop.addEventListener('click', close);

    panel.querySelector('.cg-close').addEventListener('click', close);

    panel.querySelector('.cg-btn').addEventListener('click', () => {
      // Mandamos mensaje al background service worker para que abra el popup
      chrome.runtime.sendMessage(
        { type: 'OPEN_VAULT', domain },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[HackUDC Vault] Background no disponible:', chrome.runtime.lastError.message);
          }
        }
      );
      close();
    });

    document.addEventListener('keydown', onEsc);
    function onEsc(ev) {
      if (ev.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onEsc);
      }
    }

    // Focus trap básico
    setTimeout(() => {
      const btn = panel.querySelector('.cg-btn');
      if (btn) btn.focus();
    }, 320);
  }

  // ─── 4. HTML DEL PANEL ─────────────────────────────────────
  function buildPanelHTML(domain) {
    const shortDomain = domain.replace(/^www\./, '');

    return `
      <div class="cg-header">
        <div class="cg-header-left">
          <div class="cg-vault-icon">🛡️</div>
          <div>
            <div class="cg-title">Zero-Knowledge Vault</div>
            <div class="cg-subtitle">HACKUDC · GRADIANT 2026</div>
          </div>
        </div>
        <button class="cg-close" aria-label="Cerrar panel">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="cg-body">

        <div class="cg-domain-pill">
          <span class="cg-domain-dot"></span>
          ${escapeHtml(shortDomain)}
        </div>

        <div class="cg-desc">
          Campo de contraseña detectado. Tu bóveda cifrada puede autocompletar,
          generar o verificar credenciales para este sitio.
        </div>

        <div class="cg-status">
          <span class="cg-status-icon">✦</span>
          Cifrado zero-knowledge activo — tus datos nunca salen de tu dispositivo sin cifrar.
        </div>

        <button class="cg-btn">
          <span class="cg-btn-inner">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="6.5" width="12" height="7" rx="2.5" stroke="white" stroke-width="1.4"/>
              <path d="M4 6.5V4a3 3 0 016 0v2.5" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
              <circle cx="7" cy="10" r="1.2" fill="white"/>
            </svg>
            Abrir Bóveda
          </span>
        </button>

      </div>
    `;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

})();