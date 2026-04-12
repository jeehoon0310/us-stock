# CI/CD Flow v2 — US Stock Deploy Pipeline

> **버전**: v2 (2026-04-12)
> **소스**: 2026-04-12 debug 세션 (10+ 실패 run → 최종 성공) 전체 forensics
> **다이어그램**: [ci-flow.drawio](./ci-flow.drawio)
> **이전 버전**: v1 (2026-04-11, commit `01c5b1f`) — book-finder 과거 로그 기반 재구성본, 실제 흐름과 불일치

---

## 1. TL;DR

GitHub Actions ubuntu-latest runner 가 이미지를 빌드해서 GHCR 에 푸시한 뒤, **Tailscale tailnet 에 ephemeral node 로 가입**한다. 그 상태에서 `appleboy/ssh-action@v1` 이 Synology 의 **tailnet IP `100.93.245.113` 의 포트 `28080`** 으로 SSH 연결을 시도하고, Synology 쪽의 **`tailscaled` 가 userspace 모드로 로컬 sshd 에 TCP 릴레이**한다. sshd 관점에서는 source IP 가 `127.0.0.1` 로 보인다. 이후 `sudo docker compose up -d` 로 컨테이너를 교체하고 `/api/health` 폴링으로 검증. **핵심은 포트 28080 과 Tailscale 경로 — ASUS WAN 포트포워드는 CI 경로에 사용하지 않는다.**

---

## 2. Context — 왜 v2 를 만드는가

v1 문서는 2026-04-11 에 book-finder 의 **과거 성공 run 로그**(run `23688587201`, 2026-03-28) 한 개만을 가지고 us-stock 배포 파이프라인을 역공학했다. 당시에는 book-finder 의 실제 secret 값을 볼 수 없었고, SSH 경로가 WAN 포트포워드인지 Tailscale 인지 모호한 상태로 서술했다.

2026-04-12 에 us-stock CI/CD 가 10회 이상 연속 실패했고, 사용자의 명시적 허가 하에 Synology 에 SSH 접속해서 forensics 를 수행했다. 그 결과 **v1 문서의 핵심 부분이 잘못돼 있음**이 밝혀졌다.

v2 의 목적:
- 실제 동작하는 구조를 정확히 그리고 설명
- 관리자 SSH(WAN) 와 CI/CD SSH(Tailscale) 두 경로를 명확히 분리
- Synology 내부 forensics 결과를 보존 (재현 가능한 진단)
- 10개 실패 run 의 postmortem — 동일 실수 반복 방지
- Tailscale 키 rotation runbook
- 에러 메시지 기반 troubleshooting matrix

---

## 3. What v1 got wrong

| v1 의 설명 | 실제 | 근거 |
|---|---|---|
| "Tailscale 은 CI/CD 전용 부가 경로" | **유일한 작동 경로** — ASUS WAN 은 CI 에서 차단됨 | 오늘 10 run 중 9 run 이 WAN 경로로 실패 |
| "SSH 포트는 일반 22 또는 22211" | 실제는 `28080` (내부 sshd), ASUS 가 외부 22211→28080 forward | `sudo ss -tlnp` 출력 |
| "SSH source IP 는 runner 의 외부 IP" | **`127.0.0.1`** (tailscaled userspace proxy) | `/var/log/auth.log` 증거 |
| "ASUS 포트포워드가 CI 경로에 사용됨" | 사용 안 됨. LAN/hairpin 전용 | GitHub runner 에서 `i/o timeout` |
| "deploy.yml 이 `sudo` 패턴 없이도 동작" | `sudo` 필수 (DSM 사용자는 `docker` 그룹 아님, NOPASSWD sudo 로만) | book-finder `deploy.yml` 확인 |

---

## 4. Architecture diagram

전체 구조는 [ci-flow.drawio](./ci-flow.drawio) 참조. 6개 수평 존 + 세 가지 병렬 경로 (CI 배포 / End-user HTTPS / Admin SSH) 가 시각화돼 있다.

```
Developer Mac
  │ git push
  ▼
GitHub Actions (ubuntu-latest)
  ├─ Build image → GHCR
  └─ Join tailnet (TAILSCALE_AUTHKEY)
        │
        ▼ TCP connect 100.93.245.113:28080
Tailscale tailnet (WireGuard)
        │
        ▼
Synology tailscale0 interface
  └─ tailscaled (userspace proxy)
        │
        ▼ local TCP from 127.0.0.1
  sshd :28080
        │
        ▼ sudo
  docker compose pull + up -d
        │
        ▼
  us-stock container (listen :8889)

━━━ 별도 런타임 경로 ━━━

End-user browser
  └─ HTTPS → ASUS WAN 443
        └─ DSM reverse proxy → container :8889
```

