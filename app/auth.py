import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException

SECRET_KEY = "CAMBIAME_POR_UNA_VARIABLE_DE_ENTORNO"
ALGORITHM = "HS256"

def get_password_hash(mah: str) -> str:
    return bcrypt.hashpw(mah.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_mah(plain_mah: str, hashed_mah: str) -> bool:
    return bcrypt.checkpw(plain_mah.encode('utf-8'), hashed_mah.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    # Usamos timezone.utc para evitar el aviso de obsolescencia
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None: raise HTTPException(status_code=401, detail="Token inválido")
        return email
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token expirado")