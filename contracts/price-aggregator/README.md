# Price Feed Aggregator

A production-ready Soroban smart contract that aggregates prices from multiple
authorized data sources, providing tamper-resistant, manipulation-resistant
pricing for DeFi applications such as synthetic assets and stablecoins.

## How It Works

Multiple oracle sources submit prices for each asset independently.
The contract combines them using a configurable aggregation strategy,
applies outlier detection to exclude manipulated feeds, and trips a
circuit breaker if the aggregate swings too sharply relative to the
previous accepted price.

```
Source A ──┐
Source B ──┼──► Outlier filter ──► Aggregation ──► Circuit breaker ──► AggregatedPrice
Source C ──┘         ▲                   ▲                  ▲
                staleness check    Median / WA /       max swing %
                                  TrimmedMean
```

## Aggregation Strategies

| Strategy | Description |
|---|---|
| `Median` (default) | Middle value of sorted prices. Robust against outliers. |
| `WeightedAverage` | Weighted mean using per-source weights (1–100). Rewards trusted oracles. |
| `TrimmedMean` | Drops the lowest and highest price, then averages the rest. Best with 5+ sources. |

## Security Features

| Feature | Default | Description |
|---|---|---|
| Outlier detection | 20% (`2000 bps`) | Prices deviating > threshold from median are excluded before aggregation |
| Circuit breaker | 50% (`5000 bps`) | Rejects aggregate if it moves > threshold vs last accepted price |
| Staleness check | 3600 s | Prices older than `max_price_age` seconds are ignored |
| Source authorization | Admin-controlled | Only admin-whitelisted source IDs may submit prices |
| Emergency pause | Admin-controlled | Halts all price submissions in emergency |

## Architecture

```
contracts/price-aggregator/       ← Soroban/Rust smart contract
backend/src/routes/priceAggregator.js         ← REST API routes
backend/src/services/priceAggregatorService.js ← Business logic + caching
frontend/src/components/PriceAggregatorDashboard.tsx ← React UI
frontend/src/app/price-aggregator/page.tsx    ← Next.js page
```

## Smart Contract

**Location:** `contracts/price-aggregator/`

### Functions

| Function | Access | Description |
|---|---|---|
| `initialize(admin, strategy?, max_price_age?, outlier_bps?, circuit_breaker_bps?, min_sources?)` | Public (once) | Initialize contract |
| `add_source(admin, name, weight)` | Admin | Register a new price source, returns source ID |
| `remove_source(admin, source_id)` | Admin | Deactivate a source |
| `set_weight(admin, source_id, weight)` | Admin | Update source weight (1–100) |
| `set_strategy(admin, strategy)` | Admin | Change aggregation strategy |
| `update_price(source_addr, source_id, asset, price)` | Authorized source | Submit a price (scaled to 10^18) |
| `get_price(source_id, asset)` | Read | Get latest price from a single source |
| `get_aggregated_price(asset)` | Read | Compute and return aggregated price |
| `get_source(source_id)` | Read | Get source metadata |
| `get_source_count()` | Read | Total number of sources |
| `pause(admin)` / `unpause(admin)` | Admin | Emergency pause |
| `is_paused()` / `get_admin()` / `get_strategy()` | Read | State queries |

**Events emitted:** `init`, `paused`, `unpaused`, `srcAdd`, `srcRm`, `priceUp`, `aggPrice`

### Price Scaling

All prices are submitted and stored scaled to 18 decimal places:

```
on-chain price = human_price × 10^18
```

For example, BTC at $50,000:

```
price = 50_000 × 1_000_000_000_000_000_000 = 50000000000000000000000
```

### Building

```bash
cd contracts/price-aggregator
cargo build --target wasm32-unknown-unknown --release

# Run tests
cargo test
```

### Deploying to Testnet

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/price_aggregator.wasm \
  --source <YOUR_ACCOUNT> \
  --network testnet

# Initialize
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <YOUR_ACCOUNT> \
  --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --strategy Median \
  --max_price_age 3600 \
  --outlier_bps 2000 \
  --circuit_breaker_bps 5000 \
  --min_sources 3
```

## Backend API

Base URL: `http://localhost:5000/api/price-aggregator`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/initialize` | Initialize contract |
| POST | `/sources` | Add a price source |
| DELETE | `/sources/:sourceId` | Remove a source |
| PATCH | `/sources/:sourceId/weight` | Update source weight |
| GET | `/sources/:sourceId?contractId=` | Get source info |
| GET | `/sources/count?contractId=` | Get source count |
| POST | `/prices` | Submit a price update |
| GET | `/prices/:sourceId/:asset?contractId=` | Get single-source price |
| GET | `/prices/aggregated/:asset?contractId=` | Get aggregated price |
| POST | `/strategy` | Set aggregation strategy |
| POST | `/pause` | Pause contract |
| POST | `/unpause` | Unpause contract |
| GET | `/status?contractId=` | Get pause status |

**Example: Get aggregated BTC/USD price**

```bash
curl "http://localhost:5000/api/price-aggregator/prices/aggregated/BTC%2FUSD?contractId=C..."
# Response: { "success": true, "data": { "asset": "BTC/USD", "price": "50000000000000000000000", "num_sources": 3, "strategy": "Median", ... } }
```

**Example: Submit a price**

```bash
curl -X POST http://localhost:5000/api/price-aggregator/prices \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "C...",
    "sourceAddr": "G...",
    "sourceId": 0,
    "asset": "BTC/USD",
    "price": "50000000000000000000000"
  }'
```

## Frontend

Navigate to `http://localhost:3000/price-aggregator`.

Features:
- Prices tab: query aggregated prices, submit price updates as a source
- Sources tab: view registered sources, add/remove sources (admin)
- Admin tab: change aggregation strategy, emergency pause/unpause
- WCAG 2.1 AA accessible (ARIA labels, roles, live regions)

## Environment Variables

Add to `backend/.env`:
```
# Optional: default contract ID for price aggregator
PA_CONTRACT_ID=C...
```

Add to `frontend/.env.local`:
```
NEXT_PUBLIC_PA_CONTRACT_ID=C...
```

## Running Tests

```bash
cd contracts/price-aggregator
cargo test
```

Test coverage includes:
- Initialization (success, double-init guard)
- Source management (add, remove, weight update, auth checks)
- Price submission (valid, unauthorized, inactive source, zero price)
- Staleness enforcement (stale single-source query, stale excluded from aggregation)
- Median aggregation (single source, odd count, even count)
- Weighted average aggregation
- Trimmed mean aggregation
- Insufficient sources error
- Outlier detection (outlier excluded, clean price accepted)
- Circuit breaker (trips on large swing, allows small swing)
- Multiple independent assets
- Pause enforcement

## Related

- [Synthetic Assets contract](../synthetic-assets/) — uses price feeds for collateral valuation
- [Stablecoin contract](../stablecoin/) — uses price feeds for peg maintenance
