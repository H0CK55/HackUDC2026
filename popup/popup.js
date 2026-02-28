document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnGenerate").addEventListener("click", () => {
    const options = {
      length: parseInt(document.getElementById("length").value) || 16,
      uppercase: document.getElementById("uppercase").checked,
      digits: document.getElementById("digits").checked,
      symbols: document.getElementById("symbols").checked,
    };

    chrome.runtime.sendMessage(
      { action: "GENERATE_PASSWORD", options },
      (response) => {
        const resultDiv = document.getElementById("resultPassword");
        if (response?.ok) {
          resultDiv.innerHTML = `
            <div class="password">${escapeHtml(response.data.password)}</div>
            <div class="entropy">Entropía: ${response.data.entropy} bits</div>
          `;
          copyToClipboard(response.data.password);
        } else {
          resultDiv.textContent = "Error: " + (response?.error || "Desconocido");
        }
      }
    );
  });

  document.getElementById("btnPassphrase").addEventListener("click", () => {
    const options = {
      wordCount: parseInt(document.getElementById("wordCount").value) || 5,
      lang: document.getElementById("lang").value,
    };

    chrome.runtime.sendMessage(
      { action: "GENERATE_PASSPHRASE", options },
      (response) => {
        const resultDiv = document.getElementById("resultPassphrase");
        if (response?.ok) {
          resultDiv.innerHTML = `
            <div class="password">${escapeHtml(response.data.passphrase)}</div>
            <div class="entropy">Entropía: ${response.data.entropy} bits</div>
          `;
          copyToClipboard(response.data.passphrase);
        } else {
          resultDiv.textContent = "Error: " + (response?.error || "Desconocido");
        }
      }
    );
  });

  document.getElementById("btnCheck").addEventListener("click", () => {
    const password = document.getElementById("checkPassword").value;
    if (!password) {
      document.getElementById("resultCheck").textContent = "Introduce una contraseña.";
      return;
    }

    const resultDiv = document.getElementById("resultCheck");
    resultDiv.textContent = "Verificando...";

    chrome.runtime.sendMessage(
      { action: "CHECK_FULL", password },
      (response) => {
        if (response?.ok) {
          const { strength, breach } = response.data;
          resultDiv.innerHTML = `
            <div class="strength">
              <span class="score-${strength.score}">Fortaleza: ${strength.label}</span>
            </div>
            <div class="breach ${breach.pwned ? 'pwned' : 'safe'}">
              ${breach.message}
            </div>
            ${strength.feedback.map(f => `<div style="font-size:0.75rem;color:#888;">${f}</div>`).join("")}
          `;
        } else {
          resultDiv.textContent = "Error: " + (response?.error || "Desconocido");
        }
      }
    );
  });
});

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    console.warn("No se pudo copiar al portapapeles");
  });
}
