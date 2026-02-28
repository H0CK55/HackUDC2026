# Deployment — Zero-Knowledge Vault

## Arrancar con Docker (local)

**Linux / Mac:**
```bash
sudo docker build -t vault-api .
sudo docker run -p 8000:8000 \
  -e SECRET_KEY="$(openssl rand -hex 32)" \
  -e DATABASE_URL="sqlite:////data/vault.db" \
  -v vault-data:/data \
  vault-api
```

**Windows** (PowerShell o CMD; con [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado):
```powershell
docker build -t vault-api .
docker run -p 8000:8000 -e SECRET_KEY=clave_secreta_larga_para_desarrollo -e DATABASE_URL="sqlite:////data/vault.db" -v vault-data:/data vault-api
```
No hace falta `sudo`. Para generar una clave aleatoria en PowerShell: `-join ((48..57) + (97..102) | Get-Random -Count 32 | % {[char]$_})` (o usa cualquier string largo para desarrollo).

**Si en Linux sale "permission denied"** con docker: usa `sudo docker ...` o añade tu usuario al grupo docker: `sudo usermod -aG docker $USER` y cierra/abre sesión.

---

API en **http://localhost:8000**. La extensión ya apunta ahí por defecto.


## Producción

| Qué | Dónde |
|-----|--------|
| **Backend** | `SECRET_KEY` obligatoria. Opcional: `DATABASE_URL`, `CORS_ORIGINS`. Mismo `docker run` o despliega en Railway/Render con `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. |
| **Extensión** | En `view/extension_boveda/config.js` pon la URL de tu API (ej. `https://tu-api.com/api`). En `manifest.json` añade esa URL en `host_permissions`. |
| **CORS** | En el servidor define `CORS_ORIGINS` con la URL de tu API y `chrome-extension://TU_ID` (el ID sale en `chrome://extensions`). |

API en producción debe ir por **HTTPS**; en `config.js` usa `https://` para la API.




docker-compose up --build Para cerrar
