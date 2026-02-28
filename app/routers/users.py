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

@router.get("/salt/{email}")
async def get_salt(email: str, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"client_salt": user.client_salt}

@router.post("/login")
async def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(UserDB).filter(UserDB.email == user.email).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    if not verify_mah(user.mah, db_user.mah_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "encrypted_vk": db_user.encrypted_vk
    }