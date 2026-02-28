from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional

# Límites para evitar DoS por payloads enormes
MAX_PAYLOAD_HEX = 100 * 1024   # 100 KiB en hex
MAX_NONCE_HEX = 128            # nonce en hex (64 bytes es suficiente para GCM)
MAX_EMAIL_LEN = 256
MAX_SALT_VK_LEN = 10 * 1024    # 10 KiB para salt/encrypted_vk

class UserRegister(BaseModel):
    email: str = Field(..., max_length=MAX_EMAIL_LEN)
    client_salt: str = Field(..., max_length=MAX_SALT_VK_LEN)
    mah: str = Field(..., max_length=512)
    encrypted_vk: str = Field(..., max_length=MAX_SALT_VK_LEN)

class UserLogin(BaseModel):
    email: str = Field(..., max_length=MAX_EMAIL_LEN)
    mah: str = Field(..., max_length=512)

class VaultItem(BaseModel):
    id: Optional[int] = None
    encrypted_payload: str = Field(..., max_length=MAX_PAYLOAD_HEX)
    nonce: str = Field(..., max_length=MAX_NONCE_HEX)

    model_config = ConfigDict(from_attributes=True)