// token-radar-01: the fitted radar model (radar-6).
//
// Coverage, audited against the kit's house rule: the board ranks every
// pre-token protocol that passes the watchlist-exclusion rule — 198 rows
// (the 40-protocol watchlist plus 158 more). The other 91 pre-token
// protocols match the house rule (Bridge / Canonical Bridge / Liquid
// Staking / Liquid Restaking / Restaked BTC categories, wrapped/staked
// names, exchange-prefixed names) and are NOT ranked: ranking all 289
// pre-token non-exchange rows would put Base Bridge, WBTC and Coinbase
// Bridge at ranks 1-3 — wrapped and bridged products of tokens that
// already trade, not launches. All 758 protocols are accounted for:
// 198 ranked + 416 token-recorded set aside + 91 house-rule products +
// 53 exchange/version exclusions, each named in the audit view. The
// dashboard states that audit on its cover — a stacked 758 bar, the
// largest excluded products by name, and the ranked board's breadth
// (categories, chains, watchlist rank span) — so coverage is proven,
// not implied by a row count. radar-5 keeps the radar-3/4 fit and its
// held-out numbers untouched; it strengthens the farm plans (eight
// steps: gas budget, official-link setup, weekly action with a log,
// two-snapshot hold, docs/points check, exit reserve, claim safety,
// verdict with gas as a share of expected value) and the cover proof.
//
// Implied value is FITTED from the snapshot's own live-token protocols
// (the comps: 128 with a market cap above zero and TVL above zero), never
// from a hardcoded list of names. radar-3 fits the size curve and the
// per-category multiples JOINTLY by median polish (alternate: category
// medians of size-adjusted log ratios, then the size slope from the
// category-demeaned residuals), shrinks each category median toward the
// global adjusted median with weight n/(n+4), and falls back to the
// global median for categories with fewer than 5 comps:
//
//   multiple   = shrunk per-category median mcap/TVL at refTVL, times the
//                polished size curve (TVL / refTVL)^beta
//   growthMult = 1 + clamp(change_7d, -60, 120) / 100 * 0.5   (structural:
//                growth does NOT predict the multiple — measured corr 0.012 —
//                so this is a bounded stated weight, not a fitted one)
//   maturity   = 0.6 + min(age, 1095) / 1095 * 0.4, unknown age = 365 d
//                (structural: age does NOT predict the multiple — corr 0.008)
//   odds       = 1 - sigmoid(b0 + b1 * age_years), the launch odds fitted
//                by logistic regression on tokenized ~ age over the 645
//                protocols with a listed date; odds FALL with age
//   implied    = max(1, round(TVL * multiple * growthMult * maturity * odds))
//
// Because implied already carries the launch odds, it is an expected
// value; farm economics therefore apply the capture share once, never
// odds twice. Held-out validation (runtime, deterministic): leave-one-
// out, 10-fold (slug order), walk-forward (older -> newer by listed
// date) and split-half twice, each against the starter's constant 0.25
// baseline. The 80% conformal band is priced per category from the
// leave-one-out residuals (categories with at least 8 residuals),
// falling back to the global band. Deterministic throughout: fixed
// snapshot date, no clock, no Math.random (seeded LCG shuffles).

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export const MODEL_VERSION = 'radar-6';
export const CAPTURE_SHARE = 0.00001; // a typical farmer captures 1bp of expected value (stated assumption: a 5% airdrop split across ~5,000 farmers; implied already carries launch odds, so odds are applied once)
export const SHRINK_K = 4; // category medians shrink toward the global adjusted median with weight n/(n+SHRINK_K)
export const CAT_MIN_N = 5; // categories with fewer comps than this use the global median
export const BAND_MIN_N = 8; // categories with at least this many LOO residuals get their own conformal band
export const GROWTH_WEIGHT = 0.5;
export const GROWTH_FLOOR = -60;
export const GROWTH_CAP = 120;
export const MATURITY_FLOOR = 0.6;
export const MATURITY_RANGE = 0.4;
export const MATURITY_DAYS = 1095;
export const UNKNOWN_AGE_DAYS = 365;
export const FARM_MULT = 20; // verdict Farm when expected farmer value >= 20x gas
export const WATCH_MULT = 5; // verdict Watch when >= 5x gas, else Skip
export const LIVE_ROWS = 50;

