import os
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# En producción usar DATABASE_URL (ej. postgresql://... o sqlite:////data/vault.db)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./vault.db")
# key used by SQLCipher (must match the file key when creating/opening the DB)
DB_KEY = os.getenv("DATABASE_KEY")

connect_args = {} if "sqlite" not in SQLALCHEMY_DATABASE_URL else {"check_same_thread": False}
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)

# If DATABASE_KEY is provided and we're using sqlite, configure SQLCipher PRAGMA
if DB_KEY and "sqlite" in SQLALCHEMY_DATABASE_URL:
    @event.listens_for(engine, "connect")
    def _set_sqlcipher_pragma(dbapi_connection, connection_record):
        # this will be executed on each new raw connection
        cursor = dbapi_connection.cursor()
        # Escape single quotes in DB_KEY to avoid breaking the PRAGMA string
        safe_key = DB_KEY.replace("'", "''")
        cursor.execute("PRAGMA key = '%s';" % safe_key)
        cursor.close()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()