from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import sqlite3, hashlib, secrets, os, shutil, urllib.parse, re
from datetime import datetime, timedelta
from typing import Optional
import httpx

app = FastAPI(docs_url=None, redoc_url=None)

if os.path.isdir("/app/images"):
    app.mount("/images", StaticFiles(directory="/app/images"), name="images")

DB_PATH = "/data/users.db"
FILES_DIR = os.getenv("DOWNLOADS_DIR", "/downloads")
os.makedirs(FILES_DIR, exist_ok=True)


def sanitize_filename(name: str) -> str:
    name = os.path.basename(name)
    name = re.sub(r'[^\w.\-]', '_', name)
    name = name.lstrip('._') or "file"
    return name

ALLOWED_EXTENSIONS = {
    ".pdf", ".zip", ".xlsx", ".xls", ".pptx", ".ppt",
    ".docx", ".doc", ".mp4", ".mov", ".png", ".jpg", ".jpeg"
}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs("/data", exist_ok=True)
    conn = get_db()
    conn.execute("""CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        referral TEXT NOT NULL,
        password_hash TEXT,
        google_sub TEXT UNIQUE,
        is_active INTEGER DEFAULT 1,
        is_admin INTEGER DEFAULT 0,
        must_change_password INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        original_name TEXT NOT NULL,
        size INTEGER NOT NULL,
        uploader_id INTEGER,
        uploaded_at TEXT DEFAULT (datetime('now', 'localtime'))
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author_id INTEGER,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )""")
    conn.commit()

    # DB 마이그레이션 — 기존 테이블에 컬럼 추가
    for col, definition in [
        ("is_active", "INTEGER DEFAULT 1"),
        ("is_admin", "INTEGER DEFAULT 0"),
        ("google_sub", "TEXT"),
        ("must_change_password", "INTEGER DEFAULT 0"),
    ]:
        try:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col} {definition}")
            conn.commit()
        except Exception:
            pass

    conn.close()

    # 환경변수로 첫 관리자 자동 생성
    admin_email = os.getenv("ADMIN_EMAIL", "")
    admin_password = os.getenv("ADMIN_PASSWORD", "")
    admin_name = os.getenv("ADMIN_NAME", "관리자")
    if admin_email and admin_password:
        conn = get_db()
        existing = conn.execute("SELECT id FROM users WHERE email=?", (admin_email,)).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO users (name, email, phone, referral, password_hash, is_admin) VALUES (?,?,?,?,?,1)",
                (admin_name, admin_email, "000-0000-0000", "관리자", hash_pw(admin_password))
            )
            conn.commit()
        else:
            conn.execute("UPDATE users SET is_admin=1 WHERE email=?", (admin_email,))
            conn.commit()
        conn.close()


init_db()


# ──────────────────────────────────────────
# HTML 페이지 서빙
# ──────────────────────────────────────────

_NO_CACHE = {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}


@app.get("/login")
async def login_page():
    return FileResponse("/app/login.html", headers=_NO_CACHE)


@app.get("/register")
async def register_page():
    return FileResponse("/app/register.html", headers=_NO_CACHE)


@app.get("/admin")
async def admin_index_page(request: Request):
    await require_admin(request)
    return FileResponse("/app/admin/index.html")


@app.get("/admin/members")
async def admin_members_page(request: Request):
    await require_admin(request)
    return FileResponse("/app/admin/members.html")


@app.get("/admin/files")
async def admin_files_page(request: Request):
    await require_admin(request)
    return FileResponse("/app/admin/files.html")


@app.get("/admin/notices")
async def admin_notices_page(request: Request):
    await require_admin(request)
    return FileResponse("/app/admin/notices.html")


def hash_pw(password: str) -> str:
    salt = "frindle_edu_2026_salt"
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def _get_session_user(request: Request):
    token = request.cookies.get("frindle_session")
    if not token:
        return None
    conn = get_db()
    row = conn.execute(
        """SELECT u.id, u.name, u.is_admin, u.is_active
           FROM sessions s JOIN users u ON s.user_id=u.id
           WHERE s.token=? AND s.expires_at > datetime('now','localtime')""",
        (token,)
    ).fetchone()
    conn.close()
    return row


async def require_admin(request: Request):
    user = _get_session_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not user["is_admin"]:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")
    return user


# ──────────────────────────────────────────
# Auth endpoints (public)
# ──────────────────────────────────────────

class RegisterReq(BaseModel):
    name: str
    email: str
    phone: str
    referral: str
    password: str
    agree_terms: bool = False
    agree_privacy: bool = False


class LoginReq(BaseModel):
    email: str
    password: str


