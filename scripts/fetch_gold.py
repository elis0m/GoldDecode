"""
GitHub Actions에서 실행: KRX Open API → data/gold-data.json 갱신
환경변수: KRX_API_KEY (GitHub Secrets — openapi.krx.co.kr 발급 키)
"""
import os, json, sys
from datetime import datetime, timezone, timedelta

try:
    import requests
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'requests', '-q'])
    import requests

OTP_URL  = 'https://openapi.krx.co.kr/contents/COM/GenerateOTP.jspx'
DATA_URL = 'https://openapi.krx.co.kr/contents/MDC/MDCA/MDCA11/MDCA11.jspx'
OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'gold-data.json')
KST = timezone(timedelta(hours=9))

SESSION_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Referer': 'https://openapi.krx.co.kr/',
    'Origin':  'https://openapi.krx.co.kr',
    'Accept':  'application/json, text/plain, */*',
}


def generate_otp(session: requests.Session, auth_key: str) -> str:
    params = {
        'auth':        auth_key,
        'name':        '금시장시세',
        'ptnm':        'MDC0201060201',
        'mktsel':      'G',
        'share':       '1',
        'money':       '3',
        'csvxls_isNo': 'false',
    }
    resp = session.get(OTP_URL, params=params, timeout=15)
    if resp.status_code != 200:
        print(f'[OTP 실패] HTTP {resp.status_code}')
        print(f'[OTP 응답] {resp.text[:500]}')
        resp.raise_for_status()
    otp = resp.text.strip()
    if not otp:
        raise ValueError('OTP 응답이 비어있습니다.')
    print(f'[fetch_gold] OTP 발급 성공: {otp[:8]}...')
    return otp


def fetch_gold_data(session: requests.Session, otp: str) -> list:
    resp = session.post(DATA_URL, data={'code': otp}, timeout=15)
    if resp.status_code != 200:
        print(f'[DATA 실패] HTTP {resp.status_code}')
        print(f'[DATA 응답] {resp.text[:500]}')
        resp.raise_for_status()
    data = resp.json()
    print(f'[fetch_gold] 응답 타입: {type(data).__name__}, 키: {list(data.keys()) if isinstance(data, dict) else "list"}')
    # 응답 구조에 따라 리스트 추출
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for v in data.values():
            if isinstance(v, list):
                return v
    return []


def parse_price(rows: list) -> dict:
    print(f'[fetch_gold] 행 수: {len(rows)}, 첫 행 키: {list(rows[0].keys()) if rows else "없음"}')
    for row in rows:
        name = row.get('ISU_NM', '') or row.get('itmsNm', '')
        if '99.99' in name:
            raw_price = (row.get('TDD_CLSPRC') or row.get('clpr') or '0').replace(',', '')
            price = float(raw_price)
            raw_date = row.get('BAS_DD') or row.get('basDt') or ''
            date = raw_date.replace('/', '-')
            if len(date) == 8:  # YYYYMMDD
                date = f'{date[:4]}-{date[4:6]}-{date[6:]}'
            print(f'[fetch_gold] 종목: {name} / {price:,.0f}원/g / {date}')
            return {'price': price, 'unit': '원/g', 'basis': '24K',
                    'date': date, 'source': 'krx-openapi'}
    raise ValueError(f'금 99.99 종목 없음. 첫 행: {rows[0] if rows else "없음"}')


def main():
    api_key = os.environ.get('KRX_API_KEY', '')
    if not api_key:
        raise RuntimeError('KRX_API_KEY 환경변수가 없습니다.')

    session = requests.Session()
    session.headers.update(SESSION_HEADERS)

    otp    = generate_otp(session, api_key)
    rows   = fetch_gold_data(session, otp)
    result = parse_price(rows)

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f'[fetch_gold] 저장 완료 → {OUT_PATH}')


if __name__ == '__main__':
    main()
