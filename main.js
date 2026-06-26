// ── 상태 ──────────────────────────────────────────────────────────────────────
let currentSpotPrice = null;
let currentMode = 'forward'; // 'forward' = 순산, 'reverse' = 역산

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function applyComma(input) {
  const raw = input.value.replace(/[^0-9]/g, '');
  if (!raw) { input.value = ''; return; }
  const pos = input.selectionStart;
  const prevLen = input.value.length;
  input.value = Number(raw).toLocaleString('ko-KR');
  // 커서 위치 보정
  input.selectionStart = input.selectionEnd = pos + (input.value.length - prevLen);
}

function parseCommaInput(id) {
  return parseFloat(document.getElementById(id).value.replace(/,/g, '')) || NaN;
}

function formatKRW(n) {
  if (isNaN(n) || n === null) return '-';
  return Math.round(n).toLocaleString('ko-KR') + '원';
}

function convertWeight(value, fromUnit) {
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  return fromUnit === 'g'
    ? (num / DON_TO_GRAM).toFixed(4)
    : (num * DON_TO_GRAM).toFixed(4);
}

// ── 시세 로드 (JSON → 수동) ───────────────────────────────────────────────────
// KRX Open API는 CORS 미지원 → GitHub Actions가 갱신한 gold-data.json만 사용
async function loadGoldPrice() {
  setSpotStatus('loading');

  try {
    const res = await fetch(FALLBACK_JSON, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const json = await res.json();
      if (json?.price > 0) {
        setSpotPrice(json.price, 'cache', json.date || '');
        return;
      }
    }
  } catch (_) {}

  setSpotStatus('manual');
}