@app.post("/auth/register")
async def register(req: RegisterReq):
    if not req.agree_terms or not req.agree_privacy:
        raise HTTPException(status_code=400, detail="이용약관 및 개인정보처리방침에 동의해 주세요.")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="이름을 입력해 주세요.")
    if "@" not in req.email:
        raise HTTPException(status_code=400, detail="올바른 이메일 주소를 입력해 주세요.")
    if not req.phone.strip():
        raise HTTPException(status_code=400, detail="전화번호를 입력해 주세요.")
    if not req.referral.strip():
        raise HTTPException(status_code=400, detail="유입경로를 선택해 주세요.")
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (name, email, phone, referral, password_hash) VALUES (?,?,?,?,?)",
            (req.name.strip(), req.email.strip().lower(),
             req.phone.strip(), req.referral.strip(), hash_pw(req.password))
        )
        conn.commit()
        return {"success": True, "message": "회원가입이 완료되었습니다."}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="이미 등록된 이메일입니다.")
    finally:
        conn.close()


@app.post("/auth/login")
async def login(req: LoginReq, response: Response):
    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE email=? AND password_hash=?",
        (req.email.strip().lower(), hash_pw(req.password))
    ).fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="비활성화된 계정입니다. 관리자에게 문의하세요.")

    token = secrets.token_urlsafe(32)
    expires = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
    conn = get_db()
    conn.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)",
                 (token, user["id"], expires))
    conn.commit()
    conn.close()
    response.set_cookie(
        key="frindle_session", value=token, httponly=True,
        secure=True, samesite="lax", max_age=86400 * 7, path="/"
    )
    return {"success": True, "name": user["name"], "is_admin": bool(user["is_admin"])}


@app.get("/auth/check")
async def check(request: Request):
    user = _get_session_user(request)
    if not user:
        raise HTTPException(status_code=401)
    if not user["is_active"]:
        raise HTTPException(status_code=403)
    return Response(status_code=200)


@app.get("/auth/admin-check")
async def admin_check(request: Request):
    user = _get_session_user(request)
    if not user:
        raise HTTPException(status_code=401)
    if not user["is_admin"]:
        raise HTTPException(status_code=403)
    return Response(status_code=200)


@app.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("frindle_session")
    if token:
        conn = get_db()
        conn.execute("DELETE FROM sessions WHERE token=?", (token,))
        conn.commit()
        conn.close()
    response.delete_cookie("frindle_session", path="/")
    return {"success": True}


# ──────────────────────────────────────────
# Admin API
# ──────────────────────────────────────────

@app.get("/admin/api/stats")
async def admin_stats(request: Request):
    await require_admin(request)
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    active = conn.execute("SELECT COUNT(*) FROM users WHERE is_active=1").fetchone()[0]
    week = conn.execute(
        "SELECT COUNT(*) FROM users WHERE created_at > datetime('now','-7 days','localtime')"
    ).fetchone()[0]
    month = conn.execute(
        "SELECT COUNT(*) FROM users WHERE created_at > datetime('now','-30 days','localtime')"
    ).fetchone()[0]
    recent = conn.execute(
        "SELECT id,name,email,phone,referral,created_at FROM users ORDER BY created_at DESC LIMIT 10"
    ).fetchall()
    file_count = conn.execute("SELECT COUNT(*) FROM files").fetchone()[0]
    notice_count = conn.execute("SELECT COUNT(*) FROM notices").fetchone()[0]
    conn.close()
    return {
        "total": total, "active": active, "week": week, "month": month,
        "file_count": file_count, "notice_count": notice_count,
        "recent": [dict(r) for r in recent]
    }


