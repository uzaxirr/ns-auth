from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import apps, auth, oauth, scopes, uploads, wellknown
from app.security.keys import get_private_key


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Generate RSA keys on startup if they don't exist
    get_private_key()
    # Ensure uploads directory exists
    Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="OAuth Provider", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")

app.include_router(apps.router)
app.include_router(auth.router)
app.include_router(oauth.router)
app.include_router(scopes.router)
app.include_router(uploads.router)
app.include_router(wellknown.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
