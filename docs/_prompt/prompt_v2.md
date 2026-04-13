프롬프트 1: IndexPredictor 클래스 기본 골격
Plaintext
미국 주식 지수(SPY, QQQ) 방향을 예측하는 IndexPredictor 클래스를 만들어 줘.

파일 경로: us_market/index_predictor.py

요구사항:
- 클래스명: IndexPredictor
- __init__에서 data_dir 받기 (기본값 '.')
- output_file: output/index_prediction.json
- model_path_spy: output/predictor_model_spy.joblib
- model_path_qqq: output/predictor_model_qqq.joblib
- FEATURE_NAMES 리스트를 클래스 변수로 정의 (27개):
  * SPY 관련: spy_return_1w, spy_return_1m, spy_above_200ma, spy_above_50ma, spy_rsi, spy_macd_signal, spy_bb_position
  * VIX 관련: vix_value, vix_change_5d, vix_percentile
  * QQQ 관련: qqq_return_1w, qqq_rsi
  * 시장폭: breadth_pct_above_50ma, advance_decline_ratio
  * 섹터 상대강도: xlk_relative_1m, xlu_relative_1m, xly_relative_1m
  * 매크로: yield_spread_proxy, gold_return_1w, dxy_return_1w
  * 거래량: spy_vol_ratio, spy_vol_trend_5d, qqq_vol_ratio
  * 모멘텀: spy_roc_10d, spy_price_vs_50ma_pct, spy_rsi_slope_5d, vix_above_20
- INVERSE_FEATURES 집합: vix_value, vix_change_5d, vix_percentile, vix_above_20, xlu_relative_1m, dxy_return_1w
- logging 사용 (print 금지)

프롬프트 2: 기술적 지표 계산 헬퍼 메서드
Plaintext
IndexPredictor에 기술적 지표 계산 메서드 3개를 추가해 줘.

1. _calculate_rsi(series, period=14):
   - Wilder's smoothing 방식 (EMA alpha=1/period)
   - delta.where(delta > 0, 0).ewm(alpha=1/period, adjust=False).mean()으로 gain 계산
   - gain과 loss 모두 0이면 RSI=50으로 fillna

2. _calculate_macd_signal(series):
   - EMA 12, EMA 26으로 MACD 라인 계산
   - MACD의 EMA 9로 시그널 라인 계산
   - MACD > signal이면 +1, 아래면 -1, 같으면 0 반환
   - 반환 타입: pd.Series (int)

3. _calculate_bb_position(series, window=20):
   - 20일 이동평균과 2*표준편차로 밴드 계산
   - position = (price - lower) / (upper - lower)
   - band_width가 0인 경우 np.nan으로 대체 (횡보장 보호)
   - clip(0, 1)로 범위 제한, fillna(0.5)
프롬프트 3: 피처 빌드 메서드
Plaintext
IndexPredictor에 _build_raw_features(data: pd.DataFrame) 메서드를 추가해 줘.
입력: yfinance에서 받은 Close 가격 DataFrame (SPY, QQQ, VIX 등 컬럼)
출력: 27개 피처 컬럼이 있는 DataFrame

구현 순서:
1. SPY 피처 7개: return_1w(pct_change(5)*100), return_1m(pct_change(21)*100), above_200ma(이진), above_50ma(이진), rsi(_calculate_rsi), macd_signal(_calculate_macd_signal), bb_position(_calculate_bb_position)
2. VIX 피처 3개: 현재값, 5일 변화율, 1년(252일) 백분위(rolling apply로 rank(pct=True))
3. QQQ 피처 2개: return_1w, rsi
4. 시장폭 2개: SPY 기준 50일선 위 비율(50일 rolling mean * 100), advance/decline ratio(Laplace smoothing: (adv+1)/(dec+1))
5. 섹터 상대강도 3개: XLK/XLU/XLY의 1개월 수익률에서 SPY 1개월 수익률 빼기 (* 100)
6. 매크로 3개: TNX-FVX 스프레드(FVX 없으면 TNX pct_change(5)*100 사용), 금 1주 수익률, 달러 1주 수익률
7. 거래량 3개: spy_vol/20일평균, spy 5일평균/20일평균-1, qqq_vol/20일평균
8. 모멘텀 3개: spy roc 10d, price vs 50ma %, rsi slope 5d
9. VIX 레짐: vix > 20 이진값

