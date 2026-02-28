from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..auth import get_current_user
from ..models import VaultItemDB
from ..schemas import VaultItem

router = APIRouter(prefix="/api/vault", tags=["Vault"])

@router.get("/", response_model=List[VaultItem])
async def get_vault(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token inválido")
    token = authorization.split(" ")[1]
    email = get_current_user(token)
    return db.query(VaultItemDB).filter(VaultItemDB.user_email == email).all()

@router.post("/")
async def add_vault_item(item: VaultItem, authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token inválido")
    token = authorization.split(" ")[1]
    email = get_current_user(token)
    new_item = VaultItemDB(
        user_email=email, 
        encrypted_payload=item.encrypted_payload, 
        nonce=item.nonce
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return {"msg": "Ítem guardado permanentemente", "id": new_item.id}