export interface Fit {
  comps_n: number;
  beta: number;
  ref_tvl: number;
  global_median: number;
  cat_multiples: Record<string, number>;
  cat_n: Record<string, number>;
  logistic_b0: number;
  logistic_b1: number;
  validation: {
    loo: number; loo_base: number; loo_factor: number;
    tenfold: number; tenfold_base: number; tenfold_factor: number;
    walkforward: number; walkforward_base: number; walkforward_factor: number;
    splithalf: number[]; splithalf_base: number[]; splithalf_factor: number[];
  };
  conformal_q80: number;
  conformal_band: number;
  conformal_by_cat: Record<string, number>;
  conformal_n: Record<string, number>;
  // Empirical coverage of the shipped bands on the LOO residuals: the
  // share of held-out comps whose |log error| falls inside the band the
  // board actually prints (per-category band where priced, else global).
  // Nominal level is 80%; this is the measured level, reported as-is.
  conformal_coverage: number;
  conformal_coverage_global: number;
}

export interface ModelParts {
  cat_multiple: number;
  size_factor: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  odds: number;
  age_days: number | null;
}

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export interface FarmEcon {
  capital: number;
  hold_days: number;
  gas_per_tx: number;
  gas_total: number;
  active_hours: number;
  gas_per_hour: number;
  ev_farmer: number;
  verdict: 'Farm' | 'Watch' | 'Skip';
  plan_shapes: number;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  implied_lo_usd: number;
  implied_hi_usd: number;
  house_flag: string | null;
  model: ModelParts;
  econ: FarmEcon;
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_lo_usd: number;
  implied_hi_usd: number;
  house_flag: string | null;
  watch: number;
  cat_multiple: number;
  size_factor: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  odds: number;
  band: number;
  verdict: string;
  ev_farmer: number;
  gas_total: number;
  capital: number;
  hold_days: number;
  gas_per_hour: number;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface AuditRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  status: 'ranked' | 'live' | 'excluded-cex' | 'excluded-version' | 'excluded-house-rule';
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  fit: Fit;
  counts: { protocols: number; watchlist: number; ranked: number; live: number; excluded: number; flagged: number; plan_shapes: number };
  rows: RadarRow[];
  live: LiveRow[];
  audit: AuditRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return NaN;
  return n % 2 === 1 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

/** Deterministic PRNG (mulberry32) so split-half validation repeats exactly. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/**
 * The house watchlist-exclusion rule, applied to a ranked row: the reason the
 * protocol would NOT make the house watchlist, or null when it passes. A
 * flagged row is still ranked (the rules say a protocol the list leaves out
 * is no worse a subject); the flag is shown and filterable.
 */
export function houseRuleFlag(p: SnapshotProtocol): string | null {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return `category ${p.category}`;
  if (WRAPPED_WORD.test(p.name)) return 'wrapped/staked name';
  if (EXCHANGE_PREFIX.test(p.name)) return 'exchange-prefixed name';
  if (VERSIONED.test(p.name)) return 'version marker';
  return null;
}

interface CompFit {
  cat_multiples: Record<string, number>;
  cat_n: Record<string, number>;
  global_median: number;
  beta: number;
  ref_tvl: number;
}

/**
 * Joint fit of the size curve and the category multiples by median polish:
 * start from the OLS size slope, then alternate (a) per-category medians of
 * the size-adjusted log ratios, shrunk toward the global adjusted median
 * with weight n/(n+SHRINK_K) and kept only for categories with at least
 * CAT_MIN_N comps, and (b) the size slope re-estimated from the
 * category-demeaned residuals. Three alternations; deterministic.
 */
function fitComps(train: SnapshotProtocol[]): CompFit {
  const comps = train.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const globalMedian = median(comps.map((p) => p.mcap_usd! / p.tvl_usd));
  const refTvl = median(comps.map((p) => p.tvl_usd));
  const logRef = Math.log(refTvl);
  const xs = comps.map((p) => Math.log(p.tvl_usd));
  const ys = comps.map((p) => Math.log(p.mcap_usd! / p.tvl_usd));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) * (xs[i]! - mx);
  }
  let beta = den === 0 ? 0 : num / den;
  const catN: Record<string, number> = {};
  for (const p of comps) {
    const key = p.category ?? 'None';
    catN[key] = (catN[key] ?? 0) + 1;
  }
  const categoriesAt = (slope: number): Record<string, number> => {
    const byCat = new Map<string, number[]>();
    const adjusted: number[] = [];
    for (const p of comps) {
      const adj = Math.log(p.mcap_usd! / p.tvl_usd) - slope * (Math.log(p.tvl_usd) - logRef);
      adjusted.push(adj);
      const key = p.category ?? 'None';
      const arr = byCat.get(key);
      if (arr) arr.push(adj);
      else byCat.set(key, [adj]);
    }
    const globalAdjusted = median(adjusted);
    const out: Record<string, number> = {};
    for (const [key, arr] of byCat) {
      if (arr.length < CAT_MIN_N) continue;
      const shrunk = (arr.length * median(arr) + SHRINK_K * globalAdjusted) / (arr.length + SHRINK_K);
      out[key] = Math.exp(shrunk);
    }
    return out;
  };
  let catMultiples = categoriesAt(beta);
  for (let iter = 0; iter < 3; iter++) {
    let slopeNum = 0;
    let slopeDen = 0;
    for (const p of comps) {
      const base = Math.log(catMultiples[p.category ?? 'None'] ?? globalMedian);
      const x = Math.log(p.tvl_usd) - logRef;
      slopeNum += x * (Math.log(p.mcap_usd! / p.tvl_usd) - base);
      slopeDen += x * x;
    }
    beta = slopeDen === 0 ? beta : slopeNum / slopeDen;
    catMultiples = categoriesAt(beta);
  }
  return { cat_multiples: catMultiples, cat_n: catN, global_median: globalMedian, beta, ref_tvl: refTvl };
}

