from __future__ import annotations
"""
국가보훈부 생업지원 게시판 모니터링
URL: https://www.mpva.go.kr/mpva/selectBbsNttList.do?bbsNo=32&key=145

- 3시간마다 실행 (launchd com.mpva.monitor)
- 새 게시글 감지 → 상세 페이지 크롤링 → HWP 파일 다운로드 → SQLite 저장 → 텔레그램 알림
- 상태: output/mpva_state.json
- 파일: output/mpva_files/
- 로그: logs/mpva_YYYYMMDD.log
"""

import json
import logging
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote

import requests
from bs4 import BeautifulSoup

# .env 로드 (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
from db.data_store import get_db, upsert_mpva_post  # noqa: E402

BOARD_URL = "https://www.mpva.go.kr/mpva/selectBbsNttList.do?bbsNo=32&key=145"
BASE_URL = "https://www.mpva.go.kr"
STATE_FILE = ROOT / "output" / "mpva_state.json"
FILES_DIR = ROOT / "output" / "mpva_files"

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "").strip()

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
}
TIMEOUT = 20
MAX_RETRIES = 3


# ──────────────────────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────────────────────

def setup_logging() -> None:
    log_dir = ROOT / "logs"
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / f"mpva_{datetime.now().strftime('%Y%m%d')}.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )


# ──────────────────────────────────────────────────────────────────────────────
# HTTP helpers
# ──────────────────────────────────────────────────────────────────────────────

def _get_html(url: str, retries: int = MAX_RETRIES) -> str:
    session = requests.Session()
    last_exc: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, headers=HEADERS, timeout=TIMEOUT)
            resp.raise_for_status()
            if not resp.encoding or resp.encoding.lower() == "iso-8859-1":
                resp.encoding = resp.apparent_encoding or "utf-8"
            return resp.text
        except requests.RequestException as e:
            last_exc = e
            logging.warning("fetch 시도 %d/%d 실패 (%s): %s", attempt, retries, url[:60], e)
    raise last_exc  # type: ignore[misc]


# ──────────────────────────────────────────────────────────────────────────────
# List page parsing
# ──────────────────────────────────────────────────────────────────────────────

