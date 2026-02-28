Deployment — Zero-Knowledge VaultEste documento detalla los pasos para compilar y ejecutar la API de forma segura. Se han incluido correcciones para la gestión de permisos en volúmenes de Docker y la inyección de variables de entorno.1. Preparación del Host (Linux/macOS)Antes de lanzar el contenedor, debemos asegurar que la carpeta de persistencia existe y tiene permisos de escritura, ya que SQLite necesita crear el archivo .db.Bashmkdir -p ./data
chmod 777 ./data
2. Build de la ImagenConstruye la imagen localmente etiquetándola como vault-api:local:Bashsudo docker build -t vault-api:local .
3. Ejecución (Modo Desarrollo / Hackathon)Este comando es el más fiable. Usa tu propio User ID para evitar conflictos de archivos y fuerza a la app a ignorar archivos .env internos en favor de las variables que tú definas.Bashsudo docker run --rm -p 8000:8000 \
  -u $(id -u):$(id -g) \
  -e SECRET_KEY="$(openssl rand -hex 32)" \
  -e DATABASE_URL="sqlite:////data/vault.db" \
  -e USE_DOTENV=0 \
  -v $(pwd)/data:/data \
  vault-api:local
Notas técnicas del comando:-u $(id -u):$(id -g): Ejecuta el contenedor con tus permisos de usuario actual.USE_DOTENV=0: Evita que el script de inicio intente sobrescribir la configuración./data/vault.db: Ruta absoluta interna que mapea al volumen persistente.4. Docker Compose (Recomendado para persistencia)Crea un archivo docker-compose.yml para gestionar el ciclo de vida del contenedor fácilmente:YAMLversion: "3.8"
services:
  vault:
    image: vault-api:local
    build: .
    # Ejecuta con el usuario actual del host
    user: "${UID:-1000}:${GID:-1000}"
    ports:
      - "8000:8000"
    environment:
      - SECRET_KEY=${SECRET_KEY:-super-secret-dev-key}
      - DATABASE_URL=sqlite:////data/vault.db
      - USE_DOTENV=0
      - CORS_ORIGINS=*
    volumes:
      - ./data:/data
    restart: unless-stopped
Para levantarlo: docker compose up -d5. Recomendaciones de SeguridadCategoríaRecomendaciónBase de DatosEn producción, sustituir SQLite por PostgreSQL.CORSCambiar * por el origen real de la App y el ID de la extensión de Chrome.SecretosInyectar SECRET_KEY desde un gestor de secretos, no generarla dinámicamente en producción (cerraría sesiones activas).LogsAsegurarse de que el nivel de log esté en INFO y no en DEBUG para evitar fugas de PII.6. VerificaciónUna vez el servidor indique Application startup complete, verifica los siguientes endpoints:API Health: http://localhost:8000/healthSwagger Docs: http://localhost:8000/docsBase de datos: Verifica que el archivo ./data/vault.db ha sido creado en tu máquina.