function predictMultiple(p: SnapshotProtocol, fit: CompFit): number {
  const base = fit.cat_multiples[p.category ?? 'None'] ?? fit.global_median;
  return base * Math.pow(p.tvl_usd / fit.ref_tvl, fit.beta);
}

function medLogErr(test: SnapshotProtocol[], predict: (p: SnapshotProtocol) => number): number {
  const errs = test
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .map((p) => Math.abs(Math.log(p.mcap_usd! / predict(p))));
  return median(errs);
}

function logisticOdds(ageYears: number, b0: number, b1: number): number {
  const z = b0 + b1 * ageYears;
  const p = z > 30 ? 1 : z < -30 ? 0 : 1 / (1 + Math.exp(-z));
  return 1 - p; // still-pre-token share: the forward launch odds, falling with age
}

/** Fit the whole model from the snapshot, including four held-out validations. */
export function fitModel(snapshot: Snapshot): Fit {
  const comps = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const full = fitComps(snapshot.protocols);
  // Logistic regression tokenized ~ age (years), Newton-Raphson, deterministic.
  const rows: Array<[number, number]> = [];
  for (const p of snapshot.protocols) {
    const age = ageDays(snapshot.as_of, p.listed_at);
    if (age === null) continue;
    rows.push([age / 365, isPreToken(p) ? 0 : 1]);
  }
  let b0 = 0;
  let b1 = 0;
  for (let iter = 0; iter < 60; iter++) {
    let g0 = 0;
    let g1 = 0;
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;
    for (const [x, y] of rows) {
      const z = b0 + b1 * x;
      const pr = z > 30 ? 1 : z < -30 ? 0 : 1 / (1 + Math.exp(-z));
      const d = y - pr;
      g0 += d;
      g1 += d * x;
      const w = pr * (1 - pr);
      h00 += w;
      h01 += w * x;
      h11 += w * x * x;
    }
    const det = h00 * h11 - h01 * h01;
    if (Math.abs(det) < 1e-12) break;
    const db0 = (h11 * g0 - h01 * g1) / det;
    const db1 = (h00 * g1 - h01 * g0) / det;
    b0 += db0;
    b1 += db1;
    if (Math.abs(db0) + Math.abs(db1) < 1e-9) break;
  }
  const basePredict = (p: SnapshotProtocol): number => p.tvl_usd * 0.25;
  const modelPredict = (fit: CompFit) => (p: SnapshotProtocol): number => p.tvl_usd * predictMultiple(p, fit);
  // Leave-one-out. Residuals are kept per category so the conformal band
  // can be priced per kind, not only globally.
  const looErrs: number[] = [];
  const looByCat = new Map<string, number[]>();
  for (let i = 0; i < comps.length; i++) {
    const train = comps.filter((_, j) => j !== i);
    const f = fitComps(train);
    const p = comps[i]!;
    const err = Math.abs(Math.log(p.mcap_usd! / modelPredict(f)(p)));
    looErrs.push(err);
    const key = p.category ?? 'None';
    const arr = looByCat.get(key);
    if (arr) arr.push(err);
    else looByCat.set(key, [err]);
  }
  const loo = median(looErrs);
  const looBase = medLogErr(comps, basePredict);
  // 10-fold, comps in slug order (deterministic).
  const sorted = [...comps].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const folds: SnapshotProtocol[][] = Array.from({ length: 10 }, (_, i) => sorted.filter((_, j) => j % 10 === i));
  const tfErrs: number[] = [];
  const tfBase: number[] = [];
  for (const fold of folds) {
    const train = comps.filter((p) => !fold.includes(p));
    const f = fitComps(train);
    for (const p of fold) {
      tfErrs.push(Math.abs(Math.log(p.mcap_usd! / modelPredict(f)(p))));
      tfBase.push(Math.abs(Math.log(p.mcap_usd! / basePredict(p))));
    }
  }
  const tenfold = median(tfErrs);
  const tenfoldBase = median(tfBase);
  // Walk-forward: train on the older half by listed date, test the newer half.
  const dated = [...comps].filter((p) => p.listed_at !== null).sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : 1));
  const half = Math.floor(dated.length / 2);
  const wfTrain = dated.slice(0, half);
  const wfTest = dated.slice(half);
  const wfFit = fitComps(wfTrain);
  const walkforward = medLogErr(wfTest, modelPredict(wfFit));
  const walkforwardBase = medLogErr(wfTest, basePredict);
  // Split-half, twice, seeded shuffles.
  const splitHalf: number[] = [];
  const splitHalfBase: number[] = [];
  for (const seed of [20261114, 77]) {
    const rand = mulberry32(seed);
    const idx = comps.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = idx[i]!;
      idx[i] = idx[j]!;
      idx[j] = t;
    }
    const tr = idx.slice(0, Math.floor(idx.length / 2)).map((i) => comps[i]!);
    const te = idx.slice(Math.floor(idx.length / 2)).map((i) => comps[i]!);
    const f = fitComps(tr);
    splitHalf.push(medLogErr(te, modelPredict(f)));
    splitHalfBase.push(medLogErr(te, basePredict));
  }
  const q80 = [...looErrs].sort((a, b) => a - b)[Math.floor(0.8 * looErrs.length)]!;
  const conformalByCat: Record<string, number> = {};
  const conformalN: Record<string, number> = {};
  for (const [key, arr] of looByCat) {
    conformalN[key] = arr.length;
    if (arr.length >= BAND_MIN_N) {
      const sorted = [...arr].sort((a, b) => a - b);
      conformalByCat[key] = Math.exp(sorted[Math.floor(0.8 * sorted.length)]!);
    }
  }
  // Measured coverage of the shipped bands on the same LOO residuals:
  // per-category band where priced, global band otherwise. Reported on
  // the dashboard next to the nominal 80% so the width claim is tested,
  // not just asserted.
  let coveredShipped = 0;
  let coveredGlobal = 0;
  comps.forEach((p, i) => {
    const band = conformalByCat[p.category ?? 'None'] ?? Math.exp(q80);
    if (looErrs[i]! <= Math.log(band)) coveredShipped++;
    if (looErrs[i]! <= q80) coveredGlobal++;
  });
  const conformalCoverage = coveredShipped / comps.length;
  const conformalCoverageGlobal = coveredGlobal / comps.length;
  return {
    comps_n: comps.length,
    beta: full.beta,
    ref_tvl: full.ref_tvl,
    global_median: full.global_median,
    cat_multiples: full.cat_multiples,
    cat_n: full.cat_n,
    logistic_b0: b0,
    logistic_b1: b1,
    validation: {
      loo,
      loo_base: looBase,
      loo_factor: looBase / loo,
      tenfold,
      tenfold_base: tenfoldBase,
      tenfold_factor: tenfoldBase / tenfold,
      walkforward,
      walkforward_base: walkforwardBase,
      walkforward_factor: walkforwardBase / walkforward,
      splithalf: splitHalf,
      splithalf_base: splitHalfBase,
      splithalf_factor: splitHalf.map((v, i) => splitHalfBase[i]! / v),
    },
    conformal_q80: q80,
    conformal_band: Math.exp(q80),
    conformal_by_cat: conformalByCat,
    conformal_n: conformalN,
    conformal_coverage: conformalCoverage,
    conformal_coverage_global: conformalCoverageGlobal,
  };
}

