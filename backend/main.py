from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path

from config import settings
from database.db import db
from routers import auth, invoices, export

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup"""
    try:
        await db.initialize()
        print("Database initialized successfully")
    except Exception as e:
        print(f"ERROR: Database initialization failed: {e}")
        raise
    yield

# Create FastAPI app
app = FastAPI(
    title="Bilary API",
    description="API for managing email invoices",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS with dynamic origin checking
@app.middleware("http")
async def cors_middleware(request, call_next):
    """Custom CORS middleware to allow Vercel preview URLs and configured origins"""
    origin = request.headers.get("origin")
    response = await call_next(request)
    
    # Check if origin is allowed
    allowed = False
    if origin:
        # Check exact match from settings
        if origin in settings.CORS_ORIGINS:
            allowed = True
        # Allow all *.vercel.app domains (for preview deployments)
        elif origin.endswith(".vercel.app") and origin.startswith("https://"):
            allowed = True
    
    if allowed:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

# Fallback CORS middleware for preflight requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS + ["https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https://.*\.vercel\.app"
)

# Mount routers
app.include_router(auth.router)
app.include_router(invoices.router)
app.include_router(export.router)

# Serve uploaded files (optional)
storage_path = Path(settings.STORAGE_PATH)
if storage_path.exists():
    app.mount("/files", StaticFiles(directory=str(storage_path)), name="files")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Bilary API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )
