from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
import uuid
import requests
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Object Storage (Emergent)
# ---------------------------------------------------------------------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "chronicle-cms"
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------------------
# Watermarking (Pillow) — text watermark, bottom-right, semi-transparent
# ---------------------------------------------------------------------------
FONT_PATH = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

POSITIONS = {"bottom-right", "bottom-left", "top-right", "top-left", "center"}


def apply_text_watermark(image_bytes: bytes, text: str, opacity_pct: int,
                         font_size: int, position: str = "bottom-right"):
    """Return (jpeg_bytes, width, height) with a semi-transparent text watermark."""
    base = Image.open(io.BytesIO(image_bytes))
    base = ImageOps.exif_transpose(base).convert("RGBA")
    w, h = base.size

    # Scale font relative to image width so it reads well on large photos.
    scale = max(1.0, w / 1000.0)
    fs = max(10, int(font_size * scale))
    try:
        font = ImageFont.truetype(FONT_PATH, fs)
    except Exception:
        font = ImageFont.load_default()

    overlay = Image.new("RGBA", base.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)

    text = (text or "").strip() or "© Chronicle News Wire"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    margin = int(fs * 0.6)

    if position not in POSITIONS:
        position = "bottom-right"
    if position == "bottom-right":
        x, y = w - tw - margin, h - th - margin
    elif position == "bottom-left":
        x, y = margin, h - th - margin
    elif position == "top-right":
        x, y = w - tw - margin, margin
    elif position == "top-left":
        x, y = margin, margin
    else:  # center
        x, y = (w - tw) // 2, (h - th) // 2
    x -= bbox[0]
    y -= bbox[1]

    alpha = max(0, min(255, int(255 * (opacity_pct / 100.0))))
    shadow_alpha = int(alpha * 0.7)
    off = max(1, fs // 20)
    # Soft shadow for legibility on any background.
    draw.text((x + off, y + off), text, font=font, fill=(0, 0, 0, shadow_alpha))
    draw.text((x, y), text, font=font, fill=(255, 255, 255, alpha))

    combined = Image.alpha_composite(base, overlay).convert("RGB")
    out = io.BytesIO()
    combined.save(out, format="JPEG", quality=90)
    return out.getvalue(), w, h


def make_sample_image(w: int = 1000, h: int = 620) -> bytes:
    """A newsroom-styled sample photo for the live watermark preview."""
    img = Image.new("RGB", (w, h), (24, 24, 27))
    draw = ImageDraw.Draw(img)
    for i in range(h):
        t = i / h
        r = int(24 + t * 20)
        g = int(24 + t * 18)
        b = int(27 + t * 40)
        draw.line([(0, i), (w, i)], fill=(r, g, b))
    try:
        f1 = ImageFont.truetype(FONT_PATH, 46)
        f2 = ImageFont.truetype(FONT_PATH, 20)
    except Exception:
        f1 = f2 = ImageFont.load_default()
    draw.text((48, 60), "PRESS PHOTO PREVIEW", font=f1, fill=(220, 38, 38))
    draw.text((48, 128), "Live watermark rendering sample", font=f2, fill=(200, 200, 205))
    draw.rectangle([48, 180, w - 48, h - 60], outline=(70, 70, 78), width=2)
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=88)
    return out.getvalue()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
CATEGORIES = ["World", "Politics", "Business", "Technology", "Science", "Sports", "Culture", "Opinion"]


class WatermarkSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    text: str = "© Chronicle News Wire"
    opacity: int = 55
    font_size: int = 28
    position: str = "bottom-right"


class ArticleCreate(BaseModel):
    title: str
    category: str = "World"
    author: str
    summary: str = ""
    body: str = ""


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def get_settings_doc() -> dict:
    doc = await db.settings.find_one({"_id": "watermark"})
    if not doc:
        default = WatermarkSettings().model_dump()
        default["_id"] = "watermark"
        await db.settings.insert_one(default)
        return default
    return doc


def photo_public(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "article_id": doc.get("article_id"),
        "url": f"/api/files/{doc['storage_path']}",
        "original_filename": doc.get("original_filename"),
        "content_type": doc.get("content_type"),
        "size": doc.get("size"),
        "width": doc.get("width"),
        "height": doc.get("height"),
        "watermarked": doc.get("watermarked", True),
        "watermark_text": doc.get("watermark_text"),
        "created_at": doc.get("created_at"),
    }


