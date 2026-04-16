import { useState } from "react";

const data = {
  sectors: [
    {
      id: "semiconductor",
      icon: "⚡",
      name: "반도체 (Semiconductor)",
      color: "#FF6B35",
      description: "AI 연산의 핵심. GPU, HBM, 커스텀 ASIC이 AI 인프라의 심장",
      marketSize: "$975B (2026 전체 반도체)",
      growth: "YoY +25%",
      stocks: [
        { ticker: "NVDA", name: "NVIDIA", role: "AI GPU 절대 강자", detail: "2025-26 AI칩 매출 $1,800억+, 시장 지배력 80%+", risk: "밸류에이션 부담, 커스텀ASIC 경쟁" },
        { ticker: "TSM", name: "TSMC", role: "파운드리 독점", detail: "3nm/5nm 풀 북킹 (2026년까지), NVIDIA·Apple·AMD 제조", risk: "지정학적 리스크(대만)" },
        { ticker: "AVGO", name: "Broadcom", role: "커스텀 ASIC + 네트워킹", detail: "Google TPU, Meta MTIA 설계, AI 매출 급성장", risk: "VMware 통합 리스크" },
        { ticker: "AMD", name: "AMD", role: "GPU 2위 + CPU", detail: "MI300X로 데이터센터 GPU 시장 진입, NVIDIA 대안", risk: "GPU 소프트웨어 생태계 열세" },
        { ticker: "MRVL", name: "Marvell", role: "커스텀 AI칩(XPU)", detail: "Amazon·Microsoft 커스텀칩 설계, DPU/네트워킹", risk: "소규모, 고객 집중도" },
      ],
      etfs: [
        { ticker: "SMH", name: "VanEck Semiconductor ETF", fee: "0.35%", note: "NVDA 비중 높음, 10년 연환산 27%+" },
        { ticker: "SOXX", name: "iShares Semiconductor ETF", fee: "0.35%", note: "30종목 분산, 메모리·장비 균형" },
        { ticker: "CHPS", name: "Xtrackers Semiconductor ETF", fee: "0.09%", note: "최저 보수, 균등 비중" },
      ]
    },
    {
      id: "memory",
      icon: "💾",
      name: "메모리/저장장치 (Memory & Storage)",
      color: "#00B4D8",
      description: "HBM 슈퍼사이클. AI 서버당 메모리 탑재량 급증, 2026년 DRAM 매출 +51%",
      marketSize: "$440B+ (2026 메모리)",
      growth: "DRAM +51%, NAND +45%",
      stocks: [
        { ticker: "000660.KS", name: "SK하이닉스", role: "HBM 세계 1위 (점유율 62%)", detail: "HBM4 개발 완료, NVIDIA Rubin 플랫폼 공급, UBS 전망 HBM4 점유율 70%", risk: "용량 제약, 가격 변동성" },
        { ticker: "MU", name: "Micron", role: "미국 유일 메모리 (HBM 3위)", detail: "2026 HBM 공급 전량 사전계약 완료, 매출 $700억 전망(2024년 2배)", risk: "커모디티 사이클 민감" },
        { ticker: "005930.KS", name: "삼성전자", role: "종합 반도체 + 메모리", detail: "12층 HBM4 수율 문제 해결, 파운드리+메모리 시너지", risk: "AI GPU 미보유, 파운드리 경쟁력 이슈" },
        { ticker: "STX", name: "Seagate", role: "데이터센터 HDD", detail: "HAMR 기반 Mozaic 4+ (4TB/디스크), AI 데이터 저장 수요", risk: "SSD 대체 리스크" },
        { ticker: "WDC", name: "Western Digital", role: "NAND + HDD", detail: "엔터프라이즈 SSD 수요 급증, AI 학습 데이터 저장", risk: "HBM/DRAM 미보유" },
      ],
      etfs: [
        { ticker: "SOXX", name: "iShares Semiconductor ETF", fee: "0.35%", note: "MU 최대 비중(8.5%)" },
        { ticker: "SMH", name: "VanEck Semiconductor ETF", fee: "0.35%", note: "MU, TSM 포함" },
      ]
    },
    {
      id: "datacenter",
      icon: "🏢",
      name: "데이터센터 (Data Center REITs)",
      color: "#7209B7",
      description: "AI 공장의 물리적 공간. 하이퍼스케일러 리스 수요 폭증, 2026년 $400B+ 투자",
      marketSize: "$400B+ CapEx (2026)",
      growth: "전력밀도 3배 증가 (45kW/랙)",
      stocks: [
        { ticker: "EQIX", name: "Equinix", role: "글로벌 최대 데이터센터 REIT", detail: "2027년까지 24,000+ 신규 캐비닛, 70개국 260+ DC", risk: "금리 민감, 높은 밸류에이션" },
        { ticker: "DLR", name: "Digital Realty", role: "하이퍼스케일 DC 전문", detail: "AI 고밀도 업그레이드, 리퀴드쿨링 도입, 배당 2.8%", risk: "금리 상승 시 REIT 압박" },
        { ticker: "IRM", name: "Iron Mountain", role: "데이터관리 + DC", detail: "전통 스토리지에서 DC로 전환, 높은 배당", risk: "레거시 사업 축소" },
        { ticker: "CRWV", name: "CoreWeave", role: "AI 전용 네오클라우드", detail: "2025 IPO, GPU-as-a-Service, 하이퍼스케일러 대안", risk: "수익성 미증명, 높은 부채" },
      ],
      etfs: [
        { ticker: "DTCR", name: "Global X Data Center ETF", fee: "0.50%", note: "DC REIT + 디지털 인프라 직접 노출" },
        { ticker: "SRVR", name: "Pacer Data & Infra REIT ETF", fee: "0.60%", note: "DC REIT 중심, 규칙기반 인덱스" },
      ]
    },
    {
      id: "energy",
      icon: "☢️",
      name: "에너지/전력 (Energy & Power)",
      color: "#F72585",
      description: "AI의 최대 병목은 전력. 2025년 AI DC 전력사용 29.6GW(뉴욕주 수준). 원자력 르네상스",
      marketSize: "2030년 DC 전력 = 일본 전체",
      growth: "원자력 PPA 계약 폭증",
      stocks: [
        { ticker: "CEG", name: "Constellation Energy", role: "미국 최대 원자력 운영사", detail: "21기 원자로, MS와 TMI 재가동 20년 계약, Calpine $164억 인수", risk: "2026 가이던스 기대 하회, 규제 마찰" },
        { ticker: "VST", name: "Vistra", role: "2위 원자력 + 천연가스", detail: "5년 주가 +695%, Meta·AWS 장기 전력 계약, Cogentrix $47억 인수", risk: "P/E 58배(후행), 변동성 높음" },
        { ticker: "TLN", name: "Talen Energy", role: "원자력 + 데이터센터 캠퍼스", detail: "Susquehanna 원자력 옆 DC 직접 운영, AWS 계약", risk: "소규모, 유동성" },
        { ticker: "NEE", name: "NextEra Energy", role: "재생에너지 최대", detail: "풍력·태양광 1위, Alphabet과 원자력 재가동 협력", risk: "금리 민감, 재생에너지 정책 변동" },
        { ticker: "D", name: "Dominion Energy", role: "규제 유틸리티", detail: "40-47GW DC 신규 계약 협상 중, 버지니아 DC 허브", risk: "느린 성장, 규제 리스크" },
      ],
      etfs: [
        { ticker: "NLR", name: "VanEck Uranium & Nuclear ETF", fee: "0.56%", note: "원자력 운영사+우라늄+장비 분산" },
        { ticker: "URNM", name: "Sprott Uranium Miners ETF", fee: "0.75%", note: "우라늄 광산 집중, 고위험/고수익" },
      ]
    },
    {
      id: "infra",
      icon: "🌊",
      name: "서버/냉각/네트워킹 (Server & Cooling)",
      color: "#4CC9F0",
      description: "AI 서버 전력밀도 10배 증가 → 리퀴드쿨링 필수화. 네트워킹 800G 전환",
      marketSize: "AI 인프라 $30M/MW",
      growth: "리퀴드쿨링 80% 채택률(신규)",
      stocks: [
        { ticker: "VRT", name: "Vertiv", role: "DC 냉각/전력 인프라 1위", detail: "시총 $620억+, NVIDIA Rubin 쿨링 공동개발, 매출 80% DC향", risk: "밸류에이션 확장 한계" },
        { ticker: "ANET", name: "Arista Networks", role: "DC 이더넷 스위칭 1위", detail: "2025 매출 $90억(+29%), AI 네트워킹 매출 $32.5억 목표, Cisco 추월", risk: "고객 집중(Meta·MS)" },
        { ticker: "DELL", name: "Dell Technologies", role: "AI 서버 제조", detail: "PowerEdge AI 서버, 엔터프라이즈 AI 도입 수혜", risk: "마진 압박(부품 원가 상승 15-20%)" },
        { ticker: "MOD", name: "Modine Manufacturing", role: "열관리 전문", detail: "DC 열관리 특화 전환, 레거시 사업 분리 예정", risk: "소형주, 전환 실행 리스크" },
        { ticker: "ETN", name: "Eaton", role: "전력관리 장비", detail: "UPS·배전·마이크로그리드, DC 전력 인프라 필수", risk: "산업재 사이클" },
      ],
      etfs: [
        { ticker: "TCAI", name: "T. Rowe Price AI Infra ETF", fee: "0.65%", note: "컴퓨트·스토리지·네트워킹·전력 통합" },
        { ticker: "IGV", name: "iShares Expanded Tech ETF", fee: "0.41%", note: "소프트웨어 중심이나 인프라 일부 포함" },
      ]
    },
  ],
  strategies: [
    {
      name: "코어-위성 (Core-Satellite)",
      risk: "중간",
      desc: "70% 인덱스 ETF + 30% 개별주/테마 ETF",
      allocation: "SMH/SOXX 40% + DTCR 15% + NLR 15% + 개별주 30%",
    },
    {
      name: "밸류체인 분산 (Value Chain)",
      risk: "중간",
      desc: "AI 밸류체인 5개 레이어 균등 분산",
      allocation: "반도체 20% + 메모리 20% + DC 20% + 에너지 20% + 인프라 20%",
    },
    {
      name: "삽과곡괭이 (Picks & Shovels)",
      risk: "낮음~중간",
      desc: "AI 성패 무관, 인프라 공급자에 집중",
      allocation: "VRT + ANET + ETN + CEG + EQIX 중심 (AI 앱 제외)",
    },
    {
      name: "모멘텀 로테이션",
      risk: "높음",
      desc: "분기별 상위 성과 서브섹터 집중",
      allocation: "3개월 모멘텀 기준 상위 2개 섹터에 50%씩 배분",
    },
  ]
};

