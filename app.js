const form = document.querySelector('#profit-form');
const savedStatus = document.querySelector('#saved-status');
const storageKey = 'marginmint-scenarios-v1';

const fields = [
  'salePrice', 'shippingCharged', 'productCost', 'packagingCost', 'shippingCost', 'otherCost',
  'marketplaceFee', 'paymentRate', 'paymentFlat', 'listingFee', 'adRate', 'taxRate'
];

const defaults = {
  salePrice: 42, shippingCharged: 5, productCost: 9.5, packagingCost: 1.25,
  shippingCost: 4.8, otherCost: 0, marketplaceFee: 6.5, paymentRate: 3,
  paymentFlat: .25, listingFee: .2, adRate: 0, taxRate: 0
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const $ = (id) => document.querySelector(`#${id}`);

function value(name) {
  const raw = Number(form.elements[name].value);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function readValues() {
  return Object.fromEntries(fields.map((field) => [field, value(field)]));
}

function calculate(values = readValues()) {
  const revenue = values.salePrice + values.shippingCharged;
  const fulfillment = values.productCost + values.packagingCost + values.shippingCost + values.otherCost;
  const marketplace = revenue * values.marketplaceFee / 100;
  const payment = revenue * values.paymentRate / 100 + values.paymentFlat;
  const fees = marketplace + payment + values.listingFee;
  const marketingAndTax = revenue * (values.adRate + values.taxRate) / 100;
  const totalCosts = fulfillment + fees + marketingAndTax;
  const profit = revenue - totalCosts;
  const margin = revenue ? profit / revenue * 100 : 0;
  const variableRate = (values.marketplaceFee + values.paymentRate + values.adRate + values.taxRate) / 100;
  const fixedCosts = fulfillment + values.paymentFlat + values.listingFee;
  const breakEvenRevenue = variableRate < 1 ? fixedCosts / (1 - variableRate) : 0;
  const breakEvenSalePrice = Math.max(0, breakEvenRevenue - values.shippingCharged);

  return { revenue, fulfillment, fees, marketingAndTax, totalCosts, profit, margin, breakEvenSalePrice };
}

function displayMoney(number, negative = false) {
  const formatted = money.format(Math.abs(number));
  return negative ? `−${formatted}` : formatted;
}

function messageFor(result) {
  if (!result.revenue) return 'Add a selling price to estimate your profit.';
  if (result.profit < 0) return `This price loses ${displayMoney(result.profit)} per order. Raise the price or lower a cost.`;
  if (result.margin < 15) return 'Very slim margin. Check if it still covers your time and business overhead.';
  if (result.margin < 35) return 'A workable margin. Consider a buffer for discounts, returns, and your time.';
  return 'Healthy margin. You have room to account for time, discounts, or a surprise cost.';
}

function update() {
  const result = calculate();
  const revenueBase = result.revenue || 1;
  const profitPercent = Math.max(0, Math.min(100, result.profit / revenueBase * 100));
  const costsPercent = Math.max(0, Math.min(100, result.totalCosts / revenueBase * 100));

  $('net-profit').textContent = displayMoney(result.profit);
  $('margin-badge').firstChild.textContent = `${result.margin.toFixed(1)}%`;
  $('profit-message').textContent = messageFor(result);
  $('revenue-value').textContent = displayMoney(result.revenue);
  $('fulfillment-value').textContent = displayMoney(result.fulfillment, true);
  $('fees-value').textContent = displayMoney(result.fees, true);
  $('tax-value').textContent = displayMoney(result.marketingAndTax, true);
  $('break-even-value').textContent = displayMoney(result.breakEvenSalePrice);
  $('revenue-bar-label').textContent = displayMoney(result.revenue);
  $('cost-bar-label').textContent = displayMoney(result.totalCosts);
  $('profit-bar-label').textContent = displayMoney(result.profit);
  $('revenue-bar').style.width = result.revenue ? '100%' : '0%';
  $('cost-bar').style.width = `${costsPercent}%`;
  $('profit-bar').style.width = `${profitPercent}%`;

  const badge = $('margin-badge');
  badge.style.background = result.profit < 0 ? '#f7b5a6' : result.margin < 15 ? '#f5d58d' : '';
  return result;
}

function writeValues(values) {
  fields.forEach((field) => {
    form.elements[field].value = Number(values[field] ?? 0).toFixed(2).replace(/\.00$/, '');
  });
}

function scenarios() {
  try { return JSON.parse(localStorage.getItem(storageKey)) || []; }
  catch { return []; }
}

function setScenarios(items) {
  localStorage.setItem(storageKey, JSON.stringify(items));
}

function renderSaved() {
  const items = scenarios();
  const section = $('saved-section');
  const list = $('saved-list');
  section.hidden = !items.length;
  list.replaceChildren();
  items.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'saved-item';
    card.innerHTML = `
      <div class="saved-item-top"><span>${item.label}</span><span>${item.result.margin.toFixed(1)}% margin</span></div>
      <div class="saved-item-profit">${displayMoney(item.result.profit)}</div>
      <div class="saved-item-meta">Sale price: ${displayMoney(item.values.salePrice)} · Saved ${item.savedAt}</div>
      <div class="saved-item-actions"><button type="button" data-load="${index}">Load</button><button type="button" data-delete="${index}">Delete</button></div>`;
    list.append(card);
  });
}

