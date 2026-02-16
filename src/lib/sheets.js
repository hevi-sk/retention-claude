const PUBLISHED_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSEiXi1u7NUmKiklwrtZbb8PbBJmt6PmKvHo4lepL0CUhPQWuNFObwmf3aPP4awq4xq1BD25WtzKXHb/pub?output=csv';

function parseCSVRows(text) {
  const rows = [];
  let i = 0;
  while (i < text.length) {
    const { fields, nextIndex } = parseCSVLine(text, i);
    rows.push(fields);
    i = nextIndex;
  }
  return rows;
}

function parseCSVLine(text, start) {
  const fields = [];
  let i = start;
  while (i < text.length) {
    if (text[i] === '"') {
      // Quoted field
      let field = '';
      i++; // skip opening quote
      while (i < text.length) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          field += text[i];
          i++;
        }
      }
      fields.push(field);
      // skip comma or newline
      if (text[i] === ',') { i++; }
      else {
        // end of line
        if (text[i] === '\r') i++;
        if (text[i] === '\n') i++;
        return { fields, nextIndex: i };
      }
    } else {
      // Unquoted field
      let field = '';
      while (i < text.length && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
        field += text[i];
        i++;
      }
      fields.push(field);
      if (text[i] === ',') { i++; }
      else {
        if (text[i] === '\r') i++;
        if (text[i] === '\n') i++;
        return { fields, nextIndex: i };
      }
    }
  }
  // End of text
  return { fields, nextIndex: i };
}

