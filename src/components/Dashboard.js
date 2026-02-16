'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Area
} from 'recharts';

const C = {
  bg: '#0a0e17', card: '#111827', border: '#1e293b',
  cyan: '#22d3ee', cyanDim: 'rgba(34,211,238,0.15)',
  green: '#34d399', greenDim: 'rgba(52,211,153,0.15)',
  amber: '#fbbf24', amberDim: 'rgba(251,191,36,0.15)',
  rose: '#fb7185',
  violet: '#a78bfa',
  text: '#e2e8f0', dim: '#64748b', white: '#f8fafc',
};

const SHOP_COLORS = {
  All: C.cyan, 'SF SK': '#22d3ee', 'SF CZ': '#a78bfa', 'SF DK': '#34d399', 'SF HU': '#fbbf24',
};

const SHOP_LABELS = {
  All: 'Všetky e-shopy', 'SF SK': '🇸🇰 SK', 'SF CZ': '🇨🇿 CZ', 'SF DK': '🇩🇰 DK', 'SF HU': '🇭🇺 HU',
};

// ============ SUB-COMPONENTS ============

function KPI({ label, value, sub, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div style={{ fontSize: 11, color: C.dim, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: C.white, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.dim, marginTop: 4, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

function Section({ children, sub }) {
  return (
    <div style={{ marginBottom: 14, marginTop: 32 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: C.white, margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>{children}</h2>
      {sub && <p style={{ fontSize: 12, color: C.dim, margin: '2px 0 0' }}>{sub}</p>}
    </div>
  );
}

function Heat({ value, max }) {
  if (value === null || value === undefined) return <td style={{ padding: '8px 10px', textAlign: 'center', color: C.dim, fontSize: 12 }}>—</td>;
  const i = Math.min(value / (max || 10), 1);
  return (
    <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: i > 0.4 ? C.white : C.cyan, background: `rgba(34,211,238,${0.05 + i * 0.5})`, fontFamily: "'JetBrains Mono', monospace" }}>
      {value.toFixed(1)}%
    </td>
  );
}

function Tip({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
      <div style={{ fontWeight: 600, color: C.white, marginBottom: 3 }}>{label}</div>
      {payload.filter(p => p.value != null).map((p, i) => (
        <div key={i} style={{ color: p.color || C.text, marginTop: 2 }}>
          {p.name}: <strong>{fmt ? fmt(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ============ MAIN DASHBOARD ============

export default function Dashboard({ data, loading, onFilterChange }) {
  const [shop, setShop] = useState('All');
  const [tab, setTab] = useState('overview');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [timingPct, setTimingPct] = useState(false);
  const [ltvPct, setLtvPct] = useState(false);
  const [groupPct, setGroupPct] = useState(false);

  const handleDateFrom = (v) => { setDateFrom(v); onFilterChange(v, dateTo, selectedProduct); };
  const handleDateTo = (v) => { setDateTo(v); onFilterChange(dateFrom, v, selectedProduct); };
  const handleProductChange = (v) => { setSelectedProduct(v); onFilterChange(dateFrom, dateTo, v); };

  const { shops, products, results } = data;
  const d = results[shop];
  const color = SHOP_COLORS[shop] || C.cyan;

  const tabs = [
    { id: 'overview', label: 'Prehľad' },
    { id: 'cohorts', label: 'Kohorty' },
    { id: 'timing', label: 'Čas do 2. nákupu' },
    { id: 'products', label: 'Produkty' },
    { id: 'trends', label: 'Trendy' },
    { id: 'ltv', label: 'LTV' },
    { id: 'groups', label: 'Skupiny' },
  ];

  const matureCohorts = (d.cohorts || []).filter((_, i) => i < Math.max(d.cohorts.length - 3, 1));
  const avgR90 = matureCohorts.length > 0 ? matureCohorts.reduce((s, c) => s + c.r90, 0) / matureCohorts.length : 0;

  const shopComparison = Object.entries(results)
    .filter(([k]) => k !== 'All')
    .map(([k, v]) => ({
      shop: SHOP_LABELS[k] || k,
      key: k,
      repeatRate: v.repeatRate,
      customers: v.totalCustomers,
      orders: v.totalOrders,
      median: v.timing.median,
      aov: v.monthly.length > 0 ? Math.round(v.monthly.reduce((s, m) => s + m.revenue, 0) / v.monthly.reduce((s, m) => s + m.orders, 0)) : 0,
    }));

  const inputStyle = {
    padding: '6px 10px', borderRadius: 7, border: `1px solid ${C.border}`,
    background: C.card, color: C.text, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
    outline: 'none', colorScheme: 'dark',
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex' }}>
      {/* Left Sidebar — Navigation */}
      <div style={{
        width: 200, minWidth: 200, borderRight: `1px solid ${C.border}`,
        background: 'linear-gradient(180deg, rgba(34,211,238,0.03) 0%, transparent 100%)',
        padding: '24px 14px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: C.white, margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
            Retenčný Report
          </h1>
          <p style={{ fontSize: 10, color: C.dim, margin: '4px 0 0', lineHeight: 1.4 }}>
            {d.totalCustomers?.toLocaleString()} zákazníkov<br />{d.totalOrders?.toLocaleString()} objednávok
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 9, color: C.dim, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 10px', marginBottom: 4 }}>Navigácia</div>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, transition: 'all 0.15s', textAlign: 'left',
              background: tab === t.id ? color : 'transparent',
              color: tab === t.id ? C.bg : C.dim,
            }}>{t.label}</button>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 20, fontSize: 9, color: C.dim, lineHeight: 1.5 }}>
          StretchFit Retention<br />Auto-refresh každú hodinu
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top Bar — E-shop filter, Logo, Date range */}
        <div style={{
          padding: '12px 28px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
          position: 'sticky', top: 0, zIndex: 10, background: C.bg,
        }}>
          {/* Left — E-shop filter */}
          <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 3 }}>
            {shops.map(s => (
              <button key={s} onClick={() => setShop(s)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                background: shop === s ? (SHOP_COLORS[s] || C.cyan) : 'transparent',
                color: shop === s ? C.bg : C.dim, whiteSpace: 'nowrap',
              }}>
                {s === 'All' ? 'Všetky' : s.replace('SF ', '')}
              </button>
            ))}
          </div>

          {/* Center — Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/logo.png" alt="StretchFit" style={{ height: 28, objectFit: 'contain' }} />
          </div>

          {/* Right — Date range filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Od</span>
            <input type="date" value={dateFrom} onChange={e => handleDateFrom(e.target.value)} style={inputStyle} />
            <span style={{ fontSize: 10, color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Do</span>
            <input type="date" value={dateTo} onChange={e => handleDateTo(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 32px 44px', maxWidth: 1200, margin: '0 auto', width: '100%', position: 'relative', opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>

        {/* ===== OVERVIEW ===== */}
        {tab === 'overview' && (<>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 6 }}>
            <KPI label="Repeat Rate" value={`${d.repeatRate}%`} sub={`${d.repeatCustomers?.toLocaleString()} z ${d.totalCustomers?.toLocaleString()}`} color={color} />
            <KPI label="Ø 90d repeat (zrelé)" value={`${avgR90.toFixed(1)}%`} sub="Priemer zrelých kohort" color={C.green} />
            <KPI label="Medián do 2. obj." value={`${d.timing.median}d`} sub={`P25: ${d.timing.p25}d · P75: ${d.timing.p75}d (n=${d.timing.n})`} color={C.amber} />
            <KPI label="Celkové tržby" value={`€${(d.monthly.reduce((s, m) => s + m.revenue, 0) / 1000000).toFixed(2)}M`} sub={`${d.totalOrders?.toLocaleString()} objednávok`} color={C.violet} />
            <KPI label="AOV" value={`€${d.totalOrders > 0 ? Math.round(d.monthly.reduce((s, m) => s + m.revenue, 0) / d.totalOrders) : 0}`} sub="Priem. hodnota objednávky" color={C.rose} />
          </div>

          {/* Shop comparison (only on All) */}
          {shop === 'All' && shopComparison.length > 1 && (<>
            <Section sub="Porovnanie e-shopov podľa kľúčových metrík">Porovnanie e-shopov</Section>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    {['E-shop', 'Zákazníci', 'Objednávky', 'Repeat Rate', 'Medián 2. obj.', 'AOV'].map((h, i) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'center', color: C.dim, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shopComparison.map((s, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }} onClick={() => setShop(s.key)}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: C.white }}>{s.shop}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>{s.customers.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>{s.orders.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: s.repeatRate > 20 ? C.green : s.repeatRate > 12 ? C.amber : C.rose }}>{s.repeatRate}%</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", color: C.amber }}>{s.median}d</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>€{s.aov}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>)}

          <Section sub="Mesačný vývoj podielu repeat zákazníkov">Podiel repeat zákazníkov</Section>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={d.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="month" tick={{ fill: C.dim, fontSize: 10 }} />
                <YAxis yAxisId="l" tick={{ fill: C.dim, fontSize: 10 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill: C.dim, fontSize: 10 }} unit="%" />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="new" name="Noví" fill={C.cyanDim} stroke={color} radius={[3, 3, 0, 0]} />
                <Bar yAxisId="l" dataKey="repeat" name="Repeat" fill={C.greenDim} stroke={C.green} radius={[3, 3, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="repeatPct" name="Repeat %" stroke={C.amber} strokeWidth={2.5} dot={{ r: 3, fill: C.amber }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>)}

        {/* ===== COHORTS ===== */}
        {tab === 'cohorts' && (<>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <Section sub="Nové kohorty a ich repeat rate v 30/60/90 dňových oknách">Kohortová retenčná tabuľka</Section>
            <div style={{ marginBottom: 14 }}>
              <select
                value={selectedProduct}
                onChange={e => handleProductChange(e.target.value)}
                style={{
                  ...inputStyle,
                  minWidth: 200,
                  maxWidth: 320,
                  cursor: 'pointer',
                }}
              >
                <option value="">Všetky produkty</option>
                {products.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.count})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(d.cohorts || []).length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 40, textAlign: 'center', color: C.dim }}>
              Žiadne kohorty pre zvolenú kombináciu filtrov
            </div>
          ) : (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  {['Kohorta', 'Veľkosť', '30d', '60d', '90d'].map((h, i) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: i === 0 ? 'left' : 'center', color: C.dim, fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(d.cohorts || []).map((c, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: C.white }}>{c.cohort}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>{c.size.toLocaleString()}</td>
                    <Heat value={c.r30} max={6} />
                    <Heat value={c.r60} max={8} />
                    <Heat value={c.r90} max={12} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          <Section sub="90-dňová kumulatívna repeat rate">90d repeat podľa kohorty</Section>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.cohorts || []}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="cohort" tick={{ fill: C.dim, fontSize: 10 }} />
                <YAxis tick={{ fill: C.dim, fontSize: 10 }} unit="%" />
                <Tooltip content={<Tip fmt={v => `${v}%`} />} />
                <Bar dataKey="r30" name="30d" fill={C.cyan} radius={[3, 3, 0, 0]} />
                <Bar dataKey="r60" name="60d" fill={C.green} radius={[3, 3, 0, 0]} />
                <Bar dataKey="r90" name="90d" fill={C.amber} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>)}

        {/* ===== TIMING ===== */}
        {tab === 'timing' && (<>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
            <div />
            <div>
              <select
                value={selectedProduct}
                onChange={e => handleProductChange(e.target.value)}
                style={{
                  ...inputStyle,
                  minWidth: 200,
                  maxWidth: 320,
                  cursor: 'pointer',
                }}
              >
                <option value="">Všetky produkty</option>
                {products.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.count})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <KPI label="Medián" value={`${d.timing.median} dní`} sub="Polovica repeat zákazníkov" color={C.cyan} />
            <KPI label="Priemer" value={`${d.timing.mean} dní`} sub="Stiahnutý outliermi" color={C.amber} />
            <KPI label="25. percentil" value={`${d.timing.p25} dní`} sub="Najrýchlejšia štvrtina" color={C.green} />
            <KPI label="75. percentil" value={`${d.timing.p75} dní`} sub="Tri štvrtiny do" color={C.violet} />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <Section sub={`Distribúcia dní do 2. objednávky (n=${d.timing.n})`}>Čas do druhej objednávky</Section>
            <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 3, marginBottom: 14 }}>
              {[{ key: false, label: 'Počet' }, { key: true, label: '%' }].map(o => (
                <button key={String(o.key)} onClick={() => setTimingPct(o.key)} style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
                  background: timingPct === o.key ? color : 'transparent',
                  color: timingPct === o.key ? C.bg : C.dim,
                }}>{o.label}</button>
              ))}
            </div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            {d.timing.n > 5 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={(d.distribution || []).filter(b => b.count > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="bucket" tick={{ fill: C.dim, fontSize: 10 }} />
                  <YAxis tick={{ fill: C.dim, fontSize: 10 }} unit={timingPct ? '%' : ''} />
                  <Tooltip content={<Tip fmt={v => timingPct ? `${v}%` : `${v} zákazníkov`} />} />
                  <Bar dataKey={timingPct ? 'pct' : 'count'} name={timingPct ? '%' : 'Zákazníci'} fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: C.dim }}>Nedostatok dát (n={d.timing.n})</div>
            )}
          </div>
        </>)}

        {/* ===== PRODUCTS ===== */}
        {tab === 'products' && (<>
          {/* Product retention table */}
          {d.productRetention && d.productRetention.length > 0 && (<>
            <Section sub="Aký % zákazníkov, čo kúpili produkt v 1. objednávke, sa vrátilo">Produktová retencia (1. objednávka → repeat)</Section>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    {['Produkt', 'Kupcov', 'Vrátilo sa', 'Retencia'].map((h, i) => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: i === 0 ? 'left' : 'center', color: C.dim, fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.productRetention.slice(0, 15).map((p, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '8px 10px', fontWeight: 500, color: C.white, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>{p.buyers.toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>{p.returned.toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: p.retention > 15 ? C.green : p.retention > 8 ? C.amber : C.rose }}>
                        {p.retention}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>)}

          {/* Product journey */}
          {d.productJourney && (<>
            <Section sub="Čo zákazníci kupujú v jednotlivých objednávkach">Product Journey (1. → 2. → 3. objednávka)</Section>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
              {[1, 2, 3].map(idx => (
                <div key={idx} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: [C.cyan, C.green, C.amber][idx - 1], margin: '0 0 12px', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {idx}. objednávka
                  </h3>
                  {(d.productJourney[idx] || []).slice(0, 7).map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}`, fontSize: 11 }}>
                      <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{p.product}</span>
                      <span style={{ color: C.dim, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, marginLeft: 8 }}>{p.count}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>)}

          {/* Product retention chart */}
          {d.productRetention && d.productRetention.length > 0 && (<>
            <Section sub="Vizualizácia retencie podľa produktov">Retencia podľa produktu</Section>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
              <ResponsiveContainer width="100%" height={Math.max(300, d.productRetention.slice(0, 12).length * 35)}>
                <BarChart data={d.productRetention.slice(0, 12).map(p => ({
                  ...p,
                  shortName: p.product.length > 35 ? p.product.substring(0, 35) + '...' : p.product,
                }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis type="number" tick={{ fill: C.dim, fontSize: 10 }} unit="%" />
                  <YAxis type="category" dataKey="shortName" tick={{ fill: C.text, fontSize: 10 }} width={250} />
                  <Tooltip content={<Tip fmt={v => `${v}%`} />} />
                  <Bar dataKey="retention" name="Retencia %" fill={C.cyan} radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>)}
        </>)}

        {/* ===== TRENDS ===== */}
        {tab === 'trends' && (<>
          <Section sub="Mesačný vývoj tržieb a objednávok">Tržby & objednávky</Section>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={d.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="month" tick={{ fill: C.dim, fontSize: 10 }} />
                <YAxis yAxisId="l" tick={{ fill: C.dim, fontSize: 10 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill: C.dim, fontSize: 10 }} />
                <Tooltip content={<Tip fmt={v => typeof v === 'number' && v > 500 ? `€${v.toLocaleString()}` : v} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="l" type="monotone" dataKey="revenue" name="Tržby (€)" fill={C.cyanDim} stroke={color} strokeWidth={2} />
                <Line yAxisId="r" type="monotone" dataKey="orders" name="Objednávky" stroke={C.amber} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <Section sub="Priemerná hodnota objednávky">AOV</Section>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={d.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="month" tick={{ fill: C.dim, fontSize: 10 }} />
                <YAxis tick={{ fill: C.dim, fontSize: 10 }} unit="€" domain={['auto', 'auto']} />
                <Tooltip content={<Tip fmt={v => `€${v}`} />} />
                <Line type="monotone" dataKey="aov" name="AOV" stroke={C.violet} strokeWidth={2.5} dot={{ r: 3.5, fill: C.violet }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <Section sub="Pomer nových a repeat zákazníkov">Zloženie zákazníckej bázy</Section>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={d.monthly} stackOffset="expand">
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="month" tick={{ fill: C.dim, fontSize: 10 }} />
                <YAxis tick={{ fill: C.dim, fontSize: 10 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="new" name="Noví" stackId="a" fill={color} />
                <Bar dataKey="repeat" name="Repeat" stackId="a" fill={C.green} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>)}

        {/* ===== LTV ===== */}
        {tab === 'ltv' && (() => {
          const maxCohortLtv = Math.max(...(d.ltvByCohort || []).map(c => c.avgLtv), 1);
          return (<>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <select
                value={selectedProduct}
                onChange={e => handleProductChange(e.target.value)}
                style={{
                  ...inputStyle,
                  minWidth: 200,
                  maxWidth: 320,
                  cursor: 'pointer',
                }}
              >
                <option value="">Všetky produkty</option>
                {products.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.count})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <KPI label="Priemerné LTV" value={`€${d.avgLtv?.toLocaleString() || 0}`} sub={`${d.totalCustomers?.toLocaleString()} zákazníkov`} color={C.cyan} />
              <KPI label="Celkové tržby" value={`€${((d.totalRevenue || 0) / 1000).toFixed(0)}k`} sub={`${d.totalOrders?.toLocaleString()} objednávok`} color={C.green} />
              <KPI label="LTV repeat zákazníkov" value={`€${d.repeatLtv?.toLocaleString() || 0}`} sub={`${d.repeatCustomers?.toLocaleString()} repeat zákazníkov`} color={C.amber} />
              <KPI label="LTV jednorazových" value={`€${d.oneTimeLtv?.toLocaleString() || 0}`} sub={`${((d.totalCustomers || 0) - (d.repeatCustomers || 0)).toLocaleString()} jednorazových`} color={C.violet} />
            </div>

            <Section sub="Priemerné celoživotné tržby na zákazníka podľa kohorty prvého nákupu">LTV podľa kohorty</Section>
            {(d.ltvByCohort || []).length === 0 ? (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 40, textAlign: 'center', color: C.dim }}>
                Žiadne kohorty pre zvolenú kombináciu filtrov
              </div>
            ) : (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                      {['Kohorta', 'Veľkosť', 'Priem. LTV (€)', 'Priem. obj.'].map((h, i) => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: i === 0 ? 'left' : 'center', color: C.dim, fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(d.ltvByCohort || []).map((c, i) => {
                      const intensity = Math.min(c.avgLtv / maxCohortLtv, 1);
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: C.white }}>{c.cohort}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>{c.size.toLocaleString()}</td>
                          <td style={{
                            padding: '8px 10px', textAlign: 'center', fontSize: 12, fontWeight: 600,
                            color: intensity > 0.4 ? C.white : C.cyan,
                            background: `rgba(34,211,238,${0.05 + intensity * 0.5})`,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}>
                            €{c.avgLtv.toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>{c.avgOrders}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <Section sub="Priemerné LTV na zákazníka podľa mesiaca prvého nákupu">LTV trend podľa kohorty</Section>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={d.ltvByCohort || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="cohort" tick={{ fill: C.dim, fontSize: 10 }} />
                  <YAxis tick={{ fill: C.dim, fontSize: 10 }} tickFormatter={v => `€${v}`} />
                  <Tooltip content={<Tip fmt={v => `€${v.toLocaleString()}`} />} />
                  <Bar dataKey="avgLtv" name="Priem. LTV" fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <Section sub={`Rozdelenie zákazníkov podľa celkovej útraty (n=${d.totalCustomers?.toLocaleString()})`}>Distribúcia LTV</Section>
              <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 3, marginBottom: 14 }}>
                {[{ key: false, label: 'Počet' }, { key: true, label: '%' }].map(o => (
                  <button key={String(o.key)} onClick={() => setLtvPct(o.key)} style={{
                    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
                    background: ltvPct === o.key ? color : 'transparent',
                    color: ltvPct === o.key ? C.bg : C.dim,
                  }}>{o.label}</button>
                ))}
              </div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={(d.ltvDistribution || []).filter(b => b.count > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="bucket" tick={{ fill: C.dim, fontSize: 10 }} />
                  <YAxis tick={{ fill: C.dim, fontSize: 10 }} unit={ltvPct ? '%' : ''} />
                  <Tooltip content={<Tip fmt={v => ltvPct ? `${v}%` : `${v} zákazníkov`} />} />
                  <Bar dataKey={ltvPct ? 'pct' : 'count'} name={ltvPct ? '%' : 'Zákazníci'} fill={C.violet} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>);
        })()}

        {tab === 'groups' && (() => {
          return (<>
            <select value={selectedProduct} onChange={e => handleProductChange(e.target.value)}
              style={{ ...inputStyle, minWidth: 200, maxWidth: 320, cursor: 'pointer', marginBottom: 10 }}>
              <option value="">Všetky produkty</option>
              {products.map(p => <option key={p.name} value={p.name}>{p.name} ({p.count})</option>)}
            </select>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <Section sub="Rozdelenie zákazníkov podľa celkovej životnej útraty">Skupiny podľa útraty</Section>
              <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 3, marginBottom: 14 }}>
                {[{ key: false, label: 'Počet' }, { key: true, label: '%' }].map(o => (
                  <button key={String(o.key)} onClick={() => setGroupPct(o.key)} style={{
                    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
                    background: groupPct === o.key ? color : 'transparent',
                    color: groupPct === o.key ? C.bg : C.dim,
                  }}>{o.label}</button>
                ))}
              </div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={d.spendGroups || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="bucket" tick={{ fill: C.dim, fontSize: 10 }} />
                  <YAxis tick={{ fill: C.dim, fontSize: 10 }} unit={groupPct ? '%' : ''} />
                  <Tooltip content={<Tip fmt={v => groupPct ? `${v}%` : `${v} zákazníkov`} />} />
                  <Bar dataKey={groupPct ? 'pct' : 'count'} name={groupPct ? '%' : 'Zákazníci'} fill={C.cyan} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <Section sub="Rozdelenie zákazníkov podľa počtu objednávok">Skupiny podľa objednávok</Section>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={d.orderGroups || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="bucket" tick={{ fill: C.dim, fontSize: 10 }} />
                  <YAxis tick={{ fill: C.dim, fontSize: 10 }} unit={groupPct ? '%' : ''} />
                  <Tooltip content={<Tip fmt={v => groupPct ? `${v}%` : `${v} zákazníkov`} />} />
                  <Bar dataKey={groupPct ? 'pct' : 'count'} name={groupPct ? '%' : 'Zákazníci'} fill={C.violet} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>);
        })()}

        <div style={{ fontSize: 10, color: C.dim, textAlign: 'center', marginTop: 32 }}>
          StretchFit Retention Dashboard · Dáta: Google Sheets (Shopify export) · Auto-refresh každú hodinu
        </div>
        </div>
      </div>
    </div>
  );
}