def parse_posts(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    posts: list[dict] = []
    seen: set[str] = set()

    for row in soup.select("table tbody tr, ul.board_list li, div.board_list li, tr"):
        link = row.find("a")
        if not link:
            continue

        raw_title = link.get_text(strip=True)
        title = re.sub(r"새글$", "", raw_title).strip()
        if not title:
            continue

        nttno = _extract_ntt_no(link)
        if not nttno or nttno in seen:
            continue
        seen.add(nttno)

        # author / department / date / views from sibling <td> elements
        tds = row.find_all("td")
        author = department = date = ""
        views = 0
        if len(tds) >= 5:
            texts = [td.get_text(strip=True) for td in tds]
            # Typical column order: 번호 제목 파일 작성자 부서 작성일 조회수
            for text in texts:
                if re.match(r"20\d{2}-\d{2}-\d{2}", text):
                    date = text
                elif re.match(r"\d+$", text) and int(text) < 100000 and not text.startswith("0"):
                    views = int(text)
                elif "보훈" in text or "지청" in text or "청" in text:
                    author = text
                elif text in ("복지과", "의료복지팀", "보상과", "총무과") or (
                    len(text) <= 10 and "과" in text or "팀" in text
                ):
                    department = text

        url = (
            f"{BASE_URL}/mpva/selectBbsNttView.do"
            f"?key=145&bbsNo=32&nttNo={nttno}"
            f"&searchCtgry=&searchCnd=all&searchKrwd=&integrDeptCode=&pageIndex=1"
        )

        posts.append({
            "ntt_no": nttno,
            "title": title,
            "author": author,
            "department": department,
            "date": date or _extract_date(row),
            "views": views,
            "url": url,
        })

    return posts


def _extract_ntt_no(link) -> str | None:
    href = link.get("href", "") or ""
    if "nttNo=" in href:
        try:
            return href.split("nttNo=")[1].split("&")[0]
        except Exception:
            pass

    onclick = link.get("onclick", "") or ""
    if "'" in onclick:
        for part in onclick.split("'"):
            if part.isdigit():
                return part

    for attr in ("data-nttno", "data-ntt-no", "data-id"):
        if link.has_attr(attr):
            return link[attr]

    return None


def _extract_date(row) -> str:
    text = row.get_text(" ", strip=True)
    m = re.search(r"(20\d{2})[-./](\d{1,2})[-./](\d{1,2})", text)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return ""


# ──────────────────────────────────────────────────────────────────────────────
# Detail page parsing
# ──────────────────────────────────────────────────────────────────────────────

def fetch_detail(post: dict) -> dict:
    """Fetch detail page and enrich the post dict with content + files."""
    try:
        html = _get_html(post["url"])
    except Exception as e:
        logging.warning("[%s] 상세 페이지 fetch 실패: %s", post["ntt_no"], e)
        return post

    soup = BeautifulSoup(html, "html.parser")

    # Title (override with detail-page value if better)
    for sel in [".bbsViewTit", ".subjectDiv", "h4.tit", ".tit_cont", "h4", "h3"]:
        el = soup.select_one(sel)
        if el:
            t = re.sub(r"새글$", "", el.get_text(strip=True)).strip()
            if t and len(t) > len(post.get("title", "")):
                post["title"] = t
                break

    # Info table: 부서, 연락처, 작성자
    for tr in soup.select("table tr"):
        ths = tr.find_all("th")
        tds = tr.find_all("td")
        for th, td in zip(ths, tds):
            label = th.get_text(strip=True)
            value = td.get_text(strip=True)
            if "부서" in label and not post.get("department"):
                post["department"] = value
            elif any(k in label for k in ("연락처", "전화", "담당")) and not post.get("contact"):
                post["contact"] = value
            elif any(k in label for k in ("작성자", "기관", "지청")) and not post.get("author"):
                post["author"] = value

    # Date / views from meta section
    for sel in [".bbsViewInfo", ".view_info", ".writeInfo", ".info_area", ".date_info"]:
        meta = soup.select_one(sel)
        if meta:
            text = meta.get_text(" ", strip=True)
            if not post.get("date"):
                m = re.search(r"20\d{2}[-./]\d{1,2}[-./]\d{1,2}", text)
                if m:
                    post["date"] = m.group(0).replace(".", "-").replace("/", "-")
            if not post.get("views"):
                m = re.search(r"(\d+)\s*$", text)
                if m and int(m.group(1)) < 100000:
                    post["views"] = int(m.group(1))
            break

    # Content — 실제 선택자: td.p-table__content (mpva.go.kr 구조)
    for sel in [
        "td.p-table__content",
        ".p-wrap.bbs td",
        ".bbsViewCont", ".viewarea", ".cont_area", ".view_cont",
        ".board_view", ".bbs_view", "#contents .txt", ".detail_content",
    ]:
        el = soup.select_one(sel)
        if el and len(el.get_text(strip=True)) > 20:
            post["content"] = el.get_text("\n", strip=True)
            break

    # Files — 실제 패턴: href="./downloadBbsFile.do?atchmnflNo=..."
    files: list[dict] = []
    seen_urls: set[str] = set()
    detail_base = BASE_URL + "/mpva/"  # 상대 경로 기준

    for a in soup.find_all("a", href=True):
        href = a["href"]
        raw_text = a.get_text(strip=True)
        if not raw_text:
            continue
        is_file = any(k in href for k in [
            "downloadBbsFile", "FileDown", "fileDown", "file_down",
        ]) and "previewBbsFile" not in href
        if not is_file:
            continue
        # 절대 URL 변환
        if href.startswith("./"):
            file_url = detail_base + href[2:]
        elif href.startswith("/"):
            file_url = BASE_URL + href
        elif href.startswith("http"):
            file_url = href
        else:
            file_url = detail_base + href
        # "hwp 문서", "pdf 문서" 등 접두어 제거
        clean_name = re.sub(r"^(hwp|pdf|xlsx?|docx?|pptx?)\s+문서", "", raw_text, flags=re.IGNORECASE).strip()
        clean_name = clean_name or raw_text
        if file_url not in seen_urls:
            seen_urls.add(file_url)
            files.append({"filename": clean_name, "url": file_url, "local_path": ""})

    # Files — 구형 eGov onclick 패턴: fn_egov_downFile('FILEID', 'SN')
    for a in soup.find_all("a"):
        onclick = a.get("onclick", "") or ""
        if not onclick:
            continue
        m = re.search(r"[Dd]own[Ff]ile\(['\"]([^'\"]+)['\"],\s*['\"](\d+)['\"]", onclick)
        if m:
            file_id, file_sn = m.group(1), m.group(2)
            file_url = f"{BASE_URL}/cmm/fms/FileDown.do?atchFileId={file_id}&fileSn={file_sn}"
            text = a.get_text(strip=True) or f"첨부파일_{file_sn}"
            if file_url not in seen_urls:
                seen_urls.add(file_url)
                files.append({"filename": text, "url": file_url, "local_path": ""})

    post["files"] = files
    return post


# ──────────────────────────────────────────────────────────────────────────────
# File download
# ──────────────────────────────────────────────────────────────────────────────

def download_files(post: dict) -> dict:
    """Download all attached files for a post. Updates files[*].local_path in-place."""
    FILES_DIR.mkdir(parents=True, exist_ok=True)

    for file_info in post.get("files", []):
        url = file_info.get("url", "")
        if not url:
            continue

        # Sanitize display name as fallback filename
        safe_name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", file_info.get("filename", "file"))[:80]
        local_path = FILES_DIR / f"{post['ntt_no']}_{safe_name}"

        if local_path.exists():
            file_info["local_path"] = str(local_path)
            continue

        try:
            r = requests.get(url, headers=HEADERS, timeout=30, stream=True)
            r.raise_for_status()

            # Prefer filename from Content-Disposition
            cd = r.headers.get("Content-Disposition", "")
            if "filename" in cd:
                cd_name = _parse_content_disposition(cd)
                if cd_name:
                    safe_cd = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", cd_name)[:80]
                    local_path = FILES_DIR / f"{post['ntt_no']}_{safe_cd}"

            with open(local_path, "wb") as f:
                for chunk in r.iter_content(8192):
                    f.write(chunk)

            file_info["local_path"] = str(local_path)
            logging.info("  📎 다운로드: %s", local_path.name)

        except Exception as e:
            logging.warning("  ❌ 파일 다운로드 실패 (%s): %s", file_info["filename"][:40], e)

    return post


def _parse_content_disposition(cd: str) -> str:
    """Extract filename from Content-Disposition header, handling RFC 5987 and EUC-KR."""
    # RFC 5987: filename*=UTF-8''...
    m = re.search(r"filename\*\s*=\s*([^;]+)", cd, re.IGNORECASE)
    if m:
        raw = m.group(1).strip().strip("'\"")
        if raw.lower().startswith("utf-8''"):
            return unquote(raw[7:])
        return unquote(raw)

    # Standard filename=
    m = re.search(r'filename\s*=\s*["\']?([^"\';\r\n]+)', cd, re.IGNORECASE)
    if m:
        raw = m.group(1).strip().strip("\"'")
        # URL-encoded filename (e.g. %E2%98%85 → ★)
        if "%" in raw:
            try:
                return unquote(raw, encoding="utf-8")
            except Exception:
                pass
        for enc in ("utf-8", "euc-kr"):
            try:
                return raw.encode("iso-8859-1").decode(enc)
            except Exception:
                pass
        return raw

    return ""


# ──────────────────────────────────────────────────────────────────────────────
# State management
# ──────────────────────────────────────────────────────────────────────────────

def load_state() -> dict:
    if not STATE_FILE.exists():
        return {"ntt_nos": [], "last_checked": None}
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"ntt_nos": [], "last_checked": None}