async def article_public(doc: dict) -> dict:
    photos = await db.photos.find(
        {"article_id": doc["id"], "is_deleted": False}, {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    return {
        "id": doc["id"],
        "title": doc["title"],
        "category": doc.get("category"),
        "author": doc.get("author"),
        "summary": doc.get("summary", ""),
        "body": doc.get("body", ""),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "photos": [photo_public(p) for p in photos],
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "Chronicle CMS API"}


@api_router.get("/categories")
async def list_categories():
    return {"categories": CATEGORIES}


@api_router.get("/settings/watermark")
async def get_watermark_settings():
    doc = await get_settings_doc()
    return WatermarkSettings(**doc).model_dump()


@api_router.put("/settings/watermark")
async def update_watermark_settings(settings: WatermarkSettings):
    payload = settings.model_dump()
    if payload["position"] not in POSITIONS:
        payload["position"] = "bottom-right"
    payload["opacity"] = max(5, min(100, payload["opacity"]))
    payload["font_size"] = max(12, min(72, payload["font_size"]))
    await db.settings.update_one({"_id": "watermark"}, {"$set": payload}, upsert=True)
    return payload


@api_router.get("/watermark/preview")
async def watermark_preview(
    text: str = Query("© Chronicle News Wire"),
    opacity: int = Query(55),
    font_size: int = Query(28),
    position: str = Query("bottom-right"),
):
    sample = make_sample_image()
    out, _, _ = apply_text_watermark(sample, text, opacity, font_size, position)
    return Response(content=out, media_type="image/jpeg",
                    headers={"Cache-Control": "no-store"})


@api_router.post("/articles")
async def create_article(payload: ArticleCreate):
    cat = payload.category if payload.category in CATEGORIES else "World"
    doc = {
        "id": str(uuid.uuid4()),
        "title": payload.title.strip() or "Untitled",
        "category": cat,
        "author": payload.author.strip() or "Staff Reporter",
        "summary": payload.summary.strip(),
        "body": payload.body.strip(),
        "is_deleted": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.articles.insert_one({**doc})
    return await article_public(doc)


@api_router.get("/articles")
async def list_articles(category: Optional[str] = None, q: Optional[str] = None):
    query = {"is_deleted": False}
    if category and category != "All" and category in CATEGORIES:
        query["category"] = category
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"summary": {"$regex": q, "$options": "i"}},
            {"author": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.articles.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [await article_public(d) for d in docs]


@api_router.get("/articles/{article_id}")
async def get_article(article_id: str):
    doc = await db.articles.find_one({"id": article_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    return await article_public(doc)


@api_router.delete("/articles/{article_id}")
async def delete_article(article_id: str):
    res = await db.articles.update_one({"id": article_id}, {"$set": {"is_deleted": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.photos.update_many({"article_id": article_id}, {"$set": {"is_deleted": True}})
    return {"ok": True}


@api_router.post("/articles/{article_id}/photos")
async def upload_photos(article_id: str, files: List[UploadFile] = File(...)):
    article = await db.articles.find_one({"id": article_id, "is_deleted": False})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    settings = WatermarkSettings(**(await get_settings_doc()))
    results = []
    for file in files:
        raw = await file.read()
        if not raw:
            continue
        try:
            processed, width, height = apply_text_watermark(
                raw, settings.text, settings.opacity, settings.font_size, settings.position
            )
        except Exception as e:
            logger.error(f"Watermark failed for {file.filename}: {e}")
            raise HTTPException(status_code=400, detail=f"Could not process image: {file.filename}")
        photo_id = str(uuid.uuid4())
        path = f"{APP_NAME}/articles/{article_id}/{photo_id}.jpg"
        stored = put_object(path, processed, "image/jpeg")
        doc = {
            "id": photo_id,
            "article_id": article_id,
            "storage_path": stored["path"],
            "original_filename": file.filename,
            "content_type": "image/jpeg",
            "size": stored.get("size", len(processed)),
            "width": width,
            "height": height,
            "watermarked": True,
            "watermark_text": settings.text,
            "is_deleted": False,
            "created_at": now_iso(),
        }
        await db.photos.insert_one({**doc})
        results.append(photo_public(doc))
    await db.articles.update_one({"id": article_id}, {"$set": {"updated_at": now_iso()}})
    return {"photos": results}


@api_router.get("/photos")
async def list_photos():
    docs = await db.photos.find({"is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    out = []
    for d in docs:
        p = photo_public(d)
        art = await db.articles.find_one({"id": d.get("article_id")}, {"_id": 0, "title": 1})
        p["article_title"] = art["title"] if art else None
        out.append(p)
    return out


@api_router.delete("/photos/{photo_id}")
async def delete_photo(photo_id: str):
    res = await db.photos.update_one({"id": photo_id}, {"$set": {"is_deleted": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {"ok": True}


@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.photos.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = get_object(path)
    return Response(content=data, media_type=record.get("content_type", content_type),
                    headers={"Cache-Control": "public, max-age=86400"})


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
