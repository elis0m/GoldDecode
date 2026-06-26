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

let _chartHistory = null;
let _chartPeriod  = 12;
let _chartUnit    = 'g';

function renderChart(history, period, unit) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - period);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const slice = history.filter(h => h.date >= cutoffStr);
  if (slice.length < 2) return;

  const mult = unit === 'don' ? DON_TO_GRAM : 1;
  const unitLabel = unit === 'don' ? '원/돈' : '원/g';

  const W = 600, H = 220;
  const PAD = { top: 20, right: 24, bottom: 38, left: 74 };
  const CW = W - PAD.left - PAD.right;
  const CH = H - PAD.top - PAD.bottom;
  const n = slice.length;
  const prices = slice.map(h => h.price * mult);

  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const gap = (rawMax - rawMin) * 0.08;
  const yMin = rawMin - gap;
  const yMax = rawMax + gap;
  const yRange = yMax - yMin;

  const toX = i => PAD.left + (i / (n - 1)) * CW;
  const toY = p => PAD.top + (1 - (p - yMin) / yRange) * CH;

  const tickDiv = unit === 'don' ? 10000 : 10000;
  const tickStep = Math.ceil((rawMax - rawMin) / 4 / tickDiv) * tickDiv || tickDiv;
  const tickBase = Math.floor(rawMin / tickDiv) * tickDiv;
  const yTicks = [];
  for (let v = tickBase - tickStep; v <= rawMax + tickStep * 1.5; v += tickStep) {
    if (v >= yMin && v <= yMax) yTicks.push(v);
  }

  const monthLabels = [];
  let lastMonth = null;
  slice.forEach((h, i) => {
    const m = h.date.slice(0, 7);
    if (m !== lastMonth) { monthLabels.push({ i, label: h.date.slice(5, 7) + '월' }); lastMonth = m; }
  });

  const pts = slice.map((h, i) => ({ x: toX(i), y: toY(h.price * mult) }));
  function bezierPath(ps) {
    let d = `M ${ps[0].x.toFixed(1)} ${ps[0].y.toFixed(1)}`;
    for (let i = 1; i < ps.length; i++) {
      const mx = ((ps[i-1].x + ps[i].x) / 2).toFixed(1);
      d += ` C ${mx} ${ps[i-1].y.toFixed(1)} ${mx} ${ps[i].y.toFixed(1)} ${ps[i].x.toFixed(1)} ${ps[i].y.toFixed(1)}`;
    }
    return d;
  }
  const linePath = bezierPath(pts);
  const baseY = (PAD.top + CH).toFixed(1);
  const fillPath = `${linePath} L ${pts[n-1].x.toFixed(1)} ${baseY} L ${pts[0].x.toFixed(1)} ${baseY} Z`;

  const minIdx = prices.indexOf(rawMin);
  const maxIdx = prices.indexOf(rawMax);

  let s = `<defs>
    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#C9A84C" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#C9A84C" stop-opacity="0.02"/>
    </linearGradient>
    <clipPath id="cc">
      <rect x="${PAD.left}" y="${PAD.top}" width="${CW}" height="${CH}"/>
    </clipPath>
  </defs>`;

  yTicks.forEach(v => {
    const y = toY(v).toFixed(1);
    const label = unit === 'don'
      ? (v / 10000).toFixed(0) + '만'
      : (v / 10000).toFixed(0) + '만';
    s += `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + CW}" y2="${y}" stroke="rgba(128,128,128,0.15)" stroke-width="1" stroke-dasharray="3,4"/>`;
    s += `<text x="${PAD.left - 7}" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="11" fill="rgba(160,160,160,0.9)">${label}</text>`;
  });

  s += `<line x1="${PAD.left}" y1="${PAD.top + CH}" x2="${PAD.left + CW}" y2="${PAD.top + CH}" stroke="rgba(128,128,128,0.25)" stroke-width="1"/>`;

  monthLabels.forEach(({ i, label }) => {
    const x = toX(i);
    if (x < PAD.left + 18 || x > PAD.left + CW - 18) return;
    s += `<line x1="${x.toFixed(1)}" y1="${PAD.top + CH}" x2="${x.toFixed(1)}" y2="${PAD.top + CH + 4}" stroke="rgba(128,128,128,0.3)" stroke-width="1"/>`;
    s += `<text x="${x.toFixed(1)}" y="${PAD.top + CH + 15}" text-anchor="middle" font-size="10" fill="rgba(160,160,160,0.85)">${label}</text>`;
  });

  s += `<path d="${fillPath}" fill="url(#cg)" clip-path="url(#cc)"/>`;
  s += `<path d="${linePath}" fill="none" stroke="#C9A84C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#cc)"/>`;

  const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim();
  const surf = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim();

  const minX = toX(minIdx), minY = toY(rawMin);
  const minLabelY = minY + (minY < PAD.top + CH - 20 ? 14 : -8);
  s += `<circle cx="${minX.toFixed(1)}" cy="${minY.toFixed(1)}" r="4" style="fill:${surf};stroke:${gold};stroke-width:2"/>`;
  s += `<text x="${minX.toFixed(1)}" y="${minLabelY.toFixed(1)}" text-anchor="middle" font-size="10" fill="${gold}" opacity="0.9">최저</text>`;

  const maxX = toX(maxIdx), maxY = toY(rawMax);
  const maxLabelY = maxY + (maxY > PAD.top + 20 ? -8 : 14);
  s += `<circle cx="${maxX.toFixed(1)}" cy="${maxY.toFixed(1)}" r="4" style="fill:${surf};stroke:${gold};stroke-width:2"/>`;
  s += `<text x="${maxX.toFixed(1)}" y="${maxLabelY.toFixed(1)}" text-anchor="middle" font-size="10" fill="${gold}" opacity="0.9">최고</text>`;

  const lastX = toX(n - 1), lastY = toY(prices[n - 1]);
  s += `<circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="7" fill="none" stroke="${gold}" stroke-width="1" opacity="0.35"/>`;
  s += `<circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="4.5" fill="${gold}"/>`;

  s += `<line id="ct-xline" x1="0" y1="${PAD.top}" x2="0" y2="${PAD.top + CH}" stroke="${gold}" stroke-width="1" stroke-dasharray="4,3" opacity="0.55" style="display:none"/>`;
  s += `<circle id="ct-dot" r="4.5" style="fill:${gold};stroke:${surf};stroke-width:2;display:none"/>`;
  s += `<rect id="ct-overlay" x="${PAD.left}" y="${PAD.top}" width="${CW}" height="${CH}" fill="transparent" style="cursor:crosshair"/>`;

  document.getElementById('price-chart').innerHTML = s;

  const overlay = document.getElementById('ct-overlay');
  const xline   = document.getElementById('ct-xline');
  const dot     = document.getElementById('ct-dot');
  const tooltip = document.getElementById('chart-tooltip');
  const svgEl   = document.getElementById('price-chart');
  const wrapEl  = svgEl.closest('.chart-wrap');

  overlay.addEventListener('mousemove', e => {
    const svgRect  = svgEl.getBoundingClientRect();
    const wrapRect = wrapEl.getBoundingClientRect();
    const svgX     = (e.clientX - svgRect.left) * (W / svgRect.width);
    const idx      = Math.max(0, Math.min(n - 1, Math.round((svgX - PAD.left) / CW * (n - 1))));
    const h        = slice[idx];
    const cx = toX(idx), cy = toY(h.price * mult);

    xline.setAttribute('x1', cx.toFixed(1)); xline.setAttribute('x2', cx.toFixed(1));
    xline.style.display = '';
    dot.setAttribute('cx', cx.toFixed(1)); dot.setAttribute('cy', cy.toFixed(1));
    dot.style.display = '';

    const tipX = (cx / W) * svgRect.width + svgRect.left - wrapRect.left;
    const tipY = (cy / H) * svgRect.height;
    tooltip.style.display = 'flex';
    tooltip.style.left    = Math.min(tipX + 14, wrapRect.width - 155) + 'px';
    tooltip.style.top     = Math.max(tipY - 44, 4) + 'px';
    tooltip.innerHTML     = `<span class="tip-date">${h.date}</span><span class="tip-price">${Math.round(h.price * mult).toLocaleString('ko-KR')} ${unitLabel}</span>`;
  });

  overlay.addEventListener('mouseleave', () => {
    xline.style.display = dot.style.display = 'none';
    tooltip.style.display = 'none';
  });

  document.getElementById('chart-note').textContent =
    `${slice[0].date} ~ ${slice[n-1].date} · ${n}거래일 기준`;
}

