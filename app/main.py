import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from .routers import users, vault

# Crea las tablas
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Zero-Knowledge Vault API")

# CORS: por defecto "*" (desarrollo). En producción definir CORS_ORIGINS, ej.:
# CORS_ORIGINS=https://tudominio.com,chrome-extension://abcdef
cors_origins = os.getenv("CORS_ORIGINS", "").strip()
allow_origins = [o.strip() for o in cors_origins.split(",") if o.strip()] if cors_origins else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=len(allow_origins) > 0 and "*" not in allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluimos los routers
app.include_router(users.router)
app.include_router(vault.router)