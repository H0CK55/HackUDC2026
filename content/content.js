(function () {
  const BADGE_CLASS = "clavegal-icon";
  let activePanel = null;
  let targetInput = null;

  function injectIcon(input) {
    if (input.dataset.clavegal === "1") return;
    input.dataset.clavegal = "1";

    const wrapper = document.createElement("span");
    wrapper.style.position = "relative";
    wrapper.style.display = getComputedStyle(input).display === "block" ? "block" : "inline-block";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = BADGE_CLASS;
    badge.title = "ClaveGal";
    badge.textContent = "🔒";
    badge.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openPanel(input);
    });
    wrapper.appendChild(badge);
  }

  function scan() {
    document.querySelectorAll('input[type="password"]:not([data-clavegal])')
      .forEach(injectIcon);
  }

  const mo = new MutationObserver(scan);
  mo.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("click", (ev) => {
    if (activePanel && !activePanel.contains(ev.target)) closePanel();
  });

  function closePanel() {
    if (activePanel) { activePanel.remove(); activePanel = null; }
  }

  function openPanel(input) {
    closePanel();
    targetInput = input;

    const rect = input.getBoundingClientRect();
    const panel = document.createElement("div");
    panel.className = "clavegal-panel";
    panel.innerHTML = `
      <div class="cg-header">
        <span>ClaveGal</span>
        <button class="cg-close" aria-label="Cerrar">×</button>
      </div>
      <div class="cg-body">
        <button id="cgVerify" class="cg-btn cg-primary">Verificar</button>
        <div id="cgOutput" class="cg-output" aria-live="polite"></div>
      </div>
    `;
    Object.assign(panel.style, {
      position: "fixed",
      top: Math.min(rect.bottom + 8, window.innerHeight - 200) + "px",
      left: Math.min(rect.left, window.innerWidth - 300) + "px",
      zIndex: 2147483647
    });
    document.body.appendChild(panel);
    activePanel = panel;

    panel.querySelector(".cg-close").onclick = closePanel;

    panel.querySelector("#cgVerify").onclick = () => {
      const out = panel.querySelector("#cgOutput");
      out.textContent = "Verificando...";
      const domain = location.hostname;

      chrome.runtime?.sendMessage?.({
        type: "VERIFY_OR_CREATE",
        domain,
        url: location.href,
        typed: input.value || ""
      });
    };
  }

  chrome.runtime?.onMessage?.addListener?.((msg) => {
    if (!activePanel) return;
    const out = activePanel.querySelector("#cgOutput");
    if (!out) return;

    if (msg?.type === "VAULT_LOCKED") {
      out.textContent = "Vault bloqueado. Desbloquéalo en el popup (clave maestra).";
    }

    if (msg?.type === "FOUND" || msg?.type === "CREATED") {
      const pwd = msg.data?.password || "";
      if (targetInput) {
        targetInput.value = pwd;
        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        targetInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      out.textContent = (msg.type === "FOUND")
        ? `Contraseña encontrada para ${msg.data.domain} (rellenada).`
        : `Contraseña creada y guardada para ${msg.data.domain} (rellenada).`;
    }

    if (msg?.type === "CHECK_RESULT") {
      const { strength, pwned } = msg.data || {};
      const score = (strength && typeof strength.score === "number") ? strength.score : "?";
      out.textContent += `\nFortaleza: ${score} | Filtraciones: ${pwned ? "Sí" : "No"}`;
    }
  });

  scan();
})();
