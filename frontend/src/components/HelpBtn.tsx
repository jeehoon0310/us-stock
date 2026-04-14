"use client";
import { useState, useEffect } from "react";

// ── 도움말 데이터 (초등학생도 이해할 수 있는 수준) ──────────────────────────

const H = {
  green: "text-primary font-bold",
  yellow: "text-secondary font-bold",
  red: "text-error font-bold",
  blue: "text-tertiary font-bold",
  bold: "font-bold text-on-surface",
};

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-surface-container-high p-3 rounded-lg text-xs space-y-1 my-3 border border-outline-variant/10">
    {children}
  </div>
);

const Sec = ({ children }: { children: React.ReactNode }) => (
  <p className="font-bold text-on-surface text-sm mt-4 mb-1">{children}</p>
);

const HELP_DATA: Record<string, { title: string; body: React.ReactNode }> = {

  verdict: {
    title: "Verdict (판정) 이게 뭐야?",
    body: (
      <>
        <Sec>🚦 신호등이라고 생각하면 돼요!</Sec>
        <p>오늘 주식을 사도 되는지, 조심해야 하는지, 쉬어야 하는지를 <span className={H.bold}>신호등</span>처럼 알려줘요.</p>
        <Box>
          <p><span className={H.green}>GO (초록불)</span> = "지금 사도 좋아요!"</p>
          <p><span className={H.yellow}>CAUTION (노란불)</span> = "조심해서 사세요!"</p>
          <p><span className={H.red}>STOP (빨간불)</span> = "지금은 사지 마세요, 기다려요!"</p>
        </Box>
        <Sec>🗳️ 어떻게 결정해요?</Sec>
        <p>3명이 투표해요:</p>
        <Box>
          <p>1. <span className={H.bold}>Regime</span> (시장 체제) — 시장이 위험한지 안전한지</p>
          <p>2. <span className={H.bold}>Gate</span> (섹터 신호등) — 11개 업종 점수</p>
          <p>3. <span className={H.bold}>ML</span> (AI 로봇) — 다음 주에 오를 것 같은지</p>
        </Box>
        <p>3명 다 "좋다!" → <span className={H.green}>GO</span></p>
        <p>하나라도 "위험!" → <span className={H.red}>STOP</span></p>
        <p>나머지 → <span className={H.yellow}>CAUTION</span></p>
      </>
    ),
  },

  regime: {
    title: "Market Regime (시장 체제) 이게 뭐야?",
    body: (
      <>
        <Sec>🌡️ 시장의 체온계예요!</Sec>
        <p>사람이 아프면 열이 나듯, 주식 시장도 <span className={H.bold}>"지금 건강한지, 아픈지"</span> 측정하는 거예요.</p>
        <Sec>5개 센서로 측정해요</Sec>
        <Box>
          <p><span className={H.bold}>VIX (30%)</span> — 공포 지수. 숫자가 높으면 사람들이 무서워하는 중</p>
          <p><span className={H.bold}>Trend (25%)</span> — 주가가 오르는 중인지 내리는 중인지</p>
          <p><span className={H.bold}>Breadth (18%)</span> — 전체 주식 중 몇 개가 오르고 있는지</p>
          <p><span className={H.bold}>Credit (15%)</span> — 위험한 투자를 하는 사람이 많은지</p>
          <p><span className={H.bold}>Yield Curve (12%)</span> — 단기/장기 이자 차이</p>
        </Box>
        <Sec>결과는 4단계</Sec>
        <Box>
          <p><span className={H.green}>RISK ON</span> = 안전해요! 투자하기 좋은 날씨 ☀️</p>
          <p><span className={H.yellow}>NEUTRAL</span> = 보통이에요. 구름 좀 있어요 ⛅</p>
          <p><span className={H.red}>RISK OFF</span> = 조심! 비 올 것 같아요 🌧️</p>
          <p><span className={H.red}>CRISIS</span> = 위험! 태풍이에요! 🌪️</p>
        </Box>
      </>
    ),
  },

  gate: {
    title: "Sector Gate (섹터 신호등) 이게 뭐야?",
    body: (
      <>
        <Sec>🏢 11개 업종의 건강검진표예요!</Sec>
        <p>미국 주식은 <span className={H.bold}>11개 업종</span>으로 나뉘어요 (기술, 금융, 에너지, 건강 등).<br />
        각 업종마다 "잘하고 있어?" 점수를 매기고, 평균을 내요.</p>
        <Box>
          <p><span className={H.green}>BULLISH (초록)</span> = 이 업종 지금 잘 나가고 있어요 📈</p>
          <p><span className={H.yellow}>NEUTRAL (노랑)</span> = 그냥 보통이에요</p>
          <p><span className={H.red}>BEARISH (빨강)</span> = 이 업종 지금 힘들어요 📉</p>
        </Box>
        <Box>
          <p>전체 평균 <span className={H.bold}>70점 이상</span> → GO</p>
          <p>전체 평균 <span className={H.bold}>40~70점</span> → CAUTION</p>
          <p>전체 평균 <span className={H.bold}>40점 미만</span> → STOP</p>
        </Box>
      </>
    ),
  },

  ml: {
    title: "ML Predictor (AI 예측 로봇) 이게 뭐야?",
    body: (
      <>
        <Sec>🤖 AI 로봇이 다음 주를 예측해요!</Sec>
        <p>컴퓨터가 <span className={H.bold}>여러 가지 정보</span>를 보고, "다음 5일 동안 오를까? 내릴까?" 예측해요.</p>
        <Sec>SPY와 QQQ 두 개를 따로 예측해요</Sec>
        <Box>
          <p><span className={H.bold}>SPY</span> = 미국 대표 회사 500개 평균 (삼성+현대+SK 같은 거)</p>
          <p><span className={H.bold}>QQQ</span> = 미국 IT 회사 100개 평균 (애플+구글+테슬라 같은 거)</p>
        </Box>
        <Sec>결과 읽는 법</Sec>
        <Box>
          <p><span className={H.green}>▲ BULLISH</span> = "오를 것 같아요!" (황소가 뿔로 위로 들어올려요)</p>
          <p><span className={H.red}>▼ BEARISH</span> = "내릴 것 같아요!" (곰이 발로 아래로 내려쳐요)</p>
          <p><span className={H.bold}>Probability</span> = 오를 확률 (50% 넘으면 오를 가능성이 더 높아요)</p>
          <p><span className={H.bold}>Confidence</span> = AI가 얼마나 확신하는지 (HIGH=확신)</p>
        </Box>
      </>
    ),
  },

  picks: {
    title: "Stock Picks (추천 종목) 이게 뭐야?",
    body: (
      <>
        <Sec>🏆 컴퓨터가 뽑은 "공부 잘하는 학생" 명단이에요!</Sec>
        <p>수백 개 미국 주식 중에서 <span className={H.bold}>가장 좋아 보이는 종목</span>을 골라줘요.</p>
        <Sec>6가지를 보고 점수를 매겨요</Sec>
        <Box>
          <p><span className={H.bold}>기술 분석 (35%)</span> — 주가 그래프가 예쁜 모양인지</p>
          <p><span className={H.bold}>기본 분석 (20%)</span> — 회사가 돈을 잘 버는지</p>
          <p><span className={H.bold}>애널리스트 (15%)</span> — 전문가들이 "사라"고 했는지</p>
          <p><span className={H.bold}>상대 강도 (15%)</span> — 시장 평균보다 잘하고 있는지</p>
          <p><span className={H.bold}>거래량 (10%)</span> — 많은 사람들이 사고팔고 있는지</p>
          <p><span className={H.bold}>기관 투자 (5%)</span> — 큰 회사들이 이 주식을 사고 있는지</p>
        </Box>
      </>
    ),
  },

  grade: {
    title: "Grade (등급) 이게 뭐야?",
    body: (
      <>
        <Sec>📊 주식의 성적표예요!</Sec>
        <p>학교에서 A, B, C, D, F 등급 받는 것처럼, 주식도 점수에 따라 등급을 받아요.</p>
        <Box>
          <p><span className={H.green}>A (75점 이상)</span> = 최우수! "이 주식 정말 좋아요!"</p>
          <p><span className={H.blue}>B (62~74점)</span> = 우수! "꽤 괜찮아요"</p>
          <p><span className={H.yellow}>C (48~61점)</span> = 보통. "그저 그래요"</p>
          <p><span className={H.red}>D (35~47점)</span> = 미흡. "별로예요"</p>
          <p><span className={H.red}>F (35점 미만)</span> = 부진. "지금은 안 좋아요"</p>
        </Box>
      </>
    ),
  },

  strategy: {
    title: "Strategy (전략) 이게 뭐야?",
    body: (
      <>
        <Sec>🎯 "이 주식은 어떤 상황이야?" 알려줘요!</Sec>
        <Box>
          <p><span className={H.bold}>Trend (추세)</span> = 에스컬레이터를 타고 꾸준히 올라가는 중 📈</p>
          <p><span className={H.bold}>Swing (스윙)</span> = 그네처럼 왔다갔다 하는 중 🎢</p>
          <p><span className={H.bold}>Reversal (반전)</span> = 떨어지다가 바닥 찍고 올라오는 중 ⬆️</p>
        </Box>
      </>
    ),
  },

  setup: {
    title: "Setup (진입 패턴) 이게 뭐야?",
    body: (
      <>
        <Sec>🪜 지금 어디쯤 있는지 알려줘요!</Sec>
        <Box>
          <p><span className={H.bold}>Breakout (돌파)</span> = 벽을 뚫고 나가는 중! 🚀</p>
          <p><span className={H.bold}>Pullback (눌림)</span> = 올라가다 잠깐 쉬는 중. 계단에서 앉았다 일어나요 🪜</p>
          <p><span className={H.bold}>Base (바닥)</span> = 바닥에서 준비 중. 로켓 발사 대기 중 🛸</p>
          <p><span className={H.bold}>Reversal (반전)</span> = 내려가다 방향 바꾸는 중 ⬆️</p>
        </Box>
        <p className="text-[11px]">예: <span className={H.bold}>Trend/Breakout</span> = "꾸준히 오르다가 저항선을 뚫었어!" → 아주 좋은 신호!</p>
      </>
    ),
  },

  action: {
    title: "Action (행동 지침) 이게 뭐야?",
    body: (
      <>
        <Sec>🎬 "이 주식 어떻게 해?" 알려줘요!</Sec>
        <p>시장 상태(Verdict)와 주식 등급(Grade)을 합쳐서 <span className={H.bold}>"뭘 해야 할지"</span> 정해줘요.</p>
        <Box>
          <p><span className={H.green}>BUY (매수)</span> = "지금 사세요!" 시장 좋고 + 주식도 좋을 때</p>
          <p><span className={H.green}>SMALL BUY (소량 매수)</span> = "조금만 사세요!" 시장은 애매하지만 주식은 좋을 때</p>
          <p><span className={H.yellow}>WATCH (관망)</span> = "지켜보세요!" 아직 확실하지 않을 때</p>
          <p><span className="text-on-surface-variant font-bold">HOLD (보유)</span> = "가만히 기다리세요!" 시장이 안 좋을 때</p>
        </Box>
      </>
    ),
  },

  drivers: {
    title: "Key Drivers (핵심 요인) 이게 뭐야?",
    body: (
      <>
        <Sec>🔍 AI가 "왜 그렇게 생각했는지" 이유를 알려줘요!</Sec>
        <p>시험 볼 때 "왜 이 답 골랐어?" 설명하는 것처럼, AI도 <span className={H.bold}>가장 중요한 이유</span>를 보여줘요.</p>
        <Box>
          <p><span className={H.bold}>막대 길이</span> = 얼마나 중요한 이유인지 (길수록 중요!)</p>
          <p><span className={H.green}>BULLISH (초록)</span> = "이 신호는 오른다는 뜻이에요"</p>
          <p><span className={H.red}>BEARISH (빨강)</span> = "이 신호는 내린다는 뜻이에요"</p>
        </Box>
        <Sec>자주 나오는 이유들</Sec>
        <Box>
          <p><span className={H.bold}>spy_return_10d</span> — 최근 10일 수익률</p>
          <p><span className={H.bold}>spy_rsi14</span> — 과열/침체 지표 (RSI)</p>
          <p><span className={H.bold}>vix_value</span> — 공포 지수</p>
          <p><span className={H.bold}>spy_price_vs_20ma</span> — 20일 평균선 위/아래</p>
        </Box>
      </>
    ),
  },

  composite_score: {
    title: "Composite Score (종합 점수) 이게 뭐야?",
    body: (
      <>
        <Sec>🏅 6가지 점수를 합친 최종 성적이에요!</Sec>
        <p>주식을 6가지 방법으로 평가해서 하나의 점수로 합쳐요. 점수가 높을수록 지금 사기 좋은 주식이에요.</p>
        <Box>
          <p><span className={H.bold}>기술 분석 35%</span> + <span className={H.bold}>기업 가치 20%</span></p>
          <p><span className={H.bold}>전문가 의견 15%</span> + <span className={H.bold}>상대 강도 15%</span></p>
          <p><span className={H.bold}>거래량 10%</span> + <span className={H.bold}>기관 투자 5%</span></p>
        </Box>
        <Box>
          <p><span className={H.green}>75점 이상</span> = A등급 (매우 좋음)</p>
          <p><span className={H.yellow}>50~74점</span> = B/C등급 (보통)</p>
          <p><span className={H.red}>50점 미만</span> = D/F등급 (주의)</p>
        </Box>
      </>
    ),
  },

  technical_score: {
    title: "Technical Score (기술 분석) 이게 뭐야?",
    body: (
      <>
        <Sec>📈 주가 그래프를 보고 매기는 점수예요!</Sec>
        <p>주식의 가격이 어떻게 움직이는지 <span className={H.bold}>패턴을 분석</span>해서 점수를 줘요.</p>
        <Box>
          <p><span className={H.bold}>RSI</span> — 주식이 너무 많이 올랐는지(과열), 너무 떨어졌는지(침체) 확인</p>
          <p><span className={H.bold}>이동평균선</span> — 평균 가격보다 위에 있으면 좋은 신호</p>
          <p><span className={H.bold}>모멘텀</span> — 요즘 빠르게 오르고 있는지 확인</p>
        </Box>
        <p className="text-[11px]">점수가 높을수록 그래프 모양이 예쁘고 오를 것 같다는 뜻이에요!</p>
      </>
    ),
  },

  fundamental_score: {
    title: "Fundamental Score (기업 가치) 이게 뭐야?",
    body: (
      <>
        <Sec>🏭 회사가 얼마나 잘 운영되는지 보는 점수예요!</Sec>
        <p>주가 그래프가 아니라 <span className={H.bold}>회사 자체가 좋은지</span> 평가해요.</p>
        <Box>
          <p><span className={H.bold}>수익성</span> — 회사가 돈을 잘 버나요?</p>
          <p><span className={H.bold}>성장성</span> — 매출이 늘어나고 있나요?</p>
          <p><span className={H.bold}>재무 건전성</span> — 빚이 너무 많지 않나요?</p>
        </Box>
        <p className="text-[11px]">점수가 높은 회사 = 좋은 학교 성적을 꾸준히 받는 학생 같아요!</p>
      </>
    ),
  },

  analyst_score: {
    title: "Analyst Score (전문가 의견) 이게 뭐야?",
    body: (
      <>
        <Sec>👨‍💼 주식 전문가들의 의견을 모은 점수예요!</Sec>
        <p>월가(미국 금융가)의 <span className={H.bold}>전문 분석가들</span>이 이 주식을 어떻게 평가하는지 반영해요.</p>
        <Box>
          <p><span className={H.green}>Buy (매수 추천)</span> = "이 주식 사세요!" 라고 말한 전문가가 많을수록 점수↑</p>
          <p><span className={H.yellow}>Hold (보유)</span> = "그냥 갖고 있어요"</p>
          <p><span className={H.red}>Sell (매도)</span> = "팔아요!" 라고 말하면 점수↓</p>
        </Box>
      </>
    ),
  },

  rs_score: {
    title: "RS Score (상대 강도 점수) 이게 뭐야?",
    body: (
      <>
        <Sec>🏃 달리기 대회에서 몇 등인지 보는 점수예요!</Sec>
        <p>이 주식이 <span className={H.bold}>미국 시장 전체와 비교해서 얼마나 잘하는지</span> 봐요.</p>
        <Box>
          <p><span className={H.bold}>0~100점</span>으로 표시해요</p>
          <p><span className={H.green}>80점 이상</span> = 시장보다 훨씬 잘하고 있어요 🏆</p>
          <p><span className={H.yellow}>50점 근처</span> = 시장이랑 비슷해요</p>
          <p><span className={H.red}>20점 이하</span> = 시장보다 많이 뒤처져 있어요</p>
        </Box>
        <p className="text-[11px]">달리기 선수 100명 중에서 내가 80등이면 RS Score = 80이에요!</p>
      </>
    ),
  },

  volume_score: {
    title: "Volume Score (거래량 점수) 이게 뭐야?",
    body: (
      <>
        <Sec>📦 얼마나 많이 사고파는지 보는 점수예요!</Sec>
        <p>주식 시장에서 <span className={H.bold}>많은 사람이 관심 갖는 주식</span>일수록 거래량이 많아요.</p>
        <Box>
          <p><span className={H.bold}>거래량이 많다</span> = 많은 사람들이 이 주식에 관심있어요</p>
          <p><span className={H.bold}>거래량이 적다</span> = 관심 받지 못하는 주식이에요</p>
        </Box>
        <p className="text-[11px]">인기 있는 가게일수록 손님이 많은 것처럼, 좋은 주식도 거래량이 많아요!</p>
      </>
    ),
  },

  score_13f: {
    title: "13F Score (기관 투자 점수) 이게 뭐야?",
    body: (
      <>
        <Sec>🏦 큰 투자회사들이 얼마나 사고 있는지 보는 점수예요!</Sec>
        <p>미국에서는 큰 투자회사들이 <span className={H.bold}>어떤 주식을 샀는지 공개</span>(13F 보고서)해야 해요.</p>
        <Box>
          <p><span className={H.bold}>점수 높음</span> = 워런 버핏 같은 큰 투자자들이 많이 사고 있어요</p>
          <p><span className={H.bold}>점수 낮음</span> = 큰 투자자들이 별로 관심 없어요</p>
        </Box>
        <p className="text-[11px]">큰 어른들이 좋다고 사는 주식 = 믿을 만하다는 신호예요!</p>
      </>
    ),
  },

  rs_vs_spy: {
    title: "RS vs SPY (시장 대비 수익률) 이게 뭐야?",
    body: (
      <>
        <Sec>📊 이 주식이 미국 평균보다 얼마나 잘했는지 보여줘요!</Sec>
        <p><span className={H.bold}>SPY</span>는 미국 대표 회사 500개 평균이에요 (미국 시장 성적표).</p>
        <Box>
          <p><span className={H.green}>+5%</span> = 이 주식이 미국 평균보다 5% 더 올랐어요 👍</p>
          <p><span className={H.yellow}>0%</span> = 미국 평균이랑 똑같아요</p>
          <p><span className={H.red}>-3%</span> = 이 주식이 미국 평균보다 3% 더 떨어졌어요 👎</p>
        </Box>
        <p className="text-[11px]">플러스(+)일수록 시장보다 강한 주식이에요!</p>
      </>
    ),
  },

  regime_score: {
    title: "Regime Score (시장 체온 점수) 이게 뭐야?",
    body: (
      <>
        <Sec>🌡️ 시장의 건강 점수예요!</Sec>
        <p>5개 센서(VIX, Trend, Breadth, Credit, Yield Curve)를 합쳐서 계산한 <span className={H.bold}>종합 건강 점수</span>예요.</p>
        <Box>
          <p><span className={H.green}>점수 높음 (2~3)</span> = 시장이 건강해요! ☀️</p>
          <p><span className={H.yellow}>점수 보통 (1~2)</span> = 그럭저럭이에요 ⛅</p>
          <p><span className={H.red}>점수 낮음 (0~1)</span> = 시장이 아파요 🌧️</p>
        </Box>
      </>
    ),
  },

  confidence: {
    title: "Confidence (확신도) 이게 뭐야?",
    body: (
      <>
        <Sec>🎯 "얼마나 확실한 분석이야?" 를 나타내요!</Sec>
        <p>컴퓨터가 분석 결과를 얼마나 <span className={H.bold}>확신하는지</span> 퍼센트로 보여줘요.</p>
        <Box>
          <p><span className={H.green}>90% 이상</span> = 매우 확실해요! 거의 틀림없어요</p>
          <p><span className={H.yellow}>60~90%</span> = 꽤 확실해요</p>
          <p><span className={H.red}>60% 미만</span> = 불확실해요. 조심하세요</p>
        </Box>
        <p className="text-[11px]">50%는 동전 던지기와 같아요. 높을수록 믿을 수 있어요!</p>
      </>
    ),
  },

  stop_loss: {
    title: "Stop Loss (손절 기준) 이게 뭐야?",
    body: (
      <>
        <Sec>🛑 더 크게 잃지 않으려고 미리 정해두는 선이에요!</Sec>
        <p>주식을 샀는데 이 가격만큼 내려가면 <span className={H.bold}>자동으로 팔아서 더 큰 손해를 막아요</span>.</p>
        <Box>
          <p>예) Stop Loss = <span className={H.bold}>5%</span></p>
          <p>→ 내가 10만원에 샀으면, 9만5천원이 되면 팔아요</p>
          <p>→ 더 떨어져서 5만원, 3만원이 되는 걸 막아줘요</p>
        </Box>
        <Box>
          <p><span className={H.green}>RISK ON 시장</span> → 손절선 7% (좀 더 여유있게)</p>
          <p><span className={H.yellow}>NEUTRAL 시장</span> → 손절선 6%</p>
          <p><span className={H.red}>RISK OFF 시장</span> → 손절선 5% (더 빨리 팔아요)</p>
        </Box>
      </>
    ),
  },

  mdd_warning: {
    title: "MDD Warning (최대 손실 경보) 이게 뭐야?",
    body: (
      <>
        <Sec>⚠️ "이만큼 잃으면 빨간불!" 이에요!</Sec>
        <p><span className={H.bold}>MDD (Maximum DrawDown)</span> = 꼭대기에서 가장 많이 내려간 % 에요.</p>
        <Box>
          <p>예) 내 주식이 100만원 → 88만원이 됐어요</p>
          <p>→ MDD = 12% (12% 내려갔어요)</p>
          <p>→ MDD Warning이 10%면 경보 울림! 🚨</p>
        </Box>
        <p className="text-[11px]">이 수치를 넘으면 "지금 시장이 좀 이상한 것 같으니 조심해요!" 라는 신호예요.</p>
      </>
    ),
  },

  spy_divergence: {
    title: "Volume-Price Divergence (거래량-가격 불일치) 이게 뭐야?",
    body: (
      <>
        <Sec>🔔 가격이랑 거래량이 따로 노는 것을 감지해요!</Sec>
        <p>보통 주가가 오르면 거래량도 많아요. 그런데 이게 맞지 않으면 <span className={H.bold}>이상 신호</span>예요!</p>
        <Box>
          <p><span className={H.red}>Distribution (매도세)</span> = 가격이 내리는데 거래량이 많아요 → 사람들이 무서워서 팔고 있어요 📤</p>
          <p><span className={H.green}>Climax Buy (급등)</span> = 가격이 갑자기 확 오르면서 거래량이 폭발 → 과열 주의! 📈</p>
          <p><span className="font-bold text-on-surface-variant">None</span> = 특이 신호 없음 ✅</p>
        </Box>
        <Box>
          <p><span className={H.bold}>Vol Ratio</span> = 최근 2일 거래량 ÷ 최근 20일 평균</p>
          <p>1.5 이상이면 평소보다 거래량이 많은 거예요</p>
        </Box>
      </>
    ),
  },

  ai_thesis: {
    title: "Investment Thesis (투자 근거) 이게 뭐야?",
    body: (
      <>
        <Sec>📝 AI가 왜 이 주식을 추천하는지 설명이에요!</Sec>
        <p>AI가 여러 가지 정보를 분석한 후 <span className={H.bold}>"이 주식에 투자해야 하는 이유"</span>를 요약해줘요.</p>
        <Box>
          <p>뉴스, 실적, 시장 위치, 기술적 신호 등을 종합해서</p>
          <p>가장 중요한 이유를 2~3문장으로 알려줘요</p>
        </Box>
        <p className="text-[11px]">어디까지나 AI의 분석이에요. 최종 판단은 항상 본인이 해야 해요!</p>
      </>
    ),
  },

  catalysts: {
    title: "Bull Catalysts (상승 촉매) 이게 뭐야?",
    body: (
      <>
        <Sec>🚀 주가를 올릴 수 있는 좋은 이유들이에요!</Sec>
        <p><span className={H.bold}>Catalyst(촉매)</span>는 화학 시간에 배운 것처럼, 반응을 더 빠르게 만드는 거예요.<br />
        주식에서는 주가를 <span className={H.green}>더 빨리 오르게 만드는 사건들</span>이에요.</p>
        <Box>
          <p>예) 새 제품 출시, 좋은 실적 발표, 정부 지원, 경쟁사 문제 등</p>
        </Box>
        <p className="text-[11px]">이 이유들이 실현되면 주가가 오를 수 있어요!</p>
      </>
    ),
  },

  bear_cases: {
    title: "Bear Risks (하락 위험) 이게 뭐야?",
    body: (
      <>
        <Sec>⚠️ 주가를 내릴 수 있는 나쁜 이유들이에요!</Sec>
        <p><span className={H.red}>Bear(곰)</span>는 주가가 내릴 때를 뜻해요.<br />
        Bear Risk = <span className={H.bold}>주가를 내릴 수 있는 위험 요소</span>들이에요.</p>
        <Box>
          <p>예) 실적 부진 위험, 경쟁 심화, 규제, 경기 침체 등</p>
        </Box>
        <p className="text-[11px]">이런 위험을 알고 투자해야 손해를 줄일 수 있어요!</p>
      </>
    ),
  },

  probability: {
    title: "Probability (오를 확률) 이게 뭐야?",
    body: (
      <>
        <Sec>🎲 다음 5일 동안 오를 가능성이에요!</Sec>
        <p>AI가 계산한 <span className={H.bold}>"올라갈 확률"</span>이에요.</p>
        <Box>
          <p><span className={H.green}>70% 이상</span> = "꽤 오를 것 같아요!" 기대해볼 만해요</p>
          <p><span className={H.yellow}>50% 근처</span> = "반반이에요" 잘 모르겠어요</p>
          <p><span className={H.red}>30% 이하</span> = "내릴 것 같아요" 조심하세요</p>
        </Box>
        <p className="text-[11px]">50%는 동전 던지기랑 같아요. 70% 이상이면 AI가 오를 거라고 꽤 확신하는 거예요!</p>
      </>
    ),
  },

  performance: {
    title: "Performance (성과 시뮬레이터) 이게 뭐야?",
    body: (
      <>
        <Sec>💰 "그날 샀으면 얼마나 벌었을까?" 시뮬레이션이에요!</Sec>
        <p>각 날짜에 추천 종목들을 <span className={H.bold}>똑같은 금액씩 나눠서 샀다면</span> 지금 얼마가 됐는지 계산해줘요.</p>
        <Box>
          <p><span className={H.bold}>Entry Date</span> = 이 날짜에 샀어요</p>
          <p><span className={H.bold}>Return</span> = 지금까지 수익률 (+면 이익, -면 손실)</p>
          <p><span className={H.bold}>vs SPY</span> = 미국 시장 평균보다 얼마나 잘했는지</p>
        </Box>
        <p className="text-[11px]">실제 투자가 아니에요! 참고용 시뮬레이션이에요.</p>
      </>
    ),
  },

  api_costs: {
    title: "API Costs (AI 사용 비용) 이게 뭐야?",
    body: (
      <>
        <Sec>💳 이 시스템이 AI를 쓰는 데 드는 돈이에요!</Sec>
        <p>주식 분석을 위해 <span className={H.bold}>3가지 AI 서비스</span>를 사용해요.</p>
        <Box>
          <p><span className={H.bold}>Gemini Flash</span> = 구글의 AI. 빠르고 저렴해요</p>
          <p><span className={H.bold}>GPT-5-mini</span> = OpenAI의 AI. 글을 잘 써요</p>
          <p><span className={H.bold}>Perplexity Sonar</span> = 인터넷 검색 AI. 최신 뉴스를 찾아요</p>
        </Box>
        <p className="text-[11px]">종목 10개 분석에 약 $0.04 (약 50원) 정도 들어요. 정말 저렴해요!</p>
      </>
    ),
  },
};

// ── HelpBtn 컴포넌트 ──────────────────────────────────────────────────────────

type Topic = keyof typeof HELP_DATA;

export function HelpBtn({ topic }: { topic: Topic }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const data = HELP_DATA[topic];
  if (!data) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-outline-variant/40 text-on-surface-variant/60 text-[9px] font-black hover:border-primary hover:text-primary hover:bg-primary/10 transition-all ml-1 flex-shrink-0 leading-none"
        aria-label="도움말"
      >
        ?
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface-container-low border border-outline-variant/20 rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10 sticky top-0 bg-surface-container-low">
              <h3 className="text-sm font-bold text-on-surface pr-4">{data.title}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant text-xl leading-none flex-shrink-0 transition-colors"
              >
                ×
              </button>
            </div>
            {/* Body */}
            <div className="px-5 py-4 text-[13px] text-on-surface-variant leading-relaxed">
              {data.body}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
