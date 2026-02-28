const API_URL        = (typeof window !== "undefined" && window.VAULT_API_URL)  || "http://localhost:8000/api";
let SESSION_TOKEN    = null;
let LOCAL_VK         = null;
const INACTIVITY_MS  = 15 * 60 * 1000;
let _inactivityTimer = null;
let _allVaultItems   = [];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function isLocalApi() {
  try {
    const u = new URL(API_URL);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch { return true; }
}
function isInsecureProduction() {
  return !isLocalApi() && API_URL.startsWith("http://");
}
function ensureSecureApi(feedbackId) {
  if (!isInsecureProduction()) return true;
  const msg = "En producción la API debe usar HTTPS. Edita config.js.";
  if (feedbackId) showFeedback(feedbackId, "err", msg);
  else logLine("⚠️ " + msg);
  return false;
}

function buf2hex(b) { return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''); }
function hex2buf(h) {
  if (!h && h !== '') throw new Error('hex2buf: empty input');
  const s = String(h).replace(/\s+/g, '');
  if (s.length === 0) throw new Error('hex2buf: empty string');
  if (s.length % 2 !== 0) throw new Error('hex2buf: odd-length hex string');
  if (!/^[0-9a-fA-F]+$/.test(s)) throw new Error('hex2buf: invalid hex characters');
  return new Uint8Array(s.match(/.{1,2}/g).map(b => parseInt(b, 16)));
}

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

async function saveSession(token, vkKey) {
  const rawVK = await crypto.subtle.exportKey("raw", vkKey);
  await chrome.storage.session.set({ sessionToken: token, vkHex: buf2hex(rawVK), lastActivity: Date.now() });
}

async function restoreSession() {
  try {
    const data = await chrome.storage.session.get(['sessionToken', 'vkHex', 'lastActivity']);
    if (data.sessionToken && data.vkHex) {
      if (data.lastActivity && Date.now() - data.lastActivity > INACTIVITY_MS) {
        await chrome.storage.session.remove(['sessionToken', 'vkHex', 'lastActivity']);
        return false;
      }
      SESSION_TOKEN = data.sessionToken;
      LOCAL_VK = await crypto.subtle.importKey(
        "raw", hex2buf(data.vkHex), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]
      );
      return true;
    }
  } catch {}
  return false;
}

async function clearSession() {
  SESSION_TOKEN = null;
  LOCAL_VK = null;
  clearTimeout(_inactivityTimer);
  _inactivityTimer = null;
  await chrome.storage.session.remove(['sessionToken', 'vkHex', 'lastActivity']);
}

function resetInactivityTimer() {
  clearTimeout(_inactivityTimer);
  if (!SESSION_TOKEN) return;
  _inactivityTimer = setTimeout(async () => {
    await clearSession();
    lockVaultUI();
    document.querySelector('[data-tab="auth"]').click();
    showFeedback('loginFeedback', 'info', 'Sesión cerrada por inactividad (15 min).');
    logLine('⏱️ Sesión cerrada por inactividad.');
  }, INACTIVITY_MS);
}

function getEmailFromToken() {
  if (!SESSION_TOKEN) return null;
  try {
    return JSON.parse(atob(SESSION_TOKEN.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub;
  } catch { return null; }
}

async function sha1hex(str) {
  const buf = await crypto.subtle.digest('SHA-1', encoder.encode(str));
  return buf2hex(buf).toUpperCase();
}

async function checkHIBP(password) {
  const hash   = await sha1hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' }
  });
  if (!res.ok) throw new Error('Error consultando HIBP');
  const text = await res.text();
  for (const line of text.split('\n')) {
    const [s, count] = line.trim().split(':');
    if (s === suffix) return parseInt(count, 10);
  }
  return 0;
}

function showBreachResult(badgeId, count) {
  const el = $(badgeId);
  if (count === 0) {
    el.className = 'v-breach safe show';
    el.textContent = '✔ No encontrada en filtraciones conocidas';
  } else {
    const fmt = count.toLocaleString('es-ES');
    el.className = 'v-breach pwned show';
    el.textContent = `⚠ Filtrada ${fmt} veces — elige otra contraseña`;
  }
}

