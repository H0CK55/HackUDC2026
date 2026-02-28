// popup.js — HackUDC Zero-Knowledge Vault
// Lógica completa con feedback visual rico

const API_URL = (typeof window !== "undefined" && window.VAULT_API_URL) || "http://localhost:8000/api";
let SESSION_TOKEN = null;
let LOCAL_VK      = null;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* ─────────────────────────────────────────────
   UTILS: crypto helpers
───────────────────────────────────────────── */
function buf2hex(b) { return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''); }
function hex2buf(h) { return new Uint8Array(h.match(/.{1,2}/g).map(b => parseInt(b,16))); }

async function derivarMEK(password, salt) {
  const km = await crypto.subtle.importKey("raw", encoder.encode(password), { name:"PBKDF2" }, false, ["deriveBits","deriveKey"]);
  const bits = await crypto.subtle.deriveBits({ name:"PBKDF2", salt: encoder.encode(salt), iterations:100000, hash:"SHA-256" }, km, 256);
  return crypto.subtle.importKey("raw", bits, { name:"AES-GCM" }, true, ["encrypt","decrypt"]);
}

async function derivarMAH(mek) {
  const bits = await crypto.subtle.exportKey("raw", mek);
  const hmac = await crypto.subtle.importKey("raw", bits, { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  return buf2hex(await crypto.subtle.sign("HMAC", hmac, encoder.encode("autenticacion")));
}

/* ─────────────────────────────────────────────
   UTILS: UI helpers
───────────────────────────────────────────── */
function $(id) { return document.getElementById(id); }

function logLine(msg) {
  const el = $('log');
  const div = document.createElement('div');
  if (msg.startsWith('✅') || msg.startsWith('🔓') || msg.startsWith('🟢')) div.className = 'log-ok';
  else if (msg.startsWith('❌') || msg.startsWith('🔴')) div.className = 'log-err';
  else if (msg.startsWith('⏳') || msg.startsWith('⚙️') || msg.startsWith('🔒')) div.className = 'log-warn';
  else if (msg.startsWith('🌐') || msg.startsWith('⬇️') || msg.startsWith('ℹ️')) div.className = 'log-info';
  else div.className = 'log-muted';
  div.textContent = msg;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function showFeedback(id, type, msg) {
  const el = $(id);
  el.className = `v-feedback ${type} show`;
  const icon = type === 'err' ? '✖' : type === 'ok' ? '✔' : 'ℹ';
  el.innerHTML = `<span>${icon}</span> ${escapeHtml(String(msg))}`;
}
function hideFeedback(id) {
  const el = $(id);
  el.className = 'v-feedback';
  el.textContent = '';
}

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

function markInput(el, state) {
  el.classList.remove('error','success');
  if (state) el.classList.add(state);
}

function setLoading(btn, on) {
  btn.disabled = on;
  btn.classList.toggle('loading', on);
}

function setStatus(state) {
  const pill = $('statusPill');
  const dot  = $('statusDot');
  const txt  = $('statusText');
  const styles = {
    online:  { color:'rgba(0,255,157,.2)',   bc:'rgba(0,255,157,.2)',  dc:'#00ff9d', label:'EN LÍNEA' },
    offline: { color:'rgba(100,120,140,.1)', bc:'rgba(100,120,140,.2)',dc:'#4a6070', label:'OFFLINE' },
    error:   { color:'rgba(255,51,88,.1)',   bc:'rgba(255,51,88,.25)', dc:'#ff3358', label:'ERROR' },
  };
  const s = styles[state] || styles.offline;
  pill.style.background  = s.color;
  pill.style.borderColor = s.bc;
  pill.style.color       = s.dc;
  dot.style.background   = s.dc;
  dot.style.boxShadow    = `0 0 6px ${s.dc}`;
  txt.textContent        = s.label;
}

function unlockVaultUI() {
  $('vaultLocked').style.display   = 'none';
  $('vaultUnlocked').style.display = 'flex';
  setStatus('online');
  $('tabVault').style.color = 'var(--accent2)';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ─────────────────────────────────────────────
   TABS
───────────────────────────────────────────── */
document.querySelectorAll('.v-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.v-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.v-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $(`panel-${tab.dataset.tab}`).classList.add('active');
    if (tab.dataset.tab === 'vault') updateSaveSectionVisibility();
  });
});

/* ─────────────────────────────────────────────
   PASSWORD TOGGLES
───────────────────────────────────────────── */
function setupEye(eyeId, inputId) {
  const eye   = $(eyeId);
  const input = $(inputId);
  if (!eye || !input) return;
  eye.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    eye.textContent = show ? '🙈' : '👁';
  });
}
setupEye('eyeToggle',        'masterPass');
setupEye('eyeToggleReg',      'regPass');
setupEye('eyeSitePass',       'sitePass');
setupEye('eyeSitePassConfirm','sitePassConfirm');

