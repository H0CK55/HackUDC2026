# Auditoría de seguridad — Zero-Knowledge Vault

Resumen de fallos detectados, correcciones aplicadas y recomendaciones pendientes.


## Implementado

- **Validación de email:** Registro y login usan `EmailStr` de Pydantic; se rechazan emails con formato inválido.
- **HTTPS en producción:** La extensión permite HTTP solo para `localhost` / `127.0.0.1`. Si la API en `config.js` no es local y usa `http://`, se bloquean login, registro y bóveda y se muestra aviso para editar `config.js` con HTTPS.

## Recomendaciones pendientes (prioridad media)

### 10. **Formato de nonce/hex**
- **Estado actual:** Backend acepta cualquier string en `nonce` y `encrypted_payload` hasta el límite de longitud; la extensión usa hex.
- **Riesgo:** Valores no hex podrían causar errores o comportamientos raros al descifrar.
- **Recomendación:** En el backend, validar que `nonce` y `encrypted_payload` sean cadenas hexadecimales (regex `^[0-9a-fA-F]+$`) además del límite de tamaño; en la extensión, validar en `hex2buf` y manejar longitudes impares o caracteres inválidos sin romper la UI.

### 11. **Persistencia del token en la extensión**
- **Estado actual:** `SESSION_TOKEN` y `LOCAL_VK` solo viven en memoria (variables del popup); al cerrar el popup se pierde la sesión.
- **Comentario:** No persistir el token en disco es más seguro; si se quiere “mantener sesión”, usar `chrome.storage.session` (se borra al cerrar el navegador) y nunca `local` para el token/VK, y opcionalmente cifrar lo que se guarde.

---