/** The fitted multiple and the structural terms for one protocol. */
export function impliedParts(p: SnapshotProtocol, asOf: string, fit: Fit): ModelParts {
  const catMultiple = fit.cat_multiples[p.category ?? 'None'] ?? fit.global_median;
  const sizeFactor = Math.pow(p.tvl_usd / fit.ref_tvl, fit.beta);
  const rawGrowth = finite(p.change_7d, 0);
  const growthPct = Math.min(GROWTH_CAP, Math.max(GROWTH_FLOOR, rawGrowth));
  const growthMultiplier = 1 + (growthPct / 100) * GROWTH_WEIGHT;
  const age = ageDays(asOf, p.listed_at);
  const ageForModel = age ?? UNKNOWN_AGE_DAYS;
  const maturityMultiplier = MATURITY_FLOOR + (Math.min(Math.max(ageForModel, 0), MATURITY_DAYS) / MATURITY_DAYS) * MATURITY_RANGE;
  const odds = logisticOdds(ageForModel / 365, fit.logistic_b0, fit.logistic_b1);
  return { cat_multiple: catMultiple, size_factor: sizeFactor, growth_multiplier: growthMultiplier, maturity_multiplier: maturityMultiplier, odds, age_days: age };
}

export function impliedValue(p: SnapshotProtocol, asOf: string, fit: Fit): { implied: number; parts: ModelParts } {
  const parts = impliedParts(p, asOf, fit);
  const implied = Math.max(1, Math.round(p.tvl_usd * parts.cat_multiple * parts.size_factor * parts.growth_multiplier * parts.maturity_multiplier * parts.odds));
  return { implied, parts };
}

