import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from .routers import users, vault

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Zero-Knowledge Vault API")

cors_origins = os.getenv("CORS_ORIGINS", "").strip()
allow_origins = [o.strip() for o in cors_origins.split(",") if o.strip()] if cors_origins else ["*"]

if "*" in allow_origins:
    logger.warning("CORS_ORIGINS no configurado: usando '*' — solo aceptable en desarrollo local")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=len(allow_origins) > 0 and "*" not in allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(vault.router)