"""
미국 주식 야간 뉴스 모니터 — 충격 뉴스 감지 시 텔레그램 알림
실행 주기: 15분마다 (launchd StartInterval=900)
활성 시간: KST 21:30 ~ 08:00 (US 프리마켓~포스트마켓)

감지 3단계:
  Level 1 — 키워드 필터 (무비용)
  Level 2 — VIX 스파이크 확인 (yfinance)
  Level 3 — Gemini Flash 충격도 스코어링 (GOOGLE_API_KEY 있을 때만)

뉴스 소스:
  - Finnhub market news API (FINNHUB_API_KEY)
  - CNBC / MarketWatch / Reuters RSS (무료)

상태: output/news_monitor_state.json
로그: logs/news_monitor_YYYYMMDD.log
"""

import hashlib
import json
import logging
import os
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent.parent
STATE_FILE = ROOT / "output" / "news_monitor_state.json"

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
FINNHUB_API_KEY = os.environ.get("FINNHUB_API_KEY", "").strip()
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "").strip()

KST = ZoneInfo("Asia/Seoul")
TIMEOUT = 15
MAX_SEEN = 300  # 중복 방지 해시 최대 보관 수

HEADERS = {
    "User-Agent": "Mozilla/5.0 Chrome/124.0.0.0",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}

# ─────────────────────────────────────────────────────────────────────────────
# 키워드 사전
# ─────────────────────────────────────────────────────────────────────────────

CRITICAL_KW = [
    "circuit breaker", "trading halt", "market crash", "market meltdown",
    "emergency rate cut", "emergency meeting", "flash crash", "black monday",
    "black tuesday", "stock market closed", "nyse halted", "nasdaq halted",
    "fed emergency", "systemic risk", "bank run", "bank failure",
    "debt ceiling default", "us default", "nuclear",
]

HIGH_KW = [
    "tariff", "trade war", "recession", "rate hike surprise", "rate cut surprise",
    "fed rate", "fomc surprise", "inflation surge", "cpi shock", "jobs report miss",
    "gdp contraction", "bankruptcy", "sec investigation", "sec charges", "fraud",
    "war", "sanctions", "oil shock", "geopolitical", "earnings miss", "guidance cut",
    "layoffs", "mass layoffs", "credit downgrade", "yield spike", "vix spike",
    "market selloff", "market rout", "sell-off", "plunge", "tumble", "collapse",
    "crypto crash", "bitcoin crash",
]

RSS_FEEDS = [
    {"name": "CNBC",       "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"},
    {"name": "MarketWatch", "url": "https://feeds.marketwatch.com/marketwatch/topstories/"},
    {"name": "Reuters",    "url": "https://feeds.reuters.com/reuters/businessNews"},
]


# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────

def setup_logging() -> None:
    log_dir = ROOT / "logs"
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / f"news_monitor_{datetime.now().strftime('%Y%m%d')}.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )


# ─────────────────────────────────────────────────────────────────────────────
# 활성 시간 확인 (KST 21:30 ~ 08:00)
# ─────────────────────────────────────────────────────────────────────────────

def is_active_hours() -> bool:
    now = datetime.now(KST)
    h, m = now.hour, now.minute
    # 21:30~23:59 또는 00:00~08:00
    if h >= 22 or h < 8:
        return True
    if h == 21 and m >= 30:
        return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# 상태 관리
# ─────────────────────────────────────────────────────────────────────────────

def load_state() -> dict:
    if not STATE_FILE.exists():
        return {"seen": {}, "alerts_sent": 0, "last_checked": None}
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"seen": {}, "alerts_sent": 0, "last_checked": None}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    # 오래된 seen 항목 정리 (48시간 초과)
    cutoff = (datetime.now(KST) - timedelta(hours=48)).isoformat()
    state["seen"] = {
        h: ts for h, ts in state["seen"].items() if ts > cutoff
    }
    # 최대 MAX_SEEN 개 유지
    if len(state["seen"]) > MAX_SEEN:
        sorted_items = sorted(state["seen"].items(), key=lambda x: x[1])
        state["seen"] = dict(sorted_items[-MAX_SEEN:])
    state["last_checked"] = datetime.now(KST).isoformat()
    STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def headline_hash(title: str) -> str:
    return hashlib.md5(title.lower().strip()[:120].encode()).hexdigest()[:16]


