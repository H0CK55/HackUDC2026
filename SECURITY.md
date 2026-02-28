# Auditoría de seguridad — Zero-Knowledge Vault

Resumen de fallos detectados, correcciones aplicadas y recomendaciones pendientes.


## Recomendaciones pendientes (prioridad media)

### 9. **Validación de email**
- **Estado actual:** Se usa `str` con `max_length` en los schemas; no se valida formato de email.
- **Recomendación:** Usar `EmailStr` de Pydantic (`pydantic[email]`) en registro y login para rechazar valores que no sean emails válidos.

### 10. **Formato de nonce/hex**
- **Estado actual:** Backend acepta cualquier string en `nonce` y `encrypted_payload` hasta el límite de longitud; la extensión usa hex.
- **Riesgo:** Valores no hex podrían causar errores o comportamientos raros al descifrar.
- **Recomendación:** En el backend, validar que `nonce` y `encrypted_payload` sean cadenas hexadecimales (regex `^[0-9a-fA-F]+$`) además del límite de tamaño; en la extensión, validar en `hex2buf` y manejar longitudes impares o caracteres inválidos sin romper la UI.

### 11. **Persistencia del token en la extensión**
- **Estado actual:** `SESSION_TOKEN` y `LOCAL_VK` solo viven en memoria (variables del popup); al cerrar el popup se pierde la sesión.
- **Comentario:** No persistir el token en disco es más seguro; si se quiere “mantener sesión”, usar `chrome.storage.session` (se borra al cerrar el navegador) y nunca `local` para el token/VK, y opcionalmente cifrar lo que se guarde.

### 12. **HTTPS en producción**
- **Estado actual:** La extensión usa `http://localhost:8000/api` (correcto para desarrollo).
- **Recomendación:** En producción, API en HTTPS y actualizar `API_URL` (p. ej. desde `manifest.json` o variable de build) para que la extensión solo hable con el backend por HTTPS.

---
