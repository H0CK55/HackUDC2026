import os
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from dotenv import load_dotenv # <--- Añadido
from pathlib import Path

# Cargar variables de entorno desde el archivo .env
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Configuración desde entorno con fallbacks de seguridad
SECRET_KEY = os.getenv("SECRET_KEY")
# Solo permitir algoritmos seguros; ignorar ALGORITHM del entorno para evitar "none"
ALGORITHM = "HS256"
# Convertimos a int porque las variables de entorno son siempre strings
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 15))

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable must be set")

def get_password_hash(mah: str) -> str:
    return bcrypt.hashpw(mah.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_mah(plain_mah: str, hashed_mah: str) -> bool:
    return bcrypt.checkpw(plain_mah.encode('utf-8'), hashed_mah.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None: 
            raise HTTPException(status_code=401, detail="Token inválido")
        return email
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token expirado o inválido")