---

## 5. Three distinct network paths

시스템에는 **세 가지 독립된 네트워크 경로**가 존재한다. 각각 용도와 동작 방식이 다르다.

| # | 경로 | 용도 | 진입점 | 최종 목적지 | 현재 상태 |
|---|---|---|---|---|---|
| 5.1 | Admin SSH | 사람이 수동 관리 | ASUS WAN `:22211` → LAN `192.168.1.10:28080` | sshd `:28080` | LAN/hairpin NAT 에서만 동작, 외부 차단 |
| 5.2 | CI/CD SSH | GitHub Actions runner | Tailscale mesh `100.93.245.113:28080` | tailscaled → 로컬 sshd `127.0.0.1:28080` | ✅ 유일한 CI 경로 |
| 5.3 | End-user HTTPS | 브라우저 사용자 | ASUS WAN `:443` → LAN `192.168.1.x:443` | DSM reverse proxy → container `:8889` | ✅ 공개 서비스 |

### 5.1 Admin SSH (WAN + hairpin NAT)

사용자가 Mac 에서 직접 명령:
```bash
ssh -t jeehoon@frindle.asuscomm.com -p 22211
```

경로: Mac → DNS(`frindle.asuscomm.com` → `125.129.119.209`) → ASUS WAN 22211 → LAN `192.168.1.10:28080` → sshd

**핵심**: 이 경로는 **LAN 안에서 또는 hairpin NAT 로 내부 에서만 동작**한다. 외부 (예: GitHub Actions runner) 에서 같은 WAN 경유 접근 시 `i/o timeout`. 원인은 ASUS AiProtection / Geo-IP / ISP-level SSH 차단 중 하나로 추정됨 (오늘 미확정).

### 5.2 CI/CD SSH (Tailscale → tailscaled → local sshd) ★

GitHub Actions runner 관점의 동작:
```bash
# 1. tailscale/github-action@v3 이 runner 를 tailnet 에 가입
sudo tailscale up --authkey=$TAILSCALE_AUTHKEY --accept-routes

# 2. appleboy/ssh-action@v1 이 tailnet IP 로 SSH
ssh -p 28080 jeehoon@100.93.245.113 "$REMOTE_SCRIPT"
```

Synology 관점:
1. WireGuard 패킷이 `tailscale0` interface 로 들어옴 (100.93.245.113)
2. `tailscaled` 가 userspace 모드로 패킷을 직접 수신
3. 대상이 로컬 (`:28080`) 이므로 tailscaled 가 `127.0.0.1:28080` 으로 로컬 TCP 소켓 오픈하고 데이터 relay
4. sshd 는 `from 127.0.0.1 port <random>` 으로 연결을 수신 (source IP 가 loopback 으로 나타나는 결정적 증거)
5. 정상 publickey 인증 후 session 시작

**이 경로는 외부 네트워크에 SSH 를 노출하지 않는다.** 즉 ASUS WAN 22211 이 잠겨 있어도 CI 가 동작함.

### 5.3 End-user HTTPS (WAN 443 → DSM Reverse Proxy)

```
Browser → DNS (edu.frindle.synology.me → 125.129.119.209)
       → ASUS WAN 443
       → LAN 192.168.1.x:443
       → DSM Reverse Proxy (HAProxy, Let's Encrypt TLS)
       → us-stock container :8889 (또는 book-finder container :3000)
```

**이 경로는 외부에서 잘 동작한다**. ASUS 443 포트포워드가 정상 동작하며, GitHub Actions runner 도 이 경로로 us-stock HTTP 를 읽을 수 있음 (배포 검증용 `curl https://edu.frindle.synology.me/api/health` 등).

---

## 6. The key insight: tailscaled userspace proxy

Synology 의 `tailscaled` 프로세스:
```
tailscale+ 11457 /volume1/@appstore/Tailscale/bin/tailscaled
  --state=/volume1/@appdata/Tailscale/tailscaled.state
  --socket=/volume1/@appdata/Tailscale/tailscaled.sock
  --port=41641
```

DSM Package Center 경유로 설치된 Tailscale 은 **userspace 모드**로 동작한다:
- Linux kernel 의 `netfilter` 를 건드리지 않음 (kernel module 불필요, root 권한 제한)
- 대신 tailscaled 가 TUN 디바이스(`tailscale0`) 의 패킷을 userspace 에서 직접 처리
- 들어온 TCP 세그먼트를 해석한 뒤 **로컬 루프백 주소로 직접 TCP 소켓을 오픈**해서 relay
- 결과: 피어에서 `100.93.245.113:28080` 으로 보낸 연결이 최종적으로 `127.0.0.1:28080` 으로 로컬 접속으로 재탄생

