#!/usr/bin/env python3
"""
각 페이지 스크린샷 캡처 → archive/legacy-dashboard/images/ 저장
사용법: .venv/bin/python3 .scripts/take_screenshots.py
전제조건: localhost:3000 (Next.js dev server) 구동 중이어야 함
"""

import sys
import time
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("playwright 미설치. 설치 중...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "playwright"], check=True)
    subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
    from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"
OUT_DIR = Path(__file__).parent.parent / "archive" / "legacy-dashboard" / "images"

PAGES = [
    ("edu.frindle.synology.me_1.png", "/",          "Overview · 종합 판정"),
    ("edu.frindle.synology.me_2.png", "/regime",    "Market Regime · 시장 체제"),
    ("edu.frindle.synology.me_3.png", "/top-picks", "Top Picks · Smart Money"),
    ("edu.frindle.synology.me_4.png", "/ai",        "AI Analysis · 투자 논지"),
    ("edu.frindle.synology.me_5.png", "/forecast",  "Index Forecast · SPY/QQQ"),
    ("edu.frindle.synology.me_6.png", "/ml",        "ML Rankings · GBM 스크리닝"),
]


def take_screenshots():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
        )
        page = context.new_page()

        for filename, path, label in PAGES:
            url = BASE_URL + path
            out_path = OUT_DIR / filename
            print(f"  [{label}] {url} → {filename}")

            page.goto(url, wait_until="networkidle", timeout=30000)
            # SideNav 완전 렌더링 대기 (데이터 로딩)
            time.sleep(1.5)

            page.screenshot(path=str(out_path), full_page=True)
            size = out_path.stat().st_size // 1024
            print(f"    ✓ {out_path.name} ({size} KB)")

        browser.close()

    print(f"\n완료: {len(PAGES)}개 스크린샷 → {OUT_DIR}")


if __name__ == "__main__":
    print(f"스크린샷 캡처 시작 ({BASE_URL})")
    print("※ localhost:3000 dev server가 구동 중이어야 합니다\n")
    take_screenshots()
