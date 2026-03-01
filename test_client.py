"""Local test client for the deployed OAuth provider."""
from __future__ import annotations

import sys
import requests

API = "https://backend-production-c59b.up.railway.app"
CLIENT_ID = "c4837fd25358dcb87beadacb43c30e39"
CLIENT_SECRET = "xbAdqfYyZ44z9Bjnf1FEMbOmYAH9N6-RCChnYkR9GcVZsEErmN3fCsUqD5vV7i5Q"


def step(label: str):
    print(f"\n{'='*60}\n  {label}\n{'='*60}")


def main():
    # 1. Health check
    step("1. Health Check")
    r = requests.get(f"{API}/health")
    print(f"  Status: {r.status_code}  Body: {r.json()}")
    assert r.status_code == 200

    # 2. JWKS endpoint
    step("2. JWKS Endpoint")
    r = requests.get(f"{API}/.well-known/jwks.json")
    jwks = r.json()
    print(f"  Keys: {len(jwks['keys'])}  kid: {jwks['keys'][0]['kid']}")
    assert r.status_code == 200

    # 3. Client Credentials Token Request
    step("3. Token Request (client_credentials)")
    r = requests.post(
        f"{API}/oauth/token",
        data={
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "scope": "read write",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    print(f"  Status: {r.status_code}")
    token_data = r.json()
    if r.status_code != 200:
        print(f"  Error: {token_data}")
        sys.exit(1)
    access_token = token_data["access_token"]
    print(f"  token_type: {token_data['token_type']}")
    print(f"  expires_in: {token_data['expires_in']}s")
    print(f"  scope:      {token_data.get('scope', 'N/A')}")
    print(f"  token:      {access_token[:40]}...")

    # 4. Introspect the token
    step("4. Token Introspection")
    r = requests.post(
        f"{API}/oauth/token/introspect",
        data={"token": access_token},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    intro = r.json()
    print(f"  active:     {intro.get('active')}")
    print(f"  client_id:  {intro.get('client_id')}")
    print(f"  scope:      {intro.get('scope')}")
    print(f"  token_type: {intro.get('token_type')}")
    print(f"  issuer:     {intro.get('iss')}")
    assert intro["active"] is True

    # 5. Revoke the token
    step("5. Token Revocation")
    r = requests.post(
        f"{API}/oauth/token/revoke",
        data={"token": access_token},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    print(f"  Status: {r.status_code}  Body: {r.json()}")

    # 6. Introspect again — should be inactive
    step("6. Introspect After Revocation")
    r = requests.post(
        f"{API}/oauth/token/introspect",
        data={"token": access_token},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    intro2 = r.json()
    print(f"  active: {intro2.get('active')}")
    assert intro2["active"] is False

    step("ALL TESTS PASSED")


if __name__ == "__main__":
    main()