이 동작 때문에 sshd 의 auth.log 에 다음과 같이 기록된다:
```
Apr 12 09:32:24 frindle01 sshd[27842]: Accepted publickey for jeehoon from 127.0.0.1 port 55340 ssh2: ED25519 SHA256:...
                                                                         ↑↑↑↑↑↑↑↑↑
                                                                         tailscaled proxy!
```

**`from 127.0.0.1`** 이 결정적 단서였다. v1 을 쓸 때는 이 단서가 없어서 source IP 가 runner 의 외부 IP 라고 가정했다.

---

## 7. Why WAN port forward doesn't work for external CI

ASUS 라우터에는 분명히 port forward 규칙이 설정돼 있다: `WAN 22211 → LAN 192.168.1.10:28080`. Mac 에서 이 경로로 SSH 하면 잘 동작한다:

```bash
$ ssh -p 22211 jeehoon@frindle.asuscomm.com
# → SSH_OK
```

하지만 GitHub Actions runner 에서 같은 경로로 접근하면 **항상** `dial tcp 125.129.119.209:***: i/o timeout` 에러:

```
2026/04/12 00:27:45 dial tcp 125.129.119.209:***: i/o timeout
##[error]Process completed with exit code 1.
```

**가능한 원인들**:
1. **ASUS AiProtection "Two-Way IPS"** — 외부 SSH 스캐너 방지 기능이 non-KR 소스 IP 를 차단 (가장 유력)
2. **ASUS Geo-IP filter** — 지역 기반 차단
3. **ISP 레벨 차단** — 일부 한국 ISP 가 비표준 포트로의 인바운드 TCP 를 차단 (드물지만 가능)
4. **ASUS NAT session 제한** — 외부 소스 IP 는 NAT 테이블 등록 안 됨

정확한 원인은 미확정이지만, **결론은 명확**: CI/CD 는 이 경로에 의존하지 말 것. Tailscale 경로를 써라.

Mac 에서는 왜 동작하는가:
- Mac 이 LAN (`192.168.219.x`) 안에 있어서 hairpin NAT 혜택을 받을 가능성
- 또는 Mac 의 Tailscale client 가 DNS 나 route 를 통해 실제로는 tailnet 경로로 처리할 수 있음 (이 Mac 은 Tailscale 설치됨)
- 또는 ASUS 가 특정 source IP 범위만 허용

따라서 "Mac 에서 되니까 CI 에서도 되어야 한다" 는 가정은 **오늘 디버깅의 가장 큰 함정**이었다.

---

## 8. GitHub Actions Workflow Breakdown

`.github/workflows/deploy.yml` 의 실제 스텝:

```yaml
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      # ① 이미지 빌드 섹션
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=sha,prefix=
            type=raw,value={{date 'YYYYMMDD-HHmm'}},enable={{is_default_branch}}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          platforms: linux/amd64
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # ② Tailscale tailnet 가입
      - uses: tailscale/github-action@v3
        with:
          authkey: ${{ secrets.TAILSCALE_AUTHKEY }}
          # 결과: runner 가 ephemeral node 로 tailnet 에 조인

      # ③ 원격 배포 (SSH via Tailscale)
      - uses: appleboy/ssh-action@v1
        env:
          GHCR_PULL_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          host: ${{ secrets.SYNOLOGY_HOST }}       # 100.93.245.113
          username: ${{ secrets.SYNOLOGY_USERNAME }} # jeehoon
          key: ${{ secrets.SYNOLOGY_SSH_KEY }}      # RSA private
          port: ${{ secrets.SYNOLOGY_PORT }}        # 28080
          envs: GHCR_PULL_TOKEN
          script: |
            set -e
            echo "$GHCR_PULL_TOKEN" | sudo /usr/local/bin/docker login ghcr.io -u jeehoon0310 --password-stdin
            sudo /usr/local/bin/docker pull ghcr.io/jeehoon0310/us-stock:latest
            sudo mkdir -p /volume1/docker/us-stock
            cd /volume1/docker/us-stock
            curl -sfL "https://raw.githubusercontent.com/jeehoon0310/us-stock/main/docker-compose.prod.yml" -o docker-compose.yml.new
            if ! diff -q docker-compose.yml docker-compose.yml.new > /dev/null 2>&1; then
              sudo mv docker-compose.yml.new docker-compose.yml
            else
              rm docker-compose.yml.new
            fi
            sudo /usr/local/bin/docker compose down || true
            sudo /usr/local/bin/docker compose up -d
            sudo /usr/local/bin/docker image prune -f
            for i in $(seq 1 30); do
              curl -sf http://localhost:8889/api/health && echo " OK" && exit 0
              sleep 2
            done
            echo "Health check failed"
            sudo /usr/local/bin/docker logs us-stock --tail=80
            exit 1
```

