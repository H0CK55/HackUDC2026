# Zero-Knowledge Vault API — imagen para deployment
FROM python:3.12-slim

WORKDIR /app

# Dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código (no copiar .env; usar variables de entorno en runtime)
COPY app/ ./app/

# En runtime definir: SECRET_KEY, DATABASE_URL, CORS_ORIGINS (opcional)
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