/* ─────────────────────────────────────────────
   STRENGTH METER
───────────────────────────────────────────── */
$('regPass').addEventListener('input', evalStrength);

function evalStrength() {
  const val   = $('regPass').value;
  const fill  = $('strengthFill');
  const label = $('strengthLabel');
  let score = 0;
  if (val.length >= 8)  score++;
  if (val.length >= 14) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    { pct:  0, color:'transparent', text:'— sin evaluar' },
    { pct: 20, color:'#ff3358',     text:'Muy débil' },
    { pct: 40, color:'#ff6a00',     text:'Débil' },
    { pct: 60, color:'#ffaa00',     text:'Media' },
    { pct: 80, color:'#7ec8e3',     text:'Fuerte' },
    { pct:100, color:'#00ff9d',     text:'Muy fuerte 🛡' },
  ];
  const lvl = levels[Math.min(score, 5)];
  fill.style.width      = `${lvl.pct}%`;
  fill.style.background = lvl.color;
  label.textContent     = lvl.text;
  label.style.color     = lvl.color;
}

/* ─────────────────────────────────────────────
   DOMAIN AUTO-DETECT
   1. Lee pendingDomain (puesto por content.js)
   2. Si no hay, consulta la pestaña activa
   3. Inyecta el dominio en el campo oculto y lo muestra
───────────────────────────────────────────── */
function normalizeDomain(domain) {
  if (!domain) return '';
  return domain.toLowerCase().replace(/^www\./, '').trim();
}

function applyDomain(domain) {
  if (!domain) return;

  // Campo oculto que usará guardarItem()
  $('siteUrl').value = domain;

  // Badge del header
  $('domainText').textContent = `Sitio: ${domain}`;
  $('domainBadge').classList.add('show');

  // Pill en el paso 1 del formulario
  $('detectedSiteLabel').textContent = domain;
  $('detectedSite').style.display = 'flex';

  // Pill de confirmación en paso 2
  $('confirmSiteLabel').textContent = domain;

  logLine(`🌐 Dominio detectado: ${domain}`);
  updateSaveSectionVisibility();
}

// Primero intentamos pendingDomain (viene del badge en la página)
chrome.storage.local.get('pendingDomain', ({ pendingDomain }) => {
  if (pendingDomain) {
    applyDomain(pendingDomain);
    chrome.storage.local.remove('pendingDomain');
  } else {
    // Fallback: leer la URL de la pestaña activa
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        try {
          const url = new URL(tabs[0].url);
          // Ignorar páginas internas del navegador
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            applyDomain(url.hostname.replace(/^www\./, ''));
          }
        } catch {}
      }
    });
  }
});

/* ─────────────────────────────────────────────
   VISIBILIDAD "GUARDAR": ocultar si ya hay credencial para este sitio
───────────────────────────────────────────── */
async function siteAlreadyInVault(domain) {
  if (!LOCAL_VK || !SESSION_TOKEN || !domain) return false;
  try {
    const res = await fetch(`${API_URL}/vault`, {
      headers: { 'Authorization': `Bearer ${SESSION_TOKEN}` }
    });
    if (!res.ok) return false;
    const items = await res.json();
    const current = normalizeDomain(domain);
    for (const item of items) {
      try {
        const buf  = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: hex2buf(item.nonce) }, LOCAL_VK, hex2buf(item.encrypted_payload)
        );
        const parsed = JSON.parse(decoder.decode(buf));
        if (parsed && parsed.site && normalizeDomain(parsed.site) === current) return true;
      } catch {}
    }
  } catch {}
  return false;
}

async function updateSaveSectionVisibility() {
  const block = $('saveCredentialBlock');
  if (!block) return;
  const domain = $('siteUrl') && $('siteUrl').value ? $('siteUrl').value.trim() : '';
  if (!domain) {
    block.style.display = '';
    return;
  }
  if (!LOCAL_VK || !SESSION_TOKEN) {
    block.style.display = '';
    return;
  }
  const alreadySaved = await siteAlreadyInVault(domain);
  block.style.display = alreadySaved ? 'none' : '';
  if (alreadySaved) {
    $('saveStep2').style.display = 'none';
    $('saveStep1').style.display = 'flex';
  }
}

