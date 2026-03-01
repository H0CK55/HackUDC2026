# 🛡️ VoidVault

> **Gestor de contraseñas zero-knowledge con cifrado en cliente — tus contraseñas nunca viajan en texto plano.**

---

## 🧠 ¿Qué es esto en dos palabras?

Imagina que tienes una caja fuerte. Pero en lugar de darle la llave al banco para que la guarde por ti, **tú te quedas siempre con la llave**. El banco solo guarda la caja — y aunque alguien la robe, no puede abrirla.

Eso es VoidVault.

Es una **extensión de Chrome** que actúa como gestor de contraseñas. Todo el cifrado ocurre dentro de tu navegador, usando tu dispositivo como única fuente de verdad. Si alguien hackeara nuestra base de datos, solo encontraría datos cifrados inútiles.

### El problema que resuelve

Algunos gestores de contraseñas tradicionales requieren que confíes ciegamente en el proveedor. Si su servidor es comprometido, o si ellos mismos actúan de mala fe, tus contraseñas están en riesgo. VoidVault elimina esa necesidad de confianza: **zero-knowledge** significa que nosotros técnicamente *no podemos* ver tus contraseñas aunque quisiéramos.

### Cómo lo usa una persona normal

1. Instalas la extensión en Chrome.
2. Te registras y se genera tu clave de cifrado local.
3. Cuando entras a cualquier web con contraseña, aparece un badge **VAULT** en el campo.
4. Click → rellena automáticamente. Sin copiar, sin recordar.
5. Al hacer login en un sitio nuevo, VoidVault te pregunta si quieres guardar la contraseña. Tú decides.

Todo esto ocurre de forma transparente, sin que tus datos salgan de tu navegador en texto plano.

---

