/**
 * BACKGROUND SERVICE WORKER (Manifest V3)
 * ========================================
 * Punto de entrada del service worker.
 * Importa el handler de Persona 2 para manejar mensajes.
 */

// Importar el handler de mensajes
import "./password-extension/src/persona2_handler.js";

console.log("[ClaveGal] Service Worker iniciado");
