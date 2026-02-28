from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..auth import get_current_user
from ..models import VaultItemDB
from ..schemas import VaultItem

# ESTA ES LA LÍNEA QUE TE FALTA:
router = APIRouter(prefix="/api/vault", tags=["Vault"])

@router.get("/", response_model=List[VaultItem])
async def get_vault(token: str, db: Session = Depends(get_db)):
    email = get_current_user(token)
    return db.query(VaultItemDB).filter(VaultItemDB.user_email == email).all()

@router.post("/")
async def add_vault_item(item: VaultItem, token: str, db: Session = Depends(get_db)):
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