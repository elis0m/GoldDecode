# 💍 GoldDecode · 금값 해독기

> 당신이 지불하는 금값, 그 안을 해독합니다

**실시간 금 시세** 기반으로 악세사리(반지·목걸이·팔찌 등) 구매 시 세공비를 역산하거나, 세공비 입력으로 예상 판매가를 계산하는 웹 계산기입니다.

🔗 **배포 URL**: `https://{username}.github.io/gold-decode`

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 실시간 시세 | corsproxy.io 경유 공공데이터포털 KRX API 조회 |
| 순산 모드 | 세공비 입력 → 예상 판매가 계산 |
| 역산 모드 | 실제 구매가 → 세공비 추정 |
| 순도 선택 | 24K / 18K / 14K |
| 무게 환산 | g ↔ 돈 (1돈 = 3.75g) 자동 환산 |
| 시세 캐시 | API 실패 시 GitHub Actions가 갱신한 JSON fallback |

## 계산 공식

```
순금 원가  = 금 시세(원/g) × 순도 비율 × 무게(g)
부가세     = 순금 원가 × 10%
순산 가격  = 순금 원가 + 부가세 + 세공비
역산 세공비 = 실제 구매가 - 순금 원가 - 부가세
```

## GitHub 설정

### 1. GitHub Pages 활성화
Settings → Pages → Source: **GitHub Actions**

### 2. API Key 등록
Settings → Secrets and variables → Actions → New repository secret

| 이름 | 값 |
|------|------|
| `DATA_GO_KR_KEY` | 공공데이터포털 발급 API Key |

API Key 발급: [data.go.kr — 금융위원회 일반상품시세정보](https://www.data.go.kr/data/15094805/openapi.do)

### 3. config.js에 API Key 입력 (브라우저 실시간 조회용)
```js
// config.js
const KRX_API_KEY = 'YOUR_API_KEY_HERE'; // 발급받은 키로 교체
```

> ⚠️ 공공데이터포털 일반 공개키는 트래픽이 많아지면 `data.go.kr`에서 별도 발급 필요합니다.

## 주의사항

- 본 계산기는 **참고용**이며 실제 거래가와 차이가 있을 수 있습니다.
- 세공비는 업체마다 상이합니다.
- 보석류(다이아몬드 등) 가격은 금값과 별도입니다.
- 주말·공휴일에는 직전 거래일 시세가 표시됩니다.

## 라이선스

MIT