async function loadPriceChart() {
  try {
    const res = await fetch('./data/gold-history.json', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;
    const history = await res.json();
    if (!Array.isArray(history) || history.length < 2) return;

    const W = 440, H = 140, PAD = { top: 12, bottom: 8, left: 4, right: 4 };
    const prices = history.map(h => h.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;
    const n = history.length;

    const toX = i => PAD.left + (i / (n - 1)) * (W - PAD.left - PAD.right);
    const toY = p => PAD.top + (1 - (p - minP) / range) * (H - PAD.top - PAD.bottom);

    // 라인 좌표
    const pts = history.map((h, i) => `${toX(i).toFixed(1)},${toY(h.price).toFixed(1)}`);

    // 채우기 영역 (라인 아래)
    const fillPts = [
      `${toX(0).toFixed(1)},${H - PAD.bottom}`,
      ...pts,
      `${toX(n - 1).toFixed(1)},${H - PAD.bottom}`,
    ].join(' ');

    const svg = document.getElementById('price-chart');
    svg.innerHTML = `
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#C9A84C" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#C9A84C" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <polygon points="${fillPts}" fill="url(#chartGrad)"/>
      <polyline points="${pts.join(' ')}" fill="none" stroke="#C9A84C" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${toX(n-1).toFixed(1)}" cy="${toY(prices[n-1]).toFixed(1)}" r="3.5" fill="#C9A84C"/>
    `;

    // 레이블
    document.getElementById('chart-label-start').textContent = history[0].date;
    document.getElementById('chart-label-end').textContent   = history[n - 1].date;
    document.getElementById('chart-min').textContent = `최저 ${Math.round(minP).toLocaleString('ko-KR')}원`;
    document.getElementById('chart-max').textContent = `최고 ${Math.round(maxP).toLocaleString('ko-KR')}원`;

    document.getElementById('chart-note').textContent =
      `${history[0].date} ~ ${history[n-1].date} · ${n}거래일 기준`;
  } catch (_) {}
}

function setSpotPrice(price, source, date) {
  currentSpotPrice = price;
  document.getElementById('spot-price-display').textContent =
    `${price.toLocaleString('ko-KR')}원/g (24K)`;
  const badge = document.getElementById('spot-badge');
  badge.textContent = `🕐 ${date} 기준 (KRX)`;
  updateRefTable(price);
  badge.className = 'spot-badge cached';
  document.getElementById('spot-manual-row').style.display = 'none';
  document.getElementById('spot-info').style.display = 'flex';
}

function setSpotStatus(status) {
  const info = document.getElementById('spot-info');
  const manual = document.getElementById('spot-manual-row');
  if (status === 'loading') {
    document.getElementById('spot-price-display').textContent = '시세 불러오는 중...';
    info.style.display = 'flex';
    manual.style.display = 'none';
  } else if (status === 'manual') {
    document.getElementById('spot-price-display').textContent = '시세 로드 실패';
    document.getElementById('spot-badge').textContent = '⚠️ 수동 입력 필요';
    document.getElementById('spot-badge').className = 'spot-badge error';
    info.style.display = 'flex';
    manual.style.display = 'flex';
  }
}

// ── 계산 로직 ──────────────────────────────────────────────────────────────────
function getSpotPrice() {
  const manualInput = document.getElementById('spot-manual').value;
  if (currentSpotPrice) return currentSpotPrice;
  const manual = parseFloat(manualInput);
  return isNaN(manual) ? null : manual;
}

function calcSalePrice(spotPrice, purity, weightG, workmanship) {
  const goldCost = spotPrice * purity * weightG;
  const vat = goldCost * VAT_RATE;
  const total = goldCost + vat + workmanship;
  return { goldCost, vat, workmanship, total };
}

function calcWorkmanship(spotPrice, purity, weightG, actualPrice) {
  const goldCost = spotPrice * purity * weightG;
  const vat = goldCost * VAT_RATE;
  const workmanship = actualPrice - goldCost - vat;
  return { goldCost, vat, workmanship, total: actualPrice };
}

// ── UI 이벤트 ──────────────────────────────────────────────────────────────────
function getSelectedPurity() {
  return document.querySelector('.purity-btn.active')?.dataset.purity || '24K';
}

function getWeightInGrams() {
  const val = parseFloat(document.getElementById('weight-input').value);
  const unit = document.getElementById('weight-unit').value;
  if (isNaN(val)) return null;
  return unit === 'don' ? val * DON_TO_GRAM : val;
}

function onCalculate() {
  const spotPrice = getSpotPrice();
  const purity = PURITY[getSelectedPurity()];
  const weightG = getWeightInGrams();

  if (!spotPrice) return showError('금 시세를 입력해주세요.');
  if (!weightG || weightG <= 0) return showError('무게를 입력해주세요.');

  let result;
  if (currentMode === 'forward') {
    const workmanship = parseCommaInput('workmanship-input');
    if (isNaN(workmanship) || workmanship < 0) return showError('세공비를 입력해주세요.');
    result = calcSalePrice(spotPrice, purity, weightG, workmanship);
  } else {
    const actualPrice = parseCommaInput('actual-price-input');
    if (isNaN(actualPrice) || actualPrice <= 0) return showError('실제 구매가를 입력해주세요.');
    result = calcWorkmanship(spotPrice, purity, weightG, actualPrice);
  }

  showResult(result);
}

function showResult({ goldCost, vat, workmanship, total }) {
  document.getElementById('result-gold-cost').textContent = formatKRW(goldCost);
  document.getElementById('result-vat').textContent = formatKRW(vat);

  const ratio = goldCost > 0 ? (workmanship / goldCost) * 100 : 0;
  const ratioText = workmanship >= 0 ? ` (순금 원가 대비 ${ratio.toFixed(1)}%)` : '';
  document.getElementById('result-workmanship').textContent = formatKRW(workmanship) + ratioText;

  document.getElementById('result-total').textContent = formatKRW(total);
  const section = document.getElementById('result-section');
  section.style.display = 'block';
  section.classList.add('animate-in');
  if (workmanship < 0) {
    document.getElementById('result-workmanship').classList.add('negative');
    document.getElementById('result-note').textContent =
      '⚠️ 세공비가 음수입니다. 입력값을 확인하세요.';
    document.getElementById('result-note').style.display = 'block';
  } else {
    document.getElementById('result-workmanship').classList.remove('negative');
    document.getElementById('result-note').style.display = 'none';
  }
}

function showError(msg) {
  alert(msg);
}

// ── 초기화 ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 시세 로드
  loadGoldPrice();
  loadPriceChart();

  // 모드 토글
  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', e => {
      currentMode = e.target.value;
      document.getElementById('forward-fields').style.display =
        currentMode === 'forward' ? 'block' : 'none';
      document.getElementById('reverse-fields').style.display =
        currentMode === 'reverse' ? 'block' : 'none';
      document.getElementById('result-section').style.display = 'none';
    });
  });

  // 순도 버튼
  document.querySelectorAll('.purity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.purity-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 무게 단위 전환 — 입력값 자동 환산
  document.getElementById('weight-unit').addEventListener('change', e => {
    const input = document.getElementById('weight-input');
    const newUnit = e.target.value;
    const fromUnit = newUnit === 'g' ? 'don' : 'g';
    if (input.value) {
      input.value = convertWeight(input.value, fromUnit);
    }
  });

  // 시세 직접 입력 토글
  document.getElementById('spot-edit-btn').addEventListener('click', () => {
    const row = document.getElementById('spot-manual-row');
    row.style.display = 'flex';
    document.getElementById('spot-manual').focus();
  });
  document.getElementById('spot-edit-cancel').addEventListener('click', () => {
    document.getElementById('spot-manual-row').style.display = 'none';
    document.getElementById('spot-manual').value = '';
    // 취소 시 원래 로드된 시세로 복원
    if (currentSpotPrice) {
      document.getElementById('spot-price-display').textContent =
        `${currentSpotPrice.toLocaleString('ko-KR')}원/g (24K)`;
    }
  });

  // 금액 입력 콤마 자동 포맷
  ['workmanship-input', 'actual-price-input', 'spot-manual'].forEach(id => {
    document.getElementById(id).addEventListener('input', function() {
      applyComma(this);
    });
  });

  // 계산 버튼
  document.getElementById('calc-btn').addEventListener('click', onCalculate);

  // 수동 시세 입력
  document.getElementById('spot-manual').addEventListener('input', e => {
    const val = parseFloat(e.target.value.replace(/,/g, ''));
    if (!isNaN(val) && val > 0) currentSpotPrice = val;
  });
});