function saveScenario() {
  const values = readValues();
  const result = calculate(values);
  const label = `Listing at ${displayMoney(values.salePrice)}`;
  const savedAt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date());
  const items = scenarios();
  items.unshift({ label, values, result, savedAt });
  setScenarios(items.slice(0, 12));
  renderSaved();
  savedStatus.textContent = 'Scenario saved in this browser.';
  window.setTimeout(() => { savedStatus.textContent = ''; }, 2400);
}

async function copySummary() {
  const values = readValues();
  const result = calculate(values);
  const summary = `MarginMint estimate\nSelling price: ${displayMoney(values.salePrice)}\nOrder revenue: ${displayMoney(result.revenue)}\nProduct & fulfillment: ${displayMoney(result.fulfillment, true)}\nMarketplace & payment fees: ${displayMoney(result.fees, true)}\nMarketing & tax set-aside: ${displayMoney(result.marketingAndTax, true)}\nEstimated net profit: ${displayMoney(result.profit)} (${result.margin.toFixed(1)}% margin)\nBreak-even selling price: ${displayMoney(result.breakEvenSalePrice)}`;
  try {
    await navigator.clipboard.writeText(summary);
    $('copy-button').textContent = 'Copied!';
    window.setTimeout(() => { $('copy-button').textContent = 'Copy summary'; }, 1800);
  } catch {
    $('copy-button').textContent = 'Copy unavailable';
    window.setTimeout(() => { $('copy-button').textContent = 'Copy summary'; }, 1800);
  }
}

form.addEventListener('input', update);
$('reset-button').addEventListener('click', () => { writeValues(defaults); update(); });
$('save-button').addEventListener('click', saveScenario);
$('copy-button').addEventListener('click', copySummary);
$('clear-saved-button').addEventListener('click', () => { localStorage.removeItem(storageKey); renderSaved(); });
$('saved-list').addEventListener('click', (event) => {
  const target = event.target;
  const loadIndex = target.dataset.load;
  const deleteIndex = target.dataset.delete;
  const items = scenarios();
  if (loadIndex !== undefined) { writeValues(items[loadIndex].values); update(); window.scrollTo({ top: $('calculator').offsetTop - 20, behavior: 'smooth' }); }
  if (deleteIndex !== undefined) { items.splice(deleteIndex, 1); setScenarios(items); renderSaved(); }
});

update();
renderSaved();