/* ─────────────────────────────────────────────
   LOGIN
───────────────────────────────────────────── */
$('btnIniciar').addEventListener('click', iniciarSesion);
$('masterPass').addEventListener('keydown', e => { if (e.key === 'Enter') iniciarSesion(); });

async function iniciarSesion() {
  const btn   = $('btnIniciar');
  const email = $('email').value.trim();
  const pass  = $('masterPass').value;

  hideFeedback('loginFeedback');
  markInput($('email'), null);
  markInput($('masterPass'), null);

  if (!email || !pass) {
    showFeedback('loginFeedback','err','Email y contraseña son obligatorios.');
    shake($('loginForm'));
    return;
  }

  setLoading(btn, true);
  logLine('⏳ Conectando con el servidor...');

  try {
    const resSalt = await fetch(`${API_URL}/salt/${email}`);
    if (!resSalt.ok) throw new Error('Usuario no encontrado.');

    const dataSalt = await resSalt.json();
    logLine('⚙️ Derivando claves criptográficas...');

    const mek = await derivarMEK(pass, email + dataSalt.client_salt);
    const mah = await derivarMAH(mek);

    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ email, mah })
    });

    if (!res.ok) throw new Error('Credenciales incorrectas.');

    const data = await res.json();
    SESSION_TOKEN = data.access_token;

    const parts    = data.encrypted_vk.split(':');
    const vkBuffer = await crypto.subtle.decrypt(
      { name:'AES-GCM', iv: hex2buf(parts[0]) }, mek, hex2buf(parts[1])
    );
    LOCAL_VK = await crypto.subtle.importKey("raw", vkBuffer, { name:"AES-GCM" }, true, ["encrypt","decrypt"]);

    markInput($('email'),      'success');
    markInput($('masterPass'), 'success');
    showFeedback('loginFeedback','ok','Bóveda desbloqueada correctamente.');
    logLine('✅ Login OK — Bóveda abierta.');
    unlockVaultUI();

    setTimeout(() => { document.querySelector('[data-tab="vault"]').click(); }, 900);

  } catch (err) {
    markInput($('masterPass'), 'error');
    showFeedback('loginFeedback','err', err.message || 'Error de conexión.');
    shake($('masterPassField'));
    shake($('loginFeedback'));
    logLine(`❌ ${err.message}`);
    setStatus('error');
    setTimeout(() => setStatus('offline'), 2000);
  } finally {
    setLoading(btn, false);
  }
}

/* ─────────────────────────────────────────────
   REGISTER
───────────────────────────────────────────── */
$('btnRegistrar').addEventListener('click', registrar);

async function registrar() {
  const btn     = $('btnRegistrar');
  const email   = $('regEmail').value.trim();
  const pass    = $('regPass').value;
  const confirm = $('regPassConfirm').value;

  hideFeedback('regFeedback');
  markInput($('regEmail'), null);
  markInput($('regPass'), null);
  markInput($('regPassConfirm'), null);

  if (!email || !pass) {
    showFeedback('regFeedback','err','Todos los campos son obligatorios.');
    shake($('panel-register'));
    return;
  }
  if (pass !== confirm) {
    showFeedback('regFeedback','err','Las contraseñas no coinciden.');
    markInput($('regPass'), 'error');
    markInput($('regPassConfirm'), 'error');
    shake($('regPassConfirm').closest('.v-field'));
    logLine('❌ Las contraseñas no coinciden.');
    return;
  }
  if (pass.length < 8) {
    showFeedback('regFeedback','err','Mínimo 8 caracteres.');
    markInput($('regPass'), 'error');
    shake($('regPass').closest('.v-field'));
    return;
  }

  setLoading(btn, true);
  logLine('⚙️ Generando claves criptográficas...');

  try {
    const newSalt = 'sal_' + Date.now();
    const mek = await derivarMEK(pass, email + newSalt);
    const mah = await derivarMAH(mek);

    LOCAL_VK = await crypto.subtle.generateKey({ name:'AES-GCM', length:256 }, true, ["encrypt","decrypt"]);
    const vkBits = await crypto.subtle.exportKey("raw", LOCAL_VK);
    const iv     = crypto.getRandomValues(new Uint8Array(12));
    const encVK  = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, mek, vkBits);

    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        email, client_salt: newSalt, mah,
        encrypted_vk: buf2hex(iv) + ':' + buf2hex(encVK)
      })
    });

    if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Error al registrar.'); }

    markInput($('regEmail'), 'success');
    markInput($('regPass'),  'success');
    showFeedback('regFeedback','ok','Cuenta creada. Iniciando sesión...');
    logLine('✅ Registro completado.');

    setTimeout(() => {
      $('email').value = email;
      document.querySelector('[data-tab="auth"]').click();
    }, 1200);

  } catch (err) {
    showFeedback('regFeedback','err', err.message);
    shake($('panel-register'));
    logLine(`❌ ${err.message}`);
  } finally {
    setLoading(btn, false);
  }
}

