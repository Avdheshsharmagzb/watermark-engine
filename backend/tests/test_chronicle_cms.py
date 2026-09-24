"""Backend tests for Chronicle CMS (news + text watermark on photos)."""
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to reading frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"


def _png_bytes(w=800, h=600, color=(200, 50, 50)):
    img = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# -- Categories -------------------------------------------------------------
def test_categories(s):
    r = s.get(f"{API}/categories", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("categories"), list) and len(data["categories"]) >= 5
    assert "World" in data["categories"]


# -- Watermark settings -----------------------------------------------------
def test_watermark_settings_get_and_update(s):
    r = s.get(f"{API}/settings/watermark", timeout=30)
    assert r.status_code == 200
    orig = r.json()
    for k in ("text", "opacity", "font_size", "position"):
        assert k in orig

    # Update with clamping + invalid position -> falls back to bottom-right
    payload = {"text": "TEST_WM", "opacity": 500, "font_size": 5, "position": "diagonal"}
    r = s.put(f"{API}/settings/watermark", json=payload, timeout=30)
    assert r.status_code == 200
    updated = r.json()
    assert updated["text"] == "TEST_WM"
    assert updated["opacity"] == 100  # clamped
    assert updated["font_size"] == 12  # clamped
    assert updated["position"] == "bottom-right"

    # verify persistence
    r2 = s.get(f"{API}/settings/watermark", timeout=30)
    assert r2.json()["text"] == "TEST_WM"

    # restore
    s.put(f"{API}/settings/watermark",
          json={"text": orig["text"], "opacity": orig["opacity"],
                "font_size": orig["font_size"], "position": orig["position"]}, timeout=30)


def test_watermark_preview_returns_jpeg(s):
    r = s.get(f"{API}/watermark/preview",
              params={"text": "Preview T", "opacity": 60, "font_size": 30, "position": "bottom-right"},
              timeout=60)
    assert r.status_code == 200
    assert r.headers["Content-Type"].startswith("image/jpeg")
    Image.open(io.BytesIO(r.content)).verify()  # valid image


# -- Articles CRUD ----------------------------------------------------------
@pytest.fixture(scope="module")
def article_id(s):
    r = s.post(f"{API}/articles", json={
        "title": "TEST_Article", "category": "Technology",
        "author": "TEST_Author", "summary": "s", "body": "b"
    }, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["title"] == "TEST_Article"
    assert data["category"] == "Technology"
    assert isinstance(data["photos"], list) and data["photos"] == []
    return data["id"]


def test_list_and_filter_articles(s, article_id):
    r = s.get(f"{API}/articles", timeout=30)
    assert r.status_code == 200
    assert any(a["id"] == article_id for a in r.json())

    r = s.get(f"{API}/articles", params={"category": "Technology"}, timeout=30)
    assert r.status_code == 200
    assert all(a["category"] == "Technology" for a in r.json())

    r = s.get(f"{API}/articles", params={"q": "TEST_Article"}, timeout=30)
    assert r.status_code == 200
    assert any(a["id"] == article_id for a in r.json())


def test_get_article_detail(s, article_id):
    r = s.get(f"{API}/articles/{article_id}", timeout=30)
    assert r.status_code == 200
    assert r.json()["id"] == article_id


# -- Photo upload + watermark + serving ------------------------------------
@pytest.fixture(scope="module")
def uploaded_photo(s, article_id):
    files = {"files": ("test.png", _png_bytes(), "image/png")}
    r = s.post(f"{API}/articles/{article_id}/photos", files=files, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["photos"]) == 1
    p = data["photos"][0]
    assert p["watermarked"] is True
    assert p["width"] == 800 and p["height"] == 600
    assert p["url"].startswith("/api/files/")
    assert p.get("watermark_text")
    return p


def test_uploaded_photo_persisted_in_article(s, article_id, uploaded_photo):
    r = s.get(f"{API}/articles/{article_id}", timeout=30)
    assert r.status_code == 200
    photos = r.json()["photos"]
    assert any(p["id"] == uploaded_photo["id"] for p in photos)


def test_serve_watermarked_file(s, uploaded_photo):
    url = BASE_URL + uploaded_photo["url"]
    r = s.get(url, timeout=60)
    assert r.status_code == 200
    assert r.headers["Content-Type"].startswith("image/jpeg")
    img = Image.open(io.BytesIO(r.content))
    assert img.format == "JPEG"


def test_upload_non_image_errors(s, article_id):
    files = {"files": ("bad.txt", b"not an image", "text/plain")}
    r = s.post(f"{API}/articles/{article_id}/photos", files=files, timeout=60)
    assert r.status_code == 400


def test_list_photos_has_article_title(s, uploaded_photo):
    r = s.get(f"{API}/photos", timeout=30)
    assert r.status_code == 200
    entry = next((p for p in r.json() if p["id"] == uploaded_photo["id"]), None)
    assert entry is not None
    assert entry.get("article_title") == "TEST_Article"


def test_delete_photo(s, article_id, uploaded_photo):
    # upload a second photo to delete
    files = {"files": ("d.png", _png_bytes(400, 300, (0, 128, 0)), "image/png")}
    r = s.post(f"{API}/articles/{article_id}/photos", files=files, timeout=120)
    pid = r.json()["photos"][0]["id"]
    r = s.delete(f"{API}/photos/{pid}", timeout=30)
    assert r.status_code == 200
    r = s.get(f"{API}/photos", timeout=30)
    assert not any(p["id"] == pid for p in r.json())


# -- Article delete cascades photos ----------------------------------------
def test_delete_article_soft_deletes_photos(s):
    r = s.post(f"{API}/articles", json={
        "title": "TEST_Delete", "category": "World", "author": "A", "summary": "", "body": ""
    }, timeout=30)
    aid = r.json()["id"]
    files = {"files": ("x.png", _png_bytes(300, 200), "image/png")}
    r = s.post(f"{API}/articles/{aid}/photos", files=files, timeout=120)
    pid = r.json()["photos"][0]["id"]

    r = s.delete(f"{API}/articles/{aid}", timeout=30)
    assert r.status_code == 200

    r = s.get(f"{API}/articles/{aid}", timeout=30)
    assert r.status_code == 404

    r = s.get(f"{API}/photos", timeout=30)
    assert not any(p["id"] == pid for p in r.json())


def test_get_missing_article_404(s):
    r = s.get(f"{API}/articles/does-not-exist", timeout=30)
    assert r.status_code == 404