---

## 9. Current Secret Values (us-stock, 2026-04-12 final)

| Secret | 값 | 설명 |
|---|---|---|
| `SYNOLOGY_HOST` | `100.93.245.113` | Synology 의 Tailscale IP (frindle01) |
| `SYNOLOGY_PORT` | `28080` | 내부 sshd 리슨 포트 (ASUS 22211 아님) |
| `SYNOLOGY_USERNAME` | `jeehoon` | DSM 사용자 계정 (NOPASSWD sudo for docker) |
| `SYNOLOGY_SSH_KEY` | RSA private key (`~/.ssh/id_rsa` 원본) | Mac 에서 검증된 키, Synology `~jeehoon/.ssh/authorized_keys` 에 등록됨 |
| `TAILSCALE_AUTHKEY` | `tskey-auth-k0Kh1QDzEu11CNTRL-…` (key ID prefix, 전체 값은 GitHub secret + 패스워드 매니저에만 저장) | Reusable + Ephemeral + Pre-approved. **Rotated 2026-04-12 10:38 KST**: 구 1일 키 (`kPs0i2c8yd11CNTRL`, Apr 12→Apr 13) 폐기 → 신 키 (**Expiry: Jul 11, 2026**, 약 90일). us-stock + book-finder 양쪽 레포 동시 갱신 완료. |
| `GITHUB_TOKEN` | 자동 | workflow 실행 시 GitHub 가 주입, `packages:write` 포함 |

**주의**: GitHub Actions secret 은 **write-only** — 설정 후 값을 다시 볼 수 없음. 원본은 반드시 패스워드 매니저 등에 저장할 것.

---

## 10. Synology-side Forensics

오늘 `ssh -t jeehoon@frindle.asuscomm.com -p 22211` 로 직접 접속해서 수집한 실제 출력:

### 10.1 sshd 리슨 포트

```bash
$ sudo ss -tlnp 2>/dev/null | grep -i ssh
tcp   0   0   0.0.0.0:28080   0.0.0.0:*   LISTEN   13290/sshd: /usr/bi
tcp6  0   0   :::28080        :::*        LISTEN   13290/sshd: /usr/bi
```

→ sshd 는 **0.0.0.0:28080** (모든 인터페이스) 에서만 리슨. 포트 22 는 열려 있지 않음.

### 10.2 sshd_config 핵심 설정

```bash
$ sudo grep -Ei '^(port|listenaddress|allowusers|permitrootlogin|passwordauth|pubkeyauth)' /etc/ssh/sshd_config
PasswordAuthentication no
```

→ 포트 지시자가 없음 → 기본 22 여야 하는데 실제 28080 → **systemd unit 또는 DSM 관리 스크립트에서 `-p 28080` 주입**하는 것으로 추정 (DSM 시스템 설정)

### 10.3 네트워크 인터페이스

```bash
$ ip -4 addr show
    inet 127.0.0.1/8 scope host lo
    inet 192.168.1.11/24 brd 192.168.1.255 scope global ovs_eth0
    inet 169.254.163.55/16 brd 169.254.255.255 scope global ovs_eth1
    ...
    inet 192.168.1.10/24 brd 192.168.1.255 scope global ovs_eth4
    inet 172.30.0.1/24 brd ... scope global docker-c4b1ed48
    ...다수의 docker bridge
```

→ LAN 은 `192.168.1.0/24`, Synology 는 `.10` 과 `.11` 두 개 보유. Docker 브리지 다수. `tailscale0` 인터페이스는 `ip addr` 에서 직접 보이지 않지만 `tailscale status` 에 `100.93.245.113` 으로 나타남.

### 10.4 Tailscale 바이너리 + 프로세스

```bash
$ ls -la /var/packages/Tailscale/target/bin/
drwxr-xr-x 1 tailscale tailscale       38 Mar 26 06:16 .
drwxr-xr-x 1 tailscale tailscale       18 Mar 28 21:15 ..
-rwxr-xr-x 1 tailscale tailscale 31400929 Mar 26 06:16 tailscale
-rwxr-xr-x 1 tailscale tailscale 40529197 Mar 26 06:16 tailscaled

$ ps auxww | grep tailscal
tailsca+ 11457 /volume1/@appstore/Tailscale/bin/tailscaled
  --state=/volume1/@appdata/Tailscale/tailscaled.state
  --socket=/volume1/@appdata/Tailscale/tailscaled.sock
  --port=41641
```