/* ─────────────────────────────────────────────
   GUARDAR ITEM — FLUJO 2 PASOS
───────────────────────────────────────────── */

// Paso 1 → Siguiente
$('btnSiguiente').addEventListener('click', () => {
  const url  = $('siteUrl').value.trim();
  const pass = $('sitePass').value;

  hideFeedback('step1Feedback');
  markInput($('sitePass'), null);

  if (!url) {
    showFeedback('step1Feedback','err','No se detectó ningún dominio. Abre la bóveda desde una página web.');
    return;
  }
  if (!pass) {
    showFeedback('step1Feedback','err','Introduce la contraseña del sitio.');
    shake($('sitePass').closest('.v-field'));
    markInput($('sitePass'), 'error');
    return;
  }

  // Avanzar a paso 2
  $('saveStep1').style.display = 'none';
  $('saveStep2').style.display = 'flex';
  $('sitePassConfirm').value = '';
  $('sitePassConfirm').focus();
  hideFeedback('step2Feedback');
  markInput($('sitePassConfirm'), null);
});

// Paso 2 → Volver
$('btnVolver').addEventListener('click', () => {
  $('saveStep2').style.display = 'none';
  $('saveStep1').style.display = 'flex';
  hideFeedback('step1Feedback');
  markInput($('sitePass'), null);
});

// Paso 2 → Guardar
$('btnGuardar').addEventListener('click', guardarItem);
$('sitePassConfirm').addEventListener('keydown', e => { if (e.key === 'Enter') guardarItem(); });