# ─────────────────────────────────────────────────────────────────────────────
# 뉴스 수집
# ─────────────────────────────────────────────────────────────────────────────

def fetch_finnhub_news() -> list[dict]:
    if not FINNHUB_API_KEY:
        return []
    try:
        r = requests.get(
            "https://finnhub.io/api/v1/news",
            params={"category": "general", "token": FINNHUB_API_KEY},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        items = r.json()
        return [
            {"title": item.get("headline", ""), "url": item.get("url", ""),
             "source": item.get("source", "Finnhub"), "id": str(item.get("id", ""))}
            for item in items if item.get("headline")
        ]
    except Exception as e:
        logging.warning("Finnhub fetch 실패: %s", e)
        return []


def fetch_rss(feed: dict) -> list[dict]:
    try:
        r = requests.get(feed["url"], headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
        root = ET.fromstring(r.content)
        items = []
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            if title:
                items.append({"title": title, "url": link,
                              "source": feed["name"], "id": ""})
        return items
    except Exception as e:
        logging.warning("RSS fetch 실패 (%s): %s", feed["name"], e)
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Level 1 — 키워드 필터
# ─────────────────────────────────────────────────────────────────────────────

def keyword_level(title: str) -> str | None:
    t = title.lower()
    if any(k in t for k in CRITICAL_KW):
        return "CRITICAL"
    if any(k in t for k in HIGH_KW):
        return "HIGH"
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Level 2 — VIX 스파이크
# ─────────────────────────────────────────────────────────────────────────────

_vix_cache: tuple[float, float, datetime] | None = None  # (current, pct_change, fetched_at)

def get_vix() -> tuple[float, float]:
    """(current_vix, 30분_변화율%) 반환. 실패 시 (0, 0)."""
    global _vix_cache
    # 캐시 5분 유효
    if _vix_cache and (datetime.now(KST) - _vix_cache[2]).seconds < 300:
        return _vix_cache[0], _vix_cache[1]
    try:
        import yfinance as yf
        hist = yf.Ticker("^VIX").history(period="1d", interval="5m")
        if hist.empty:
            return 0.0, 0.0
        current = float(hist["Close"].iloc[-1])
        prev = float(hist["Close"].iloc[-7]) if len(hist) >= 7 else current
        pct = (current - prev) / prev * 100 if prev else 0.0
        _vix_cache = (current, pct, datetime.now(KST))
        return current, pct
    except Exception as e:
        logging.warning("VIX fetch 실패: %s", e)
        return 0.0, 0.0


def vix_is_elevated() -> tuple[bool, float, float]:
    """(is_elevated, current_vix, pct_change_30m)"""
    vix, pct = get_vix()
    elevated = vix > 25 or pct > 15
    return elevated, vix, pct


# ─────────────────────────────────────────────────────────────────────────────
# Level 3 — Gemini Flash 스코어링
# ─────────────────────────────────────────────────────────────────────────────

def gemini_score(title: str) -> tuple[int, str]:
    """(score 1-10, reason). GOOGLE_API_KEY 없으면 (0, '')."""
    if not GOOGLE_API_KEY:
        return 0, ""
    try:
        prompt = (
            "Rate how market-moving this financial news headline is for US stocks, "
            "scale 1-10. Only respond in format: <score>/10: <reason under 20 words>\n"
            f"Headline: {title}"
        )
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GOOGLE_API_KEY}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=20,
        )
        r.raise_for_status()
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        m = re.match(r"(\d+)/10[:\s]*(.+)", text)
        if m:
            return int(m.group(1)), m.group(2).strip()
        return 0, text[:60]
    except Exception as e:
        logging.warning("Gemini 스코어링 실패: %s", e)
        return 0, ""


# ─────────────────────────────────────────────────────────────────────────────
# Telegram 알림
# ─────────────────────────────────────────────────────────────────────────────

def send_telegram(text: str) -> bool:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logging.warning("Telegram 미설정 — 알림 생략")
        return False
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            data={"chat_id": TELEGRAM_CHAT_ID, "text": text,
                  "parse_mode": "HTML", "disable_web_page_preview": False},
            timeout=TIMEOUT,
        )
        ok = r.json().get("ok", False)
        if ok:
            logging.info("✅ 텔레그램 전송 완료")
        return ok
    except Exception as e:
        logging.error("❌ 텔레그램 오류: %s", e)
        return False