→ DSM Package Center 를 통해 설치된 Tailscale. 실행 중인 tailscaled 는 WireGuard 포트 41641 사용. `--netfilter-mode` 플래그 없음 → 기본 userspace 모드.

### 10.5 auth.log — 성공 패턴 (결정적 증거)

```bash
$ sudo grep -E 'Accepted' /var/log/auth.log | tail -5
Apr 12 09:26:23 frindle01 sshd[18454]: Accepted publickey for jeehoon from 182.231.6.223 port 64570 ssh2: RSA SHA256:fz9duMmJUWARmCu2Z7ZvyqAU87IsdKjXXHE/45xiYn8
Apr 12 09:32:24 frindle01 sshd[27842]: Accepted publickey for jeehoon from 127.0.0.1 port 55340 ssh2: ED25519 SHA256:PZj60fGIM/7HNbRK2QfG0uB+4KD8H3dJTZZmN2cmhc8
Apr 12 09:33:30 frindle01 sshd[29876]: Accepted publickey for jeehoon from 182.231.6.223 port 65213 ssh2: RSA SHA256:fz9duMmJUWARmCu2Z7ZvyqAU87IsdKjXXHE/45xiYn8
```

두 가지 source IP 패턴:
- `182.231.6.223` — **사용자 Mac 의 공용 IP** (ASUS WAN IP 와 다름), RSA 키
- `127.0.0.1` — **tailscaled 가 userspace relay 한 CI 연결**, ED25519 키 (book-finder 전용)

09:32:24 KST 가 book-finder 의 성공한 배포 run (`24294950861`) 의 SSH 진입 시각과 일치. 직후 09:32:25 에 `sudo docker pull ghcr.io/jeehoon0310/book-finder:latest` 가 실행됨.

### 10.6 iptables / firewall

```bash
$ sudo iptables -t nat -L PREROUTING -n -v
iptables: No chain/target/match by that name.

$ sudo iptables -L INPUT -n
[DEFAULT rules only, no custom blocks]

$ sudo iptables -L FORWARD -n
Chain DEFAULT_FORWARD (1 references)
DOCKER-USER / DOCKER-ISOLATION / ACCEPT RELATED,ESTABLISHED / ...
```

→ NAT PREROUTING 체인 없음 (DSM 이 특별한 방식으로 외부 포트 매핑 처리). Synology 방화벽은 기본 상태로, 외부 SSH 를 막는 규칙 없음. 따라서 **ASUS WAN 차단은 ASUS 측 설정**에 기인하지 Synology 쪽은 아님.

---

## 11. Today's Postmortem — 10개 실패 run 의 타임라인

| # | Run ID | 시각 (UTC) | 변경 사항 | 결과 | 근본 원인 |
|---|---|---|---|---|---|
| 1 | 24280292131 | 2026-04-11 10:11 | 초기 Python 이미지 배포 | ❌ Python CPU 부족 | 아키텍처 오설계 |
| 2 | 24285483390 | 2026-04-11 15:22 | Next.js 전환 첫 push | ❌ Tailscale auth | `TAILSCALE_AUTHKEY` 미등록 |
| 3 | 24285665340 | 2026-04-11 15:32 | 포트 8889 복원 + daily_report | ❌ Tailscale auth | 동일 |
| 4 | 24293965553 | 2026-04-11 23:27 | ci-flow docs 추가 | ❌ Tailscale auth | 동일 |
| 5 | 24294503304 | 2026-04-12 00:01 | `TAILSCALE_AUTHKEY` 신규 등록 + `SYNOLOGY_HOST=100.93.245.113` | ❌ Deploy refused | HOST ok, PORT 틀림 (22211 → 리슨 안 함) |
| 6 | 24294911351 | 2026-04-12 00:26 | `SYNOLOGY_HOST=frindle.asuscomm.com`, `PORT=22211`, `USERNAME=jeehoon` | ❌ Deploy timeout | WAN 경로 외부 차단 |
| 7 | 24295022040 | 2026-04-12 00:33 | `sudo` 패턴 추가 + `SSH_KEY` 갱신 | ❌ Deploy timeout | 여전히 WAN 경로 |
| 8 | 24295099500 | 2026-04-12 00:38 | `HOST=100.93.245.113`, `PORT=22` | ❌ Deploy refused | Tailscale IP ok, 22 포트에 sshd 없음 |
| 9 | (book-finder 24294950861) | 2026-04-12 00:32 | 비교용 book-finder 트리거 | ✅ | book-finder 에 정답 config 있음 |
| 10 | 24295344032 | 2026-04-12 00:45 | `HOST=100.93.245.113`, `PORT=28080` | ✅ **성공** | 정답 |