def save_state(posts: list[dict]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    state = {
        "ntt_nos": [p["ntt_no"] for p in posts],
        "last_checked": datetime.now().isoformat(),
        "sample": [{"ntt_no": p["ntt_no"], "title": p["title"]} for p in posts[:5]],
    }
    STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8"
    )


# ──────────────────────────────────────────────────────────────────────────────
# Telegram
# ──────────────────────────────────────────────────────────────────────────────

def send_telegram(text: str) -> bool:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logging.warning("TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID 미설정 — 알림 생략")
        return False
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            data={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": False,
            },
            timeout=TIMEOUT,
        )
        ok = r.json().get("ok", False)
        if ok:
            logging.info("✅ 텔레그램 전송 완료")
        else:
            logging.error("❌ 텔레그램 전송 실패: %s", r.text[:200])
        return ok
    except Exception as e:
        logging.error("❌ 텔레그램 오류: %s", e)
        return False


def format_message(new_posts: list[dict]) -> str:
    lines = [f"🔔 <b>국가보훈부 생업지원 공고</b> 신규 {len(new_posts)}건", ""]
    for p in new_posts:
        dept = f" [{p['department']}]" if p.get("department") else ""
        date_str = f" ({p['date']})" if p.get("date") else ""
        file_str = f" 📎{len(p.get('files', []))}" if p.get("files") else ""
        lines.append(f'• <a href="{p["url"]}">{p["title"]}</a>{dept}{date_str}{file_str}')
    lines += ["", f'📋 <a href="{BOARD_URL}">게시판 바로가기</a>']
    return "\n".join(lines)


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main() -> int:
    setup_logging()
    logging.info("=== MPVA 모니터링 시작 ===")

    # 1. 목록 크롤링
    try:
        html = _get_html(BOARD_URL)
    except Exception as e:
        logging.error("목록 페이지 fetch 실패: %s", e)
        return 1

    posts = parse_posts(html)
    logging.info("목록 파싱: %d건", len(posts))

    if not posts:
        logging.warning("파싱 결과 0건 — HTML 구조 확인 필요")
        debug_file = ROOT / "output" / "mpva_debug.html"
        debug_file.parent.mkdir(exist_ok=True)
        debug_file.write_text(html[:8000], encoding="utf-8")
        logging.warning("HTML 덤프 저장: %s", debug_file)
        return 1

    # 2. 신규 게시글 감지
    state = load_state()
    previous_ids = set(state.get("ntt_nos", []))

    if not previous_ids:
        logging.info("최초 실행 — 초기 상태 저장 (알림 없음, 스팸 방지)")
        save_state(posts)
        return 0

    new_posts = [p for p in posts if p["ntt_no"] not in previous_ids]
    logging.info("신규 게시글: %d건", len(new_posts))

    if not new_posts:
        logging.info("새 게시글 없음")
        save_state(posts)
        return 0

    # 3. 신규 게시글 상세 크롤링 + 파일 다운로드 + DB 저장
    db = get_db()
    enriched: list[dict] = []

    for p in new_posts:
        logging.info("  📄 상세 크롤링: [%s] %s", p["ntt_no"], p["title"][:50])
        p = fetch_detail(p)
        p = download_files(p)
        p["fetched_at"] = datetime.now().isoformat()
        upsert_mpva_post(db, p)
        enriched.append(p)
        logging.info("  ✅ DB 저장 완료 (파일 %d개)", len(p.get("files", [])))

    db.close()

    # 4. 텔레그램 알림
    send_telegram(format_message(enriched))

    # 5. 상태 저장
    save_state(posts)
    return 0


if __name__ == "__main__":
    sys.exit(main())
