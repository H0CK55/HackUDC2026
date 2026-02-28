# Zero-Knowledge Vault API — imagen para deployment
FROM python:3.12-slim

WORKDIR /app

# Dependencias del sistema para compilar pysqlcipher3
RUN apt-get update && apt-get install -y \
    gcc \
    libsqlcipher-dev \
    && rm -rf /var/lib/apt/lists/*

# Dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código (no copiar .env; usar variables de entorno en runtime)
COPY app/ ./app/

# Copiar el script de inicialización local (solo útil en desarrollo/entorno contenerizado)
COPY scripts/init_env.sh /app/scripts/init_env.sh
RUN chmod +x /app/scripts/init_env.sh

# En runtime definir: SECRET_KEY, DATABASE_URL, CORS_ORIGINS (opcional)
ENV PYTHONUNBUFFERED=1

# Crear usuario no-root para ejecutar la aplicación
RUN groupadd -r vault || true && useradd -r -g vault -d /app -s /sbin/nologin vault || true \
    && chown -R vault:vault /app /app/scripts || true
USER vault

EXPOSE 8000

# Healthcheck: intenta conectar en el puerto 8000 dentro del contenedor
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import socket,sys; s=socket.socket(); s.settimeout(2);\
try: s.connect(('127.0.0.1',8000)); s.close(); sys.exit(0)\
except Exception: sys.exit(1)"
# Ejecutar el script de inicialización (genera .env si falta) y a continuación
# lanzar la aplicación. El script puede ejecutarse múltiples veces sin dañar
# nada, ya que no reescribe el .env a menos que se le pase --force.
ENTRYPOINT ["/bin/bash","-c","/app/scripts/init_env.sh || true && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]

# CMD queda como respaldo si se quiere ejecutar directamente uvicorn sin bash.CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

