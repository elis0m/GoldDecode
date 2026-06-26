const PURITY = { '24K': 1.000, '18K': 0.750, '14K': 0.585 };
const DON_TO_GRAM = 3.75;
const VAT_RATE = 0.1;

// GitHub Actions가 갱신하는 시세 JSON (KRX Open API → Actions → JSON → 브라우저)
const FALLBACK_JSON = './data/gold-data.json';
