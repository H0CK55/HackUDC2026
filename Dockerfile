FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    libsqlcipher-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

COPY scripts/init_env.sh /app/scripts/init_env.sh
RUN chmod +x /app/scripts/init_env.sh

ENV PYTHONUNBUFFERED=1

RUN groupadd -r vault || true && useradd -r -g vault -d /app -s /sbin/nologin vault || true \
    && mkdir -p /data \
    && chown -R vault:vault /app /app/scripts /data || true
USER vault

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import socket,sys; s=socket.socket(); s.settimeout(2);\
try: s.connect(('127.0.0.1',8000)); s.close(); sys.exit(0)\
except Exception: sys.exit(1)"

ENTRYPOINT ["/bin/bash","-c","/app/scripts/init_env.sh || true && \
# ensure data directory is writable before starting
if [ ! -w \"/data\" ]; then echo \"ERROR: /data is not writable\" >&2; exit 1; fi && \
exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]

# CMD queda como respaldo si se quiere ejecutar directamente uvicorn sin bash.CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

