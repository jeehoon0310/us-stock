# CI/CD Flow — US Stock Deploy Pipeline

> **출처**: book-finder Actions run `23688587201` (2026-03-28) 로그 재구성 + us-stock 현행 `.github/workflows/deploy.yml` 분석
> **다이어그램**: [ci-flow.drawio](./ci-flow.drawio)

book-finder 의 실제 성공 로그를 뜯어서 us-stock 배포 파이프라인이 어떻게 흘러야 하는지 복원한 문서입니다. 개별 라인 번호는 `logs_62426821527/0_build-and-deploy.txt` 기준.

---

## 1. 전체 플로우 요약

```
Developer Mac
    │ git push origin main
    ▼
GitHub Repo (webhook)
    │ workflow: build-and-deploy 트리거
    ▼
┌──────────────────── GitHub Actions runner (ubuntu-latest) ────────────────────┐
│ ① Checkout          ② Setup Buildx      ③ Login GHCR       ④ Metadata        │
│ ⑤ Build & Push ─────────────────────▶ GHCR: ghcr.io/.../us-stock:latest       │
│                                                                                │
│ ⑥ Connect to Tailscale (tailscale/github-action@v3, authkey 인증)              │
│    └─ runner 가 tailnet 합류 (Ephemeral node)                                  │
│                                                                                │
│ ⑦ SSH to Synology (appleboy/ssh-action@v1)                                     │
│    ├─ sudo docker login ghcr.io                                                │
│    ├─ sudo docker pull ghcr.io/.../us-stock:latest                             │
│    ├─ curl docker-compose.prod.yml → diff → mv if changed                      │
│    ├─ sudo docker compose down                                                 │
│    ├─ sudo docker compose up -d                                                │
│    ├─ sudo docker image prune -f                                               │
│    └─ curl /api/health (loop × 30) → exit 0/1                                  │
└────────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
Synology 컨테이너 (listen :8889)
    ▲
    │ (런타임 요청 경로 — 배포와 분리)
User Browser → DNS → ASUS WAN:443 → Synology LAN → DSM Reverse Proxy → :8889
```

---

## 2. Phase 0 — Developer Push

| 트리거 | 설명 |
|---|---|
| `git push origin main` | 로컬 또는 `scripts/run_and_commit.sh` 가 daily 커밋 후 push |
| 또는 `workflow_dispatch` | GitHub UI 수동 실행 |

워크플로우 정의: `.github/workflows/deploy.yml`

---

## 3. Phase 1 — GitHub Actions Image Build

ubuntu-latest runner 에서 순차 실행되는 6 스텝.

### 3.1 Checkout

```yaml
- uses: actions/checkout@v4
```

레포를 runner workspace 에 clone. us-stock 은 public 이므로 추가 토큰 불필요.

### 3.2 Set up Docker Buildx

```yaml
- uses: docker/setup-buildx-action@v3
```

멀티플랫폼 빌드 + GHA 캐시 지원을 위해 Buildx 활성화.

### 3.3 Login to GHCR

```yaml
- uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

자동 생성 `GITHUB_TOKEN` 으로 GHCR 로그인. `permissions.packages: write` 권한 필수.

### 3.4 Extract Metadata

```yaml
- uses: docker/metadata-action@v5
  with:
    images: ghcr.io/${{ github.repository }}
    tags: |
      type=raw,value=latest,enable={{is_default_branch}}
      type=sha,prefix=
      type=raw,value={{date 'YYYYMMDD-HHmm'}},enable={{is_default_branch}}