// Fetch raw data from published Google Sheet CSV
export async function fetchSheetData() {
  const response = await fetch(PUBLISHED_CSV_URL, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const rows = parseCSVRows(text);
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

// Filter rows to only customers whose first order contained the given product
export function filterRowsByProduct(rows, productName) {
  const matchingCustomers = new Set();
  for (const row of rows) {
    const product = row['Product Title'] || '';
    const orderIndex = parseInt(row['Customer Order Index']) || 0;
    if (orderIndex === 1 && product === productName) {
      matchingCustomers.add(row['Customer ID']);
    }
  }
  return rows.filter(r => matchingCustomers.has(r['Customer ID']));
}

// Extract product list (with counts >= 20) from raw rows
export function computeProductsList(rows) {
  const productCounts = {};
  for (const row of rows) {
    const product = row['Product Title'] || '';
    if (product) productCounts[product] = (productCounts[product] || 0) + 1;
  }
  return Object.entries(productCounts)
    .filter(([_, count]) => count >= 20)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

// Process raw rows into structured data
export function processData(rows) {
  // Parse rows
  const orders = [];
  for (const row of rows) {
    const date = row['Date'];
    const customerId = row['Customer ID'];
    const orderIndex = parseInt(row['Customer Order Index']) || 0;
    const product = row['Product Title'] || null;
    const shop = row['E-shop'] || 'Unknown';
    const totalSales = parseFloat(row['Total Sales (EUR)']) || 0;
    const orderName = row['Order Name'];

    if (!customerId || !date) continue;

    // Use only positive sales (exclude refund line items) for revenue
    const grossSales = totalSales > 0 ? totalSales : 0;
    orders.push({ orderName, date, customerId, orderIndex, product, shop, totalSales: grossSales });
  }

  // Get unique shops
  const shops = ['All', ...new Set(orders.map(o => o.shop))].sort();

  // Get unique products (non-null, with count > 20)
  const productCounts = {};
  orders.forEach(o => {
    if (o.product) productCounts[o.product] = (productCounts[o.product] || 0) + 1;
  });
  const products = Object.entries(productCounts)
    .filter(([_, count]) => count >= 20)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // Compute metrics for each shop
  const results = {};
  for (const shop of shops) {
    const filtered = shop === 'All' ? orders : orders.filter(o => o.shop === shop);
    results[shop] = computeMetrics(filtered);
  }

  return { shops, products, results };
}

function computeMetrics(orders) {
  // Deduplicate to order level
  const orderMap = new Map();
  for (const o of orders) {
    const key = `${o.orderName}|${o.customerId}`;
    if (!orderMap.has(key)) {
      orderMap.set(key, { ...o, products: o.product ? [o.product] : [] });
    } else {
      const existing = orderMap.get(key);
      existing.totalSales += o.totalSales;
      if (o.product) existing.products.push(o.product);
    }
  }
  const dedupedOrders = Array.from(orderMap.values());

  // Basic counts
  const customerIds = new Set(dedupedOrders.map(o => o.customerId));
  const repeatCustomerIds = new Set(dedupedOrders.filter(o => o.orderIndex >= 2).map(o => o.customerId));
  const totalCustomers = customerIds.size;
  const repeatCustomers = repeatCustomerIds.size;

  // Monthly trends
  const monthlyMap = new Map();
  for (const o of dedupedOrders) {
    const month = o.date.substring(0, 7); // YYYY-MM
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { orders: [], customers: new Set(), newCusts: new Set(), repeatCusts: new Set(), revenue: 0 });
    }
    const m = monthlyMap.get(month);
    m.orders.push(o);
    m.customers.add(o.customerId);
    m.revenue += o.totalSales;
    if (o.orderIndex === 1) m.newCusts.add(o.customerId);
    if (o.orderIndex >= 2) m.repeatCusts.add(o.customerId);
  }

  const monthly = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({
      month: formatMonth(month),
      orders: m.orders.length,
      revenue: Math.round(m.revenue),
      customers: m.customers.size,
      new: m.newCusts.size,
      repeat: m.repeatCusts.size,
      repeatPct: m.customers.size > 0 ? round1(m.repeatCusts.size / m.customers.size * 100) : 0,
      aov: m.orders.length > 0 ? Math.round(m.revenue / m.orders.length) : 0,
    }));

  // Cohorts
  const firstOrders = dedupedOrders.filter(o => o.orderIndex === 1);
  const cohortMap = new Map();
  for (const o of firstOrders) {
    const cohortMonth = o.date.substring(0, 7);
    if (!cohortMap.has(cohortMonth)) cohortMap.set(cohortMonth, []);
    cohortMap.get(cohortMonth).push(o);
  }

  const cohorts = Array.from(cohortMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohortMonth, cohortOrders]) => {
      const cohortCustIds = new Set(cohortOrders.map(o => o.customerId));
      const size = cohortCustIds.size;

      // First date per customer in cohort
      const firstDates = new Map();
      for (const o of cohortOrders) {
        const existing = firstDates.get(o.customerId);
        if (!existing || o.date < existing) firstDates.set(o.customerId, o.date);
      }

      // Find repeat orders from cohort customers
      const repeatOrders = dedupedOrders.filter(o => cohortCustIds.has(o.customerId) && o.orderIndex >= 2);

      let r30 = 0, r60 = 0, r90 = 0;
      for (const [custId, firstDate] of firstDates) {
        const custRepeats = repeatOrders.filter(o => o.customerId === custId && o.date > firstDate);
        if (custRepeats.length === 0) continue;
        const firstRepeatDate = custRepeats.reduce((min, o) => o.date < min ? o.date : min, custRepeats[0].date);
        const days = daysBetween(firstDate, firstRepeatDate);
        if (days > 0 && days <= 30) { r30++; r60++; r90++; }
        else if (days > 0 && days <= 60) { r60++; r90++; }
        else if (days > 0 && days <= 90) { r90++; }
      }

      return {
        cohort: formatMonth(cohortMonth),
        size,
        r30: size > 0 ? round1(r30 / size * 100) : 0,
        r60: size > 0 ? round1(r60 / size * 100) : 0,
        r90: size > 0 ? round1(r90 / size * 100) : 0,
      };
    });

  // Time to 2nd order
  const idx1Dates = new Map();
  const idx2Dates = new Map();
  for (const o of dedupedOrders) {
    if (o.orderIndex === 1) {
      const existing = idx1Dates.get(o.customerId);
      if (!existing || o.date < existing) idx1Dates.set(o.customerId, o.date);
    }
    if (o.orderIndex === 2) {
      const existing = idx2Dates.get(o.customerId);
      if (!existing || o.date < existing) idx2Dates.set(o.customerId, o.date);
    }
  }

  const daysTo2nd = [];
  for (const [custId, d1] of idx1Dates) {
    const d2 = idx2Dates.get(custId);
    if (d2) {
      const days = daysBetween(d1, d2);
      if (days > 0) daysTo2nd.push(days);
    }
  }
  daysTo2nd.sort((a, b) => a - b);

  const timing = daysTo2nd.length > 0 ? {
    median: percentile(daysTo2nd, 50),
    mean: round1(daysTo2nd.reduce((s, d) => s + d, 0) / daysTo2nd.length),
    p25: percentile(daysTo2nd, 25),
    p75: percentile(daysTo2nd, 75),
    n: daysTo2nd.length,
  } : { median: 0, mean: 0, p25: 0, p75: 0, n: 0 };

  // Distribution
  const buckets = [
    { label: '0–7d', min: 0, max: 7 },
    { label: '8–14d', min: 8, max: 14 },
    { label: '15–30d', min: 15, max: 30 },
    { label: '31–60d', min: 31, max: 60 },
    { label: '61–90d', min: 61, max: 90 },
    { label: '91–120d', min: 91, max: 120 },
    { label: '121–180d', min: 121, max: 180 },
    { label: '180d+', min: 181, max: 99999 },
  ];
  const distribution = buckets.map(b => {
    const count = daysTo2nd.filter(d => d >= b.min && d <= b.max).length;
    return { bucket: b.label, count, pct: daysTo2nd.length > 0 ? round1(count / daysTo2nd.length * 100) : 0 };
  });

  // Product retention (which first-order products lead to repeat purchases)
  const productRetention = computeProductRetention(orders, dedupedOrders, repeatCustomerIds);

  // Product journey (what do customers buy in 1st, 2nd, 3rd order)
  const productJourney = computeProductJourney(orders);

  // === LTV calculations ===
  const customerSpend = new Map();
  for (const o of dedupedOrders) {
    if (!customerSpend.has(o.customerId)) {
      customerSpend.set(o.customerId, { total: 0, count: 0 });
    }
    const cs = customerSpend.get(o.customerId);
    cs.total += o.totalSales;
    cs.count += 1;
  }

  const totalRevenue = dedupedOrders.reduce((s, o) => s + o.totalSales, 0);
  const avgLtv = totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0;

  let repeatTotal = 0, repeatCount = 0, oneTimeTotal = 0, oneTimeCount = 0;
  for (const [custId, cs] of customerSpend) {
    if (repeatCustomerIds.has(custId)) {
      repeatTotal += cs.total;
      repeatCount++;
    } else {
      oneTimeTotal += cs.total;
      oneTimeCount++;
    }
  }
  const repeatLtv = repeatCount > 0 ? Math.round(repeatTotal / repeatCount) : 0;
  const oneTimeLtv = oneTimeCount > 0 ? Math.round(oneTimeTotal / oneTimeCount) : 0;

  // LTV by cohort
  const ltvByCohort = Array.from(cohortMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohortMonth, cohortOrders]) => {
      const cohortCustIds = new Set(cohortOrders.map(o => o.customerId));
      const size = cohortCustIds.size;
      let cohortTotalSpend = 0, cohortTotalOrders = 0;
      for (const custId of cohortCustIds) {
        const cs = customerSpend.get(custId);
        if (cs) { cohortTotalSpend += cs.total; cohortTotalOrders += cs.count; }
      }
      return {
        cohort: formatMonth(cohortMonth),
        size,
        avgLtv: size > 0 ? Math.round(cohortTotalSpend / size) : 0,
        avgOrders: size > 0 ? round1(cohortTotalOrders / size) : 0,
      };
    });

  // LTV distribution
  function getLtvBucket(total) {
    if (total <= 50) return 0;
    if (total <= 100) return 1;
    if (total <= 200) return 2;
    if (total <= 500) return 3;
    return 4;
  }
  const ltvBucketLabels = ['€0–50', '€50–100', '€100–200', '€200–500', '€500+'];
  const ltvBucketCounts = [0, 0, 0, 0, 0];
  for (const [, cs] of customerSpend) {
    ltvBucketCounts[getLtvBucket(cs.total)]++;
  }
  const ltvDistribution = ltvBucketLabels.map((label, i) => ({
    bucket: label,
    count: ltvBucketCounts[i],
    pct: totalCustomers > 0 ? round1(ltvBucketCounts[i] / totalCustomers * 100) : 0,
  }));

  return {
    totalCustomers, repeatCustomers,
    repeatRate: totalCustomers > 0 ? round1(repeatCustomers / totalCustomers * 100) : 0,
    totalOrders: dedupedOrders.length,
    monthly, cohorts, timing, distribution, productRetention, productJourney,
    avgLtv, repeatLtv, oneTimeLtv, totalRevenue: Math.round(totalRevenue),
    ltvByCohort, ltvDistribution,
  };
}

