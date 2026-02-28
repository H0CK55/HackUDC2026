# Rate limiting simple en memoria (sin dependencias externas)
import time
from collections import defaultdict
from fastapi import Request, HTTPException

# (timestamp, count) por clave (ej. IP). Limpiamos entradas viejas periódicamente.
_buckets = defaultdict(list)
_WINDOW = 60  # segundos
_MAX_LOGIN       = 10   # intentos por IP por minuto (login + register)
_MAX_SALT        = 30   # peticiones por IP por minuto
_MAX_VAULT_READ  = 60   # GET /vault por IP por minuto
_MAX_VAULT_WRITE = 30   # POST/PUT/DELETE /vault por IP por minuto


def _clean_old(bucket: list) -> None:
    now = time.time()
    while bucket and bucket[0][0] < now - _WINDOW:
        bucket.pop(0)


def _check_limit(bucket: list, max_per_minute: int) -> None:
    _clean_old(bucket)
    # tras limpiar, todos los registros están dentro de la ventana
    if len(bucket) >= max_per_minute:
        raise HTTPException(status_code=429, detail="Demasiadas peticiones. Espera un minuto.")
    bucket.append((time.time(), 1))


def get_client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def rate_limit_auth(request: Request) -> None:
    """Límite para login y register."""
    key = "auth:" + get_client_key(request)
    _check_limit(_buckets[key], _MAX_LOGIN)


async def rate_limit_salt(request: Request) -> None:
    """Límite para GET /salt (evitar enumeración masiva)."""
    key = "salt:" + get_client_key(request)
    _check_limit(_buckets[key], _MAX_SALT)


async def rate_limit_vault_read(request: Request) -> None:
    """Límite para GET /vault."""
    key = "vault_read:" + get_client_key(request)
    _check_limit(_buckets[key], _MAX_VAULT_READ)


async def rate_limit_vault_write(request: Request) -> None:
    """Límite para POST/PUT/DELETE /vault."""
    key = "vault_write:" + get_client_key(request)
    _check_limit(_buckets[key], _MAX_VAULT_WRITE)
