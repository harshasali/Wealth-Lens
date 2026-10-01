import React, { useEffect, useMemo, useState } from 'react';
import LineChart from './LineChart.jsx';

const ASSET_TYPES = [
  'Real Estate',
  'Equities (Stocks)',
  'Fixed Deposits (FDs)',
  'Mutual Funds',
  'Gold and Precious Metals',
  'Provident Fund (PF)',
  'Public Provident Fund (PPF)',
  'National Pension System (NPS)',
  'Bonds and Debentures',
  'Savings Accounts',
  'Cryptocurrency',
];

const LIABILITY_TYPES = [
  'Home Mortgage',
  'Car Loan',
  'Personal Loan',
  'Student Loan',
  'Credit Card Debt',
  'Business Loan',
];

const CURRENT_YEAR = new Date().getFullYear();
const HORIZON = 10;
const STORAGE_KEY = 'wealthlens-v1';

const CURRENCIES = {
  INR: { symbol: '₹', locale: 'en-IN', label: 'INR (₹)' },
  USD: { symbol: '$', locale: 'en-US', label: 'USD ($)' },
  EUR: { symbol: '€', locale: 'en-IE', label: 'EUR (€)' },
  GBP: { symbol: '£', locale: 'en-GB', label: 'GBP (£)' },
};

const makeFmt = (code) => {
  const c = CURRENCIES[code] || CURRENCIES.INR;
  const nf = new Intl.NumberFormat(c.locale, { maximumFractionDigits: 0 });
  return (n) => `${c.symbol}${nf.format(Math.round(n || 0))}`;
};
const compactFmt = (code) => {
  const c = CURRENCIES[code] || CURRENCIES.INR;
  const nf = new Intl.NumberFormat(c.locale, { notation: 'compact', maximumFractionDigits: 1 });
  return (n) => `${c.symbol}${nf.format(n || 0)}`;
};

const compound = (p, r, y) => p * Math.pow(1 + r / 100, y);

function loanBalance(principal, ratePct, emi, years) {
  const r = ratePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return Math.max(0, principal - emi * n);
  const bal = principal * Math.pow(1 + r, n) - emi * ((Math.pow(1 + r, n) - 1) / r);
  return Math.max(0, bal);
}

const defaultAssets = [
  { id: 1, type: 'Equities (Stocks)', amount: 50000, cagr: 12, year: 2022 },
  { id: 2, type: 'Mutual Funds', amount: 100000, cagr: 11, year: 2022 },
  { id: 3, type: 'Fixed Deposits (FDs)', amount: 20000, cagr: 7, year: 2022 },
  { id: 4, type: 'Gold and Precious Metals', amount: 3000, cagr: 8, year: 2022 },
];
const defaultLiabilities = [
  { id: 1, type: 'Home Mortgage', amount: 200000, rate: 4, tenure: 20, emi: 1500, year: 2022 },
  { id: 2, type: 'Car Loan', amount: 30000, rate: 6, tenure: 5, emi: 500, year: 2022 },
];

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? null; } catch { return null; }
};

const COLORS = {
  amber: '#f5b84a',
  indigo: '#7d6cf0',
  teal: '#4dd4c6',
  rose: '#ef6b7e',
  sky: '#7cc8ff',
};

