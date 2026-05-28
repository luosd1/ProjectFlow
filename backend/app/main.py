from fastapi import FastAPI

from app.api.routes_health import router as health_router

app = FastAPI(title="ProjectFlow API")
app.include_router(health_router, prefix="/api")
