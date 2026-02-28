from pydantic import BaseModel, ConfigDict
from typing import List, Optional

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
    
    # Esto es necesario para que Pydantic pueda leer modelos de SQLAlchemy
    model_config = ConfigDict(from_attributes=True)