function hideBreachBadge(badgeId) {
  $(badgeId).className = 'v-breach';
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const _checkBreachFor = (badgeId) => debounce(async (pass) => {
  if (!pass) { hideBreachBadge(badgeId); return; }
  const el = $(badgeId);
  el.className = 'v-breach checking show';
  el.textContent = '⏳ Comprobando filtraciones...';
  try {
    showBreachResult(badgeId, await checkHIBP(pass));
    logLine($(badgeId).classList.contains('pwned')
      ? `⚠ Contraseña filtrada detectada en HIBP`
      : `✔ Contraseña no encontrada en filtraciones HIBP`);
  } catch { hideBreachBadge(badgeId); }
}, 500);

const checkBreachSite = _checkBreachFor('breachBadge');
const checkBreachEdit = _checkBreachFor('editBreachBadge');

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
  const email = getEmailFromToken();
  if (email) $('userEmailLabel').textContent = email;
  
  // Hide auth and register tabs when logged in
  document.querySelectorAll('.v-tab').forEach(tab => {
    if (tab.dataset.tab === 'auth' || tab.dataset.tab === 'register') {
      tab.style.display = 'none';
    }
  });
  
  // Automatically switch to vault tab
  document.querySelector('[data-tab="vault"]').click();
  
  resetInactivityTimer();
}

function lockVaultUI() {
  $('vaultLocked').style.display   = '';
  $('vaultUnlocked').style.display = 'none';
  setStatus('offline');
  $('tabVault').style.color = '';
  
  // Show auth and register tabs when logged out
  document.querySelectorAll('.v-tab').forEach(tab => {
    if (tab.dataset.tab === 'auth' || tab.dataset.tab === 'register') {
      tab.style.display = '';
    }
  });
  
  clearTimeout(_inactivityTimer);
  _inactivityTimer = null;
}


async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    await clearSession();
    lockVaultUI();
    document.querySelector('[data-tab="auth"]').click();
    showFeedback('loginFeedback', 'err', 'Sesión expirada. Inicia sesión de nuevo.');
    logLine('⚠️ Sesión expirada — inicia sesión de nuevo.');
    throw new Error('Sesión expirada');
  }
  return res;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.querySelectorAll('.v-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.v-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.v-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $(`panel-${tab.dataset.tab}`).classList.add('active');
    if (tab.dataset.tab === 'vault') updateSaveSectionVisibility();
  });
});

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

$('sitePass').addEventListener('input', () => {
  checkBreachSite($('sitePass').value);
  // Hide confirm button when user manually edits the password
  $('btnConfirmarGenerada').style.display = 'none';
});
$('editNewPass').addEventListener('input', () => checkBreachEdit($('editNewPass').value));

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

function normalizeDomain(domain) {
  if (!domain) return '';
  return domain.toLowerCase().replace(/^www\./, '').trim();
}

function applyDomain(domain) {
  if (!domain) return;
  $('siteUrl').value = domain;
  $('domainText').textContent = `Sitio: ${domain}`;
  $('domainBadge').classList.add('show');
  $('detectedSiteLabel').textContent = domain;
  $('detectedSite').style.display = 'flex';
  logLine(`🌐 Dominio detectado: ${domain}`);
  updateSaveSectionVisibility();
}

chrome.storage.local.get('pendingDomain', ({ pendingDomain }) => {
  if (pendingDomain) {
    applyDomain(pendingDomain);
    chrome.storage.local.remove('pendingDomain');
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        try {
          const url = new URL(tabs[0].url);
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            applyDomain(url.hostname.replace(/^www\./, ''));
          }
        } catch {}
      }
    });
  }
});