export default function App() {
  const init = load();
  const [assets, setAssets] = useState(init?.assets ?? defaultAssets);
  const [liabilities, setLiabilities] = useState(init?.liabilities ?? defaultLiabilities);
  const [bankRate, setBankRate] = useState(init?.bankRate ?? 3.5);
  const [currency, setCurrency] = useState(init?.currency ?? 'INR');

  const fmt = useMemo(() => makeFmt(currency), [currency]);
  const fmtCompact = useMemo(() => compactFmt(currency), [currency]);
  const sym = CURRENCIES[currency].symbol;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ assets, liabilities, bankRate, currency }));
  }, [assets, liabilities, bankRate, currency]);

  const totals = useMemo(() => {
    const assetVal = assets.reduce(
      (s, a) => s + compound(+a.amount || 0, +a.cagr || 0, Math.max(0, CURRENT_YEAR - (+a.year || CURRENT_YEAR))), 0);
    const bankOnlyVal = assets.reduce(
      (s, a) => s + compound(+a.amount || 0, +bankRate || 0, Math.max(0, CURRENT_YEAR - (+a.year || CURRENT_YEAR))), 0);
    const principal = assets.reduce((s, a) => s + (+a.amount || 0), 0);
    const liabVal = liabilities.reduce(
      (s, l) => s + loanBalance(+l.amount || 0, +l.rate || 0, +l.emi || 0, Math.max(0, CURRENT_YEAR - (+l.year || CURRENT_YEAR))), 0);
    return { assetVal, liabVal, netWorth: assetVal - liabVal, bankOnlyVal, principal };
  }, [assets, liabilities, bankRate]);

  const projection = useMemo(() => {
    const years = Array.from({ length: HORIZON + 1 }, (_, i) => CURRENT_YEAR + i);
    const invested = [], bankOnly = [], liab = [], net = [];
    years.forEach((y) => {
      let aSum = 0, bSum = 0;
      assets.forEach((a) => {
        const yrs = Math.max(0, y - (+a.year || y));
        aSum += compound(+a.amount || 0, +a.cagr || 0, yrs);
        bSum += compound(+a.amount || 0, +bankRate || 0, yrs);
      });
      let lSum = 0;
      liabilities.forEach((l) => {
        const yrs = Math.max(0, y - (+l.year || y));
        lSum += loanBalance(+l.amount || 0, +l.rate || 0, +l.emi || 0, yrs);
      });
      invested.push({ x: y, y: aSum });
      bankOnly.push({ x: y, y: bSum });
      liab.push({ x: y, y: lSum });
      net.push({ x: y, y: aSum - lSum });
    });
    return { invested, bankOnly, liab, net };
  }, [assets, liabilities, bankRate]);

  // Asset mix donut
  const mix = useMemo(() => {
    const map = new Map();
    assets.forEach((a) => {
      const v = compound(+a.amount || 0, +a.cagr || 0, Math.max(0, CURRENT_YEAR - (+a.year || CURRENT_YEAR)));
      map.set(a.type, (map.get(a.type) || 0) + v);
    });
    const total = [...map.values()].reduce((s, v) => s + v, 0) || 1;
    return [...map.entries()]
      .map(([type, v]) => ({ type, v, pct: (v / total) * 100 }))
      .sort((a, b) => b.v - a.v);
  }, [assets]);

  const addAsset = () =>
    setAssets((a) => [...a, { id: Date.now(), type: 'Equities (Stocks)', amount: 0, cagr: 10, year: CURRENT_YEAR }]);
  const addLiability = () =>
    setLiabilities((l) => [...l, { id: Date.now(), type: 'Home Mortgage', amount: 0, rate: 5, tenure: 10, emi: 0, year: CURRENT_YEAR }]);
  const upd = (setter) => (id, key, val) =>
    setter((arr) => arr.map((row) => (row.id === id ? { ...row, [key]: val } : row)));
  const rm = (setter) => (id) => setter((arr) => arr.filter((r) => r.id !== id));

  const alpha = totals.assetVal - totals.bankOnlyVal;
  const alphaPct = totals.bankOnlyVal > 0 ? (alpha / totals.bankOnlyVal) * 100 : 0;
  const gainPct = totals.principal > 0 ? ((totals.assetVal - totals.principal) / totals.principal) * 100 : 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 pt-8 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <div className="serif text-xl">WealthLens</div>
            <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: 'var(--muted)' }}>
              Investment helper & tracker
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-7 text-[12px] tracking-[0.18em] uppercase" style={{ color: 'var(--muted)' }}>
            <a href="#about" className="hover:text-white">About</a>
            <a href="#dashboard" className="hover:text-white">Dashboard</a>
            <a href="#what-if" className="hover:text-white">What-If</a>
            <a href="#portfolio" className="hover:text-white">Portfolio</a>
          </nav>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>Currency</span>
            <select
              className="field py-1.5 pr-7 w-auto text-sm"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label="Currency"
            >
              {Object.entries(CURRENCIES).map(([code, c]) => (
                <option key={code} value={code}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* HERO / Purpose */}
      <section id="about" className="max-w-6xl mx-auto px-6 pt-10 pb-12 grid md:grid-cols-12 gap-8 items-end">
        <div className="md:col-span-7">
          <span className="chip"><span className="dot" style={{ background: COLORS.amber }} />A scholarship project</span>
          <h1 className="serif text-5xl md:text-6xl leading-[1.05] mt-5">
            See your money <em className="not-italic" style={{ color: COLORS.amber }}>clearly</em>.
            <br /> Decide with <em className="not-italic" style={{ color: COLORS.teal }}>confidence</em>.
          </h1>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--muted)', maxWidth: 580 }}>
            WealthLens is a friendly investment helper for people who never got a personal-finance
            class. Log what you own and owe, project where you'll be in ten years, and ask the most
            useful what-if of all — <span className="text-white">"what if I had just left it in the bank?"</span>
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <a href="#dashboard" className="btn-primary">Open my dashboard</a>
            <a href="#what-if" className="btn-ghost">Try the what-if</a>
          </div>
        </div>
        <div className="md:col-span-5">
          <div className="panel-soft p-6">
            <div className="text-[11px] uppercase tracking-[0.22em] mb-4" style={{ color: 'var(--muted)' }}>
              Why it matters
            </div>
            <ul className="space-y-4 text-[15px] leading-relaxed">
              <Bullet color={COLORS.amber} title="Clarity over jargon">
                Plain-English numbers, no finance degree required.
              </Bullet>
              <Bullet color={COLORS.teal} title="The honest comparison">
                Every investment shown next to the boring savings-account baseline — so you know if the risk paid off.
              </Bullet>
              <Bullet color={COLORS.indigo} title="Yours, privately">
                Everything stays on your device. No accounts, no tracking, no ads.
              </Bullet>
            </ul>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6"><div className="divider-soft" /></div>

      {/* Dashboard */}
      <section id="dashboard" className="max-w-6xl mx-auto px-6 py-12">
        <SectionHead eyebrow="Today" title="Where you stand right now" />
        <div className="grid md:grid-cols-12 gap-5 mt-6">
          <BigStat
            className="md:col-span-5"
            label="Net worth"
            value={fmt(totals.netWorth)}
            accent={totals.netWorth >= 0 ? COLORS.teal : COLORS.rose}
            sub={`${fmt(totals.assetVal)} assets − ${fmt(totals.liabVal)} liabilities`}
          />
          <SmallStat className="md:col-span-3" label="Assets" value={fmt(totals.assetVal)} accent={COLORS.amber} />
          <SmallStat className="md:col-span-2" label="Liabilities" value={fmt(totals.liabVal)} accent={COLORS.rose} />
          <SmallStat
            className="md:col-span-2"
            label="Return on principal"
            value={`${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%`}
            accent={gainPct >= 0 ? COLORS.teal : COLORS.rose}
          />
        </div>

        <div className="grid lg:grid-cols-12 gap-5 mt-5">
          <div className="panel lg:col-span-7">
            <SubHead title="Next 10 years" hint="Assets compounded at your CAGR, liabilities amortized at the EMI you set." />
            <LineChart
              series={[
                { name: 'Assets', color: COLORS.amber, points: projection.invested },
                { name: 'Liabilities', color: COLORS.rose, points: projection.liab },
                { name: 'Net worth', color: COLORS.indigo, points: projection.net, fill: false, dashed: true },
              ]}
              yFormat={fmtCompact}
            />
          </div>
          <div className="panel lg:col-span-5">
            <SubHead title="Asset mix" hint="Share of today's portfolio by type." />
            <MixDonut data={mix} />
          </div>
        </div>
      </section>

      {/* What-If */}
      <section id="what-if" className="max-w-6xl mx-auto px-6 py-12">
        <div className="panel-soft p-7">
          <SectionHead
            eyebrow="The honest question"
            title={<>What if you'd just left it in the <em className="serif not-italic" style={{ color: COLORS.amber }}>bank</em>?</>}
          />
          <p className="mt-3 max-w-3xl" style={{ color: 'var(--muted)' }}>
            We re-run every contribution at a plain savings rate and compare it to what you actually invested.
            The gap — your <span className="text-white">investing alpha</span> — is the part the risk actually paid for.
          </p>

          <div className="flex flex-wrap items-end gap-6 mt-6">
            <div>
              <label className="label">Savings rate</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" step="0.1" min="0" className="field w-24"
                  value={bankRate} onChange={(e) => setBankRate(+e.target.value)}
                />
                <span style={{ color: 'var(--muted)' }}>% / year</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 flex-1 min-w-[300px]">
              <Pill label="Invested today" value={fmt(totals.assetVal)} color={COLORS.amber} />
              <Pill label="If in bank" value={fmt(totals.bankOnlyVal)} color={COLORS.sky} />
              <Pill
                label="Your alpha"
                value={`${alpha >= 0 ? '+' : ''}${fmt(alpha)} · ${alphaPct.toFixed(1)}%`}
                color={alpha >= 0 ? COLORS.teal : COLORS.rose}
              />
            </div>
          </div>

          <div className="mt-7">
            <LineChart
              series={[
                { name: 'What you actually invested', color: COLORS.amber, points: projection.invested },
                { name: 'If left in a savings account', color: COLORS.sky, points: projection.bankOnly, dashed: true },
              ]}
              yFormat={fmtCompact}
            />
          </div>
        </div>
      </section>

      {/* Portfolio */}
      <section id="portfolio" className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        <SectionHead eyebrow="Your numbers" title="Portfolio & obligations" />

        <div className="panel">
          <div className="flex items-center justify-between mb-5">
            <SubHead title="Investments" hint="What you own and what it's growing into." />
            <button className="btn-primary" onClick={addAsset}>+ Add investment</button>
          </div>
          <div className="space-y-3">
            {assets.map((a) => (
              <RowCard key={a.id}>
                <Field label="Type">
                  <select className="field" value={a.type} onChange={(e) => upd(setAssets)(a.id, 'type', e.target.value)}>
                    {ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Amount invested">
                  <MoneyInput sym={sym} value={a.amount} onChange={(v) => upd(setAssets)(a.id, 'amount', v)} />
                </Field>
                <Field label="Expected CAGR">
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.1" className="field" value={a.cagr}
                      onChange={(e) => upd(setAssets)(a.id, 'cagr', +e.target.value)} />
                    <span style={{ color: 'var(--muted)' }}>%</span>
                  </div>
                </Field>
                <Field label="Started in">
                  <input type="number" className="field" value={a.year}
                    onChange={(e) => upd(setAssets)(a.id, 'year', +e.target.value)} />
                </Field>
                <Field label="Worth today">
                  <div className="field" style={{ background: 'rgba(245,184,74,0.08)', color: COLORS.amber, borderColor: 'rgba(245,184,74,0.30)' }}>
                    {fmt(compound(+a.amount || 0, +a.cagr || 0, Math.max(0, CURRENT_YEAR - (+a.year || CURRENT_YEAR))))}
                  </div>
                </Field>
                <div className="flex items-end">
                  <button className="btn-danger w-full" onClick={() => rm(setAssets)(a.id)}>Remove</button>
                </div>
              </RowCard>
            ))}
            {assets.length === 0 && <Empty label="No investments yet — add your first one above." />}
          </div>
        </div>

        <div className="panel">
          <div className="flex items-center justify-between mb-5">
            <SubHead title="Liabilities" hint="Loans amortize using the EMI you actually pay." />
            <button className="btn-primary" onClick={addLiability}>+ Add liability</button>
          </div>
          <div className="space-y-3">
            {liabilities.map((l) => (
              <RowCard key={l.id} cols={7}>
                <Field label="Type">
                  <select className="field" value={l.type} onChange={(e) => upd(setLiabilities)(l.id, 'type', e.target.value)}>
                    {LIABILITY_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Original amount">
                  <MoneyInput sym={sym} value={l.amount} onChange={(v) => upd(setLiabilities)(l.id, 'amount', v)} />
                </Field>
                <Field label="Interest %">
                  <input type="number" step="0.1" className="field" value={l.rate}
                    onChange={(e) => upd(setLiabilities)(l.id, 'rate', +e.target.value)} />
                </Field>
                <Field label="Tenure (yrs)">
                  <input type="number" className="field" value={l.tenure}
                    onChange={(e) => upd(setLiabilities)(l.id, 'tenure', +e.target.value)} />
                </Field>
                <Field label="Monthly EMI">
                  <MoneyInput sym={sym} value={l.emi} onChange={(v) => upd(setLiabilities)(l.id, 'emi', v)} />
                </Field>
                <Field label="Balance">
                  <div className="field" style={{ background: 'rgba(239,107,126,0.08)', color: COLORS.rose, borderColor: 'rgba(239,107,126,0.30)' }}>
                    {fmt(loanBalance(+l.amount || 0, +l.rate || 0, +l.emi || 0, Math.max(0, CURRENT_YEAR - (+l.year || CURRENT_YEAR))))}
                  </div>
                </Field>
                <div className="flex items-end">
                  <button className="btn-danger w-full" onClick={() => rm(setLiabilities)(l.id)}>Remove</button>
                </div>
              </RowCard>
            ))}
            {liabilities.length === 0 && <Empty label="No liabilities — debt-free is a great place to be." />}
          </div>
        </div>

        {/* Insights */}
        <div className="panel-soft p-7">
          <SubHead title="Quiet observations" hint="A few notes based on what you entered." />
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {alpha < 0 && (
              <Note tone="rose" title="Your portfolio is trailing a savings account">
                The risk you're taking isn't being rewarded yet. Worth a rebalance or a longer time horizon.
              </Note>
            )}
            {alpha >= 0 && totals.bankOnlyVal > 0 && (
              <Note tone="teal" title="Investing is paying off">
                You're ahead of the bank baseline by {fmt(alpha)} ({alphaPct.toFixed(1)}%).
              </Note>
            )}
            {totals.liabVal > totals.assetVal && (
              <Note tone="amber" title="Debt is heavier than savings">
                Prioritising high-interest debt usually beats most stock returns.
              </Note>
            )}
            {assets.some((a) => +a.cagr > 25) && (
              <Note tone="amber" title="One of your CAGRs looks optimistic">
                25%+ a year for a decade is rare. Try stress-testing with a lower number.
              </Note>
            )}
            <Note tone="indigo" title="Privacy by default">
              Everything you enter is saved in your browser only — nothing leaves this device.
            </Note>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 pb-10 pt-2">
        <div className="divider-soft mb-6" />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm" style={{ color: 'var(--muted)' }}>
          <div>WealthLens · An open educational project.</div>
          <div>
            Designed & built by{' '}
            <a href="https://www.linkedin.com/in/harshamsali/" target="_blank" rel="noreferrer"
               className="hover:text-white" style={{ color: COLORS.amber, textDecoration: 'underline', textUnderlineOffset: 4 }}>
              Harshavardhan Sali
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <div className="w-11 h-11 rounded-2xl grid place-items-center"
         style={{ background: 'linear-gradient(135deg, #f5b84a, #ef6b7e 60%, #7d6cf0)' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="10" cy="10" r="6" stroke="#1a1330" strokeWidth="2.5" />
        <path d="M15 15 L21 21" stroke="#1a1330" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function SectionHead({ eyebrow, title }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: 'var(--muted)' }}>{eyebrow}</div>
      <h2 className="serif text-3xl md:text-4xl mt-2">{title}</h2>
    </div>
  );
}
function SubHead({ title, hint }) {
  return (
    <div>
      <div className="serif text-xl">{title}</div>
      {hint && <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{hint}</div>}
    </div>
  );
}
function Bullet({ color, title, children }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm" style={{ color: 'var(--muted)' }}>{children}</div>
      </div>
    </li>
  );
}
function BigStat({ className = '', label, value, sub, accent }) {
  return (
    <div className={`panel ${className}`}>
      <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="serif text-5xl mt-3" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-sm mt-2" style={{ color: 'var(--muted)' }}>{sub}</div>}
    </div>
  );
}
function SmallStat({ className = '', label, value, accent }) {
  return (
    <div className={`panel ${className}`}>
      <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="serif text-2xl mt-2" style={{ color: accent }}>{value}</div>
    </div>
  );
}
function Pill({ label, value, color }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="text-[10px] uppercase tracking-[0.20em]" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="text-lg font-semibold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
function RowCard({ children, cols = 6 }) {
  const cls = cols === 7
    ? 'grid grid-cols-1 md:grid-cols-7 gap-3 items-start p-4 rounded-2xl'
    : 'grid grid-cols-1 md:grid-cols-6 gap-3 items-start p-4 rounded-2xl';
  return <div className={cls} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>{children}</div>;
}
function Field({ label, children }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
function MoneyInput({ sym, value, onChange }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
            style={{ color: 'var(--muted)' }}>{sym}</span>
      <input
        type="number"
        className="field pl-7"
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
    </div>
  );
}
function Empty({ label }) {
  return (
    <div className="text-sm rounded-2xl p-6 text-center"
         style={{ color: 'var(--muted)', border: '1px dashed rgba(255,255,255,0.12)' }}>
      {label}
    </div>
  );
}
function Note({ tone, title, children }) {
  const map = { rose: '#ef6b7e', teal: '#4dd4c6', amber: '#f5b84a', indigo: '#7d6cf0' };
  const c = map[tone] || '#fff';
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${c}33`, borderLeft: `3px solid ${c}` }}>
      <div className="font-semibold" style={{ color: c }}>{title}</div>
      <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{children}</div>
    </div>
  );
}

function MixDonut({ data }) {
  if (!data || data.length === 0)
    return <div className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>No investments to chart yet.</div>;
  const PALETTE = ['#f5b84a', '#4dd4c6', '#7d6cf0', '#ef6b7e', '#7cc8ff', '#d2a6ff', '#9be07f', '#ffb38a', '#ff8fb1', '#a3e3ff', '#ffd66b'];
  const R = 60, C = 90, stroke = 22;
  let acc = 0;
  const circ = 2 * Math.PI * R;
  return (
    <div className="flex flex-col md:flex-row items-center gap-6 mt-3">
      <svg viewBox="0 0 180 180" width="180" height="180">
        <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        {data.map((d, i) => {
          const len = (d.pct / 100) * circ;
          const dash = `${len} ${circ - len}`;
          const offset = circ - acc;
          acc += len;
          return (
            <circle key={i} cx={C} cy={C} r={R} fill="none"
              stroke={PALETTE[i % PALETTE.length]} strokeWidth={stroke}
              strokeDasharray={dash} strokeDashoffset={offset}
              transform={`rotate(-90 ${C} ${C})`} />
          );
        })}
        <text x={C} y={C - 4} textAnchor="middle" fontSize="11" fill="rgba(245,241,232,0.6)"
              style={{ textTransform: 'uppercase', letterSpacing: '0.18em' }}>Holdings</text>
        <text x={C} y={C + 18} textAnchor="middle" fontSize="22" fill="#f5f1e8" fontFamily="Fraunces, serif">{data.length}</text>
      </svg>
      <ul className="flex-1 w-full space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.type} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="truncate">{d.type}</span>
            </div>
            <div className="tabular-nums" style={{ color: 'var(--muted)' }}>{d.pct.toFixed(1)}%</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
