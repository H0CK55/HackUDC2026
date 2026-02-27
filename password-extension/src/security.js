/**
 * PERSONA 2 — Módulo de Seguridad de Contraseñas
 * ================================================
 * Funciones:
 *  - evaluateStrength(password)   → fortaleza con zxcvbn
 *  - checkBreach(password)        → filtraciones con HIBP (k-anonymity)
 *  - generatePassword(options)    → contraseña aleatoria segura (Web Crypto)
 *  - generatePassphrase(words)    → passphrase estilo Diceware
 */

// ─────────────────────────────────────────────
// 1. EVALUACIÓN DE FORTALEZA (zxcvbn)
// ─────────────────────────────────────────────

/**
 * Evalúa la fortaleza de una contraseña usando zxcvbn.
 * @param {string} password
 * @returns {{ score: number, label: string, feedback: string[], crackTime: string }}
 */
function evaluateStrength(password) {
  if (!password || password.length === 0) {
    return { score: 0, label: "Vacía", feedback: ["Introduce una contraseña."], crackTime: "instantáneo" };
  }

  // zxcvbn debe estar cargado previamente (ver README)
  const result = zxcvbn(password);

  const labels = ["Muy débil", "Débil", "Regular", "Fuerte", "Muy fuerte"];
  const colors = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#27ae60"];

  const feedback = [];
  if (result.feedback.warning) feedback.push("⚠️ " + result.feedback.warning);
  result.feedback.suggestions.forEach(s => feedback.push("💡 " + s));

  // Tiempo estimado de cracking en modo offline lento
  const crackTime = result.crack_times_display.offline_slow_hashing_1e4_per_second;

  return {
    score: result.score,           // 0-4
    label: labels[result.score],
    color: colors[result.score],
    feedback: feedback.length > 0 ? feedback : ["✅ Sin sugerencias adicionales."],
    crackTime: crackTime,
    entropy: Math.round(result.guesses_log10 * 3.32), // bits aprox.
  };
}

// ─────────────────────────────────────────────
// 2. VERIFICACIÓN DE FILTRACIONES (HIBP)
//    Usa k-anonymity: solo se envían 5 chars del hash SHA-1
// ─────────────────────────────────────────────

/**
 * Genera el hash SHA-1 de una contraseña (en mayúsculas).
 * @param {string} password
 * @returns {Promise<string>} hash SHA-1 hex en mayúsculas
 */
async function sha1(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Comprueba si la contraseña ha aparecido en filtraciones conocidas.
 * NUNCA envía la contraseña completa — solo los primeros 5 caracteres del hash (k-anonymity).
 * @param {string} password
 * @returns {Promise<{ pwned: boolean, count: number, message: string }>}
 */
async function checkBreach(password) {
  try {
    const hash = await sha1(password);
    const prefix = hash.slice(0, 5);   // Solo esto va a la API
    const suffix = hash.slice(5);      // Esto lo comparamos localmente

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" } // Evita análisis de tráfico
    });

    if (!response.ok) {
      throw new Error(`Error de red: ${response.status}`);
    }

    const text = await response.text();

    // Cada línea tiene formato: HASHSUFFIX:COUNT
    const lines = text.split("\n");
    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(":");
      if (hashSuffix.trim() === suffix) {
        const count = parseInt(countStr.trim(), 10);
        return {
          pwned: true,
          count: count,
          message: `🚨 Esta contraseña ha aparecido ${count.toLocaleString()} veces en filtraciones. ¡No la uses!`
        };
      }
    }

    return {
      pwned: false,
      count: 0,
      message: "✅ Esta contraseña no aparece en filtraciones conocidas."
    };

  } catch (error) {
    console.error("[HIBP] Error al verificar:", error);
    return {
      pwned: null,
      count: 0,
      message: "⚠️ No se pudo verificar la filtración. Comprueba tu conexión."
    };
  }
}

// ─────────────────────────────────────────────
// 3. GENERADOR DE CONTRASEÑA ALEATORIA SEGURA
//    Usa Web Crypto API (criptográficamente seguro)
// ─────────────────────────────────────────────

const CHARSETS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits:    "0123456789",
  symbols:   "!@#$%^&*()-_=+[]{}|;:,.<>?",
};

