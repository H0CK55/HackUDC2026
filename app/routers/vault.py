from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..auth import get_current_user
from ..models import VaultItemDB
from ..schemas import VaultItem

router = APIRouter(prefix="/api/vault", tags=["Vault"])


def _get_token(authorization: Optional[str] = Header(None)) -> str:
    """Token solo por header Authorization: Bearer (evita fugas en logs/query)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token inválido")
    return authorization.split(" ")[1]


@router.get("", response_model=List[VaultItem])
@router.get("/", response_model=List[VaultItem])
async def get_vault(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    jwt_token = _get_token(authorization=authorization)
    email = get_current_user(jwt_token)
    return db.query(VaultItemDB).filter(VaultItemDB.user_email == email).all()

@router.post("")
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
