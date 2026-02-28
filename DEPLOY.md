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

Como iniciar docker -> copiar y pegar:
docker build -t zk-vault-api .
docker run -p 8000:8000 -e SECRET_KEY=test123 -e DATABASE_URL=sqlite:////app/vault.db --name zk-vault zk-vault-api

**Windows** (PowerShell o CMD; con [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado):
```powershell
docker build -t vault-api .
docker run -p 8000:8000 -e SECRET_KEY=clave_secreta_larga_para_desarrollo -e DATABASE_URL="sqlite:////data/vault.db" -v vault-data:/data vault-api
```
No hace falta `sudo`. Para generar una clave aleatoria en PowerShell: `-join ((48..57) + (97..102) | Get-Random -Count 32 | % {[char]$_})` (o usa cualquier string largo para desarrollo).

**Si en Linux sale "permission denied"** con docker: usa `sudo docker ...` o añade tu usuario al grupo docker: `sudo usermod -aG docker $USER` y cierra/abre sesión.

---

API en **http://localhost:8000**. La extensión ya apunta ahí por defecto.


## Arrancar localmente (recomendado para desarrollo y para ejecutar la Vault "siempre" en tu máquina)

1. Genera un `.env` local seguro usando el script incluido:

```bash
./scripts/init_env.sh
```

Esto crea un `.env` en la raíz del proyecto con un `SECRET_KEY` fuerte y `DATABASE_URL` apuntando a `./vault.db`.

2. Instala dependencias en un virtualenv y ejecuta la app:

```bash
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

3. Para mantener la Vault corriendo localmente de forma persistente puedes usar `systemd` (Linux) o `tmux`/`screen`. Ejemplo de servicio systemd (ejecuta como tu usuario):

Create `/etc/systemd/user/vault.service` (o en `~/.config/systemd/user/vault.service`):

```ini
[Unit]
Description=Zero-Knowledge Vault (user service)

[Service]
WorkingDirectory=%h/Escritorio/Hackaton2026/HackUDC2026/HackUDC2026
EnvironmentFile=%h/Escritorio/Hackaton2026/HackUDC2026/HackUDC2026/.env
ExecStart=%h/Escritorio/Hackaton2026/HackUDC2026/HackUDC2026/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=on-failure

[Install]
WantedBy=default.target
```

Enable and start the user service:

```bash
systemctl --user daemon-reload
systemctl --user enable --now vault.service
```

Si prefieres Docker pero que corra localmente "siempre", crea un `docker-compose.yml` con un volumen y usa `docker compose up -d`.


## Producción

| Qué | Dónde |
|-----|--------|
| **Backend** | `SECRET_KEY` obligatoria. Opcional: `DATABASE_URL`, `CORS_ORIGINS`. Mismo `docker run` o despliega en Railway/Render con `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. |
| **Extensión** | En `view/extension_boveda/config.js` pon la URL de tu API (ej. `https://tu-api.com/api`). En `manifest.json` añade esa URL en `host_permissions`. |
| **CORS** | En el servidor define `CORS_ORIGINS` con la URL de tu API y `chrome-extension://TU_ID` (el ID sale en `chrome://extensions`). |

API en producción debe ir por **HTTPS**; en `config.js` usa `https://` para la API.




docker-compose up --build Para cerrar
