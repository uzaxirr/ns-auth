from __future__ import annotations

AVAILABLE_SCOPES = [
    {
        "name": "openid",
        "description": "OpenID Connect identity",
        "claims": ["sub", "iss", "aud", "iat", "exp"],
    },
    {
        "name": "profile",
        "description": "User profile information",
        "claims": ["display_name", "username", "avatar_url", "bio"],
    },
    {
        "name": "email",
        "description": "Email address",
        "claims": ["email", "email_verified"],
    },
    {
        "name": "cohort",
        "description": "NS cohort information",
        "claims": ["cohort_id", "cohort_name", "enrollment_date"],
    },
    {
        "name": "activity",
        "description": "User activity and stats",
        "claims": ["posts_count", "streak_days", "last_active"],
    },
    {
        "name": "socials",
        "description": "Social media links",
        "claims": ["twitter", "github", "linkedin", "website"],
    },
    {
        "name": "wallet",
        "description": "Blockchain wallet address",
        "claims": ["wallet_address", "chain"],
    },
    {
        "name": "offline_access",
        "description": "Long-lived refresh tokens",
        "claims": ["refresh_token"],
    },
]

VALID_SCOPE_NAMES = {s["name"] for s in AVAILABLE_SCOPES}