@app.get("/admin/api/users")
async def admin_users(request: Request):
    await require_admin(request)
    conn = get_db()
    users = conn.execute(
        "SELECT id,name,email,phone,referral,created_at,is_active,is_admin FROM users ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return {"users": [dict(u) for u in users]}


class UserUpdateReq(BaseModel):
    is_active: Optional[int] = None
    is_admin: Optional[int] = None


@app.patch("/admin/api/users/{user_id}")
async def admin_update_user(user_id: int, req: UserUpdateReq, request: Request):
    me = await require_admin(request)
    if req.is_active is not None:
        if user_id == me["id"] and req.is_active == 0:
            raise HTTPException(status_code=400, detail="자신의 계정은 비활성화할 수 없습니다.")
        conn = get_db()
        conn.execute("UPDATE users SET is_active=? WHERE id=?", (req.is_active, user_id))
        conn.commit()
        conn.close()
    if req.is_admin is not None:
        conn = get_db()
        conn.execute("UPDATE users SET is_admin=? WHERE id=?", (req.is_admin, user_id))
        conn.commit()
        conn.close()
    return {"success": True}


@app.delete("/admin/api/users/{user_id}")
async def admin_delete_user(user_id: int, request: Request):
    me = await require_admin(request)
    if user_id == me["id"]:
        raise HTTPException(status_code=400, detail="자신의 계정은 삭제할 수 없습니다.")
    conn = get_db()
    conn.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
    conn.execute("DELETE FROM users WHERE id=?", (user_id,))
    conn.commit()
    conn.close()
    return {"success": True}


# ──────────────────────────────────────────
# File management
# ──────────────────────────────────────────

@app.get("/admin/api/files")
async def admin_files(request: Request):
    await require_admin(request)
    conn = get_db()
    db_files = {row["filename"]: dict(row) for row in conn.execute(
        "SELECT filename, original_name, size, uploaded_at FROM files"
    ).fetchall()}
    conn.close()

    result = []
    if os.path.exists(FILES_DIR):
        for fname in sorted(os.listdir(FILES_DIR)):
            fpath = os.path.join(FILES_DIR, fname)
            if not os.path.isfile(fpath):
                continue
            if not re.search(r'\.(pdf|zip|xlsx|xls|pptx|ppt|docx|doc|mp4|mov|png|jpg|jpeg)$', fname, re.I):
                continue
            st = os.stat(fpath)
            if fname in db_files:
                result.append(db_files[fname])
            else:
                result.append({
                    "filename": fname,
                    "original_name": fname,
                    "size": st.st_size,
                    "uploaded_at": datetime.fromtimestamp(st.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                })
    result.sort(key=lambda x: x["uploaded_at"], reverse=True)
    return {"files": result}


@app.post("/admin/api/upload")
async def admin_upload(request: Request, file: UploadFile = File(...)):
    await require_admin(request)
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"허용되지 않는 파일 형식입니다. ({', '.join(ALLOWED_EXTENSIONS)})")

    safe_name = sanitize_filename(file.filename or ("upload" + ext))
    os.makedirs(FILES_DIR, exist_ok=True)
    dest = os.path.join(FILES_DIR, safe_name)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기는 500MB를 초과할 수 없습니다.")

    with open(dest, "wb") as f:
        f.write(content)

    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO files (filename, original_name, size) VALUES (?,?,?)",
        (safe_name, file.filename, len(content))
    )
    conn.commit()
    conn.close()

    return {"success": True, "filename": safe_name, "original_name": file.filename}


@app.delete("/admin/api/files/{filename}")
async def admin_delete_file(filename: str, request: Request):
    await require_admin(request)
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="잘못된 파일명입니다.")
    conn = get_db()
    conn.execute("DELETE FROM files WHERE filename=?", (filename,))
    conn.commit()
    conn.close()
    dest = os.path.join(FILES_DIR, filename)
    if os.path.exists(dest):
        os.remove(dest)
    return {"success": True}


@app.get("/dl/{filename}")
async def download_file(filename: str, request: Request):
    user = _get_session_user(request)
    if not user:
        raise HTTPException(status_code=401)
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400)
    dest = os.path.join(FILES_DIR, filename)
    if not os.path.exists(dest):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    conn = get_db()
    file_row = conn.execute("SELECT original_name FROM files WHERE filename=?", (filename,)).fetchone()
    conn.close()
    display_name = file_row["original_name"] if file_row else filename
    return FileResponse(
        path=dest,
        filename=display_name,
        media_type="application/octet-stream"
    )


# ──────────────────────────────────────────
# Notice management
# ──────────────────────────────────────────

class NoticeReq(BaseModel):
    title: str
    content: str


