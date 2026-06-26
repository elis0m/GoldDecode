# 💍 GoldDecode · 금값 해독기 — 개발 진행 계획서

> "당신이 지불하는 금값, 그 안을 해독합니다"

> GitHub Pages 기반 정적 웹앱 | 금 시세 API 연동 | 부가세·세공비 역산 계산기

---

## 1. 프로젝트 개요

### 프로젝트 정보

| 항목 | 내용 |
|------|------|
| **영문명** | GoldDecode |
| **한국어명** | 금값 해독기 |
| **슬로건** | 당신이 지불하는 금값, 그 안을 해독합니다 |
| **레포지토리명** | `gold-decode` |
| **배포 URL** | `https://{username}.github.io/gold-decode` |

### 목적

국내 금 시세 API를 실시간으로 받아와, 악세사리(반지·목걸이·팔찌 등) 구매 시 **살 때 가격에서 순금 원가 + 부가세를 제외한 세공비를 역산**하거나, 반대로 **세공비를 입력해 예상 판매가를 산출**하는 웹 계산기를 만든다.

### 핵심 기능 요약

- 실시간 금 시세 조회 (24K 기준 1g 단가)
- 순도(24K / 18K / 14K) 및 무게(g 또는 돈) 입력
- 부가세(10%) 자동 반영
- **역산 모드**: 실제 살 때 가격 → 세공비 계산
- **순산 모드**: 세공비 입력 → 예상 판매가 계산
- GitHub Pages로 정적 배포 (백엔드 불필요)

---

## 2. 기술 스택

| 분류 | 선택 | 비고 |
|------|------|------|
| 호스팅 | GitHub Pages | 무료, 정적 파일 배포 |
| 프레임워크 | Vanilla HTML/CSS/JS | 의존성 최소화 |
| 금 시세 API | 공공데이터포털 KRX 금시세 API (1순위) / KRX Open API (2순위) | 국내 공식 데이터, 무료 |
| 시세 캐싱 | GitHub Actions + JSON 파일 | CORS 우회 및 호출 횟수 절감 |
| 스타일 | CSS Variables + Flexbox | 반응형, 모바일 대응 |
| 버전 관리 | GitHub (main 브랜치 → Pages 자동 배포) | |

### API 선택 근거 및 비교

| API | 제공 기관 | 데이터 신뢰도 | CORS | 갱신 주기 | 비용 |
|-----|----------|------------|------|----------|------|
| **공공데이터포털 KRX 금시세** | 금융위원회 / 한국거래소 | ⭐⭐⭐⭐⭐ | ❌ (우회 필요) | 일 1회 | 무료 |
| **KRX Open API** | 한국거래소 공식 | ⭐⭐⭐⭐⭐ | ❌ (우회 필요) | 실시간 | 무료 |
| `goldapi.io` *(폴백용)* | 민간 | ⭐⭐⭐ | ✅ | 실시간 | 월 100회 무료 |

### GitHub Pages의 CORS 제약 및 해결 전략

GitHub Pages는 서버가 없는 **정적 호스팅**이므로, CORS를 허용하지 않는 공공 API를 직접 호출할 수 없다.
아래 두 가지 방식 중 하나를 선택한다.

**방식 A — GitHub Actions 스케줄링 (권장)**

```
[GitHub Actions] → 매일 오전 11시 KRX API 호출
                → gold-data.json 으로 저장 (레포 내)
                → GitHub Pages가 해당 JSON을 읽어 표시
```

- CORS 문제 없음, API Key 노출 없음
- 시세는 일 1회 갱신 (KRX 기준과 동일)
- `.github/workflows/fetch-gold.yml` 로 자동화

**방식 B — CORS Proxy 경유 (간단 구현)**

```
[브라우저] → corsproxy.io → 공공데이터포털 API → 응답 반환
```

- 구현 간단, 별도 서버 불필요
- 단, 외부 프록시 서비스 의존성 존재 (서비스 중단 위험)
- 개발/테스트 단계에서 임시로 활용 가능

> ✅ **최종 선택**: 방식 A (GitHub Actions) 를 기본으로 하되, 개발 초기에는 방식 B로 빠르게 프로토타이핑

### 공공데이터포털 API 상세

