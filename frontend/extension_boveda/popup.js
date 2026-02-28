const API_URL = "http://localhost:8000/api";
let SESSION_TOKEN = null;
let LOCAL_VK = null;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function buf2hex(buffer) { return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function hex2buf(hexString) { return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16))); }

function logMsg(msg) {
    const logEl = document.getElementById('log');
    logEl.innerText += "\n" + msg;
    logEl.scrollTop = logEl.scrollHeight;
}

// =====================================================================
// CRIPTOGRAFÍA
// =====================================================================

async function derivarMEK(password, salt) {
    const keyMaterial = await crypto.subtle.importKey(
        "raw", encoder.encode(password),
        { name: "PBKDF2" }, false,
        ["deriveBits", "deriveKey"]
    );
    const mekBuffer = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-256" },
        keyMaterial, 256
    );
    return await crypto.subtle.importKey("raw", mekBuffer, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

async function derivarMAH(mek) {
    const mekBits = await crypto.subtle.exportKey("raw", mek);
    const hmacKey = await crypto.subtle.importKey("raw", mekBits, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return buf2hex(await crypto.subtle.sign("HMAC", hmacKey, encoder.encode("autenticacion")));
}

// =====================================================================
// HIBP BREACH CHECKING — k-anonymity
// La contraseña NUNCA sale del navegador. Solo los primeros 5 chars del hash SHA-1.
// =====================================================================

async function checkBreach(password) {
    const hashBuffer = await crypto.subtle.digest("SHA-1", encoder.encode(password));
    const hashHex = buf2hex(hashBuffer).toUpperCase();
    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { "Add-Padding": "true" }
    });
    if (!res.ok) throw new Error("No se pudo contactar con HaveIBeenPwned");

    const text = await res.text();
    for (const line of text.split("\r\n")) {
        const [returnedSuffix, countStr] = line.split(":");
        if (returnedSuffix === suffix) return parseInt(countStr, 10);
    }
    return 0;
}

