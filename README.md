# 🪙 GoldDecode — 금값 해독기

> 당신이 지불하는 금값, 그 안을 해독합니다

금 악세사리(반지·목걸이·팔찌 등) 구매 시 **세공비를 역산**하거나, 세공비를 입력해 **예상 판매가를 계산**하는 웹 계산기입니다. KRX 금시세 기준 당일 데이터를 사용합니다.

🔗 **배포 URL**: `https://elis0m.github.io/GoldDecode`

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 당일 금 시세 | KRX Open API 기반, GitHub Actions가 매시간 갱신 |
| 순산 모드 | 세공비 입력 → 예상 판매가 계산 |
| 역산 모드 | 실제 구매가 입력 → 세공비 추정 |
| 세공비 비율 표시 | 순금 원가 대비 세공비 % 자동 계산 |
| 순도 선택 | 24K / 18K / 14K |
| 무게 환산 | g ↔ 돈 (1돈 = 3.75g) 자동 환산 |
| 시세 직접 입력 | 로드된 시세를 수동으로 덮어쓸 수 있는 편집 버튼 |
| 최근 1년 시세 추이 | 거래일별 24K 금 시세 라인 차트 |
| 금 정보 카드 | 순도 기준, 살 때 vs 팔 때 차이 안내 |

## 계산 공식

```
순금 원가   = 금 시세(원/g) × 순도 비율 × 무게(g)
부가세      = 순금 원가 × 10%
순산 가격   = 순금 원가 + 부가세 + 세공비
역산 세공비  = 실제 구매가 - 순금 원가 - 부가세
세공비 비율  = 세공비 ÷ 순금 원가 × 100%
```

**순도 비율**

| 종류 | 비율 |
|------|------|
| 24K | 1.000 (99.9%) |
| 18K | 0.750 (75.0%) |
| 14K | 0.585 (58.5%) |

## GitHub 설정

### 1. GitHub Pages 활성화
Settings → Pages → Source: **GitHub Actions**

### 2. KRX Open API Key 등록
[openapi.krx.co.kr](https://openapi.krx.co.kr) 에서 회원가입 후 API Key 발급

Settings → Secrets and variables → Actions → New repository secret

| 이름 | 값 |
|------|------|
| `KRX_API_KEY` | openapi.krx.co.kr 발급 API Key |

### 3. 초기 시세 히스토리 수집 (최초 1회)
Actions → **Backfill Gold History** → Run workflow

과거 1년치 금 시세를 `data/gold-history.json`에 수집합니다.

## 워크플로우

| 워크플로우 | 실행 시점 | 역할 |
|-----------|---------|------|
| `fetch-gold.yml` | 평일 09~16시 매시 정각 | 당일 금 시세 갱신 |
| `backfill-history.yml` | 수동 1회 | 과거 1년 시세 일괄 수집 |
| `deploy.yml` | main 브랜치 push 시 | GitHub Pages 배포 |

## 주의사항

- 본 계산기는 **참고용**이며 실제 거래가와 차이가 있을 수 있습니다.
- 세공비는 업체마다 상이합니다.
- 보석류(다이아몬드 등) 가격은 금값과 별도입니다.
- 주말·공휴일에는 직전 거래일 시세가 표시됩니다.

## 라이선스

MIT