- **신청 URL**: [data.go.kr — 금융위원회 일반상품시세정보](https://www.data.go.kr/data/15094805/openapi.do)
- **엔드포인트**: `http://apis.data.go.kr/1160100/service/GetGeneralProductInfoService/getGoldPriceInfo`
- **요청 파라미터**: `serviceKey`, `numOfRows`, `pageNo`, `resultType=json`
- **응답 필드**: 기준일자, 종목명, 종가(원/g), 등락, 거래량
- **개발계정 트래픽**: 10,000회/일

### KRX Open API 상세

- **신청 URL**: [openapi.krx.co.kr](https://openapi.krx.co.kr)
- **제공 데이터**: KRX 금시장 실시간 시세, 체결가, 거래량
- **인증 방식**: 회원가입 후 API Key 발급
- **특이사항**: 장 운영시간(09:00~15:30) 외에는 전일 종가 반환

---

## 3. 계산 공식 정의

### 3-1. 순산 모드 (예상 판매가 계산)

```
순금 원가 = 24K 시세(원/g) × 순도 비율 × 무게(g)
부가세    = 순금 원가 × 0.1
예상 판매가 = 순금 원가 + 부가세 + 세공비
```

**순도 비율**

| 종류 | 순도 비율 |
|------|----------|
| 24K  | 1.000    |
| 18K  | 0.750    |
| 14K  | 0.585    |

### 3-2. 역산 모드 (세공비 역산)

```
순금 원가  = 24K 시세(원/g) × 순도 비율 × 무게(g)
부가세     = 순금 원가 × 0.1
세공비(추정) = 실제 살 때 가격 - 순금 원가 - 부가세
```

### 3-3. 무게 단위 환산

```
1돈 = 3.75g
입력 단위: g 또는 돈 선택 가능
```

---

## 4. 화면 구성 (UI 설계)

```
┌─────────────────────────────────────────┐
│  🔍 GoldDecode · 금값 해독기             │
│  당신이 지불하는 금값, 그 안을 해독합니다 │
│  현재 금 시세: 196,000원/g (24K 기준)    │
│  [마지막 업데이트: 2026-06-26 10:30]     │
├─────────────────────────────────────────┤
│  ◉ 순산 모드   ○ 역산 모드              │
├─────────────────────────────────────────┤
│  순도 선택:  [24K]  [18K]  [14K]        │
│  무게:  [______] g  ↔  돈              │
│  세공비:  [______] 원 (순산 모드 시)     │
│  실제 구매가: [______] 원 (역산 모드 시) │
├─────────────────────────────────────────┤
│           [ 계산하기 ]                   │
├─────────────────────────────────────────┤
│  📊 계산 결과                            │
│  ├ 순금 원가:    XXX,XXX 원             │
│  ├ 부가세(10%): XXX,XXX 원             │
│  ├ 세공비:      XXX,XXX 원             │
│  └ 최종 가격:   XXX,XXX 원             │
└─────────────────────────────────────────┘
```

---

## 5. 디렉토리 구조

```
gold-decode/
├── index.html              # 메인 페이지
├── style.css               # 스타일시트
├── main.js                 # 계산 로직 + JSON 시세 로드
├── config.js               # 상수 정의 (순도 비율, 단위 등)
├── data/
│   └── gold-data.json      # GitHub Actions가 자동 갱신하는 시세 파일
├── README.md               # 프로젝트 설명
└── .github/
    └── workflows/
        ├── fetch-gold.yml  # 매일 KRX 시세 가져와 gold-data.json 갱신
        └── deploy.yml      # main 브랜치 push 시 Pages 자동 배포
```

---

## 6. 개발 단계별 계획

### Phase 1 — 기반 구축 (1~2일)

- [ ] GitHub 레포지토리 생성 (`gold-decode`)
- [ ] GitHub Pages 활성화 (Settings → Pages → `main` 브랜치 `/root`)
- [ ] `index.html` 기본 뼈대 작성
- [ ] `style.css` 레이아웃 설계 (모바일 반응형)
- [ ] `config.js` 에 API 엔드포인트 및 상수 정의

### Phase 2 — 금 시세 API 연동 및 자동화 (2~3일)

**2-1. 공공데이터포털 API Key 발급**
- [ ] [data.go.kr](https://www.data.go.kr) 회원가입
- [ ] `금융위원회_일반상품시세정보` 활용 신청 → API Key 발급
- [ ] Postman 또는 curl로 응답 구조 확인 및 파싱 테스트

**2-2. GitHub Actions 스케줄러 구성 (`fetch-gold.yml`)**
- [ ] 매일 오전 11시(KRX 시세 고시 후) 자동 실행 설정 (`cron: '0 2 * * *'` UTC 기준)
- [ ] Python 또는 Node.js 스크립트로 KRX API 호출
- [ ] 응답에서 24K 종가(원/g) 파싱 → `data/gold-data.json` 으로 저장
- [ ] GitHub Actions가 레포에 자동 커밋 (`actions/github-script` 활용)
- [ ] API Key는 **GitHub Secrets** 에 저장 (`DATA_GO_KR_KEY`)

```yaml
# .github/workflows/fetch-gold.yml 예시 구조
name: Fetch Gold Price
on:
  schedule:
    - cron: '0 2 * * 1-5'  # 평일 오전 11시 KST
  workflow_dispatch:         # 수동 실행 가능
jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Fetch KRX Gold Price
        run: python scripts/fetch_gold.py
        env:
          API_KEY: ${{ secrets.DATA_GO_KR_KEY }}
      - name: Commit updated gold-data.json
        run: |
          git config user.name "github-actions"
          git add data/gold-data.json
          git commit -m "chore: update gold price data" || exit 0
          git push
```

**2-3. 프론트엔드에서 JSON 로드**
- [ ] `main.js` 에서 `fetch('./data/gold-data.json')` 으로 시세 로드
- [ ] 마지막 갱신 일시 표시
- [ ] JSON 로드 실패 시 `goldapi.io` 폴백 호출 처리
- [ ] 장 휴장일(주말·공휴일) 대비 — 직전 거래일 데이터 표시 안내

### Phase 3 — 계산 로직 구현 (1일)

- [ ] 순산 모드 함수 구현 (`calcSalePrice`)
- [ ] 역산 모드 함수 구현 (`calcWorkmanship`)
- [ ] 무게 단위(g ↔ 돈) 실시간 환산
- [ ] 순도 비율 상수 적용
- [ ] 결과값 천 단위 콤마 포맷팅

### Phase 4 — UI 완성 및 UX 개선 (1~2일)

- [ ] 모드 전환(순산/역산) 토글 UI
- [ ] 순도 선택 버튼 스타일
- [ ] 계산 결과 테이블 애니메이션
- [ ] 입력값 유효성 검사 (음수, 빈값 등)
- [ ] 시세 수동 입력 옵션 추가 (API 불가 시 대비)

### Phase 5 — 배포 및 마무리 (0.5일)

- [ ] GitHub Pages 최종 배포 확인
- [ ] 모바일 브라우저 크로스 테스트 (iOS Safari, Android Chrome)
- [ ] `README.md` 작성 (사용법, 공식 설명, 주의사항)
- [ ] 오픈 소스 라이선스 추가 (MIT 권장)

---

## 7. 주요 고려사항 및 제약

### API 관련
- **공공데이터포털 API Key**는 절대 클라이언트 JS에 노출하지 않고, **GitHub Secrets**에만 저장
- GitHub Actions가 시세를 `gold-data.json` 으로 레포에 저장하므로, 브라우저는 **JSON 파일만 읽음** → API Key 노출 없음
- KRX 금시장은 **평일 09:00~15:30** 운영 → 주말·공휴일은 직전 거래일 데이터 표시, UI에 명시
- `goldapi.io` 는 JSON 로드 실패 시 **폴백(fallback) 전용**으로만 사용 (월 100회 제한 초과 방지)
- GitHub Actions 실행 실패 시 Slack 또는 GitHub 이메일 알림 설정 권장

### 계산 정확도
- 세공비는 업체마다 다르므로 계산 결과는 **추정값**임을 UI에 명시
- 부속 보석(다이아몬드 등) 가격은 금값과 별도임을 안내
- 시세는 **팔 때 기준**을 사용해야 역산이 정확함을 명시

### 법적 고지
- 본 계산기는 **참고용**이며 실제 거래가와 차이가 있을 수 있음을 푸터에 안내

---

## 8. 향후 확장 가능 기능

- 백금(Platinum), 은(Silver) 시세 계산 추가
- 계산 이력 저장 (localStorage)
- 시세 변동 그래프 시각화 (Chart.js)
- PWA(Progressive Web App) 전환으로 오프라인 지원
- 카카오톡 공유 버튼 추가

---

## 9. 참고 자료

- [GitHub Pages 공식 문서](https://docs.github.com/en/pages)
- [GitHub Actions 공식 문서](https://docs.github.com/en/actions)
- [공공데이터포털 — 금융위원회 일반상품시세정보 API](https://www.data.go.kr/data/15094805/openapi.do)
- [KRX Open API 공식](https://openapi.krx.co.kr)
- [KRX 금시장 시세 조회](https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201060201)
- 금 순도 기준: 한국표준금거래소 고시 기준
- 부가가치세법 제14조 (세율 10% 적용)

---

*작성일: 2026년 6월 26일*