각 컬럼이 없으면 해당 피처 스킵 (에러 없이). 타겟은 추가하지 않음.
프롬프트 4: 데이터 수집 메서드
Plaintext
IndexPredictor에 _fetch_price_data(start_date='2023-01-01') 메서드를 추가해 줘.

요구사항:
- yfinance로 다음 티커 다운로드: SPY, QQQ, ^VIX, XLK, XLU, XLY, GC=F, DX-Y.NYB, ^TNX, ^FVX
- lookback_start를 start_date에서 300일 전으로 설정 (이동평균 계산용)
- Close 가격을 가져오되, 야후파이낸스 심볼을 깔끔한 이름으로 rename:
  * ^VIX → VIX, GC=F → GOLD, DX-Y.NYB → DXY, ^TNX → TNX, ^FVX → FVX
- Volume 데이터도 추가: SPY_VOL, QQQ_VOL 컬럼
- 에러 시 빈 DataFrame 반환, logger.error 기록
프롬프트 5: 학습 데이터셋 생성
Plaintext
IndexPredictor에 reconstruct_signals_from_prices(start_date='2023-01-01') 메서드를 추가해 줘.

요구사항:
- _fetch_price_data()로 가격 데이터 수집
- _build_raw_features()로 27개 피처 생성
- prediction_horizon_days(기본 5일) 기반으로 타겟 추가:
  * spy_target_return: SPY의 5일 후 수익률 (pct_change(5).shift(-5) * 100)
  * spy_target_direction: 수익률 > 0이면 1, 아니면 0
  * qqq_target_return, qqq_target_direction도 동일하게
- start_date 이후 데이터만 필터링
- 로그에 행 수와 피처 수 출력
- 빈 데이터면 빈 DataFrame 반환
프롬프트 6: GradientBoosting 학습 메서드
Plaintext
IndexPredictor에 train(df, target_ticker='SPY') 메서드를 추가해 줘.

요구사항:
- scikit-learn의 GradientBoostingClassifier + GradientBoostingRegressor 사용
- ImportError 시 설치 안내 메시지 반환

학습 과정:
1. 타겟 컬럼 확인 (spy_target_direction, spy_target_return 등)
2. NaN 타겟 행 제거 (shift로 인한 마지막 N행)
3. min_training_samples(기본 50) 미만이면 에러 반환
4. 클래스 불균형 보정:
   - n_bearish, n_bullish 카운트
   - weight = total / (2 * n_class) 방식으로 sample_weights 생성
5. TimeSeriesSplit(n_splits=5) CV:
   - 각 fold에서 StandardScaler를 fit_transform(train) / transform(test)
   - GradientBoostingClassifier(n_estimators=150, max_depth=4, learning_rate=0.05, subsample=0.8, min_samples_leaf=10, random_state=42)
   - accuracy_score와 brier_score_loss 수집
   - 단일 클래스 fold는 스킵
6. 전체 데이터로 최종 모델 학습 (Classifier + Regressor)
7. Feature importances 상위 10개 추출
8. joblib.dump으로 저장 (classifier, regressor, scaler, features, trained_at, training_samples, cv_accuracy, target_std 포함)
9. 반환: accuracy, brier_score, training_samples, features_used, top_features
프롬프트 7: 최신 피처 벡터 생성
Plaintext
IndexPredictor에 build_latest_features() 메서드를 추가해 줘.

요구사항:
- _fetch_price_data(start_date='2024-01-01')로 최신 데이터 수집
- _build_raw_features()로 피처 생성
- FEATURE_NAMES 중 실제 사용 가능한 피처만 선택
- 마지막 행(iloc[-1])을 최신 피처 벡터로 추출
- NaN이 피처의 절반 이상이면 None 반환 (신뢰할 수 없음)
- 나머지 NaN은 0으로 채움
- 반환 타입: Optional[pd.Series]