async function guardarItem() {
  if (!LOCAL_VK || !SESSION_TOKEN) {
    showFeedback('saveFeedback','err','Inicia sesión primero.');
    return;
  }

  const btn     = $('btnGuardar');
  const url     = $('siteUrl').value.trim();
  const pass    = $('sitePass').value;
  const confirm = $('sitePassConfirm').value;

  hideFeedback('step2Feedback');
  markInput($('sitePassConfirm'), null);

  if (pass !== confirm) {
    showFeedback('step2Feedback','err','Las contraseñas no coinciden.');
    markInput($('sitePassConfirm'), 'error');
    shake($('sitePassConfirm').closest('.v-field'));
    logLine('❌ Las contraseñas no coinciden.');
    return;
  }

  setLoading(btn, true);
  logLine('🔒 Cifrando credencial con AES-GCM...');

  try {
    // Ciframos: "url||contraseña" como payload
    const payload = JSON.stringify({ site: url, password: pass });
    const iv      = crypto.getRandomValues(new Uint8Array(12));
    const cifrado = await crypto.subtle.encrypt(
      { name:'AES-GCM', iv }, LOCAL_VK, encoder.encode(payload)
    );

    const res = await fetch(`${API_URL}/vault`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SESSION_TOKEN}`
      },
      body: JSON.stringify({ encrypted_payload: buf2hex(cifrado), nonce: buf2hex(iv) })
    });

    if (!res.ok) throw new Error('Error al guardar en servidor.');

    // Éxito: resetear formulario y volver a paso 1
    markInput($('sitePassConfirm'), 'success');
    showFeedback('saveFeedback','ok',`Credencial de "${url}" guardada.`);
    logLine(`✅ Credencial de ${url} cifrada y almacenada.`);

    setTimeout(() => {
      $('saveStep2').style.display = 'none';
      $('saveStep1').style.display = 'flex';
      hideFeedback('saveFeedback');
      markInput($('sitePassConfirm'), null);
      updateSaveSectionVisibility();
      refrescarListaBoveda(true);
    }, 1500);

  } catch (err) {
    showFeedback('step2Feedback','err', err.message);
    shake($('sitePassConfirm').closest('.v-field'));
    logLine(`❌ ${err.message}`);
  } finally {
    setLoading(btn, false);
  }
}

/* ─────────────────────────────────────────────
   DESCARGAR / REFRESCAR BÓVEDA
───────────────────────────────────────────── */
$('btnDescargar').addEventListener('click', () => descargarBoveda());

/** Refresca la lista de la bóveda (fetch + descifrar + render). silent = true no muestra loading ni logs. */
async function refrescarListaBoveda(silent = false) {
  if (!LOCAL_VK || !SESSION_TOKEN) return;
  const btn  = $('btnDescargar');
  const list = $('itemsList');

  if (!silent) {
    setLoading(btn, true);
    hideFeedback('listFeedback');
    list.innerHTML = '';
    logLine('⬇️ Descargando bóveda cifrada...');
  }

  try {
    const res = await fetch(`${API_URL}/vault`, {
      headers: { 'Authorization': `Bearer ${SESSION_TOKEN}` }
    });
    if (!res.ok) throw new Error('No se pudo obtener la bóveda.');
    const items = await res.json();

    list.innerHTML = '';
    if (!silent) logLine(`ℹ️ ${items.length} ítem(s) encontrado(s).`);

    if (items.length === 0) {
      if (!silent) showFeedback('listFeedback','info','La bóveda está vacía.');
      return;
    }

    for (const [i, item] of items.entries()) {
      try {
        const buf  = await crypto.subtle.decrypt(
          { name:'AES-GCM', iv: hex2buf(item.nonce) }, LOCAL_VK, hex2buf(item.encrypted_payload)
        );
        const text = decoder.decode(buf);
        if (!silent) {
          let logDesc = 'Ítem descifrado';
          try {
            const parsed = JSON.parse(text);
            if (parsed.site) logDesc = `🔓 ${parsed.site}`;
          } catch {}
          logLine(logDesc);
        }
        renderItem(item.id, text, i * 70);
      } catch {
        if (!silent) logLine(`❌ Error descifrando [${item.id}]`);
      }
    }
  } catch (err) {
    if (!silent) {
      showFeedback('listFeedback','err', err.message);
      logLine(`❌ ${err.message}`);
    }
  } finally {
    if (!silent) setLoading(btn, false);
  }
}

async function descargarBoveda() {
  if (!LOCAL_VK || !SESSION_TOKEN) {
    showFeedback('listFeedback','err','Inicia sesión primero.');
    return;
  }
  await refrescarListaBoveda(false);
}

function renderItem(id, text, delay = 0) {
  const list = $('itemsList');
  const el   = document.createElement('div');
  el.className = 'v-item';
  el.style.animationDelay = `${delay}ms`;

  // Intentar parsear como { site, password } o mostrar como texto plano
  let site = '', password = text;
  try {
    const parsed = JSON.parse(text);
    if (parsed.site && parsed.password) {
      site     = parsed.site;
      password = parsed.password;
    }
  } catch {}

  const displaySite = site ? `<span class="v-item-site">🌐 ${escapeHtml(site)}</span>` : '';
  const maskedPass  = '•'.repeat(Math.min(password.length, 12));

  el.innerHTML = `
    <span class="v-item-val">
      ${displaySite}
      <span class="v-item-pass" data-pass="${escapeHtml(password)}" title="Clic para revelar">${maskedPass}</span>
    </span>
    <button class="v-item-copy" title="Copiar contraseña">⎘</button>
  `;

  // Toggle revelar contraseña
  const passEl = el.querySelector('.v-item-pass');
  let revealed = false;
  passEl.style.cursor = 'pointer';
  passEl.addEventListener('click', () => {
    revealed = !revealed;
    passEl.textContent = revealed ? password : maskedPass;
    passEl.style.color = revealed ? 'var(--accent2)' : '';
  });

  // Copiar contraseña
  el.querySelector('.v-item-copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText(password);
    const copyBtn = el.querySelector('.v-item-copy');
    copyBtn.textContent = '✔';
    copyBtn.style.color = 'var(--accent2)';
    setTimeout(() => { copyBtn.textContent = '⎘'; copyBtn.style.color = ''; }, 1500);
  });

  list.appendChild(el);
}