async function siteAlreadyInVault(domain) {
  if (!LOCAL_VK || !SESSION_TOKEN || !domain) return false;
  try {
    const res = await apiFetch(`${API_URL}/vault`, {
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
  if (!domain) { block.style.display = ''; return; }
  if (!LOCAL_VK || !SESSION_TOKEN) { block.style.display = ''; return; }
  const alreadySaved = await siteAlreadyInVault(domain);
  block.style.display = alreadySaved ? 'none' : '';
}

$('btnIniciar').addEventListener('click', iniciarSesion);
$('masterPass').addEventListener('keydown', e => { if (e.key === 'Enter') iniciarSesion(); });

async function iniciarSesion() {
  if (!ensureSecureApi('loginFeedback')) return;
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

    await saveSession(SESSION_TOKEN, LOCAL_VK);

    markInput($('email'),      'success');
    markInput($('masterPass'), 'success');
    showFeedback('loginFeedback','ok','Bóveda desbloqueada correctamente.');
    logLine('✅ Login OK — Bóveda abierta.');
    $('itemsList').innerHTML = '';
    unlockVaultUI();

    setTimeout(async () => {
      document.querySelector('[data-tab="vault"]').click();
      refrescarListaBoveda(true);
      await handlePendingCredential();
    }, 900);

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

$('btnRegistrar').addEventListener('click', registrar);

async function registrar() {
  if (!ensureSecureApi('regFeedback')) return;
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
    const newSalt = buf2hex(crypto.getRandomValues(new Uint8Array(32)));
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

$('btnSiguiente').addEventListener('click', guardarItem);
$('sitePass').addEventListener('keydown', e => { if (e.key === 'Enter') guardarItem(); });

async function guardarItem() {
  if (!ensureSecureApi('step1Feedback')) return;
  if (!LOCAL_VK || !SESSION_TOKEN) {
    showFeedback('step1Feedback','err','Inicia sesión primero.');
    return;
  }

  const btn  = $('btnSiguiente');
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

  setLoading(btn, true);
  logLine('🔒 Cifrando credencial con AES-GCM...');

  try {
    const payload = JSON.stringify({ site: url, password: pass });
    const iv      = crypto.getRandomValues(new Uint8Array(12));
    const cifrado = await crypto.subtle.encrypt(
      { name:'AES-GCM', iv }, LOCAL_VK, encoder.encode(payload)
    );

    const res = await apiFetch(`${API_URL}/vault`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SESSION_TOKEN}`
      },
      body: JSON.stringify({ encrypted_payload: buf2hex(cifrado), nonce: buf2hex(iv) })
    });

    if (!res.ok) throw new Error('Error al guardar en servidor.');

    markInput($('sitePass'), 'success');
    showFeedback('step1Feedback','ok',`Credencial de "${url}" guardada.`);
    logLine(`✅ Credencial de ${url} cifrada y almacenada.`);

    setTimeout(() => {
      $('sitePass').value = '';
      markInput($('sitePass'), null);
      hideBreachBadge('breachBadge');
      $('btnConfirmarGenerada').style.display = 'none';
      hideFeedback('step1Feedback');
      updateSaveSectionVisibility();
      refrescarListaBoveda(true);
    }, 1500);

  } catch (err) {
    showFeedback('step1Feedback','err', err.message);
    shake($('sitePass').closest('.v-field'));
    logLine(`❌ ${err.message}`);
  } finally {
    setLoading(btn, false);
  }
}

$('btnDescargar').addEventListener('click', () => descargarBoveda());

async function refrescarListaBoveda(silent = false) {
  if (!ensureSecureApi('listFeedback')) return;
  if (!LOCAL_VK || !SESSION_TOKEN) return;
  const btn  = $('btnDescargar');
  const list = $('itemsList');

  hideFeedback('listFeedback');
  list.innerHTML = '';

  if (!silent) {
    setLoading(btn, true);
    logLine('⬇️ Descargando bóveda cifrada...');
  }

  try {
    const res = await apiFetch(`${API_URL}/vault`, {
      headers: { 'Authorization': `Bearer ${SESSION_TOKEN}` }
    });
    if (!res.ok) throw new Error('No se pudo obtener la bóveda.');
    const items = await res.json();

    list.innerHTML = '';
    if (!silent) logLine(`ℹ️ ${items.length} ítem(s) encontrado(s).`);

    if (items.length === 0) {
      _allVaultItems = [];
      renderFilteredItems('');
      if (!silent) showFeedback('listFeedback','info','La bóveda está vacía.');
      return;
    }

    _allVaultItems = [];
    for (const [i, item] of items.entries()) {
      try {
        const buf  = await crypto.subtle.decrypt(
          { name:'AES-GCM', iv: hex2buf(item.nonce) }, LOCAL_VK, hex2buf(item.encrypted_payload)
        );
        const text = decoder.decode(buf);
        let site = '';
        try { const parsed = JSON.parse(text); site = parsed.site || ''; } catch {}
        _allVaultItems.push({ id: item.id, text, site });
        if (!silent) logLine(site ? `🔓 ${site}` : 'Ítem descifrado');
      } catch {
        if (!silent) logLine(`❌ Error descifrando [${item.id}]`);
      }
    }
    renderFilteredItems($('searchInput').value);
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
  if (!ensureSecureApi('listFeedback')) return;
  if (!LOCAL_VK || !SESSION_TOKEN) {
    showFeedback('listFeedback','err','Inicia sesión primero.');
    return;
  }
  await refrescarListaBoveda(false);
}

// ── DELETE ITEM ──────────────────────────────────────────────
async function eliminarItem(id, site) {
  if (!LOCAL_VK || !SESSION_TOKEN) return;
  if (!confirm(`¿Eliminar la credencial de "${site}"?\nEsta acción no se puede deshacer.`)) return;

  logLine(`⚙️ Eliminando credencial de ${site}...`);
  try {
    const res = await apiFetch(`${API_URL}/vault/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${SESSION_TOKEN}` }
    });
    if (!res.ok) throw new Error('Error al eliminar en el servidor.');
    logLine(`✅ Credencial de ${site} eliminada.`);
    refrescarListaBoveda(true);
    updateSaveSectionVisibility();
  } catch (err) {
    logLine(`❌ ${err.message}`);
    showFeedback('listFeedback','err', err.message);
  }
}

function renderItem(id, text, delay = 0) {
  const list = $('itemsList');
  const el   = document.createElement('div');
  el.className = 'v-item';
  el.style.animationDelay = `${delay}ms`;

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
    <button class="v-item-edit" title="Editar contraseña">✏️</button>
    <button class="v-item-copy" title="Copiar contraseña">⎘</button>
    <button class="v-item-delete" title="Eliminar credencial">🗑</button>
  `;

  const passEl = el.querySelector('.v-item-pass');
  let revealed = false;
  passEl.style.cursor = 'pointer';
  passEl.addEventListener('click', () => {
    revealed = !revealed;
    passEl.textContent = revealed ? password : maskedPass;
    passEl.style.color = revealed ? 'var(--accent2)' : '';
  });

  el.querySelector('.v-item-edit').addEventListener('click', () => {
    openEditModal(id, site || text);
  });

  el.querySelector('.v-item-copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText(password);
    const copyBtn = el.querySelector('.v-item-copy');
    copyBtn.textContent = '✔';
    copyBtn.style.color = 'var(--accent2)';
    setTimeout(() => { copyBtn.textContent = '⎘'; copyBtn.style.color = ''; }, 1500);
  });

  el.querySelector('.v-item-delete').addEventListener('click', () => {
    eliminarItem(id, site || 'este sitio');
  });

  list.appendChild(el);
}

function renderFilteredItems(filter = '') {
  const list = $('itemsList');
  list.innerHTML = '';
  const q = filter.toLowerCase().trim();
  const filtered = q
    ? _allVaultItems.filter(item => item.site.toLowerCase().includes(q))
    : _allVaultItems;
  filtered.forEach((item, i) => renderItem(item.id, item.text, i * 70));
}

setupEye('eyeEditNew',     'editNewPass');
setupEye('eyeEditConfirm', 'editNewPassConfirm');
setupEye('eyeOldMaster',  'oldMasterPass');
setupEye('eyeNewMaster',  'newMasterPass');

function openEditModal(itemId, site) {
  $('editItemId').value = itemId;
  $('editSiteLabel').textContent = `🌐 ${site}`;
  $('editNewPass').value = '';
  $('editNewPassConfirm').value = '';
  hideFeedback('editFeedback');
  hideBreachBadge('editBreachBadge');
  markInput($('editNewPass'), null);
  markInput($('editNewPassConfirm'), null);
  $('editOverlay').classList.add('show');
  $('editNewPass').focus();
}

function closeEditModal() {
  $('editOverlay').classList.remove('show');
}

$('btnEditCancelar').addEventListener('click', closeEditModal);
$('editOverlay').addEventListener('click', e => {
  if (e.target === $('editOverlay')) closeEditModal();
});

$('btnEditGuardar').addEventListener('click', actualizarItem);
$('editNewPassConfirm').addEventListener('keydown', e => { if (e.key === 'Enter') actualizarItem(); });

async function actualizarItem() {
  if (!LOCAL_VK || !SESSION_TOKEN) {
    showFeedback('editFeedback', 'err', 'Sesión expirada. Inicia sesión de nuevo.');
    return;
  }
  const btn     = $('btnEditGuardar');
  const itemId  = $('editItemId').value;
  const site    = $('editSiteLabel').textContent.replace('🌐 ', '').trim();
  const newPass = $('editNewPass').value;
  const confirm = $('editNewPassConfirm').value;

  hideFeedback('editFeedback');
  markInput($('editNewPass'), null);
  markInput($('editNewPassConfirm'), null);

  if (!newPass) {
    showFeedback('editFeedback', 'err', 'Introduce la nueva contraseña.');
    markInput($('editNewPass'), 'error');
    shake($('editNewPass').closest('.v-field'));
    return;
  }
  if (newPass !== confirm) {
    showFeedback('editFeedback', 'err', 'Las contraseñas no coinciden.');
    markInput($('editNewPassConfirm'), 'error');
    shake($('editNewPassConfirm').closest('.v-field'));
    return;
  }

  setLoading(btn, true);
  logLine(`⚙️ Actualizando credencial de ${site}...`);

  try {
    const payload = JSON.stringify({ site, password: newPass });
    const iv      = crypto.getRandomValues(new Uint8Array(12));
    const cifrado = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, LOCAL_VK, encoder.encode(payload)
    );

    const res = await apiFetch(`${API_URL}/vault/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SESSION_TOKEN}`
      },
      body: JSON.stringify({ encrypted_payload: buf2hex(cifrado), nonce: buf2hex(iv) })
    });

    if (!res.ok) throw new Error('Error al actualizar en el servidor.');

    markInput($('editNewPass'), 'success');
    showFeedback('editFeedback', 'ok', 'Contraseña actualizada correctamente.');
    logLine(`✅ Credencial de ${site} actualizada.`);

    setTimeout(() => {
      closeEditModal();
      refrescarListaBoveda(true);
    }, 1000);

  } catch (err) {
    showFeedback('editFeedback', 'err', err.message);
    logLine(`❌ ${err.message}`);
  } finally {
    setLoading(btn, false);
  }
}

// ── GENERATE PASSWORD ────────────────────────────────────────
$('btnGenerar').addEventListener('click', generarPassword);

function generarPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*?-_';
  const rnd = crypto.getRandomValues(new Uint8Array(16));
  const password = Array.from(rnd, b => chars[b % chars.length]).join('');

  setNativeValue($('sitePass'), password);

  // Show the confirm button
  $('btnConfirmarGenerada').style.display = 'flex';
  $('btnConfirmarGenerada').focus();
}

// "Use this password" confirmation button
$('btnConfirmarGenerada').addEventListener('click', () => {
  const pass = $('sitePass').value;
  if (!pass) return;
  $('btnConfirmarGenerada').style.display = 'none';
  logLine('✅ Contraseña generada confirmada.');
});

function setNativeValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// ── CAMBIAR CONTRASEÑA MAESTRA ────────────────────────────────
$('btnCambiarPass').addEventListener('click', () => {
  $('cambiarPassOverlay').classList.add('show');
  hideFeedback('cambiarPassFeedback');
  $('oldMasterPass').value = '';
  $('newMasterPass').value = '';
  $('newMasterPassConfirm').value = '';
});

$('btnCambiarPassCancelar').addEventListener('click', () => {
  $('cambiarPassOverlay').classList.remove('show');
});

$('btnCambiarPassGuardar').addEventListener('click', cambiarPasswordMaestra);

async function cambiarPasswordMaestra() {
  const btn   = $('btnCambiarPassGuardar');
  const email = getEmailFromToken();
  if (!email || !LOCAL_VK) { showFeedback('cambiarPassFeedback', 'err', 'Sesión inválida.'); return; }

  const oldPass = $('oldMasterPass').value;
  const newPass = $('newMasterPass').value;
  const confirm = $('newMasterPassConfirm').value;

  if (!oldPass || !newPass || !confirm) {
    showFeedback('cambiarPassFeedback', 'err', 'Rellena todos los campos.');
    return;
  }
  if (newPass !== confirm) {
    showFeedback('cambiarPassFeedback', 'err', 'Las contraseñas nuevas no coinciden.');
    return;
  }
  if (newPass === oldPass) {
    showFeedback('cambiarPassFeedback', 'err', 'La nueva contraseña debe ser diferente a la actual.');
    return;
  }

  setLoading(btn, true);
  hideFeedback('cambiarPassFeedback');

  try {
    const resSalt = await fetch(`${API_URL}/salt/${email}`);
    if (!resSalt.ok) throw new Error('No se pudo obtener el salt.');
    const { client_salt } = await resSalt.json();

    const oldMek = await derivarMEK(oldPass, email + client_salt);
    const oldMah = await derivarMAH(oldMek);

    const newSalt = buf2hex(crypto.getRandomValues(new Uint8Array(32)));
    const newMek  = await derivarMEK(newPass, email + newSalt);
    const newMah  = await derivarMAH(newMek);

    const rawVK  = await crypto.subtle.exportKey("raw", LOCAL_VK);
    const iv     = crypto.getRandomValues(new Uint8Array(12));
    const encVK  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, newMek, rawVK);
    const newEncryptedVk = buf2hex(iv) + ':' + buf2hex(encVK);

    const res = await apiFetch(`${API_URL}/users/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
      body: JSON.stringify({ old_mah: oldMah, new_mah: newMah, new_encrypted_vk: newEncryptedVk, new_client_salt: newSalt }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Error al cambiar la contraseña.');
    }

    showFeedback('cambiarPassFeedback', 'ok', '✅ Contraseña maestra actualizada.');
    logLine('✅ Contraseña maestra cambiada correctamente.');
    setTimeout(() => $('cambiarPassOverlay').classList.remove('show'), 1500);

  } catch (err) {
    showFeedback('cambiarPassFeedback', 'err', err.message);
    logLine(`❌ ${err.message}`);
  } finally {
    setLoading(btn, false);
  }
}

// ── CREDENCIAL PENDIENTE (detectada en formulario web) ────────
async function handlePendingCredential() {
  const data = await chrome.storage.local.get('pendingSaveCredential');
  if (!data.pendingSaveCredential) return;

  const { site, password } = data.pendingSaveCredential;

  if (SESSION_TOKEN && LOCAL_VK) {
    // Sesión activa → ir al tab Bóveda, pre-rellenar y pedir confirmación
    await chrome.storage.local.remove('pendingSaveCredential');

    document.querySelector('[data-tab="vault"]').click();

    // Aplicar dominio si no está ya establecido
    if (site && (!$('siteUrl').value || $('siteUrl').value.trim() === '')) {
      applyDomain(site);
    }

    // Pre-rellenar la contraseña detectada
    setNativeValue($('sitePass'), password);

    showFeedback('step1Feedback', 'info', `Contraseña detectada de "${escapeHtml(site)}". Revisa y guarda.`);
    logLine(`🌐 Contraseña detectada en formulario: ${site}`);
    await updateSaveSectionVisibility();
  } else {
    // Sin sesión → mostrar banner en el panel de acceso
    const banner = $('pendingCredentialBanner');
    if (banner) {
      banner.className = 'v-feedback info show';
      banner.innerHTML = `<span>ℹ</span> Contraseña detectada en <strong>${escapeHtml(site)}</strong>. Inicia sesión para guardarla.`;
    }
  }
}

// ── LOGOUT ────────────────────────────────────────────────────
$('btnLogout').addEventListener('click', async () => {
  await clearSession();
  lockVaultUI();
  _allVaultItems = [];
  $('itemsList').innerHTML = '';
  $('searchInput').value = '';
  $('userEmailLabel').textContent = '—';
  document.querySelector('[data-tab="auth"]').click();
  logLine('🔒 Sesión cerrada.');
});

// ── BÚSQUEDA ──────────────────────────────────────────────────
$('searchInput').addEventListener('input', () => {
  renderFilteredItems($('searchInput').value);
});

// ── INACTIVIDAD — resetear timer en cualquier interacción ─────
['click', 'keydown'].forEach(evt =>
  document.addEventListener(evt, () => { if (SESSION_TOKEN) resetInactivityTimer(); }, { passive: true })
);

(async () => {
  const restored = await restoreSession();
  if (restored) {
    logLine('🟢 Sesión restaurada automáticamente.');
    unlockVaultUI();
    refrescarListaBoveda(true);
  }
  await handlePendingCredential();
})();