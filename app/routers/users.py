from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import UserDB
from ..schemas import UserRegister, UserLogin
from ..auth import get_password_hash, verify_mah, create_access_token

router = APIRouter(prefix="/api", tags=["Users"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user: UserRegister, db: Session = Depends(get_db)):
    if db.query(UserDB).filter(UserDB.email == user.email).first():
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    new_user = UserDB(
        email=user.email,
        client_salt=user.client_salt,
        mah_hash=get_password_hash(user.mah),
        encrypted_vk=user.encrypted_vk
    )
    db.add(new_user)
    db.commit()
    return {"msg": "Usuario registrado exitosamente"}

# ... añadir el endpoint de salt y login aquí