핵심 교훈:
- **Mac 에서 성공한 SSH ≠ CI 에서 성공 보장** — 네트워크 경로가 다름 (hairpin NAT / Tailscale vs 외부 IP)
- **비교 가능한 성공 사례를 즉시 트리거**해라 — book-finder 배포를 진단 용도로 돌리자 원인 파악이 빨라짐
- **auth.log 의 source IP 는 결정적 단서** — `from 127.0.0.1` 을 보지 못했으면 tailscaled userspace proxy 가설에 도달 못했음
- **`nc -z` port scan 으로 실제 리슨 포트를 확인**하는 습관

---

## 12. Tailscale Auth Key Lifecycle

### 12.1 왜 rotation 이 중요한가

- Tailscale auth key 는 **수명 (expiration)** 이 있음
- 키 만료 시 GitHub Actions 가 tailnet 에 가입 못 함 → CI 전체 실패
- Synology 와 Mac 같은 **이미 가입된 머신**은 영향 없음 (machine key 를 별도 보유)
- 영향 받는 대상: **ephemeral CI node**

### 12.2 새 키 발급 (브라우저)

1. https://login.tailscale.com/admin/settings/keys 접속
2. "Generate auth key..." 클릭
3. 옵션:
   - **Reusable**: ✅
   - **Ephemeral**: ✅
   - **Pre-approved**: ✅
   - **Expiration**: **90 days** 또는 **180 days** (1일은 절대 금지 — 어제 실수)
   - **Tags**: 선택 (`tag:ci` 등, ACL 에 정의돼 있어야 함)
   - Description: `us-stock + book-finder CI`
4. Generate → **`tskey-auth-...` 전체 문자열 즉시 복사** (생성 화면에서만 보임)
5. 패스워드 매니저에 저장: "Tailscale CI key" 항목 생성

### 12.3 GitHub 에 등록 (gh CLI)

```bash
# us-stock
gh secret set TAILSCALE_AUTHKEY --body "tskey-auth-..." -R jeehoon0310/us-stock

# book-finder (같은 키 재사용)
gh secret set TAILSCALE_AUTHKEY --body "tskey-auth-..." -R jeehoon0310/book-finder

# 확인
gh secret list -R jeehoon0310/us-stock | grep TAILSCALE
gh secret list -R jeehoon0310/book-finder | grep TAILSCALE
```

### 12.4 구 키 정리

- Tailscale admin 에서 구 키의 **Revoke** 클릭 (즉시 무효) 또는 자연 만료 대기
- 주의: 구 키로 가입된 ephemeral 노드는 자동 소멸되므로 현재 진행 중인 CI 에 영향 없음

### 12.5 갱신 주기 권장

- **90일마다 1회** 또는 **만료 1주일 전**
- 달력 리마인더 / GitHub 레포에 `SECURITY.md` 로 기록
- 이상적으로는 Tailscale OAuth client 전환 (자동 rotation) — 향후 개선

### 12.6 Rotation history

실제 rotation 발생 기록. 이 문서를 업데이트할 때마다 최상단에 한 줄 추가.

| 날짜 (KST) | 구 키 ID | 신 키 ID | 신 키 만료 | 대상 레포 | 사유 |
|---|---|---|---|---|---|
| 2026-04-12 10:38 | `kPs0i2c8yd11CNTRL` (Apr 12→**Apr 13**, 1일) | `k0Kh1QDzEu11CNTRL` | **Jul 11, 2026** (~90일) | us-stock + book-finder | 초기 발급 시 Expiration 기본값이 1일이어서 내일 만료 예정 → 장기 키로 교체 |
| 2026-04-12 08:23 | `k5y08ixfm011CNTKL` (Mar 28→Jun 26, 90일, book-finder 전용) | `kPs0i2c8yd11CNTRL` (1일 — 실수) | 2026-04-13 | us-stock 신규 등록 + book-finder 갱신 | us-stock 에 처음으로 TAILSCALE_AUTHKEY 등록 시도. Expiration 1일로 잘못 선택 |
| 2026-03-28 22:36 | — | `k5y08ixfm011CNTKL` | 2026-06-26 (90일) | book-finder 초기 등록 | 최초 발급 |

