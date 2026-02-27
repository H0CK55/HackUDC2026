/**
 * PERSONA 2 — Service Worker Handler
 * =====================================
 * Este archivo se encarga de escuchar los mensajes que llegan
 * desde el content script (Persona 1) o el popup (Persona 4)
 * y llama a las funciones del módulo de seguridad.
 *
 * MENSAJES QUE MANEJA PERSONA 2:
 * ┌─────────────────────────┬────────────────────────────────────────┐
 * │ Mensaje recibido        │ Función llamada                        │
 * ├─────────────────────────┼────────────────────────────────────────┤
 * │ CHECK_STRENGTH          │ evaluateStrength(password)             │
 * │ CHECK_BREACH            │ checkBreach(password)                  │
 * │ CHECK_FULL              │ evaluateStrength + checkBreach         │
 * │ GENERATE_PASSWORD       │ generatePassword(options)              │
 * │ GENERATE_PASSPHRASE     │ generatePassphrase(options)            │
 * └─────────────────────────┴────────────────────────────────────────┘
 */

import { evaluateStrength, checkBreach, generatePassword, generatePassphrase } from "./security.js";
import WORDLIST_ES, { WORDLIST_EN } from "../wordlist/wordlist.js";

/**
 * Registra el listener en el service worker.
 * Debe llamarse desde background.js: import "./persona2_handler.js"
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Manejamos solo los mensajes de Persona 2
  if (!message || !message.action) return false;

  switch (message.action) {

    // ─── Verificar fortaleza ───────────────────────────────────────
    case "CHECK_STRENGTH": {
      try {
        const result = evaluateStrength(message.password);
        sendResponse({ ok: true, data: result });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
      return false; // síncrono
    }

    // ─── Verificar filtraciones (async) ───────────────────────────
    case "CHECK_BREACH": {
      checkBreach(message.password)
        .then(result => sendResponse({ ok: true, data: result }))
        .catch(e => sendResponse({ ok: false, error: e.message }));
      return true; // async → mantener canal abierto
    }

    // ─── Verificación completa: fortaleza + filtración ─────────────
    case "CHECK_FULL": {
      const strengthResult = evaluateStrength(message.password);
      checkBreach(message.password)
        .then(breachResult => {
          sendResponse({
            ok: true,
            data: {
              strength: strengthResult,
              breach: breachResult,
            }
          });
        })
        .catch(e => sendResponse({ ok: false, error: e.message }));
      return true; // async
    }

    // ─── Generar contraseña aleatoria ─────────────────────────────
    case "GENERATE_PASSWORD": {
      try {
        const result = generatePassword(message.options || {});
        sendResponse({ ok: true, data: result });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
      return false;
    }

    // ─── Generar passphrase Diceware ──────────────────────────────
    case "GENERATE_PASSPHRASE": {
      try {
        const lang = message.options?.lang === "en" ? WORDLIST_EN : WORDLIST_ES;
        const result = generatePassphrase({
          wordList: lang,
          ...message.options,
        });
        sendResponse({ ok: true, data: result });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
      return false;
    }

    // ─── Acción no reconocida ──────────────────────────────────────
    default:
      return false;
  }
});