const SectorCard = ({ sector, isActive, onClick }) => (
  <div
    onClick={onClick}
    style={{
      padding: "16px",
      borderRadius: "12px",
      cursor: "pointer",
      background: isActive ? `${sector.color}15` : "var(--bg-card)",
      border: isActive ? `2px solid ${sector.color}` : "2px solid var(--border)",
      transition: "all 0.2s ease",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
      <span style={{ fontSize: "24px" }}>{sector.icon}</span>
      <span style={{ fontWeight: 700, fontSize: "15px", color: sector.color }}>{sector.name}</span>
    </div>
    <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{sector.description}</p>
    <div style={{ display: "flex", gap: "12px", marginTop: "10px", flexWrap: "wrap" }}>
      <span style={{ fontSize: "11px", background: `${sector.color}20`, color: sector.color, padding: "3px 8px", borderRadius: "6px", fontWeight: 600 }}>{sector.marketSize}</span>
      <span style={{ fontSize: "11px", background: `${sector.color}20`, color: sector.color, padding: "3px 8px", borderRadius: "6px", fontWeight: 600 }}>{sector.growth}</span>
    </div>
  </div>
);

const StockRow = ({ stock, color }) => (
  <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: "200px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, color, fontSize: "14px" }}>{stock.ticker}</span>
          <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>{stock.name}</span>
        </div>
        <div style={{ fontSize: "12px", color, fontWeight: 600, marginBottom: "4px" }}>{stock.role}</div>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{stock.detail}</div>
      </div>
      <div style={{ minWidth: "160px", fontSize: "11px", color: "#e74c3c", background: "#e74c3c15", padding: "6px 10px", borderRadius: "8px", lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600 }}>리스크:</span> {stock.risk}
      </div>
    </div>
  </div>
);

const EtfBadge = ({ etf, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: `${color}08`, borderRadius: "10px", border: `1px solid ${color}25` }}>
    <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, color, fontSize: "14px", minWidth: "50px" }}>{etf.ticker}</span>
    <div>
      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{etf.name}</div>
      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>보수 {etf.fee} · {etf.note}</div>
    </div>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [activeSector, setActiveSector] = useState("semiconductor");
  const sector = data.sectors.find(s => s.id === activeSector);

  const cssVars = {
    "--bg-main": "#0a0e17",
    "--bg-card": "#111827",
    "--border": "#1e293b",
    "--text-primary": "#e2e8f0",
    "--text-secondary": "#94a3b8",
    "--accent": "#3b82f6",
  };

  return (
    <div style={{ ...cssVars, background: "var(--bg-main)", color: "var(--text-primary)", minHeight: "100vh", fontFamily: "'Segoe UI', -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "28px" }}>🔌</span>
            <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, background: "linear-gradient(135deg, #FF6B35, #F72585, #7209B7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              AI 인프라 투자 전략 2026
            </h1>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
            에너지 · 데이터센터 · 반도체 · 메모리 · 서버/냉각 — 5대 밸류체인 투자 가이드
          </p>
          <div style={{ display: "flex", gap: "6px", marginTop: "12px", padding: "4px", background: "var(--bg-card)", borderRadius: "10px", flexWrap: "wrap" }}>
            {[
              { id: "overview", label: "시장 현황" },
              { id: "stocks", label: "종목 분석" },
              { id: "strategy", label: "포트폴리오 전략" },
              { id: "risk", label: "리스크 & 주의사항" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "8px 16px", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600,
                  background: activeTab === tab.id ? "var(--accent)" : "transparent",
                  color: activeTab === tab.id ? "#fff" : "var(--text-secondary)",
                  transition: "all 0.2s",
                }}
              >{tab.label}</button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div>
            <div style={{ background: "linear-gradient(135deg, #FF6B3510, #F7258510, #7209B710)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, marginTop: 0, marginBottom: "12px" }}>📊 2026년 AI 인프라 투자 핵심 수치</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                {[
                  { label: "하이퍼스케일러 CapEx", value: "$660-690B", sub: "MS·Alphabet·Amazon·Meta·Oracle" },
                  { label: "NVIDIA AI칩 매출", value: "$180B+", sub: "2025-26 합산" },
                  { label: "AI DC 전력소비", value: "29.6GW", sub: "뉴욕주 전체 수준 (2025말)" },
                  { label: "메모리 시장", value: "$440B+", sub: "DRAM +51%, NAND +45% YoY" },
                  { label: "반도체 전체 시장", value: "~$975B", sub: "+25% YoY, $1T 임박" },
                  { label: "DC 인프라 비용", value: "$30M/MW", sub: "AI 인프라, 기존 대비 10배" },
                ].map((item, i) => (
                  <div key={i} style={{ background: "var(--bg-card)", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#3b82f6" }}>{item.value}</div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginTop: "4px" }}>{item.label}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px" }}>🔗 AI 인프라 밸류체인 5대 섹터</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {data.sectors.map(s => (
                <SectorCard key={s.id} sector={s} isActive={false} onClick={() => { setActiveSector(s.id); setActiveTab("stocks"); }} />
              ))}
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: "14px", padding: "20px", marginTop: "20px", border: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, marginTop: 0, marginBottom: "10px" }}>💡 투자 테제 요약</h3>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                <p style={{margin: "0 0 10px 0"}}><strong style={{color: "var(--text-primary)"}}>핵심 논리:</strong> 5대 빅테크가 2026년에만 $660-690B을 AI 인프라에 투자합니다. 이 자금은 반도체 → 메모리 → 서버 → 데이터센터 → 전력 순으로 밸류체인을 타고 흘러갑니다.</p>
                <p style={{margin: "0 0 10px 0"}}><strong style={{color: "var(--text-primary)"}}>최대 병목:</strong> 자본이 아닌 "전력"이 DC 건설의 최대 제약. IEA 전망: 2030년 DC 전력소비 = 일본 전체. 원자력 르네상스 가속 중.</p>
                <p style={{margin: 0}}><strong style={{color: "var(--text-primary)"}}>투자 프레임:</strong> AI 앱/모델의 성패와 무관하게, 인프라 공급자(삽과 곡괭이)는 구조적 수혜. 단, CapEx 사이클 리스크 관리 필수.</p>
              </div>
            </div>
          </div>
        )}

        {/* Stocks Tab */}
        {activeTab === "stocks" && (
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              {data.sectors.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSector(s.id)}
                  style={{
                    padding: "8px 14px", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                    background: activeSector === s.id ? `${s.color}25` : "var(--bg-card)",
                    color: activeSector === s.id ? s.color : "var(--text-secondary)",
                    border: activeSector === s.id ? `1px solid ${s.color}50` : "1px solid var(--border)",
                  }}
                >{s.icon} {s.name.split(" (")[0]}</button>
              ))}
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: "14px", padding: "20px", border: "1px solid var(--border)", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                <span style={{ fontSize: "24px" }}>{sector.icon}</span>
                <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: sector.color }}>{sector.name}</h2>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>{sector.description}</p>

              <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>📈 주요 종목</h3>
              {sector.stocks.map((stock, i) => (
                <StockRow key={i} stock={stock} color={sector.color} />
              ))}

              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "20px 0 10px", color: "var(--text-primary)" }}>📦 관련 ETF</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {sector.etfs.map((etf, i) => (
                  <EtfBadge key={i} etf={etf} color={sector.color} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Strategy Tab */}
        {activeTab === "strategy" && (
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, marginTop: 0, marginBottom: "16px" }}>🎯 포트폴리오 구성 전략</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
              {data.strategies.map((s, i) => (
                <div key={i} style={{ background: "var(--bg-card)", borderRadius: "14px", padding: "18px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>{s.name}</h3>
                    <span style={{
                      fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "6px",
                      background: s.risk === "높음" ? "#e74c3c20" : s.risk === "중간" ? "#f39c1220" : "#27ae6020",
                      color: s.risk === "높음" ? "#e74c3c" : s.risk === "중간" ? "#f39c12" : "#27ae60",
                    }}>리스크: {s.risk}</span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 8px 0" }}>{s.desc}</p>
                  <div style={{ fontSize: "12px", color: "var(--accent)", background: "var(--accent)10", padding: "8px 12px", borderRadius: "8px", fontWeight: 500 }}>
                    💼 {s.allocation}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "linear-gradient(135deg, #3b82f610, #7209B710)", borderRadius: "14px", padding: "20px", border: "1px solid var(--border)", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, marginTop: 0 }}>🇰🇷 한국 투자자 실전 팁</h3>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                <p style={{margin: "0 0 8px 0"}}><strong style={{color: "#FF6B35"}}>세금:</strong> 해외주식 양도소득세 22% (₩250만 기본공제). 손익상계 활용 필수. SK하이닉스·삼성전자는 국내 주식이므로 2025년부터 금투세 적용 여부 확인</p>
                <p style={{margin: "0 0 8px 0"}}><strong style={{color: "#00B4D8"}}>증권사:</strong> 삼성증권(최저 수수료), 미래에셋(큰 플랫폼), IBKR(옵션·다중통화, 넥스트증권 투자)</p>
                <p style={{margin: "0 0 8px 0"}}><strong style={{color: "#7209B7"}}>환율:</strong> 원화 약세 시 미국 주식 원화 수익 증가. 대규모 포지션은 환헤지 고려 (2025년 정부 선물환 상품 도입)</p>
                <p style={{margin: 0}}><strong style={{color: "#F72585"}}>국내 대안:</strong> SK하이닉스(000660), 삼성전자(005930), 한미반도체(042700), 두산에너빌리티(034020) 등으로 국내 포트폴리오 보완 가능</p>
              </div>
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: "14px", padding: "20px", border: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, marginTop: 0 }}>🔄 추천 리밸런싱 프레임워크</h3>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                <p style={{margin: "0 0 6px 0"}}>• <strong style={{color: "var(--text-primary)"}}>분기 점검:</strong> 하이퍼스케일러 CapEx 가이던스 변화, 섹터별 모멘텀 스코어 재산정</p>
                <p style={{margin: "0 0 6px 0"}}>• <strong style={{color: "var(--text-primary)"}}>반기 리밸런싱:</strong> 밸류체인 내 상대 밸류에이션 비교 → 과열 섹터 비중 축소</p>
                <p style={{margin: "0 0 6px 0"}}>• <strong style={{color: "var(--text-primary)"}}>트리거 이벤트:</strong> NVIDIA 신제품(Rubin/Vera), 원전 재가동 승인, 관세/수출규제 변동</p>
                <p style={{margin: 0}}>• <strong style={{color: "var(--text-primary)"}}>손절 규칙:</strong> 개별주 -20%, 섹터 ETF -15% 하회 시 비중 절반 축소 검토</p>
              </div>
            </div>
          </div>
        )}

        {/* Risk Tab */}
        {activeTab === "risk" && (
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, marginTop: 0, marginBottom: "16px" }}>⚠️ 핵심 리스크 요인</h2>

            {[
              { title: "CapEx 사이클 리스크", color: "#e74c3c", desc: "하이퍼스케일러의 AI 투자가 ROI를 입증하지 못하면 CapEx 삭감 가능. 2000년 닷컴 버블 때 유사한 인프라 과잉투자가 붕괴된 선례가 있음. CFO들이 이미 '결과를 보여달라'고 요구 중." },
              { title: "밸류에이션 버블 우려", color: "#f39c12", desc: "Vistra P/E 58배, Vertiv 급등 등 AI 인프라주 전반에 프리미엄 내재. 실적이 기대에 못 미치면(CEG 2026 가이던스 사례) 급락 가능. Forward P/E로 판단 필수." },
              { title: "지정학적/규제 리스크", color: "#9b59b6", desc: "미중 반도체 수출규제 강화, TSMC 대만 리스크, 원전 규제·허가 지연. 2026년 관세 정책 변동이 부품 원가에 직접 영향." },
              { title: "기술 전환 리스크", color: "#3498db", desc: "NVIDIA GPU → 커스텀 ASIC 전환 가속(Google TPU, Amazon Trainium), 리퀴드쿨링 표준 변화, HBM4→HBM4E 세대 교체. 기존 선두주자도 빠르게 뒤처질 수 있음." },
              { title: "전력 병목 현실화", color: "#1abc9c", desc: "전력이 자본보다 큰 제약. DC 건설은 2-3년, 원전 재가동은 5년+. 단기 수요-공급 미스매치가 프로젝트 지연 및 비용 초과로 이어질 수 있음." },
              { title: "집중도 리스크", color: "#e67e22", desc: "AI 인프라 테마에 과도하게 집중하면 시장 로테이션 시 큰 손실. 2025년 초 Mag7 급락(-10~29%) 사례. 전체 포트폴리오의 30-40% 이내 권장." },
            ].map((risk, i) => (
              <div key={i} style={{ background: "var(--bg-card)", borderRadius: "12px", padding: "16px", border: "1px solid var(--border)", marginBottom: "10px", borderLeft: `4px solid ${risk.color}` }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 6px 0", color: risk.color }}>{risk.title}</h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.7 }}>{risk.desc}</p>
              </div>
            ))}

            <div style={{ background: "#27ae6010", borderRadius: "14px", padding: "20px", border: "1px solid #27ae6030", marginTop: "20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, marginTop: 0, color: "#27ae60" }}>✅ 리스크 관리 체크리스트</h3>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 2 }}>
                <p style={{margin: 0}}>□ AI 인프라 테마 비중 전체 포트폴리오의 30-40% 이내 유지</p>
                <p style={{margin: 0}}>□ 5대 밸류체인 섹터 간 분산 (단일 섹터 50% 초과 금지)</p>
                <p style={{margin: 0}}>□ ETF(SMH, SOXX, DTCR)를 코어로, 개별주는 위성으로 제한</p>
                <p style={{margin: 0}}>□ 분기별 하이퍼스케일러 실적 발표 후 CapEx 방향 재점검</p>
                <p style={{margin: 0}}>□ 개별주 -20% 손절, 섹터 ETF -15% 비중 축소 규칙 설정</p>
                <p style={{margin: 0}}>□ 환율 변동 모니터링, 원화 강세 전환 시 환헤지 고려</p>
                <p style={{margin: 0}}>□ 양도소득세 ₩250만 공제 활용, 연말 손익상계 실행</p>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: "11px", color: "var(--text-secondary)", marginTop: "32px", padding: "16px", borderTop: "1px solid var(--border)" }}>
          ⚠️ 본 자료는 정보 제공 목적이며, 투자 권유가 아닙니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.
          <br/>데이터 기준: 2026년 4월 | 출처: Futurum, iShares, Morningstar, SK hynix, NASDAQ, Motley Fool 등
        </div>
      </div>
    </div>
  );
}
