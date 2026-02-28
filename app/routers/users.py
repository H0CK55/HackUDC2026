import secrets
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import UserDB
from ..schemas import UserRegister, UserLogin
from ..auth import get_password_hash, verify_mah, create_access_token
from ..rate_limit import rate_limit_auth, rate_limit_salt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Users"])


async def _rate_limit_auth_dep(request: Request) -> None:
    await rate_limit_auth(request)


async def _rate_limit_salt_dep(request: Request) -> None:
    await rate_limit_salt(request)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    user: UserRegister,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(_rate_limit_auth_dep),
):
    email = user.email.strip().lower()
    if db.query(UserDB).filter(UserDB.email == email).first():
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    new_user = UserDB(
        email=email,
        client_salt=user.client_salt,
        mah_hash=get_password_hash(user.mah),
        encrypted_vk=user.encrypted_vk
    )
    db.add(new_user)
    db.commit()
    logger.info("REGISTER_OK ip=%s email=%s", request.client.host, email)
    return {"msg": "Usuario registrado exitosamente"}

@router.get("/salt/{email}")
async def get_salt(
    email: str,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(_rate_limit_salt_dep),
):
    # Respuesta idéntica exista o no el usuario (evita enumeración por timing/contenido)
    normalized = email.strip().lower()
    user = db.query(UserDB).filter(UserDB.email == normalized).first()
    if user:
        return {"client_salt": user.client_salt}
    return {"client_salt": secrets.token_hex(32)}

@router.post("/login")
async def login(
    user: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(_rate_limit_auth_dep),
):
    email = user.email.strip().lower()
    db_user = db.query(UserDB).filter(UserDB.email == email).first()
    if not db_user:
        logger.warning("LOGIN_FAIL ip=%s email=%s reason=user_not_found", request.client.host, email)
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    if not verify_mah(user.mah, db_user.mah_hash):
        logger.warning("LOGIN_FAIL ip=%s email=%s reason=bad_mah", request.client.host, email)
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    access_token = create_access_token(data={"sub": email})
    logger.info("LOGIN_OK ip=%s email=%s", request.client.host, email)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "encrypted_vk": db_user.encrypted_vk
    }