function evaluateStrength(password) {
  if (!password || password.length === 0) {
    return { score: 0, label: "Vacía", feedback: ["Introduce una contraseña."], crackTime: "instantáneo" };
  }

  const labels = ["Muy débil", "Débil", "Regular", "Fuerte", "Muy fuerte"];
  const colors = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#27ae60"];

  if (typeof zxcvbn === "function") {
    const result = zxcvbn(password);

    const feedback = [];
    if (result.feedback.warning) feedback.push("⚠️ " + result.feedback.warning);
    result.feedback.suggestions.forEach(s => feedback.push("💡 " + s));

    const crackTime = result.crack_times_display.offline_slow_hashing_1e4_per_second;

    return {
      score: result.score,
      label: labels[result.score],
      color: colors[result.score],
      feedback: feedback.length > 0 ? feedback : ["✅ Sin sugerencias adicionales."],
      crackTime: crackTime,
      entropy: Math.round(result.guesses_log10 * 3.32),
    };
  }

  const len = password.length;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  let score = 0;
  if (len >= 8) score++;
  if (len >= 12) score++;
  if (variety >= 3) score++;
  if (len >= 16 && variety >= 3) score++;

  const feedback = [];
  if (len < 8) feedback.push("💡 Usa al menos 8 caracteres.");
  if (len < 12) feedback.push("💡 Considera usar 12+ caracteres.");
  if (!hasUpper) feedback.push("💡 Añade mayúsculas.");
  if (!hasDigit) feedback.push("💡 Añade números.");
  if (!hasSymbol) feedback.push("💡 Añade símbolos (!@#$...)");

  return {
    score: Math.min(score, 4),
    label: labels[Math.min(score, 4)],
    color: colors[Math.min(score, 4)],
    feedback: feedback.length > 0 ? feedback : ["✅ Contraseña aceptable."],
    crackTime: "N/A (zxcvbn no cargado)",
    entropy: Math.floor(len * Math.log2(variety * 26 || 26)),
  };
}

async function sha1(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function checkBreach(password) {
  try {
    const hash = await sha1(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" }
    });

    if (!response.ok) {
      throw new Error(`Error de red: ${response.status}`);
    }

    const text = await response.text();

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

const CHARSETS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits:    "0123456789",
  symbols:   "!@#$%^&*()-_=+[]{}|;:,.<>?",
};

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

  if (excludeAmbiguous) {
    charset = charset.replace(/[l1IoO0]/g, "");
  }

  if (charset.length === 0) {
    throw new Error("Debes seleccionar al menos un tipo de caracteres.");
  }

  const required = [];
  required.push(randomChar(CHARSETS.lowercase.replace(excludeAmbiguous ? /[l1IoO0]/g : /x^/, "")));
  if (uppercase) required.push(randomChar(CHARSETS.uppercase.replace(excludeAmbiguous ? /[IoO]/g : /x^/, "")));
  if (digits)    required.push(randomChar(CHARSETS.digits.replace(excludeAmbiguous ? /[10]/g : /x^/, "")));
  if (symbols)   required.push(randomChar(CHARSETS.symbols));

  const passwordArray = [...required];
  while (passwordArray.length < length) {
    passwordArray.push(randomChar(charset));
  }

  shuffleArray(passwordArray);

  const password = passwordArray.join("");
  const entropy = Math.floor(Math.log2(Math.pow(charset.length, length)));

  return { password, entropy, charsetSize: charset.length };
}

function randomChar(str) {
  const randomValues = new Uint32Array(1);
  crypto.getRandomValues(randomValues);
  return str[randomValues[0] % str.length];
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const randomValues = new Uint32Array(1);
    crypto.getRandomValues(randomValues);
    const j = randomValues[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

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

  const entropy = Math.floor(wordCount * Math.log2(wordList.length));

  return { passphrase, entropy, wordCount };
}

export { evaluateStrength, checkBreach, generatePassword, generatePassphrase };