def format_alert(news: dict, level: str, vix: float, vix_pct: float,
                 score: int, reason: str) -> str:
    now_kst = datetime.now(KST).strftime("%m/%d %H:%M KST")
    level_icon = "🚨" if level == "CRITICAL" else "⚡"
    lines = [
        f"{level_icon} <b>미국 증시 주요 뉴스</b> [{level}]",
        f"<i>{now_kst}</i>",
        "",
        f"📰 <b>{news['title']}</b>",
        f"출처: {news['source']}",
    ]
    if vix > 0:
        vix_str = f"VIX {vix:.1f}"
        if abs(vix_pct) > 5:
            vix_str += f" ({vix_pct:+.1f}% / 30분)"
        lines.append(vix_str)
    if score >= 7 and reason:
        lines.append(f"AI 충격도: {score}/10 — {reason}")
    if news.get("url"):
        lines.append(f'\n🔗 <a href="{news["url"]}">기사 보기</a>')
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    setup_logging()

    if not is_active_hours():
        now = datetime.now(KST).strftime("%H:%M KST")
        logging.info("비활성 시간 (%s) — 종료 (활성: 21:30~08:00 KST)", now)
        return 0

    logging.info("=== 야간 뉴스 모니터 시작 (%s) ===", datetime.now(KST).strftime("%H:%M KST"))
    state = load_state()

    # 뉴스 수집
    all_news: list[dict] = []
    all_news.extend(fetch_finnhub_news())
    for feed in RSS_FEEDS:
        all_news.extend(fetch_rss(feed))

    logging.info("수집된 뉴스: %d건", len(all_news))

    alerted = 0
    vix_checked = False
    vix_val, vix_pct = 0.0, 0.0

    for news in all_news:
        title = news["title"]
        if not title:
            continue

        h = headline_hash(title)
        if h in state["seen"]:
            continue  # 이미 처리한 뉴스

        # Level 1: 키워드 필터
        level = keyword_level(title)
        if not level:
            state["seen"][h] = datetime.now(KST).isoformat()
            continue

        logging.info("  🔍 [%s] %s", level, title[:80])

        # Level 2: VIX 확인 (CRITICAL은 VIX와 무관하게 통과)
        if level == "HIGH" and not vix_checked:
            elevated, vix_val, vix_pct = vix_is_elevated()
            vix_checked = True
            logging.info("  VIX: %.1f (%+.1f%% / 30분) — elevated=%s", vix_val, vix_pct, elevated)
            if not elevated:
                logging.info("  → VIX 정상, 스킵")
                state["seen"][h] = datetime.now(KST).isoformat()
                continue
        elif level == "HIGH" and vix_checked:
            # 이미 VIX를 확인했고 elevated 여부를 재사용
            if not (vix_val > 25 or vix_pct > 15):
                state["seen"][h] = datetime.now(KST).isoformat()
                continue

        # Level 3: Gemini 스코어링 (선택적)
        score, reason = 0, ""
        if GOOGLE_API_KEY and level == "HIGH":
            score, reason = gemini_score(title)
            logging.info("  Gemini 스코어: %d/10 — %s", score, reason[:60])
            if score < 7:
                logging.info("  → 충격도 낮음 (%d/10), 스킵", score)
                state["seen"][h] = datetime.now(KST).isoformat()
                continue

        # 알림 전송
        msg = format_alert(news, level, vix_val, vix_pct, score, reason)
        if send_telegram(msg):
            alerted += 1
            state["alerts_sent"] = state.get("alerts_sent", 0) + 1

        state["seen"][h] = datetime.now(KST).isoformat()

        # 한 실행당 최대 3건 알림 (스팸 방지)
        if alerted >= 3:
            logging.info("최대 알림 횟수(3) 도달 — 나머지 생략")
            break

    logging.info("=== 완료: %d건 알림, 누적 %d건 ===",
                 alerted, state.get("alerts_sent", 0))
    save_state(state)
    return 0


if __name__ == "__main__":
    sys.exit(main())
