from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, Session
import bcrypt
import jwt

# =====================================================================
# 1. CONFIGURACIÓN Y SEGURIDAD
# =====================================================================

SECRET_KEY = "SUPER_SECRETO_DEL_SERVIDOR_CAMBIAR_EN_PRODUCCION"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15

app = FastAPI(title="Zero-Knowledge Password Manager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "null"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# 2. BASE DE DATOS (SQLAlchemy + SQLite)
# =====================================================================

SQLALCHEMY_DATABASE_URL = "sqlite:///./vault.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class UserDB(Base):
    __tablename__ = "users"
    email = Column(String, primary_key=True, index=True)
    client_salt = Column(String, nullable=False)
    mah_hash = Column(String, nullable=False)
    encrypted_vk = Column(Text, nullable=False)

class VaultItemDB(Base):
    __tablename__ = "vault_items"
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, ForeignKey("users.email"))
    encrypted_payload = Column(Text, nullable=False)
    nonce = Column(String, nullable=False)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# =====================================================================
# 3. MODELOS DE DATOS (Pydantic)
# =====================================================================

class UserRegister(BaseModel):
    email: str
    client_salt: str
    mah: str
    encrypted_vk: str

class UserLogin(BaseModel):
    email: str
    mah: str

class VaultItem(BaseModel):
    id: Optional[int] = None
    encrypted_payload: str
    nonce: str
    model_config = ConfigDict(from_attributes=True)

# =====================================================================
# 4. FUNCIONES AUXILIARES
# =====================================================================

def get_password_hash(mah: str) -> str:
    return bcrypt.hashpw(mah.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_mah(plain_mah: str, hashed_mah: str) -> bool:
    return bcrypt.checkpw(plain_mah.encode('utf-8'), hashed_mah.encode('utf-8'))

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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

# =====================================================================
# 5. ENDPOINTS
# =====================================================================

@app.post("/api/register", status_code=status.HTTP_201_CREATED)
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

@app.get("/api/salt/{email}")
async def get_salt(email: str, db: Session = Depends(get_db)):
    db_user = db.query(UserDB).filter(UserDB.email == email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"client_salt": db_user.client_salt}

@app.post("/api/login")
async def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(UserDB).filter(UserDB.email == user.email).first()
    if not db_user or not verify_mah(user.mah, db_user.mah_hash):
        raise HTTPException(status_code=400, detail="Credenciales incorrectas")
    
    return {
        "access_token": create_access_token(data={"sub": user.email}),
        "token_type": "bearer",
        "encrypted_vk": db_user.encrypted_vk
    }

@app.get("/api/vault", response_model=List[VaultItem])
async def get_vault(token: str, db: Session = Depends(get_db)):
    email = get_current_user(token)
    return db.query(VaultItemDB).filter(VaultItemDB.user_email == email).all()

@app.post("/api/vault")
async def add_vault_item(item: VaultItem, token: str, db: Session = Depends(get_db)):
    email = get_current_user(token)
    new_item = VaultItemDB(user_email=email, encrypted_payload=item.encrypted_payload, nonce=item.nonce)
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return {"msg": "Ítem guardado permanentemente", "id": new_item.id}