function computeProductRetention(rawOrders, dedupedOrders, repeatCustomerIds) {
  // For each product bought in first order, what % of buyers came back
  const firstOrderProducts = rawOrders.filter(o => o.orderIndex === 1 && o.product);

  const productBuyers = new Map();
  for (const o of firstOrderProducts) {
    if (!productBuyers.has(o.product)) productBuyers.set(o.product, new Set());
    productBuyers.get(o.product).add(o.customerId);
  }

  return Array.from(productBuyers.entries())
    .filter(([_, buyers]) => buyers.size >= 20) // Min sample size
    .map(([product, buyers]) => {
      const returned = new Set([...buyers].filter(c => repeatCustomerIds.has(c)));
      return {
        product,
        buyers: buyers.size,
        returned: returned.size,
        retention: round1(returned.size / buyers.size * 100),
      };
    })
    .sort((a, b) => b.retention - a.retention);
}

function computeProductJourney(rawOrders) {
  // Top products by order index
  const journey = {};
  for (const idx of [1, 2, 3]) {
    const products = rawOrders.filter(o => o.orderIndex === idx && o.product);
    const counts = {};
    for (const o of products) {
      counts[o.product] = (counts[o.product] || 0) + 1;
    }
    journey[idx] = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([product, count]) => ({ product, count }));
  }
  return journey;
}

// Helpers
function daysBetween(d1, d2) {
  return Math.round((new Date(d2) - new Date(d1)) / 86400000);
}

function formatMonth(yyyymm) {
  const [y, m] = yyyymm.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

function round1(n) { return Math.round(n * 10) / 10; }

function percentile(sorted, p) {
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const frac = idx - lower;
  if (lower + 1 < sorted.length) {
    return Math.round(sorted[lower] + frac * (sorted[lower + 1] - sorted[lower]));
  }
  return sorted[lower];
}

// Compute product-filtered metrics
export function computeFilteredMetrics(rows, productFilter, orderIndexFilter) {
  // Find customers who bought the specified product in the specified order index
  const matchingCustomers = new Set();
  for (const row of rows) {
    const product = row['Product Title'] || '';
    const orderIndex = parseInt(row['Customer Order Index']) || 0;
    if (product === productFilter && orderIndex === orderIndexFilter) {
      matchingCustomers.add(row['Customer ID']);
    }
  }

  // Filter all rows to only these customers
  const filteredRows = rows.filter(r => matchingCustomers.has(r['Customer ID']));

  return { customerCount: matchingCustomers.size, data: processData(filteredRows) };
}
