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

// Criptografía
async function derivarMEK(password, salt) {
    const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]);
    const mekBuffer = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
    return await crypto.subtle.importKey("raw", mekBuffer, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

async function derivarMAH(mek) {
    const mekBits = await crypto.subtle.exportKey("raw", mek);
    const hmacKey = await crypto.subtle.importKey("raw", mekBits, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return buf2hex(await crypto.subtle.sign("HMAC", hmacKey, encoder.encode("autenticacion")));
}

// Lógica de los botones
async function registrar() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('masterPass').value;
    const newSalt = "sal_" + Date.now(); 
    
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
        body: JSON.stringify({ email: email, client_salt: newSalt, mah: mah, encrypted_vk: buf2hex(iv) + ":" + buf2hex(encryptedVKBuffer) })
    });
    
    if(res.ok) logMsg("✅ Registro OK.");
    else logMsg("❌ Error: " + (await res.json()).detail);
}

async function iniciarSesion() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('masterPass').value;

    logMsg("⏳ Pidiendo sal...");
    const resSalt = await fetch(`${API_URL}/salt/${email}`);
    if(!resSalt.ok) return logMsg("❌ Usuario no encontrado.");
    
    const dataSalt = await resSalt.json();
    const mek = await derivarMEK(pass, email + dataSalt.client_salt);
    const mah = await derivarMAH(mek);
    
    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, mah: mah })
    });

    if(res.ok) {
        const data = await res.json();
        SESSION_TOKEN = data.access_token;
        const parts = data.encrypted_vk.split(":");
        try {
            const vkBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: hex2buf(parts[0]) }, mek, hex2buf(parts[1]));
            LOCAL_VK = await crypto.subtle.importKey("raw", vkBuffer, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
            logMsg("✅ Login OK. Bóveda abierta.");
        } catch(e) { logMsg("❌ Pass incorrecta."); }
    } else { logMsg("❌ Credenciales incorrectas."); }
}

async function guardarItem() {
    if(!LOCAL_VK || !SESSION_TOKEN) return logMsg("❌ Inicia sesión primero.");
    const secreto = document.getElementById('secretData').value;
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cifradoBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, LOCAL_VK, encoder.encode(secreto));
    
    const res = await fetch(`${API_URL}/vault?token=${SESSION_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted_payload: buf2hex(cifradoBuffer), nonce: buf2hex(iv) })
    });
    if(res.ok) logMsg(`🔒 Secreto cifrado y guardado.`);
}

async function descargarBoveda() {
    if(!LOCAL_VK || !SESSION_TOKEN) return logMsg("❌ Inicia sesión primero.");
    const res = await fetch(`${API_URL}/vault?token=${SESSION_TOKEN}`);
    if(res.ok) {
        const items = await res.json();
        logMsg(`⬇️ Descargando (${items.length} ítems)...`);
        for(let item of items) {
            try {
                const descifradoBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: hex2buf(item.nonce) }, LOCAL_VK, hex2buf(item.encrypted_payload));
                logMsg(`🔓 [${item.id}]: ${decoder.decode(descifradoBuffer)}`);
            } catch(e) { logMsg(`❌ Error descifrando [${item.id}]`); }
        }
    }
}

// Conectar botones del HTML con las funciones (Requisito de Manifest V3)
document.getElementById('btnRegistrar').addEventListener('click', registrar);
document.getElementById('btnIniciar').addEventListener('click', iniciarSesion);
document.getElementById('btnGuardar').addEventListener('click', guardarItem);
document.getElementById('btnDescargar').addEventListener('click', descargarBoveda);