async function loadPriceChart() {
  try {
    const res = await fetch('./data/gold-history.json', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;
    const history = await res.json();
    if (!Array.isArray(history) || history.length < 2) return;
    _chartHistory = history;
    renderChart(_chartHistory, _chartPeriod, _chartUnit);
  } catch (e) { console.error('[GoldDecode] 차트 렌더링 오류:', e); }
}

function setSpotPrice(price, source, date) {
  currentSpotPrice = price;
  document.getElementById('spot-price-display').textContent =
    `${price.toLocaleString('ko-KR')}원/g (24K)`;
  const badge = document.getElementById('spot-badge');
  badge.textContent = `🕐 ${date} 기준 (KRX)`;
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
  // 테마 초기화 (저장값 복원)
  const savedTheme = localStorage.getItem('theme');
  const toggleBtn  = document.getElementById('theme-toggle');
  if (savedTheme === 'light') {
    document.body.classList.add('light');
    toggleBtn.textContent = '☀️';
  }
  toggleBtn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    toggleBtn.textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    if (_chartHistory) renderChart(_chartHistory, _chartPeriod, _chartUnit);
  });

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

  // 차트 필터
  document.getElementById('chart-period-group').addEventListener('click', e => {
    const btn = e.target.closest('.chart-filter-btn[data-period]');
    if (!btn || !_chartHistory) return;
    document.querySelectorAll('#chart-period-group .chart-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _chartPeriod = parseInt(btn.dataset.period, 10);
    renderChart(_chartHistory, _chartPeriod, _chartUnit);
  });

  document.getElementById('chart-unit-group').addEventListener('click', e => {
    const btn = e.target.closest('.chart-filter-btn[data-unit]');
    if (!btn || !_chartHistory) return;
    document.querySelectorAll('#chart-unit-group .chart-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _chartUnit = btn.dataset.unit;
    renderChart(_chartHistory, _chartPeriod, _chartUnit);
  });

  // 계산 버튼
  document.getElementById('calc-btn').addEventListener('click', onCalculate);

  // 수동 시세 입력
  document.getElementById('spot-manual').addEventListener('input', e => {
    const val = parseFloat(e.target.value.replace(/,/g, ''));
    if (!isNaN(val) && val > 0) currentSpotPrice = val;
  });
});