**⚠️ Pitfall 주의**: Tailscale admin UI 에서 "Generate auth key..." 모달을 열면 Expiration 드롭다운의 기본 선택이 **1 day** 로 시작하는 것으로 보임. 반드시 **90 days** 또는 **180 days** 로 명시적으로 바꾸고 Generate 클릭할 것.

---

## 13. Troubleshooting Playbook

에러 메시지 → 원인 → 해결 매핑:

| 에러 메시지 | 위치 | 가능한 원인 | 해결 |
|---|---|---|---|
| `dial tcp X.X.X.X:***: i/o timeout` | GitHub Actions log | `SYNOLOGY_HOST` 가 외부 IP (`125.x.x.x`) | `gh secret set SYNOLOGY_HOST --body "100.93.245.113"` |
| `dial tcp X.X.X.X:***: connect: connection refused` | GitHub Actions log | 포트 잘못 (22 나 22211) | `gh secret set SYNOLOGY_PORT --body "28080"` |
| `kex_exchange_identification: Connection closed` | Synology `/var/log/auth.log` | 키 불일치 또는 중간 단절 | `SSH_KEY` 재등록, Tailscale 가입 상태 확인 |
| `Permission denied (publickey)` | GitHub Actions log | Key 인증 실패 | Synology `~jeehoon/.ssh/authorized_keys` 에 pubkey 있는지 확인, `AllowUsers` 확인 |
| `OAuth identity empty` | tailscale/github-action log | `TAILSCALE_AUTHKEY` secret 누락/만료 | 새 키 발급 + `gh secret set TAILSCALE_AUTHKEY` |
| `Input 'authkey' has been deprecated` | tailscale/github-action log | ⚠️ 경고일 뿐 (non-fatal), 액션은 정상 동작 | 무시 or v3 → OAuth 전환 (향후) |
| `Health check failed` 후 exit 1 | SSH script log | 컨테이너가 `/api/health` 에 200 반환 실패 | `sudo docker logs us-stock --tail=80`, `compose.yml` 의 PORT/HOSTNAME 확인 |
| `sudo: a password is required` | SSH script log | NOPASSWD sudo 설정 빠짐 | Synology `/etc/sudoers` 확인, 보통 `jeehoon ALL=(ALL) NOPASSWD: /usr/local/bin/docker` 필요 |

### 진단 명령 요약

```bash
# 1. GitHub Actions 최근 run 확인
gh run list --limit 5 --workflow=deploy.yml -R jeehoon0310/us-stock

# 2. 실패한 run 로그 보기
gh run view <RUN_ID> --log-failed -R jeehoon0310/us-stock

# 3. GitHub 시크릿 목록 (값은 못 읽음)
gh secret list -R jeehoon0310/us-stock

# 4. Mac 에서 Synology 로 직접 테스트 (hairpin 가능)
ssh -t jeehoon@frindle.asuscomm.com -p 22211

# 5. Tailscale 경로 직접 테스트
tailscale status
nc -z 100.93.245.113 28080
ssh -p 28080 jeehoon@100.93.245.113 "echo OK"

# 6. Synology 내부에서 (SSH 후)
sudo ss -tlnp | grep -i ssh           # sshd 리슨 포트 확인
sudo tail -30 /var/log/auth.log        # 최근 SSH 인증 로그
sudo /var/packages/Tailscale/target/bin/tailscale status  # Tailscale peer 목록
sudo docker ps                         # 실행 중인 컨테이너
sudo docker logs us-stock --tail=50    # 앱 로그
```

---

## 14. Rollback Plan

### 14.1 즉시 롤백 (컨테이너 손상)

```bash
ssh -t jeehoon@frindle.asuscomm.com -p 22211
cd /volume1/docker/us-stock
sudo docker compose down
# 구 sha 태그로 수동 교체
sudo docker pull ghcr.io/jeehoon0310/us-stock:<OLD_SHA>
sudo docker tag ghcr.io/jeehoon0310/us-stock:<OLD_SHA> ghcr.io/jeehoon0310/us-stock:latest
sudo docker compose up -d
curl http://localhost:8889/api/health
```

### 14.2 Workflow 롤백

```bash
# deploy.yml 이나 compose 파일 변경으로 배포가 깨진 경우
git log --oneline -10
git revert <BAD_COMMIT>
git push origin main
# → CI 재빌드 → 이전 이미지 버전이 latest 로 다시 푸시됨
```

### 14.3 시크릿 롤백

값의 원본을 저장해둔 경우에만 가능:
```bash
gh secret set SYNOLOGY_HOST --body "<old-value>" -R jeehoon0310/us-stock
```
원본 저장이 없으면 **새 값으로 재설정** 해야 함 (예: 시크릿 재발급 or 다시 발견).