이 메서드는 학습 데이터와 별개로, 예측 시점의 "가장 최신" 시장 상태를 나타냄.
stale 데이터 방지를 위해 학습 데이터의 마지막 행이 아닌 별도로 생성함.
프롬프트 8: 예측 실행 메서드
Plaintext
IndexPredictor에 predict_next_week() 메서드를 추가해 줘.

요구사항:
- SPY와 QQQ를 for 루프로 각각 독립 예측
- 각 ticker에 대해:
  1. 모델 파일 존재 확인 (predictor_model_spy.joblib / predictor_model_qqq.joblib)
  2. trained_at 체크 → retrain_interval_days(기본 7) 초과 시 재학습
  3. 재학습 필요 시 train() 호출, 실패 시 continue
  4. 최신 피처 벡터 준비:
     - 모델의 features 목록과 latest_features 매칭
     - 누락 피처는 0으로 채움 + 경고 로그
  5. scaler.transform()으로 스케일링
  6. classifier.predict_proba()로 상승 확률
  7. regressor.predict()로 예상 수익률
  8. confidence 등급: high(70%+), moderate(60%+), low(미만)
  9. key_drivers: feature_importance 상위 5개 + 현재값 + 방향(bullish/bearish)
- _get_driver_direction() 메서드로 방향 해석:
  - INVERSE_FEATURES: 양수면 bearish
  - RSI: >70 bearish, <30 bullish
  - BB: >0.8 bearish, <0.2 bullish
- 결과를 output/index_prediction.json에 저장
프롬프트 9: Regime Config 지원
Plaintext
IndexPredictor에 _load_regime_config() 메서드를 추가해 줘.

요구사항:
- output/regime_config.json 파일 읽기 시도
- 파일이 있으면 'predictor' 키의 값으로 defaults를 업데이트
- 기본값:
  * prediction_horizon_days: 5
  * cv_splits: 5
  * retrain_interval_days: 7
  * min_training_samples: 50
  * confidence_high_threshold: 70
  * confidence_moderate_threshold: 60
- __init__에서 self.config = self._load_regime_config() 호출
- 파일 없거나 에러 시 기본값 사용 (로그만 debug 레벨)
프롬프트 10: 예측 히스토리 저장
Plaintext
IndexPredictor에 예측 히스토리 관리 기능을 추가해 줘.

요구사항:
- predict_next_week()에서 예측 후 prediction_history.json에 append
- 히스토리 항목 구조:
  {
    "date": "2026-03-08",
    "spy": {"direction": "bullish", "probability": 0.63, "predicted_return": 1.2},
    "qqq": {"direction": "bearish", "probability": 0.45, "predicted_return": -0.8},
    "model_accuracy": 58.5
  }
- 최대 100개 유지 (오래된 것 삭제)
- 파일 없으면 새로 생성
프롬프트 11: 단위 테스트
Plaintext
tests/test_index_predictor.py를 만들어 줘.

테스트 목록:
1. test_calculate_rsi_normal: 상승/하락 혼합 시리즈에서 RSI가 0~100 범위인지
2. test_calculate_rsi_all_up: 모든 값이 상승하면 RSI가 100에 가까운지
3. test_calculate_macd_signal: 상승 추세에서 +1, 하락 추세에서 -1 반환하는지
4. test_calculate_bb_position: 밴드 상단이면 1에 가깝고, 하단이면 0에 가까운지
5. test_build_raw_features_columns: 결과 DataFrame에 FEATURE_NAMES 피처가 포함되는지
6. test_inverse_features_direction: INVERSE_FEATURES에 속한 피처가 양수일 때 bearish 방향인지
7. test_load_regime_config_defaults: 파일 없을 때 기본값 반환하는지
8. test_feature_names_count: FEATURE_NAMES가 27개인지

yfinance API 호출은 monkeypatch로 모킹. 더미 데이터 금지 (실제 구조 반영 mock만).
프롬프트 12: 전체 통합 실행
Plaintext
index_predictor.py에 if __name__ == '__main__' 블록을 추가해 줘.

실행 순서:
1. IndexPredictor(data_dir='.') 초기화
2. predict_next_week() 호출
3. 결과 출력:
   - SPY: 방향, 확률, 예상 수익률, 신뢰도
   - QQQ: 방향, 확률, 예상 수익률, 신뢰도
   - 상위 3개 key_drivers