[![Version](https://img.shields.io/badge/version-1.2.2-00c8ff?style=flat-square)](./manifest.json)
[![License](https://img.shields.io/badge/license-MIT-00ff9d?style=flat-square)](#)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blueviolet?style=flat-square)](#)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square)](#)
[![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL%2015-336791?style=flat-square)](#)

---

## ¿Qué es VoidVault?

VoidVault es una extensión de Chrome + API REST que actúa como gestor de contraseñas **zero-knowledge**: todo el cifrado y descifrado ocurre **en tu dispositivo** usando AES-GCM vía Web Crypto API. El servidor nunca ve tus contraseñas en claro — solo almacena payloads cifrados y nonces hexadecimales que solo tú puedes descifrar con tu vault key (VK).

**Desarrollado para HackUDC 2026.**

---

## Arquitectura

```
┌─────────────────────────────────────────┐
│            Chrome Extension             │
│                                         │
│  content.js   ──►  background.js        │
│  (inyecta UI)      (service worker)     │
│                         │               │
│  popup.html/js          │  AES-GCM      │
│  save_prompt.html/js    │  encrypt/     │
│                         │  decrypt      │
└─────────────────────────┼───────────────┘
                          │ HTTPS + JWT
                          ▼
              ┌───────────────────────┐
              │    FastAPI Backend    │
              │   /api/vault, /auth   │
              └───────────┬───────────┘
                          │
              ┌───────────▼───────────┐
              │   PostgreSQL 15        │
              │  (solo datos cifrados) │
              └───────────────────────┘
```

### Flujo zero-knowledge

1. El usuario tiene una **Vault Key (VK)** generada localmente.
2. Cada credencial se cifra con AES-GCM antes de salir del navegador: `encrypt(VK, {site, password})` → `{nonce, encrypted_payload}`.
3. El backend almacena únicamente el par `(nonce, encrypted_payload)` — nunca la VK ni las contraseñas.
4. Al recuperar, el navegador descifra localmente: `decrypt(VK, nonce, encrypted_payload)` → `{site, password}`.

---

## Características

- 🔐 **Cifrado AES-GCM en cliente** — zero-knowledge real, no marketing
- 🧩 **Extensión Chrome MV3** — Manifest V3, service worker moderno
- 🤖 **Autocompletado inteligente** — detecta campos de contraseña en cualquier web, inyecta badge VAULT
- 💾 **Guardar al enviar** — toast de guardado aparece al hacer submit en formularios con contraseña
- 🔑 **Selector de credenciales** — si hay varias cuentas para un sitio, muestra un dropdown para elegir
- 🛡️ **HTTPS enforced** — la extensión bloquea cualquier API no local que use HTTP
- 📧 **Validación de email** — frontend y backend validan formato con Pydantic `EmailStr`
- 🐳 **Docker ready** — un solo comando levanta backend + PostgreSQL
- ⚡ **FastAPI + JWT** — autenticación stateless con tokens firmados

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Extensión | Chrome MV3, Vanilla JS, Web Crypto API |
| Backend | Python 3, FastAPI, Uvicorn |
| Base de datos | PostgreSQL 15 (Alpine) |
| Auth | JWT (PyJWT) + bcrypt |
| ORM / DB | SQLAlchemy 2.0 |
| Validación | Pydantic v2 |
| Contenedores | Docker + Docker Compose |

---

## Estructura del proyecto

```
VoidVault/
├── 📦 Extensión Chrome
│   ├── manifest.json        # Configuración MV3
│   ├── background.js        # Service worker — obtiene/descifra credenciales
│   ├── content.js           # Inyección de badge en campos password
│   ├── popup.html/js        # UI principal (login, registro, bóveda)
│   ├── save_prompt.html/js  # Ventana emergente para guardar contraseñas
│   ├── badge.css            # Estilos del badge y dropdown de autocompletado
│   └── config.js            # URL de la API (editar para producción)
│
├── 🐍 Backend (FastAPI)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── requirements.txt
│
└── 🔧 Scripts
    └── init_env.sh          # Genera .env con SECRET_KEY segura
```

---

## Instalación y despliegue

### Requisitos previos

- Docker y Docker Compose instalados
- Google Chrome (para la extensión)

### 1. Levantar el backend

```bash
# Clona el repositorio y entra al directorio
git clone <repo-url>
cd VoidVault

# (Opcional) genera un .env seguro para desarrollo local
./init_env.sh

# Levanta la API + PostgreSQL
sudo docker compose up --build
```

La API estará disponible en `http://localhost:8000/api`.

### 2. Instalar la extensión en Chrome

1. Abre Chrome y ve a `chrome://extensions/`
2. Activa el **Modo desarrollador** (esquina superior derecha)
3. Haz clic en **Cargar descomprimida**
4. Selecciona la carpeta del proyecto (la que contiene `manifest.json`)

### 3. Configurar la URL de la API

Por defecto apunta a `http://localhost:8000/api`. Si despliegas el backend en otro servidor, edita `config.js`:

```js
var VAULT_API_URL = "https://tu-servidor.com/api";  // ← HTTPS obligatorio en producción
```

---

## Configuración

### Variables de entorno del backend

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | URL de conexión a PostgreSQL | `postgresql://user:pass@db:5432/vault` |
| `SECRET_KEY` | Clave para firmar JWTs — **¡cámbiala en producción!** | `cambiame-por-algo-seguro` |
| `USE_DOTENV` | Cargar `.env` desde disco (`1`) o no (`0`) | `0` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Duración del token JWT | `60` |

> ⚠️ **Nunca uses el `SECRET_KEY` por defecto en producción.** Ejecuta `./init_env.sh` para generar una clave segura de 32 bytes.

---

## Endpoints de la API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Registro de usuario |
| `POST` | `/api/auth/login` | Login, devuelve JWT |
| `GET`  | `/api/vault` | Lista credenciales cifradas del usuario |
| `POST` | `/api/vault` | Guarda una nueva credencial cifrada |
| `DELETE` | `/api/vault/{id}` | Elimina una credencial |

---

## Cómo funciona la extensión

### Badge de autocompletado

`content.js` escanea el DOM (incluyendo SPAs con MutationObserver) buscando campos `input[type="password"]`. En cada uno inyecta un badge **VAULT** que al hacer clic:

1. Consulta al service worker las credenciales para el dominio actual.
2. Si hay una sola, rellena el campo directamente.
3. Si hay varias, muestra un dropdown selector.
4. Si no hay sesión activa, abre el popup para autenticarse.

### Guardado automático

Al detectar el submit de un formulario con contraseña, aparece un toast no intrusivo que pregunta si guardar. Si el usuario confirma, se cifra la credencial y se envía al backend.

### Almacenamiento de sesión

`sessionToken` y `vkHex` se guardan en `chrome.storage.session` — se borran automáticamente al cerrar el navegador. La VK nunca se persiste en disco.

---

## Seguridad

Consulta [`SECURITY.md`](./SECURITY.md) para el informe completo de auditoría. Resumen:

- ✅ Validación de email en registro y login
- ✅ HTTPS enforced para APIs no locales
- ✅ Vault Key solo en memoria de sesión (nunca en disco)
- ✅ Cifrado AES-GCM con nonce único por credencial
- ⚠️ Pendiente: validación de formato hex en `nonce` y `encrypted_payload`
- ⚠️ Pendiente: soporte opcional para `chrome.storage.session` persistente con cifrado

---

## Desarrollo local (sin Docker)

```bash
# Crea un entorno virtual
python -m venv .venv
source .venv/bin/activate

# Instala dependencias
pip install -r requirements.txt

# Genera .env con SQLite para desarrollo
./init_env.sh

# Inicia la API
uvicorn main:app --reload --port 8000
```

---

## Contribuir

1. Haz fork del repositorio
2. Crea una rama: `git checkout -b feature/mi-mejora`
3. Commitea tus cambios: `git commit -m 'feat: descripción'`
4. Abre un Pull Request

---

## Licencia

MIT — úsalo, modifícalo, rómpelo, aprende de él.

---

<div align="center">
  <strong>Hecho con 🖤 y demasiado café en HackUDC 2026</strong>
</div>
