import time
from collections import defaultdict
from fastapi import Request, HTTPException

_buckets = defaultdict(list)
_WINDOW = 60
_MAX_LOGIN       = 10
_MAX_SALT        = 30
_MAX_VAULT_READ  = 60
_MAX_VAULT_WRITE = 30


def _clean_old(bucket: list) -> None:
    now = time.time()
    while bucket and bucket[0][0] < now - _WINDOW:
        bucket.pop(0)


def _check_limit(bucket: list, max_per_minute: int) -> None:
    _clean_old(bucket)
    if len(bucket) >= max_per_minute:
        raise HTTPException(status_code=429, detail="Demasiadas peticiones. Espera un minuto.")
    bucket.append((time.time(), 1))


def get_client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def rate_limit_auth(request: Request) -> None:
    key = "auth:" + get_client_key(request)
    _check_limit(_buckets[key], _MAX_LOGIN)


async def rate_limit_salt(request: Request) -> None:
    key = "salt:" + get_client_key(request)
    _check_limit(_buckets[key], _MAX_SALT)


async def rate_limit_vault_read(request: Request) -> None:
    key = "vault_read:" + get_client_key(request)
    _check_limit(_buckets[key], _MAX_VAULT_READ)


async def rate_limit_vault_write(request: Request) -> None:
    key = "vault_write:" + get_client_key(request)
    _check_limit(_buckets[key], _MAX_VAULT_WRITE)