```

3개 태그 동시 부여: `latest`, `sha`, `YYYYMMDD-HHmm`. 태그 기반 롤백 가능.

### 3.5 Build & Push

```yaml
- uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    platforms: linux/amd64
    tags: ${{ steps.meta.outputs.tags }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

3-stage Next.js 빌드 → `ghcr.io/jeehoon0310/us-stock:latest` 푸시. 캐시는 GitHub Actions cache 에 저장(레이어 재사용).

**→ 이 시점 이미지가 GHCR 에 올라감. 여기까지는 us-stock 도 성공 확인됨.**

---

## 4. Phase 2 — Tailscale Connect (근본 원인 구간)

```yaml
- name: Connect to Tailscale
  uses: tailscale/github-action@v3
  with:
    authkey: ${{ secrets.TAILSCALE_AUTHKEY }}
```

### 4.1 book-finder 로그에서 본 내부 동작 (L2336~2835)

| 라인 | 이벤트 |
|---|---|
| L2336 | `##[warning]Input 'authkey' has been deprecated` ← **non-fatal 경고** |
| L2339 | `authkey: ***` ← GitHub 가 secret 값을 마스킹 해서 주입 |
| L2438 | `Resolved Tailscale version: 1.82.0` |
| L2614 | `Downloading https://pkgs.tailscale.com/stable/tailscale_1.82.0_amd64.tgz` |
| L2622 | `tailscale.tgz: OK` (sha256 검증 통과) |
| L2680 | `sudo -E tailscaled ...` (daemon 시작) |
| L2781 | `tailscale up --authkey=${TAILSCALE_AUTHKEY} --hostname=... --accept-routes` |
| L2831 | `TAILSCALE_AUTHKEY: ***` (환경변수로 주입) |
| L2835 | `Attempt 1 to bring up Tailscale...` |
| L2836 | 바로 다음 스텝인 `appleboy/ssh-action@v1` 시작 → **tailscale up 성공**, 15.8초 소요 |

### 4.2 us-stock 에서 실패한 이유

- `TAILSCALE_AUTHKEY` 시크릿이 us-stock 레포에 **등록되어 있지 않음** (`gh secret list` 로 확인)
- v3 action 이 빈 authkey 를 받자 OAuth fallback 을 시도 → `OAuth identity empty` 에러
- GitHub Actions 시크릿은 **레포 범위(repository-scoped)** 라 book-finder 에 등록된 값이 us-stock 에 자동 상속되지 않음

### 4.3 `@v3` vs `@v2` — 버전 다운그레이드 불필요

- book-finder 로그가 증명: **v3 에서도 authkey 파라미터는 정상 동작** (경고만 뜸)
- v3 가 OAuth 를 "권장" 하긴 하지만 authkey fallback 제거는 안 함
- 따라서 해결책은 단순히 **us-stock 에 `TAILSCALE_AUTHKEY` 시크릿 등록**

---

## 5. Phase 3 — SSH Deploy to Synology

```yaml
- name: Deploy to Synology
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.SYNOLOGY_HOST }}    # tailnet IP
    username: ${{ secrets.SYNOLOGY_USERNAME }}
    key: ${{ secrets.SYNOLOGY_SSH_KEY }}
    port: ${{ secrets.SYNOLOGY_PORT }}
    script: | ...
```

Tailscale 으로 runner ↔ Synology SSH 터널이 열린 상태에서 스크립트 실행.

### 5.1 book-finder 의 실제 스크립트 (L2842~2864)

```bash
echo "$GHCR_TOKEN" | sudo /usr/local/bin/docker login ghcr.io -u jeehoon0310 --password-stdin
sudo /usr/local/bin/docker pull ghcr.io/jeehoon0310/book-finder:latest
cd /volume1/docker/book-finder
curl -sfL -H "Authorization: token $GHCR_TOKEN" \
  "https://raw.githubusercontent.com/jeehoon0310/book-finder/main/docker-compose.prod.yml" \
  -o docker-compose.yml.new
if ! diff -q docker-compose.yml docker-compose.yml.new > /dev/null 2>&1; then
  sudo mv docker-compose.yml.new docker-compose.yml
else
  rm docker-compose.yml.new
fi
sudo /usr/local/bin/docker compose down
sudo /usr/local/bin/docker compose up -d
sudo /usr/local/bin/docker image prune -f
for i in $(seq 1 30); do
  curl -sf http://localhost:3000/api/health && echo " ✅ OK" && exit 0
  sleep 2
done
echo "❌ Health check failed"
sudo /usr/local/bin/docker logs book-finder --tail=50
exit 1
```

**핵심 관찰**: 모든 docker 명령이 `sudo` 로 실행됨. 이는 Synology DSM 의 SSH 사용자가 `docker` 그룹에 없고, NOPASSWD sudo 로만 docker 를 쓸 수 있도록 설정되어 있다는 신호.

### 5.2 us-stock 현재 스크립트의 문제

`.github/workflows/deploy.yml` 에서 docker 명령이 `sudo` 없이 호출됨:

```bash
/usr/local/bin/docker pull ghcr.io/jeehoon0310/us-stock:latest
# ↓ Synology 에서 permission denied 발생 예상
```

**수정 필요**: 6곳(login, pull, compose down, compose up, prune, logs)에 `sudo` 추가 (book-finder 패턴 정렬).

### 5.3 Healthcheck 루프

```bash
for i in $(seq 1 30); do
  curl -sf http://localhost:8889/api/health && echo " OK" && exit 0
  sleep 2
done
```

**최대 60초** 안에 `/api/health` 가 200 반환하지 않으면 exit 1 → workflow failure → 이전 이미지로 자동 롤백(실제로는 안 함, 다음 수동 재시도 필요).

---

## 6. Phase 4 — End-User Access (런타임 경로)

**주의**: 이 경로는 **Tailscale 을 경유하지 않음**. Tailscale 은 CI/CD 전용.

```
User Browser
    │
    ▼ HTTPS GET https://edu.frindle.synology.me
    │
DNS resolution (frindle.synology.me → 공용 IP)
    │
    ▼
ASUS Router (WAN 443 port-forward → LAN Synology IP)
    │
    ▼
Synology DSM Login Portal → Reverse Proxy
    │ edu.frindle.synology.me (443) → localhost:8889
    │ Let's Encrypt TLS 자동 갱신
    ▼
us-stock container (Next.js standalone, listen :8889)
```

### 왜 Tailscale 을 런타임에 쓰지 않는가

- Tailscale 은 end-user 가 설치할 수 없음 (일반 브라우저 접근이 목적)
- ASUS 포트포워드 + DSM 역방향 프록시가 이미 HTTPS 서비스를 공개하고 있음
- Tailscale 은 **CI runner ↔ Synology SSH** 에만 필요 (SSH 포트는 WAN 에 절대 열지 않음 → 보안)

---

## 7. 필수 GitHub Secrets

| Secret | 용도 | 제공 주체 | us-stock 현재 상태 |
|---|---|---|---|
| `GITHUB_TOKEN` | GHCR push/pull 인증 | GitHub 자동 생성 | ✅ 자동 |
| `SYNOLOGY_HOST` | SSH 타겟 (tailnet IP 또는 DDNS) | 사용자 등록 | ✅ 등록됨 |
| `SYNOLOGY_PORT` | Synology SSH 포트 | 사용자 등록 | ✅ 등록됨 |
| `SYNOLOGY_USERNAME` | SSH 로그인 계정 | 사용자 등록 | ✅ 등록됨 |
| `SYNOLOGY_SSH_KEY` | PEM 형식 private key | 사용자 등록 | ✅ 등록됨 |
| **`TAILSCALE_AUTHKEY`** | **Tailscale CI 인증** | **사용자 등록** | **❌ 미등록 ← 실패 원인** |

`gh secret list` 로 확인:
```
SYNOLOGY_HOST      2026-04-11T10:11:59Z
SYNOLOGY_PORT      2026-04-11T10:12:00Z
SYNOLOGY_SSH_KEY   2026-04-11T10:12:02Z
SYNOLOGY_USERNAME  2026-04-11T10:12:01Z
```

---

## 8. Tailscale Auth Key 발급/관리 가이드

### 8.1 키 수명 개념

| 속성 | book-finder 현재 키 | 권장값 |
|---|---|---|
| **Reusable** | ✓ | ✓ (여러 run, 여러 레포 공유 가능) |
| **Ephemeral** | ✓ | ✓ (run 종료 시 노드 자동 삭제) |
| **Pre-approved** | ? | ✓ (디바이스 승인 자동화) |
| **Expiration** | 2026-06-26 (~90일) | 90~180일 |
| **Tag** | 없음/tag:ci | tag:ci 권장 (ACL 에서 범위 제한) |

### 8.2 한 번 등록하면 매 실행마다 갱신 불필요

- **Reusable** 이므로 동일 키로 수백 번 CI 돌려도 OK
- **Ephemeral** 노드는 session 종료 시 자동 소멸 (노드 목록에 쌓이지 않음)
- **키 자체는 expiration 전까지 유효** → 보통 3개월마다 1회 갱신

### 8.3 기존 book-finder 키를 us-stock 에도 재사용 가능?

**원칙**: YES. 같은 키를 여러 레포의 `TAILSCALE_AUTHKEY` 시크릿으로 복사 등록 가능.

**제약**: GitHub Actions 시크릿은 **write-only**. 한 번 저장한 값은 UI 에서 볼 수 없음. 또한 Tailscale admin 도 생성 직후 한 번만 `tskey-auth-...` 원본을 보여준 뒤 보여주지 않음.

**분기**:

```
원본 tskey-auth-... 를 저장해둔 곳이 있는가?
  ├─ YES → 그 값을 us-stock 의 TAILSCALE_AUTHKEY 에 붙여넣기 → 끝
  └─ NO  → Tailscale admin 에서 새 키 발급 (기존 키는 그대로 둬도 공존 가능)
           → 새 키를 us-stock 에 등록
           → (선택) book-finder 도 새 키로 갱신하면 관리 일원화
```

### 8.4 새 키 발급 절차

1. https://login.tailscale.com/admin/settings/keys 접속
2. "Generate auth key..." 클릭
3. 옵션 체크:
   - **Reusable** ✓
   - **Ephemeral** ✓
   - **Pre-approved** ✓
   - Expiration: 90일 (기본) 또는 180일
   - Description: `us-stock CI` (또는 `shared CI`)
4. "Generate key" → **생성 화면에서만 보이는 `tskey-auth-…` 전체 문자열을 반드시 복사** (패스워드 매니저 저장 권장)
5. GitHub 레포 → Settings → Secrets and variables → Actions → "New repository secret"
   - Name: `TAILSCALE_AUTHKEY`
   - Secret: 복사한 키
6. Add secret → 완료

---

## 9. us-stock 복구 액션 아이템

| # | 작업 | 누구 | 소요 |
|---|---|---|---|
| 1 | Tailscale 에서 auth key 발급 (새 키 또는 기존 키 재사용) | 사용자 (브라우저) | 2분 |
| 2 | GitHub 레포 us-stock Settings 에 `TAILSCALE_AUTHKEY` 시크릿 등록 | 사용자 (브라우저) | 1분 |
| 3 | `.github/workflows/deploy.yml` 의 docker 명령 6곳에 `sudo` 추가 | Claude (커밋) | 1분 |
| 4 | 커밋 + push → CI 재실행 관찰 | Claude | 5분 |
| 5 | 브라우저 검증: `https://edu.frindle.synology.me/api/health` | 사용자 | 1분 |
| 6 | 브라우저 검증: `/daily_report.html` 렌더링 확인 | 사용자 | 1분 |

**총 소요**: 약 11분

---

## 10. 트러블슈팅 체크리스트

### Tailscale 단계 실패 시

- [ ] `gh secret list` 로 `TAILSCALE_AUTHKEY` 등록 확인
- [ ] Tailscale admin 에서 해당 키 status 가 `active` 인지 확인
- [ ] 키 expiration 미지남 확인
- [ ] `tag:ci` 사용 시 ACL 에 tag 정의 포함 여부
- [ ] 로그에서 `Attempt 1 to bring up Tailscale...` 이후 성공 메시지 찾기

### SSH Deploy 단계 실패 시

- [ ] `sudo docker ...` 로 실행 중인지 확인 (ours 에 추가 필요)
- [ ] Synology SSH 사용자가 NOPASSWD sudo for `/usr/local/bin/docker` 권한 보유 확인
- [ ] `SYNOLOGY_HOST` 가 tailnet IP (100.x.x.x) 또는 DNS 인지 확인
- [ ] Synology 에서 `docker info` 수동 실행 성공 여부

### Healthcheck 단계 실패 시

- [ ] 컨테이너 로그: `sudo docker logs us-stock --tail=80`
- [ ] `curl -v http://localhost:8889/api/health` 로컬 호출
- [ ] 포트 바인딩: `sudo docker port us-stock`
- [ ] compose 파일의 PORT/HOSTNAME 환경변수 확인

---

## 11. 참고 자료

- **로그 출처**: `/Users/frindle/Downloads/logs_62426821527/0_build-and-deploy.txt` (3181 lines)
- **book-finder 성공 run**: https://github.com/jeehoon0310/book-finder/actions/runs/23688587201/job/69012146595
- **us-stock 실패 run**: https://github.com/jeehoon0310/us-stock/actions/runs/24285665340
- **Tailscale GitHub Action**: https://github.com/tailscale/github-action
- **Tailscale 키 관리 문서**: https://tailscale.com/kb/1085/auth-keys
- **appleboy/ssh-action**: https://github.com/appleboy/ssh-action
- **다이어그램**: [ci-flow.drawio](./ci-flow.drawio) (99 cells: 67 vertices + 30 edges)