@app.get("/admin/api/notices")
async def admin_get_notices(request: Request):
    await require_admin(request)
    conn = get_db()
    notices = conn.execute(
        "SELECT id,title,content,created_at FROM notices ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return {"notices": [dict(n) for n in notices]}


@app.post("/admin/api/notices")
async def admin_create_notice(req: NoticeReq, request: Request):
    me = await require_admin(request)
    if not req.title.strip() or not req.content.strip():
        raise HTTPException(status_code=400, detail="제목과 내용을 입력해 주세요.")
    conn = get_db()
    conn.execute(
        "INSERT INTO notices (title, content, author_id) VALUES (?,?,?)",
        (req.title.strip(), req.content.strip(), me["id"])
    )
    conn.commit()
    conn.close()
    return {"success": True}


@app.delete("/admin/api/notices/{notice_id}")
async def admin_delete_notice(notice_id: int, request: Request):
    await require_admin(request)
    conn = get_db()
    conn.execute("DELETE FROM notices WHERE id=?", (notice_id,))
    conn.commit()
    conn.close()
    return {"success": True}


# 공개 공지 API (사이트 사용자용)
@app.get("/api/notices")
async def public_notices(request: Request):
    user = _get_session_user(request)
    if not user:
        raise HTTPException(status_code=401)
    conn = get_db()
    notices = conn.execute(
        "SELECT id,title,content,created_at FROM notices ORDER BY created_at DESC LIMIT 20"
    ).fetchall()
    conn.close()
    return {"notices": [dict(n) for n in notices]}


# ──────────────────────────────────────────
# 비밀번호 변경
# ──────────────────────────────────────────

class ChangePwReq(BaseModel):
    current_password: str
    new_password: str


@app.post("/auth/change-password")
async def change_password(req: ChangePwReq, request: Request, response: Response):
    user_row = _get_session_user(request)
    if not user_row:
        raise HTTPException(status_code=401)
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="새 비밀번호는 8자 이상이어야 합니다.")

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id=?", (user_row["id"],)).fetchone()

    # must_change_password=1 이면 현재 비밀번호 검증 건너뜀 (초기 설정)
    if not user["must_change_password"]:
        if not user["password_hash"] or user["password_hash"] != hash_pw(req.current_password):
            conn.close()
            raise HTTPException(status_code=400, detail="현재 비밀번호가 올바르지 않습니다.")

    conn.execute(
        "UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?",
        (hash_pw(req.new_password), user_row["id"])
    )
    conn.commit()
    conn.close()
    return {"success": True}


@app.get("/auth/me")
async def me(request: Request):
    user = _get_session_user(request)
    if not user:
        raise HTTPException(status_code=401)
    conn = get_db()
    row = conn.execute(
        "SELECT id,name,email,is_admin,must_change_password FROM users WHERE id=?",
        (user["id"],)
    ).fetchone()
    conn.close()
    return dict(row)


# ──────────────────────────────────────────
# Google OAuth
# ──────────────────────────────────────────

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
BASE_URL = os.getenv("BASE_URL", "https://edu.frindle.synology.me")
GOOGLE_REDIRECT_URI = f"{BASE_URL}/auth/google/callback"

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# state 임시 저장 (메모리, 단일 서버용)
_oauth_states: dict = {}


@app.get("/auth/google/login")
async def google_login():
    if not GOOGLE_CLIENT_ID:
        return RedirectResponse(url="/login?error=google_not_configured")
    state = secrets.token_urlsafe(16)
    _oauth_states[state] = datetime.now().isoformat()

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
    }
    url = GOOGLE_AUTH_URL + "?" + urllib.parse.urlencode(params)
    return RedirectResponse(url=url)


@app.get("/auth/google/callback")
async def google_callback(request: Request, response: Response,
                          code: str = "", state: str = "", error: str = ""):
    if error:
        return RedirectResponse(url="/login?error=google_denied")

    if state not in _oauth_states:
        return RedirectResponse(url="/login?error=invalid_state")
    del _oauth_states[state]

    # 코드 → 토큰 교환
    async with httpx.AsyncClient() as client:
        token_res = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            return RedirectResponse(url="/login?error=token_failed")
        token_data = token_res.json()

        userinfo_res = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {token_data['access_token']}"}
        )
        if userinfo_res.status_code != 200:
            return RedirectResponse(url="/login?error=userinfo_failed")
        guser = userinfo_res.json()

    google_sub = guser.get("id") or guser.get("sub", "")
    email = guser.get("email", "").lower()
    name = guser.get("name", email.split("@")[0])

    conn = get_db()
    # google_sub로 먼저 조회, 없으면 email로 조회
    user = conn.execute("SELECT * FROM users WHERE google_sub=?", (google_sub,)).fetchone()
    if not user and email:
        user = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        if user:
            conn.execute("UPDATE users SET google_sub=? WHERE id=?", (google_sub, user["id"]))
            conn.commit()

    if not user:
        conn.close()
        return RedirectResponse(url="/login?error=google_not_registered")

    if not user["is_active"]:
        conn.close()
        return RedirectResponse(url="/login?error=inactive")

    token = secrets.token_urlsafe(32)
    expires = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
    conn.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)",
                 (token, user["id"], expires))
    conn.commit()
    conn.close()

    resp = RedirectResponse(url="/")
    resp.set_cookie(
        key="frindle_session", value=token, httponly=True,
        secure=True, samesite="lax", max_age=86400 * 7, path="/"
    )
    return resp
