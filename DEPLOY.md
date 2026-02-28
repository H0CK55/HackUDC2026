# Deployment — Zero-Knowledge Vault

## Arrancar con Docker (local)

```bash
# Desde la raíz del proyecto
sudo docker build -t vault-api .
sudo docker run -p 8000:8000 \
  -e SECRET_KEY="$(openssl rand -hex 32)" \
  -e DATABASE_URL="sqlite:////data/vault.db" \
  -v vault-data:/data \
  vault-api
```

API en **http://localhost:8000**. La extensión ya apunta ahí por defecto.


## Producción

| Qué | Dónde |
|-----|--------|
| **Backend** | `SECRET_KEY` obligatoria. Opcional: `DATABASE_URL`, `CORS_ORIGINS`. Mismo `docker run` o despliega en Railway/Render con `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. |
| **Extensión** | En `view/extension_boveda/config.js` pon la URL de tu API (ej. `https://tu-api.com/api`). En `manifest.json` añade esa URL en `host_permissions`. |
| **CORS** | En el servidor define `CORS_ORIGINS` con la URL de tu API y `chrome-extension://TU_ID` (el ID sale en `chrome://extensions`). |

API en producción debe ir por **HTTPS**; en `config.js` usa `https://` para la API.