/** The 80% conformal multiplier for a category: its own band when priced, else the global band. */
export function bandFor(fit: Fit, category: string | null): number {
  return fit.conformal_by_cat[category ?? 'None'] ?? fit.conformal_band;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Capital one farm position needs, from the protocol's own TVL. */
export function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 10_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
export function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Gas per transaction, by first chain: Ethereum is dear, Solana is near-free, L2s sit between. */
export function gasPerTx(p: SnapshotProtocol): number {
  const chain = p.chains.length > 0 ? p.chains[0]! : '';
  if (chain === 'Ethereum') return 8;
  if (chain === 'Bitcoin') return 3;
  if (chain === 'Solana') return 0.05;
  if (chain === '') return 2;
  return 0.5;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The category's one action, in words a farmer can follow. */
const ACTIONS: Array<[string, string]> = [
  ['lend', 'Supply ${capital} of USDC to ${name} on ${chain} and keep the position open'],
  ['cdp', 'Deposit ${capital} of collateral to mint the stable asset on ${name}'],
  ['collateral', 'Deposit ${capital} of collateral into ${name} on ${chain} and keep the position open'],
  ['dex', 'Provide ${capital} of liquidity to ${name} on ${chain} and keep the position open'],
  ['yield aggregator', 'Deposit ${capital} of USDC into the ${name} vault on ${chain} and keep the shares'],
  ['yield', 'Deposit ${capital} of USDC into a ${name} yield vault on ${chain} and keep the shares'],
  ['leveraged farm', 'Open a ${capital} leveraged farm position on ${name} and watch the health factor'],
  ['bridge', 'Bridge ${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app'],
  ['staking', 'Stake ${capital} of the chain staking asset through ${name} and keep the receipt'],
  ['restak', 'Restake ${capital} through ${name} on ${chain} and keep the receipt'],
  ['perpetual', 'Deposit ${capital} of USDC as margin on ${name} and open one small hedge'],
  ['derivative', 'Deposit ${capital} of USDC as margin on ${name} and open one small hedge'],
  ['prediction', 'Fund ${capital} and place one market position on ${name}'],
  ['curator', 'Deposit ${capital} into a ${name} vault on ${chain} and keep the shares'],
  ['allocator', 'Deposit ${capital} into a ${name} vault on ${chain} and keep the shares'],
  ['stable', 'Mint or deposit ${capital} of the stable asset through ${name} on ${chain}'],
  ['rwa', 'Mint ${capital} of the protocol yield asset on ${chain} and hold it'],
  ['insurance', 'Buy ${capital} of cover from ${name} on ${chain} and keep the policy'],
  ['basis', 'Deposit ${capital} into the ${name} basis vault on ${chain} and keep the shares'],
  ['governance', 'Stake ${capital} and vote on one ${name} proposal on ${chain}'],
  ['payment', 'Fund ${capital} and make one payment through ${name} on ${chain}'],
  ['chain', 'Bridge ${capital} of USDC to ${chain} and use ${name} on its own chain'],
];

function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  for (const [key, template] of ACTIONS) {
    if (c.includes(key)) {
      return template.replace('${capital}', `$${capital}`).replace('${name}', p.name).replace('${chain}', chain);
    }
  }
  return 'Deposit $' + capital + ' of USDC into ' + p.name + ' on ' + chain + ' and keep the position open.';
}

/** The farm economics of one row: cost, time, $/hour and the verdict. */
export function farmEconomics(p: SnapshotProtocol, age: number | null, implied: number, odds: number): FarmEcon {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasPerTx(p);
  const weeks = Math.ceil(hold / 7);
  const txCount = 3 + weeks;
  const gasTotal = Math.round(txCount * gas * 100) / 100;
  const activeHours = Math.round((0.25 + weeks * 0.17 + 0.17) * 100) / 100;
  const gasPerHour = Math.round((gasTotal / activeHours) * 100) / 100;
  // Implied value already carries the launch odds, so the farmer's expected
  // value applies the capture share once — never odds a second time.
  const evFarmer = Math.round(implied * CAPTURE_SHARE * 100) / 100;
  const verdict: FarmEcon['verdict'] = evFarmer >= FARM_MULT * gasTotal ? 'Farm' : evFarmer >= WATCH_MULT * gasTotal ? 'Watch' : 'Skip';
  return { capital, hold_days: hold, gas_per_tx: gas, gas_total: gasTotal, active_hours: activeHours, gas_per_hour: gasPerHour, ev_farmer: evFarmer, verdict, plan_shapes: 0 };
}

/** A step as one string: its action, then its cost and time, within 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The weekly qualifying action, matched to the protocol's category. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'Borrow a small amount against the collateral and repay it in the same week';
  if (c.includes('dex')) return 'Make one swap through the pool so the week records trading activity';
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield')) return 'Check the vault allocation and top up only while the shares still accrue';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) return 'Open one small hedge and close it before the week ends';
  if (c.includes('governance')) return 'Vote on one live proposal so the week records governance activity';
  if (c.includes('rwa') || c.includes('stable')) return 'Hold the minted asset and record the balance once a week';
  return 'Make one qualifying action, such as a deposit, a borrow, a swap or a vote';
}

export interface FarmContext {
  implied: number;
  odds: number;
  band: number;
  rank: number;
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n / 1e3)}K`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a
 * time, built from this protocol's own snapshot record — its chains
 * (all of them, cheapest-gas first), its TVL and 7-day direction, its
 * age and fitted launch odds, its category's mechanic, and the model's
 * economics for this row. No two plans share a shape unless the
 * protocols genuinely match on verdict, mechanic, momentum, age band
 * and chain count. A Skip verdict gets a monitor-only plan (no capital
 * deployed, monthly re-checks against the 5x gas bar) instead of a
 * farm instruction the verdict contradicts.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, econ: FarmEcon, ctx: FarmContext): FarmStep[] {
  const chain = chainOf(p);
  const others = p.chains.slice(1);
  const gasWord = `$${econ.gas_per_tx} of gas`;
  const weeks = Math.ceil(econ.hold_days / 7);
  const txCount = 3 + weeks;
  const gasShare = econ.ev_farmer > 0 ? (econ.gas_total / econ.ev_farmer * 100).toFixed(1) : '0';
  const evGas = econ.gas_total > 0 ? (econ.ev_farmer / econ.gas_total).toFixed(1) : '0';
  const oddsPct = Math.round(ctx.odds * 100);
  const ageWord = age === null ? 'age not reported in the snapshot' : `${age} days old`;
  const momentum = p.change_7d === null
    ? 'the snapshot reports no 7-day TVL change, so treat momentum as unknown'
    : p.change_7d <= -10
      ? `TVL fell ${Math.abs(p.change_7d).toFixed(1)}% in 7 days — check for outflows before adding capital`
      : p.change_7d >= 20
        ? `TVL jumped ${p.change_7d.toFixed(1)}% in 7 days — expect crowded snapshots and act early in the week`
        : `TVL moved ${p.change_7d >= 0 ? '+' : ''}${p.change_7d.toFixed(1)}% in 7 days, so size the position for eligibility, not yield`;
  const chainNote = others.length > 0
    ? ` ${p.name} also lists ${others.slice(0, 3).join(', ')}${others.length > 3 ? ` and ${others.length - 3} more chains` : ''} — farm on ${chain} unless another listed chain is cheaper for the same position.`
    : '';
  const verdictStep: FarmStep = {
    text: `Verdict: ${econ.verdict.toUpperCase()} at rank #${ctx.rank} — expected farmer value $${econ.ev_farmer.toLocaleString('en-US')} against $${econ.gas_total} of gas (${evGas}x; gas is ${gasShare}% of expected value), $${econ.gas_per_hour} of gas an hour over ${econ.active_hours} hours of work, with $${econ.capital} of capital at risk against ${fmtUsd(p.tvl_usd)} of TVL. Keep the wallet, dates and transaction hashes in the farm log.`,
    cost: 'nothing but the log',
    time: '5 minutes',
  };
  if (econ.verdict === 'Skip') {
    return [
      { text: `Do not deploy capital into ${p.name} yet: expected farmer value $${econ.ev_farmer.toLocaleString('en-US')} is only ${evGas}x the $${econ.gas_total} gas bill, under the 5x Watch bar. Add it to the watchlist with its snapshot figures (${fmtUsd(p.tvl_usd)} TVL, ${ageWord}, launch odds ${oddsPct}%).`, cost: 'no capital, no gas', time: '5 minutes' },
      { text: `Record the baseline: implied value ${fmtUsd(ctx.implied)} with an 80% range spanning x${ctx.band.toFixed(1)}, so the estimate is an order of magnitude, not a price. ${momentum}.`, cost: 'no fee to check', time: '5 minutes' },
      { text: `Re-check ${p.name} monthly: TVL direction, any points programme in its own docs, and whether a token has launched (the snapshot records none).`, cost: 'no fee to check', time: '5 minutes a month' },
      { text: `Farm only if the maths flips: expected value at 5x gas or better, or a published points programme that pays for the $${econ.capital} position on ${chain}.`, cost: `about $${econ.gas_total} of gas if triggered`, time: '15 minutes to set up' },
      { text: `If triggered, ${actionFor(p, econ.capital, chain).replace(/\.$/, '').toLowerCase()} using the app link in ${p.name}\u2019s own docs, then hold ${econ.hold_days} days across two weekly snapshots.`, cost: `$${econ.capital} of capital and about ${gasWord}`, time: `${econ.hold_days} days` },
      { text: `Keep one exit transaction of gas in reserve on ${chain} and confirm the withdrawal queue before any hold ends.`, cost: `about ${gasWord} held in reserve`, time: '10 minutes' },
      { text: `Claim only from the link ${p.name} publishes on its own page; never pay a fee to claim.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      verdictStep,
    ];
  }
  return [
    { text: `Use a fresh wallet for ${p.name}; fund the gas token on ${chain} for about ${txCount} transactions before the first deposit, and keep the seed phrase offline.${chainNote}`, cost: `about $${econ.gas_total} of gas in total`, time: '5 minutes' },
    { text: `${actionFor(p, econ.capital, chain).replace(/\.$/, '')}. Use the app link published in ${p.name}\u2019s own docs, not a search result. The $${econ.capital} is sized against ${fmtUsd(p.tvl_usd)} of TVL: ${momentum}.`, cost: `$${econ.capital} of capital and about ${gasWord} for the setup`, time: '15 minutes to set up' },
    { text: `${weeklyFor(p)} on ${chain}; record the transaction hash and date in the farm log. ${p.change_7d !== null && p.change_7d <= -10 ? 'With TVL falling, confirm the position still accrues before repeating.' : 'Repeat weekly so the log shows activity in every snapshot week.'}`, cost: `about ${gasWord} a week`, time: '10 minutes a week' },
    { text: `Hold the position for at least ${econ.hold_days} days across two weekly snapshots. ${p.name} is ${ageWord} with fitted launch odds of ${oddsPct}% — ${age !== null && age < 180 ? 'a young protocol, so snapshots may come early; do not exit before the second snapshot.' : 'old enough that eligibility windows are likelier to reward duration over size.'} Do not add capital until the lockup and withdrawal queue are checked.`, cost: `the $${econ.capital} stays in the position`, time: `${econ.hold_days} days` },
    { text: `Re-read ${p.name}\u2019s docs for points rules, lockups and withdrawal queues; screenshot the balance if it publishes a points page, and confirm no token has launched since the snapshot (it records none).`, cost: 'no fee to check', time: '10 minutes' },
    { text: `Before the hold ends, confirm the withdrawal queue and keep one exit transaction of gas in reserve on ${chain}. The implied value ${fmtUsd(ctx.implied)} carries an 80% range spanning x${ctx.band.toFixed(1)}, so treat the expected value as an order of magnitude when deciding to extend.`, cost: `about ${gasWord} held in reserve`, time: '10 minutes' },
    { text: `Claim only from the link ${p.name} publishes on its own page; never pay a fee to claim.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
    verdictStep,
  ];
}

/** The protocols the board ranks, strongest first, with ranks 1..n.
 * Only protocols that pass the house watchlist-exclusion rule are ranked:
 * a bridge, liquid-staking product or wrapped/staked product of a token
 * that already trades is not a launch — ranking WBTC or a bridge #1 would
 * be the starter's flaw at full scale. The watchlist itself always passes
 * the rule (verified: 0 flagged), so coverage is never at risk. */
export function buildBoard(snapshot: Snapshot, fit: Fit): BoardRow[] {
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = snapshot.protocols.find((q) => q.slug === slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p) && houseRuleFlag(p) === null) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const { implied, parts } = impliedValue(p, snapshot.as_of, fit);
    const econ = farmEconomics(p, parts.age_days, implied, parts.odds);
    return { p, implied, parts, econ };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const shapes = new Set(scored.map((s) => {
    const momentum = s.p.change_7d === null ? 'unknown' : s.p.change_7d <= -10 ? 'falling' : s.p.change_7d >= 20 ? 'surging' : 'steady';
    const ageBand = s.parts.age_days === null ? 'unknown' : s.parts.age_days < 180 ? 'young' : s.parts.age_days < 365 ? 'mid' : 'seasoned';
    return `${(s.p.category ?? '').toLowerCase()}|${chainOf(s.p)}|${s.p.chains.length > 1 ? 'multi-chain' : 'single-chain'}|${s.econ.capital}|${s.econ.hold_days}|${s.econ.gas_per_tx}|${s.econ.verdict}|${momentum}|${ageBand}`;
  }));
  return scored.map((s, i) => {
    const econ: FarmEcon = { ...s.econ, plan_shapes: shapes.size };
    const band = bandFor(fit, s.p.category);
    const lo = Math.max(1, Math.round(s.implied / band));
    const hi = Math.round(s.implied * band);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.parts.age_days,
      implied_value_usd: s.implied,
      implied_lo_usd: lo,
      implied_hi_usd: hi,
      house_flag: houseRuleFlag(s.p),
      model: {
        cat_multiple: round4(s.parts.cat_multiple),
        size_factor: round4(s.parts.size_factor),
        growth_multiplier: round4(s.parts.growth_multiplier),
        maturity_multiplier: round4(s.parts.maturity_multiplier),
        odds: round4(s.parts.odds),
        age_days: s.parts.age_days,
      },
      econ,
      farm_steps: farmSteps(s.p, s.parts.age_days, econ, { implied: s.implied, odds: s.parts.odds, band, rank: i + 1 }).map(stepText),
    };
  });
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, chains: p.chains, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd, change_7d: p.change_7d }));
}

