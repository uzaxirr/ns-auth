import base64
import os
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.config import settings

_private_pem = None
_public_pem = None
_public_key = None
_kid = "oauth-provider-key-1"


def _ensure_keys():
    global _private_pem, _public_pem, _public_key
    if _private_pem is not None:
        return

    # 1) Try env vars (base64-encoded PEM) — works on ephemeral containers
    if settings.rsa_private_key and settings.rsa_public_key:
        _private_pem = base64.b64decode(settings.rsa_private_key)
        _public_pem = base64.b64decode(settings.rsa_public_key)
    else:
        # 2) Fall back to file-based keys (local dev)
        keys_dir = Path(settings.keys_dir)
        keys_dir.mkdir(exist_ok=True)
        priv_path = keys_dir / "private.pem"
        pub_path = keys_dir / "public.pem"

        if priv_path.exists() and pub_path.exists():
            _private_pem = priv_path.read_bytes()
            _public_pem = pub_path.read_bytes()
        else:
            private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

            _private_pem = private_key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            )
            _public_pem = private_key.public_key().public_bytes(
                serialization.Encoding.PEM,
                serialization.PublicFormat.SubjectPublicKeyInfo,
            )

            priv_path.write_bytes(_private_pem)
            pub_path.write_bytes(_public_pem)
            os.chmod(priv_path, 0o600)

    _public_key = serialization.load_pem_public_key(_public_pem)


def get_private_key() -> bytes:
    """Return private key as PEM bytes (for python-jose)."""
    _ensure_keys()
    return _private_pem


def get_public_key():
    """Return cryptography public key object (for JWKS generation)."""
    _ensure_keys()
    return _public_key


def get_kid() -> str:
    return _kid


def _int_to_base64url(n: int) -> str:
    byte_length = (n.bit_length() + 7) // 8
    return base64.urlsafe_b64encode(n.to_bytes(byte_length, "big")).rstrip(b"=").decode()


def get_jwks() -> dict:
    pub = get_public_key()
    numbers = pub.public_numbers()
    return {
        "keys": [
            {
                "kty": "RSA",
                "use": "sig",
                "alg": "RS256",
                "kid": _kid,
                "n": _int_to_base64url(numbers.n),
                "e": _int_to_base64url(numbers.e),
            }
        ]
    }