async function comprobarFiltracion() {
    const password = document.getElementById('checkPassword').value;
    if (!password) return logMsg("⚠️ Escribe una contraseña para comprobar.");

    const btn = document.getElementById('btnComprobar');
    btn.disabled = true;
    btn.textContent = "Comprobando...";

    const hashHex = buf2hex(await crypto.subtle.digest("SHA-1", encoder.encode(password))).toUpperCase();
    logMsg(`🔍 Comprobando filtración con k-anonymity...`);
    logMsg(`   → Prefijo SHA-1 enviado: ${hashHex.slice(0, 5)}... (tu contraseña no sale del navegador)`);

    try {
        const count = await checkBreach(password);
        if (count > 0) {
            logMsg(`🚨 FILTRADA: Aparece en ${count.toLocaleString()} brechas de datos.`);
            logMsg(`   → Cámbiala inmediatamente.`);
            mostrarBadge("filtrada", count);
        } else {
            logMsg(`✅ SEGURA: No encontrada en ninguna brecha conocida.`);
            mostrarBadge("segura", 0);
        }
    } catch (e) {
        logMsg(`❌ Error al conectar con HIBP: ${e.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = "Comprobar filtración";
    }
}

function mostrarBadge(tipo, count) {
    const el = document.getElementById('breachBadge');
    if (tipo === "filtrada") {
        el.textContent = `🚨 FILTRADA ${count.toLocaleString()}x`;
        el.className = "badge danger";
    } else {
        el.textContent = `✅ No filtrada`;
        el.className = "badge safe";
    }
    el.style.display = "inline-block";
}

// =====================================================================
// AUTENTICACIÓN
// =====================================================================

async function registrar() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('masterPass').value;

    // FIX: sal criptográficamente aleatoria
    const newSalt = buf2hex(crypto.getRandomValues(new Uint8Array(16)));

    logMsg("⚙️ Generando llaves...");
    const mek = await derivarMEK(pass, email + newSalt);
    const mah = await derivarMAH(mek);

    LOCAL_VK = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const vkBits = await crypto.subtle.exportKey("raw", LOCAL_VK);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedVKBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, mek, vkBits);

    const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email, client_salt: newSalt, mah,
            encrypted_vk: buf2hex(iv) + ":" + buf2hex(encryptedVKBuffer)
        })
    });

    if (res.ok) logMsg("✅ Registro OK.");
    else logMsg("❌ Error: " + (await res.json()).detail);
}

async function iniciarSesion() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('masterPass').value;

    logMsg("⏳ Pidiendo sal...");
    const resSalt = await fetch(`${API_URL}/salt/${email}`);
    if (!resSalt.ok) return logMsg("❌ Usuario no encontrado.");

    const { client_salt } = await resSalt.json();
    const mek = await derivarMEK(pass, email + client_salt);
    const mah = await derivarMAH(mek);

    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mah })
    });

    if (res.ok) {
        const data = await res.json();
        SESSION_TOKEN = data.access_token;
        const [ivHex, encVkHex] = data.encrypted_vk.split(":");
        try {
            const vkBuffer = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: hex2buf(ivHex) }, mek, hex2buf(encVkHex)
            );
            LOCAL_VK = await crypto.subtle.importKey("raw", vkBuffer, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
            logMsg("✅ Login OK. Bóveda abierta.");
        } catch (e) {
            logMsg("❌ Pass incorrecta.");
        }
    } else {
        logMsg("❌ Credenciales incorrectas.");
    }
}

// =====================================================================
// BÓVEDA
// =====================================================================

async function guardarItem() {
    if (!LOCAL_VK || !SESSION_TOKEN) return logMsg("❌ Inicia sesión primero.");
    const secreto = document.getElementById('secretData').value;

    // Extraer contraseña del formato "sitio: contraseña" para comprobar HIBP
    const colonIdx = secreto.indexOf(":");
    const posiblePass = colonIdx !== -1 ? secreto.slice(colonIdx + 1).trim() : secreto;

    logMsg("🔍 Comprobando filtración antes de guardar...");
    try {
        const count = await checkBreach(posiblePass);
        if (count > 0) {
            logMsg(`⚠️ ADVERTENCIA: Filtrada ${count.toLocaleString()} veces. Guardando igualmente, pero considera cambiarla.`);
        } else {
            logMsg(`✅ Contraseña no filtrada. Guardando...`);
        }
    } catch (e) {
        logMsg(`⚠️ No se pudo verificar HIBP. Guardando de todas formas.`);
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cifradoBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, LOCAL_VK, encoder.encode(secreto));

    // FIX: token en Authorization header, NO en la URL
    const res = await fetch(`${API_URL}/vault`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SESSION_TOKEN}`
        },
        body: JSON.stringify({ encrypted_payload: buf2hex(cifradoBuffer), nonce: buf2hex(iv) })
    });

    if (res.ok) logMsg(`🔒 Secreto cifrado y guardado.`);
}

async function descargarBoveda() {
    if (!LOCAL_VK || !SESSION_TOKEN) return logMsg("❌ Inicia sesión primero.");

    // FIX: token en Authorization header, NO en la URL
    const res = await fetch(`${API_URL}/vault`, {
        headers: { 'Authorization': `Bearer ${SESSION_TOKEN}` }
    });

    if (res.ok) {
        const items = await res.json();
        logMsg(`⬇️ Descargando (${items.length} ítems)...`);
        for (let item of items) {
            try {
                const dec = await crypto.subtle.decrypt(
                    { name: "AES-GCM", iv: hex2buf(item.nonce) }, LOCAL_VK, hex2buf(item.encrypted_payload)
                );
                logMsg(`🔓 [${item.id}]: ${decoder.decode(dec)}`);
            } catch (e) {
                logMsg(`❌ Error descifrando [${item.id}]`);
            }
        }
    }
}

// =====================================================================
// EVENT LISTENERS
// =====================================================================
document.getElementById('btnRegistrar').addEventListener('click', registrar);
document.getElementById('btnIniciar').addEventListener('click', iniciarSesion);
document.getElementById('btnGuardar').addEventListener('click', guardarItem);
document.getElementById('btnDescargar').addEventListener('click', descargarBoveda);
document.getElementById('btnComprobar').addEventListener('click', comprobarFiltracion);