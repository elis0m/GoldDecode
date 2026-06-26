"""
GitHub Actions에서 실행: KRX Open API → data/gold-data.json 갱신
환경변수: KRX_API_KEY (GitHub Secrets)

KRX Open API 인증 흐름:
  1. GenerateOTP.jspx 로 OTP 발급
  2. 발급된 OTP를 data endpoint에 POST → JSON 응답
"""
import os, json, urllib.request, urllib.parse
from datetime import datetime, timezone, timedelta

OTP_URL  = 'https://openapi.krx.co.kr/contents/COM/GenerateOTP.jspx'
DATA_URL = 'https://openapi.krx.co.kr/contents/MDC/MDCA/MDCA11/MDCA11.jspx'
OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'gold-data.json')
KST = timezone(timedelta(hours=9))


def generate_otp(auth_key: str) -> str:
    params = urllib.parse.urlencode({
        'auth':          auth_key,
        'name':          '금시장시세',
        'ptnm':          'MDC0201060201',
        'mktsel':        'G',
        'share':         '1',
        'money':         '3',
        'csvxls_isNo':   'false',
    }).encode()
    req = urllib.request.Request(OTP_URL, data=params, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode().strip()


def fetch_gold_data(otp: str) -> list:
    body = urllib.parse.urlencode({'code': otp}).encode()
    req = urllib.request.Request(DATA_URL, data=body, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def parse_price(rows: list) -> dict:
    """
    KRX 금시장 응답에서 24K(금 99.99) 1g 기준가 추출.
    응답 필드: ISU_NM(종목명), TDD_CLSPRC(종가, 원/g), BAS_DD(기준일)
    """
    for row in rows:
        name = row.get('ISU_NM', '')
        if '99.99' in name:
            raw_price = row.get('TDD_CLSPRC', '').replace(',', '')
            price = float(raw_price)
            date  = row.get('BAS_DD', datetime.now(KST).strftime('%Y/%m/%d'))
            # BAS_DD 형식: YYYY/MM/DD → YYYY-MM-DD
            formatted = date.replace('/', '-')
            return {'price': price, 'unit': '원/g', 'basis': '24K',
                    'date': formatted, 'source': 'krx-openapi'}
    raise ValueError(f'금 99.99 종목을 응답에서 찾을 수 없음. rows={rows[:3]}')


def main():
    api_key = os.environ.get('KRX_API_KEY', '')
    if not api_key:
        raise RuntimeError('KRX_API_KEY 환경변수가 설정되지 않았습니다.')

    otp  = generate_otp(api_key)
    rows = fetch_gold_data(otp)
    result = parse_price(rows)

    print(f"[fetch_gold] {result['price']:,.0f}원/g ({result['date']})")

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"[fetch_gold] {OUT_PATH} 저장 완료")


if __name__ == '__main__':
    main()
