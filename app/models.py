from sqlalchemy import Column, Integer, String, ForeignKey
from .database import Base

class UserDB(Base):
    __tablename__ = "users"
    email = Column(String, primary_key=True, index=True)
    client_salt = Column(String, nullable=False)
    mah_hash = Column(String, nullable=False)
    encrypted_vk = Column(String, nullable=False)

class VaultItemDB(Base):
    __tablename__ = "vault_items"
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, ForeignKey("users.email"))
    encrypted_payload = Column(String, nullable=False)
    nonce = Column(String, nullable=False)