/**
 * Genera una contraseña aleatoria criptográficamente segura.
 * @param {Object} options
 * @param {number} options.length        - Longitud (default: 16)
 * @param {boolean} options.uppercase    - Incluir mayúsculas (default: true)
 * @param {boolean} options.digits       - Incluir números (default: true)
 * @param {boolean} options.symbols      - Incluir símbolos (default: true)
 * @param {boolean} options.excludeAmbiguous - Excluir caracteres ambiguos (default: false)
 * @returns {{ password: string, entropy: number }}
 */
function generatePassword(options = {}) {
  const {
    length = 16,
    uppercase = true,
    digits = true,
    symbols = true,
    excludeAmbiguous = false,
  } = options;

  let charset = CHARSETS.lowercase;
  if (uppercase) charset += CHARSETS.uppercase;
  if (digits)    charset += CHARSETS.digits;
  if (symbols)   charset += CHARSETS.symbols;

  // Eliminar caracteres ambiguos (l, 1, I, O, 0, etc.)
  if (excludeAmbiguous) {
    charset = charset.replace(/[l1IoO0]/g, "");
  }

  if (charset.length === 0) {
    throw new Error("Debes seleccionar al menos un tipo de caracteres.");
  }

  // Asegurar al menos un carácter de cada tipo seleccionado
  const required = [];
  required.push(randomChar(CHARSETS.lowercase.replace(excludeAmbiguous ? /[l1IoO0]/g : /x^/, "")));
  if (uppercase) required.push(randomChar(CHARSETS.uppercase.replace(excludeAmbiguous ? /[IoO]/g : /x^/, "")));
  if (digits)    required.push(randomChar(CHARSETS.digits.replace(excludeAmbiguous ? /[10]/g : /x^/, "")));
  if (symbols)   required.push(randomChar(CHARSETS.symbols));

  // Rellenar el resto
  const passwordArray = [...required];
  while (passwordArray.length < length) {
    passwordArray.push(randomChar(charset));
  }

  // Mezclar para que los caracteres requeridos no estén siempre al principio
  shuffleArray(passwordArray);

  const password = passwordArray.join("");
  const entropy = Math.floor(Math.log2(Math.pow(charset.length, length)));

  return { password, entropy, charsetSize: charset.length };
}

/** Devuelve un carácter aleatorio de un string usando Web Crypto */
function randomChar(str) {
  const randomValues = new Uint32Array(1);
  crypto.getRandomValues(randomValues);
  return str[randomValues[0] % str.length];
}

/** Mezcla un array in-place usando Web Crypto (Fisher-Yates) */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const randomValues = new Uint32Array(1);
    crypto.getRandomValues(randomValues);
    const j = randomValues[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ─────────────────────────────────────────────
// 4. GENERADOR DE PASSPHRASE (Diceware)
//    Selecciona palabras al azar de una lista curada
// ─────────────────────────────────────────────

/**
 * Genera una passphrase estilo Diceware.
 * @param {Object} options
 * @param {string[]} options.wordList   - Lista de palabras (importar de wordlist.js)
 * @param {number} options.wordCount    - Número de palabras (default: 5)
 * @param {string} options.separator    - Separador (default: "-")
 * @param {boolean} options.capitalize  - Capitalizar primera letra de cada palabra
 * @param {boolean} options.addNumber   - Añadir un número al final
 * @returns {{ passphrase: string, entropy: number }}
 */
function generatePassphrase(options = {}) {
  const {
    wordList,
    wordCount = 5,
    separator = "-",
    capitalize = false,
    addNumber = false,
  } = options;

  if (!wordList || wordList.length === 0) {
    throw new Error("Se necesita una lista de palabras para generar la passphrase.");
  }

  const words = [];
  for (let i = 0; i < wordCount; i++) {
    const randomValues = new Uint32Array(1);
    crypto.getRandomValues(randomValues);
    let word = wordList[randomValues[0] % wordList.length];
    if (capitalize) word = word.charAt(0).toUpperCase() + word.slice(1);
    words.push(word);
  }

  let passphrase = words.join(separator);

  if (addNumber) {
    const randomValues = new Uint32Array(1);
    crypto.getRandomValues(randomValues);
    passphrase += separator + (randomValues[0] % 100);
  }

  // Entropía: log2(wordList.length) bits por palabra
  const entropy = Math.floor(wordCount * Math.log2(wordList.length));

  return { passphrase, entropy, wordCount };
}

// ─────────────────────────────────────────────
// EXPORTS — para uso como módulo en el service worker
// ─────────────────────────────────────────────

// Si se usa como módulo ES6 (Manifest V3):
export { evaluateStrength, checkBreach, generatePassword, generatePassphrase };