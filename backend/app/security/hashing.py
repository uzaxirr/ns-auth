import hashlib
import secrets

import bcrypt


def generate_client_id() -> str:
    return secrets.token_hex(16)


def generate_client_secret() -> str:
    return secrets.token_urlsafe(48)


def hash_client_secret(secret: str) -> str:
    return bcrypt.hashpw(secret.encode(), bcrypt.gensalt()).decode()


def verify_client_secret(secret: str, hashed: str) -> bool:
    return bcrypt.checkpw(secret.encode(), hashed.encode())


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