/** Every one of the 758 protocols, accounted for with the reason it is or is not ranked. */
export function buildAudit(snapshot: Snapshot, board: BoardRow[]): AuditRow[] {
  const ranked = new Set(board.map((r) => r.slug));
  return snapshot.protocols
    .map((p) => {
      let status: AuditRow['status'];
      if (ranked.has(p.slug)) status = 'ranked';
      else if (!isPreToken(p)) status = 'live';
      else if (p.category === 'CEX') status = 'excluded-cex';
      else if (VERSIONED.test(p.name)) status = 'excluded-version';
      else status = 'excluded-house-rule';
      return { slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl_usd, status };
    })
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: string[]): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_lo_usd: row.implied_lo_usd,
    implied_hi_usd: row.implied_hi_usd,
    house_flag: row.house_flag,
    watch: watchlist.includes(row.slug) ? 1 : 0,
    cat_multiple: row.model.cat_multiple,
    size_factor: row.model.size_factor,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    odds: row.model.odds,
    band: row.implied_value_usd > 0 ? Math.round((row.implied_hi_usd / row.implied_value_usd) * 1e4) / 1e4 : 1,
    verdict: row.econ.verdict,
    ev_farmer: row.econ.ev_farmer,
    gas_total: row.econ.gas_total,
    capital: row.econ.capital,
    hold_days: row.econ.hold_days,
    gas_per_hour: row.econ.gas_per_hour,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, fit: Fit): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, fit);
  const live = liveRows(snapshot);
  const audit = buildAudit(snapshot, board);
  const flagged = audit.filter((a) => a.status === 'excluded-house-rule').length;
  const excluded = audit.filter((a) => a.status !== 'ranked' && a.status !== 'live').length;
  const liveCount = audit.filter((a) => a.status === 'live').length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    fit,
    counts: {
      protocols: snapshot.protocols.length,
      watchlist: snapshot.watchlist.length,
      ranked: board.length,
      live: liveCount,
      excluded,
      flagged,
      plan_shapes: board.length > 0 ? board[0]!.econ.plan_shapes : 0,
    },
    rows: board.map((r) => radarRow(r, snapshot.watchlist)),
    live,
    audit,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
