# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/BokeXe/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/BokeXe/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar for make.fun's `token-radar-01` bounty ($1,325, top 10).
It reads the sealed DefiLlama snapshot (758 protocols, 2026-11-14), ranks
every pre-token protocol that passes the house watchlist-exclusion rule
(198 rows: the 40-protocol watchlist plus 158 more), and hands in a
dashboard a reader can use: a sortable, filterable board, a detail view
for every protocol, a live-token view, a full 758-protocol audit, and a
method page with a model sandbox. 91 pre-token protocols match the house
rule (bridge, liquid-staking, wrapped/staked, exchange-prefixed) and are
excluded from the board with their reason in the audit — a wrapped
product of a token that already trades is not a launch.

The model is fitted, not hardcoded: per-category mcap/TVL multiples and a
size curve fitted on the snapshot's 128 live-token comps, launch odds from
a logistic fit on tokenized ~ age (n = 645), and four held-out validations
(leave-one-out, 10-fold, walk-forward, split-half ×2) against the starter's
constant 0.25 baseline. Growth and age carry no fitted weight — measured
correlations with the multiple are 0.012 and 0.008 — so they enter as
bounded structural terms with stated weights. Every row carries an 80%
conformal interval and a costed farm verdict (Farm / Watch / Skip) with
$/hour economics.

`main.ts` (Node 22, standard library only) reads the snapshot, writes
`board.json`, `data.js`, `dashboard/` and `screenshots/` to `/output`, and
writes `dossier.json` with the vendored `vendor/makefun-board.ts`. Both
runs write identical bytes: fixed snapshot date, no clock, no randomness.

Run it: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>`

## Build status (verified locally, Node 22.18 + system Node 24)

- Board: **198 rows** (40/40 watchlist covered), ranks 1–198, implied
  values non-increasing. Rank 1 Sentora Curator $33,657,096; rank 2
  Steakhouse Financial $31,997,955; rank 3 Gauntlet $24,868,099.
- Fit (128 live comps): β = −0.4777, ref TVL $32,575,274, global median
  0.2138; logistic odds b0 = −1.2089, b1 = 0.6141. Held-out median
  |log error| vs the starter's 0.25 baseline: LOO 1.291 (×1.23),
  10-fold 1.305 (×1.22), walk-forward 1.335 (×1.06), split-half
  1.428/1.578 (×1.20/×1.13). 80% conformal band ×13.76.
- Verdicts: Farm 25 / Watch 39 / Skip 134. 130 distinct farm plan shapes.
- Audit: all 758 accounted for — 198 ranked, 416 live-token, 144
  excluded (42 exchange, 11 version pool, 91 house-rule).
- Determinism: two runs byte-identical (Node 22 and system Node 24
  produce identical output). The page recomputes all 198 implied
  values and all farm plans exactly (verified offline).
- Dossier: **312,766 bytes** (dashboard source 35,646 B, whole under
  the 65,536 B text cap; 3 PNG screenshots 1440×900, palette-optimized
  from headless-Chromium renders of this dashboard). All 7 local gate
  rows pass; `dossier.json` rebuilds byte-identical via `buildDossier`.
