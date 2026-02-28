# Auditoría de seguridad — Zero-Knowledge Vault

Resumen de fallos detectados, correcciones aplicadas y recomendaciones pendientes.

---

## Correcciones ya aplicadas

### 1. **XSS en mensajes de feedback (extensión)**
- **Riesgo:** `showFeedback(id, type, msg)` usaba `innerHTML` con `msg` sin escapar. Mensajes como `err.message` o la URL del sitio podían inyectar HTML/JS.
- **Solución:** Se escapa `msg` con `escapeHtml(String(msg))` antes de insertarlo en el DOM.

### 2. **Algoritmo JWT configurable (backend)**
- **Riesgo:** Si `ALGORITHM` en `.env` se ponía en `"none"`, un atacante podría firmar tokens sin clave.
- **Solución:** El backend ignora la variable y usa siempre `HS256`.

### 3. **Límites de tamaño en payloads (backend)**
- **Riesgo:** Sin límites, `encrypted_payload` y `nonce` podían ser enormes y causar DoS o abuso de almacenamiento.
- **Solución:** En `schemas.py` se añadieron `Field(..., max_length=...)` para email, mah, client_salt, encrypted_vk, encrypted_payload y nonce (p. ej. payload hex ≤ 100 KiB, nonce hex ≤ 128 caracteres).

### 4. **Base de datos en el repositorio**
- **Riesgo:** `vault.db` no estaba en `.gitignore` y podría subirse con datos de usuarios.
- **Solución:** Añadidos `vault.db` y `*.db` a `.gitignore`.

---

## Recomendaciones pendientes (prioridad alta)

### 5. **CORS en producción**
- **Estado actual:** `allow_origins=["*"]` en `main.py`.
- **Riesgo:** Cualquier origen puede llamar a la API (uso desde páginas web maliciosas, no solo desde la extensión).
- **Recomendación:** En producción usar algo como:
  ```python
  allow_origins=[
      "chrome-extension://<ID_EXTENSION>",
      "https://tudominio.com"  # si tienes frontend web
  ]
  ```
  y cargar el ID de la extensión por variable de entorno si hace falta.

### 6. **Rate limiting**
- **Estado actual:** No hay límite de peticiones por IP/usuario.
- **Riesgo:** Fuerza bruta en login, abuso de `/register`, enumeración de usuarios con `/salt/{email}`.
- **Recomendación:** Añadir rate limiting (p. ej. `slowapi`) en:
  - `POST /api/login` y `POST /api/register`: pocas peticiones por minuto por IP.
  - `GET /api/salt/{email}`: límite para reducir enumeración de emails.

### 7. **Token en query string (GET /vault)**
- **Estado actual:** El vault acepta el JWT por query `?token=...` además del header `Authorization`.
- **Riesgo:** Los query params suelen loguearse en servidores y proxies; el token podría filtrarse.
- **Recomendación:** Como la extensión ya usa solo el header, eliminar el soporte de `token` por query en `vault.py` y devolver 401 si no viene el Bearer en el header.

### 8. **Enumeración de usuarios**
- **Estado actual:** `GET /api/salt/{email}` devuelve 404 si el email no existe y 200 con el salt si existe.
- **Riesgo:** Un atacante puede descubrir qué emails están registrados.
- **Recomendación (opcional):** Devolver siempre 200 con un salt aleatorio o un mensaje genérico cuando el usuario no exista (y seguir devolviendo 401 en login si la contraseña es incorrecta), asumiendo el coste en UX/complejidad del flujo de registro.

---

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

## Resumen de archivos tocados en las correcciones

| Archivo | Cambio |
|---------|--------|
| `view/extension_boveda/popup.js` | Escape de `msg` en `showFeedback` para evitar XSS |
| `app/auth.py` | Algoritmo JWT fijado a HS256 |
| `app/schemas.py` | Límites `max_length` en UserRegister, UserLogin y VaultItem |
| `.gitignore` | Añadidos `vault.db` y `*.db` |

---

## Checklist rápido para producción

- [ ] CORS restringido a origen de la extensión (y frontend si aplica)
- [ ] Rate limiting en login, registro y salt
- [ ] API servida por HTTPS
- [ ] `SECRET_KEY` fuerte y único (no por defecto)
- [ ] Eliminar aceptación de token por query en GET /vault (opcional)
- [ ] Considerar no revelar existencia de usuario en `/salt/{email}`
