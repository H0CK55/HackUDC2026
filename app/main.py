from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from .routers import users, vault

# Crea las tablas
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Zero-Knowledge Vault API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluimos los routers
app.include_router(users.router)
app.include_router(vault.router)