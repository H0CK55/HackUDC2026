from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..auth import get_current_user
from ..models import VaultItemDB
from ..schemas import VaultItem

router = APIRouter(prefix="/api/vault", tags=["Vault"])


def _get_token(authorization: Optional[str] = Header(None), token: Optional[str] = None) -> str:
    """Acepta token por header Bearer o por query param ?token= (para GET)."""
    if authorization and authorization.startswith("Bearer "):
        return authorization.split(" ")[1]
    if token:
        return token
    raise HTTPException(status_code=401, detail="Token inválido")


@router.get("", response_model=List[VaultItem])
@router.get("/", response_model=List[VaultItem])
async def get_vault(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = None,
    db: Session = Depends(get_db)
):
    jwt_token = _get_token(authorization=authorization, token=token)
    email = get_current_user(jwt_token)
    return db.query(VaultItemDB).filter(VaultItemDB.user_email == email).all()

@router.post("/")
async def add_vault_item(
    item: VaultItem,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    jwt_token = _get_token(authorization=authorization)
    email = get_current_user(jwt_token)
    new_item = VaultItemDB(
        user_email=email,
        encrypted_payload=item.encrypted_payload,
        nonce=item.nonce,
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return {"msg": "Ítem guardado permanentemente", "id": new_item.id}
