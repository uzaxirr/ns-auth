from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import apps, oauth, wellknown
from app.security.keys import get_private_key


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Generate RSA keys on startup if they don't exist
    get_private_key()
    yield


app = FastAPI(title="OAuth Provider", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(apps.router)
app.include_router(oauth.router)
app.include_router(wellknown.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
