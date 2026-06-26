"""
GitHub Actions에서 실행: KRX Open API (data-dbg.krx.co.kr) → data/gold-data.json 갱신
환경변수: KRX_API_KEY (GitHub Secrets — openapi.krx.co.kr 발급 키)

API Spec:
  POST https://data-dbg.krx.co.kr/svc/apis/gen/gold_bydd_trd
  Header: AUTH_KEY: {api_key}
  Body:   {"basDd": "YYYYMMDD"}
  Response: {"OutBlock_1": [{BAS_DD, ISU_NM, TDD_CLSPRC, ...}]}
"""
import os, sys, json
from datetime import datetime, timezone, timedelta
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ENDPOINT = 'https://data-dbg.krx.co.kr/svc/apis/gen/gold_bydd_trd'
OUT_PATH  = os.path.join(os.path.dirname(__file__), '..', 'data', 'gold-data.json')
KST = timezone(timedelta(hours=9))


def fetch_by_date(api_key: str, date_str: str) -> list:
    """date_str: 'YYYYMMDD' 형식"""
    body = json.dumps({'basDd': date_str}).encode()
    req  = Request(
        ENDPOINT, data=body, method='POST',
        headers={
            'AUTH_KEY':     api_key,
            'Content-Type': 'application/json',
            'Accept':       'application/json',
        },
    )
    with urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
    return data.get('OutBlock_1', [])


def find_latest_price(api_key: str) -> dict:
    """오늘부터 최대 7일 전까지 거슬러 올라가며 유효한 종가 탐색"""
    today = datetime.now(KST)
    for delta in range(7):
        target = today - timedelta(days=delta)
        date_str = target.strftime('%Y%m%d')
        print(f'[fetch_gold] 조회 시도: {date_str}')

        try:
            rows = fetch_by_date(api_key, date_str)
        except HTTPError as e:
            print(f'[fetch_gold] HTTP {e.code} — {date_str} 건너뜀')
            continue

        for row in rows:
            name  = row.get('ISU_NM', '')
            price = row.get('TDD_CLSPRC', '-').replace(',', '')
            if '99.99' in name and price not in ('-', '', '0'):
                p = float(price)
                d = row.get('BAS_DD', date_str)
                formatted = f'{d[:4]}-{d[4:6]}-{d[6:]}' if len(d) == 8 else d
                print(f'[fetch_gold] 종목: {name} / {p:,.0f}원/g / {formatted}')
                return {'price': p, 'unit': '원/g', 'basis': '24K',
                        'date': formatted, 'source': 'krx-openapi'}

    raise RuntimeError('7일치 조회에서 유효한 금 시세를 찾지 못했습니다.')


def main():
    api_key = os.environ.get('KRX_API_KEY', '')
    if not api_key:
        sys.exit('KRX_API_KEY 환경변수가 없습니다.')

    result = find_latest_price(api_key)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f'[fetch_gold] 저장 완료: {result["price"]:,.0f}원/g ({result["date"]})')


if __name__ == '__main__':
    main()
