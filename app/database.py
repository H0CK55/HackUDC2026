import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

# URL por defecto para Docker: postgresql://user:pass@db:5432/vault
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/vault")

# PostgreSQL no necesita check_same_thread (solo SQLite)
connect_args = {}
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    connect_args = {"check_same_thread": False}

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)

# Nota: Se elimina la lógica de PRAGMA key ya que Postgres no usa SQLCipher.
# El Zero-Knowledge se mantiene por el cifrado en el cliente/app.

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()