4. output/index_prediction.json 저장 확인 로그

실행 방법: python us_market/index_predictor.py

프롬프트 13: IndexPredictor 확률 보정 (Brier Score + Platt Scaling)
Plaintext
us_market/index_predictor.py의 GradientBoostingClassifier를 확률 보정으로 감싸서
예측 확률값의 신뢰도를 개선해 줘.

파일 경로: us_market/index_predictor.py

근거:
- Summary2-8, 2-11 (별도 US_Market 프로젝트 실측):
  Brier Score 0.332 → 0.239 (**-28% 개선**)
- Accuracy는 유지되지만 confidence_pct의 실제 의미 정확도 대폭 향상
- "91.5% 확신" 이라고 하면 실제 91.5%만큼 맞는 모델이 됨

요구사항:
1. sklearn.calibration.CalibratedClassifierCV 임포트
2. train() 메서드에서 기존 GradientBoostingClassifier를 감싸기:
   from sklearn.calibration import CalibratedClassifierCV
   base_clf = GradientBoostingClassifier(...)
   calibrated_clf = CalibratedClassifierCV(base_clf, method='sigmoid', cv=5)
   calibrated_clf.fit(X_train, y_train)
3. Brier Score 계산 (보정 전/후 로그 출력):
   from sklearn.metrics import brier_score_loss
   brier_before = brier_score_loss(y_test, base_clf.predict_proba(X_test)[:, 1])
   brier_after = brier_score_loss(y_test, calibrated_clf.predict_proba(X_test)[:, 1])
   logger.info("Brier before=%.3f, after=%.3f, improvement=%+.1f%%",
               brier_before, brier_after, (brier_after - brier_before) / brier_before * 100)
4. predict_next_week() 결과에 보정된 확률 반영
5. output/index_prediction.json에 "brier_score" 필드 추가

검증 목표:
- Brier Score 개선 -25% 이상 (목표: -28%, Summary2-11 실측 참조)
- Accuracy는 ±2% 이내 유지 (확률값만 조정, 분류 경계 불변)
- 단위 테스트 회귀 없음 (tests/test_index_predictor.py 전체 PASS)

참고 (Summary2-11 실측 결과):
| 보정 방법 | Brier Score | 개선률 | Accuracy |
|----------|-------------|--------|----------|
| Raw      | 0.332       | —      | 53.6%    |
| Platt    | 0.239       | -28.0% | 54.4%    |
| Isotonic | 0.239       | -28.3% | 51.5%    |

실행 방법: python us_market/index_predictor.py
테스트: pytest tests/test_index_predictor.py -v

프롬프트 14: Rule-Based Score vs ML Signal 상충 감지
Plaintext
analyzers/final_report_generator.py에 rule-based score(composite score)와
IndexPredictor ML 신호가 상충할 때 mean-reversion 경고 플래그를 추가해 줘.

파일 경로: analyzers/final_report_generator.py

근거:
- Summary2-12, 2-13 (실측 케이스): Rule-Based 44.4/100 STRONG_BULL ↔ ML BEARISH 상충
- 이런 상충은 **평균 회귀(mean-reversion) 신호**로 해석됨
- 한 쪽만 보고 투자하면 위험, 상충 경고 필수

요구사항:
1. detect_signal_conflict(composite_score, ml_direction, ml_confidence_pct) 함수 추가:
   - composite_score ≥ 60 AND ml_direction == 'bearish' AND ml_confidence_pct ≥ 70
     → return "mean_reversion_warning: rule BULL but ML BEARISH (high confidence)"
   - composite_score ≤ 40 AND ml_direction == 'bullish' AND ml_confidence_pct ≥ 70
     → return "mean_reversion_warning: rule BEAR but ML BULLISH (high confidence)"
   - 그 외: return None
2. generate_report() 호출 시 각 종목에 'signal_conflict' 필드 추가
3. output/final_top10_report.json에 상충 플래그 포함
4. 상충 발생 시 logger.warning() 출력

검증: 단위 테스트 (tests/test_final_report.py) 3개 케이스 추가 (bullish/bearish/no-conflict)
