(function () {
  const BADGE_CLASS = "clavegal-icon";
  let activePanel = null;

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
    const inputs = document.querySelectorAll('input[type="password"]:not([data-clavegal])');
    inputs.forEach(injectIcon);
  }

  const mo = new MutationObserver(scan);
  mo.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("click", (ev) => {
    if (activePanel && !activePanel.contains(ev.target)) {
      closePanel();
    }
  });

  function closePanel() {
    if (activePanel) {
      activePanel.remove();
      activePanel = null;
    }
  }

  function openPanel(input) {
    closePanel();

    const rect = input.getBoundingClientRect();
    const panel = document.createElement("div");
    panel.className = "clavegal-panel";
    
    panel.innerHTML = `
      <div class="cg-header">
        <span>ClaveGal</span>
        <button class="cg-close" aria-label="Cerrar">×</button>
      </div>
      <div class="cg-body">
        <button id="cgVerify" class="cg-btn">Verificar</button>
        <button id="cgGenerate" class="cg-btn">Generar</button>
        <div id="cgOutput" class="cg-output" aria-live="polite"></div>
      </div>
    `;

    Object.assign(panel.style, {
      position: "fixed",
      top: Math.min(rect.bottom + 8, window.innerHeight - 220) + "px",
      left: Math.min(rect.left, window.innerWidth - 300) + "px",
      zIndex: 2147483647
    });

    document.body.appendChild(panel);
    activePanel = panel;

    panel.querySelector(".cg-close").onclick = closePanel;

    panel.querySelector("#cgVerify").onclick = () => {
      const out = panel.querySelector("#cgOutput");
      if (!input.value) out.textContent = "Escribe una contraseña.";
      else out.textContent = "Verificando... (lo hará Persona 2)";
    };

    panel.querySelector("#cgGenerate").onclick = () => {
      const out = panel.querySelector("#cgOutput");
      out.textContent = "Generando... (lo hará Persona 2)";
    };
  }

  scan();
})();