---

## 15. References

### 외부 문서
- [Tailscale GitHub Action](https://github.com/tailscale/github-action)
- [appleboy/ssh-action](https://github.com/appleboy/ssh-action)
- [Tailscale Auth Keys](https://tailscale.com/kb/1085/auth-keys)
- [Tailscale userspace mode](https://tailscale.com/kb/1112/userspace-networking)
- [DSM 7.x SSH 설정](https://kb.synology.com/en-global/DSM/help/DSM/AdminCenter/system_terminal?version=7)
- [ASUS AiProtection](https://www.asus.com/support/FAQ/1034294/)

### 레포 내 관련 파일
- `.github/workflows/deploy.yml` — 배포 workflow
- `docker-compose.prod.yml` — Synology 용 compose
- `Dockerfile` — Next.js standalone 3-stage 빌드
- `dashboard-next/` — Next.js 앱 소스
- `docs/ci-flow.drawio` — 이 문서의 시각화 버전

### Book-finder 비교 자료
- `/Users/frindle/workspace/toon/book-finder/.github/workflows/deploy.yml` — 구조는 동일, secret 값은 별도
- book-finder run 23688587201 (2026-03-28 성공 로그) — v1 문서의 원 출처
- book-finder run 24294950861 (2026-04-12 오늘 재트리거 성공) — v2 검증용

---

## 16. Appendix — 오늘 사용한 gh 명령

### Secret 관리

```bash
# 전체 목록 확인 (값은 보이지 않음)
gh secret list -R jeehoon0310/us-stock

# 문자열 값 직접 등록
gh secret set SYNOLOGY_HOST --body "100.93.245.113" -R jeehoon0310/us-stock
gh secret set SYNOLOGY_PORT --body "28080" -R jeehoon0310/us-stock
gh secret set SYNOLOGY_USERNAME --body "jeehoon" -R jeehoon0310/us-stock

# 파일 내용을 그대로 등록 (SSH 키 등)
gh secret set SYNOLOGY_SSH_KEY -R jeehoon0310/us-stock < ~/.ssh/id_rsa

# 삭제
gh secret delete SECRET_NAME -R jeehoon0310/us-stock
```

### Workflow 제어

```bash
# 수동 트리거
gh workflow run deploy.yml -R jeehoon0310/us-stock --ref main

# 최근 run 목록 (JSON)
gh run list --limit 5 --workflow=deploy.yml -R jeehoon0310/us-stock \
  --json databaseId,status,conclusion,displayTitle,createdAt

# Run 진행 watch (blocking, 완료 시 exit code 반환)
gh run watch <RUN_ID> -R jeehoon0310/us-stock --exit-status

# 전체 구조 확인 (job + step 단위)
gh run view <RUN_ID> -R jeehoon0310/us-stock --json conclusion,jobs

# 실패한 스텝 로그만 추출
gh run view <RUN_ID> -R jeehoon0310/us-stock --log-failed

# 전체 로그 (grep 가능)
gh run view <RUN_ID> -R jeehoon0310/us-stock --log
```

### 네트워크 진단

```bash
# Tailscale CLI (Mac)
tailscale status
tailscale ip -4 <hostname>
tailscale ping 100.93.245.113

# Port 스캔
nc -z -w 3 <host> <port>
for p in 22 2222 22022 28080; do nc -z -w 1 100.93.245.113 $p && echo "$p OPEN"; done

# SSH verbose (어떤 키로 인증되는지 확인)
ssh -v -p <port> <user>@<host> exit

# 전체 문서 포트/호스트 확인
curl -sI https://edu.frindle.synology.me/api/health
```

### Synology 내부 진단 (SSH 후)

```bash
# sshd 리슨 포트
sudo ss -tlnp 2>/dev/null | grep -i ssh

# Tailscale 상태
sudo /var/packages/Tailscale/target/bin/tailscale status
sudo /var/packages/Tailscale/target/bin/tailscale status --json

# 최근 SSH 로그 (source IP 포함)
sudo grep -E 'Accepted|Failed' /var/log/auth.log | tail -20

# Docker 상태
sudo /usr/local/bin/docker ps
sudo /usr/local/bin/docker logs us-stock --tail=50
sudo /usr/local/bin/docker compose -f /volume1/docker/us-stock/docker-compose.yml ps
```

---

**문서 끝.** 이 문서가 다음 번 CI/CD 이슈 디버깅에 참고될 때, 오늘 쓴 시간을 또 쓰지 않도록 하는 것이 목적이다.
