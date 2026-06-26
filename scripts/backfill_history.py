"""
과거 6개월치 금 시세를 KRX Open API에서 한 번에 수집해 gold-history.json에 저장.
GitHub Actions에서 workflow_dispatch로 1회만 실행.
환경변수: KRX_API_KEY
"""
import os, sys, json, time
from datetime import datetime, timezone, timedelta
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ENDPOINT     = 'https://data-dbg.krx.co.kr/svc/apis/gen/gold_bydd_trd'
HISTORY_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'gold-history.json')
KST          = timezone(timedelta(hours=9))


def fetch_by_date(api_key: str, date_str: str) -> list:
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
        return json.loads(resp.read()).get('OutBlock_1', [])


def extract_price(rows: list) -> float | None:
    for row in rows:
        name  = row.get('ISU_NM', '')
        price = row.get('TDD_CLSPRC', '-').replace(',', '')
        if '99.99' in name and price not in ('-', '', '0'):
            return float(price)
    return None


def main():
    api_key = os.environ.get('KRX_API_KEY', '')
    if not api_key:
        sys.exit('KRX_API_KEY 환경변수가 없습니다.')

    today   = datetime.now(KST).date()
    start   = today - timedelta(days=365)  # 약 1년

    history = []
    current = start
    while current <= today:
        date_str = current.strftime('%Y%m%d')
        try:
            rows  = fetch_by_date(api_key, date_str)
            price = extract_price(rows)
            if price:
                formatted = f'{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}'
                history.append({'date': formatted, 'price': price})
                print(f'  {formatted}: {price:,.0f}원/g')
            # 주말·공휴일은 데이터 없음 → 건너뜀
        except HTTPError as e:
            print(f'  {date_str}: HTTP {e.code} 건너뜀')
        except Exception as e:
            print(f'  {date_str}: 오류 — {e}')

        current += timedelta(days=1)
        time.sleep(0.3)  # API 부하 방지

    history.sort(key=lambda h: h['date'])
    with open(HISTORY_PATH, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)
    print(f'\n[backfill] 완료: {len(history)}건 저장 → {HISTORY_PATH}')


if __name__ == '__main__':
    main()
