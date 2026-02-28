import re
from pydantic import BaseModel, ConfigDict, Field, field_validator, EmailStr
from typing import List, Optional

# Límites para evitar DoS por payloads enormes
MAX_PAYLOAD_HEX = 100 * 1024   # 100 KiB en hex
MAX_NONCE_HEX = 128            # nonce en hex (64 bytes es suficiente para GCM)
MAX_SALT_VK_LEN = 10 * 1024   # 10 KiB para salt/encrypted_vk

_EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')

class UserRegister(BaseModel):
    email: EmailStr
    client_salt: str = Field(..., max_length=MAX_SALT_VK_LEN)
    mah: str = Field(..., max_length=512)
    encrypted_vk: str = Field(..., max_length=MAX_SALT_VK_LEN)

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        normalized = v.strip().lower()
        if not _EMAIL_RE.match(normalized):
            raise ValueError('Formato de email inválido')
        return normalized

class UserLogin(BaseModel):
    email: EmailStr
    mah: str = Field(..., max_length=512)

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        normalized = v.strip().lower()
        if not _EMAIL_RE.match(normalized):
            raise ValueError('Formato de email inválido')
        return normalized

class VaultItem(BaseModel):
    id: Optional[int] = None
    encrypted_payload: str = Field(..., max_length=MAX_PAYLOAD_HEX)
    nonce: str = Field(..., max_length=MAX_NONCE_HEX)

    @field_validator("encrypted_payload")
    @classmethod
    def _check_encrypted_payload_hex(cls, v: str) -> str:
        if not isinstance(v, str):
            raise TypeError("encrypted_payload must be a hex string")
        h = v.strip()
        if len(h) == 0:
            raise ValueError("encrypted_payload cannot be empty")
        # length must be even (pairs of hex chars)
        if len(h) % 2 != 0:
            raise ValueError("encrypted_payload hex has odd length")
        if len(h) > MAX_PAYLOAD_HEX:
            raise ValueError("encrypted_payload too large")
        if not all(c in "0123456789abcdefABCDEF" for c in h):
            raise ValueError("encrypted_payload must be hexadecimal")
        return h

    @field_validator("nonce")
    @classmethod
    def _check_nonce_hex(cls, v: str) -> str:
        if not isinstance(v, str):
            raise TypeError("nonce must be a hex string")
        h = v.strip()
        if len(h) == 0:
            raise ValueError("nonce cannot be empty")
        if len(h) % 2 != 0:
            raise ValueError("nonce hex has odd length")
        if len(h) > MAX_NONCE_HEX:
            raise ValueError("nonce too large")
        if not all(c in "0123456789abcdefABCDEF" for c in h):
            raise ValueError("nonce must be hexadecimal")
        return h

    model_config = ConfigDict(from_attributes=True)