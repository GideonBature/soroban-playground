// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

//! # Price Feed Aggregator Contract
//!
//! Combines prices from multiple authorized sources using configurable
//! aggregation strategies (median, weighted average, trimmed mean).
//!
//! ## Security features
//! - Outlier detection: sources whose price deviates more than `outlier_bps`
//!   from the median are excluded before aggregation.
//! - Circuit breaker: if the new aggregated price deviates more than
//!   `circuit_breaker_bps` from the last accepted price, the update is
//!   rejected to guard against manipulation.
//! - Staleness check: prices older than `max_price_age` seconds are ignored.
//! - Source authorization: only admin-authorized source IDs may submit prices.
//!
//! ## Lifecycle
//! 1. Admin calls `initialize`.
//! 2. Admin registers sources with `add_source` and optionally calls
//!    `set_weight` to tune weighted-average mode.
//! 3. Authorized sources call `update_price` periodically.
//! 4. Consumers call `get_aggregated_price` to get the current result.
//! 5. Admin may `pause`/`unpause` in emergencies.

#![no_std]

mod storage;
mod test;
mod types;

use soroban_sdk::{contract, contractimpl, symbol_short, vec, Address, Env, String, Vec};

use crate::storage::{
    get_admin, get_circuit_breaker_bps, get_last_aggregated, get_max_price_age, get_min_sources,
    get_outlier_bps, get_price, get_source, get_source_count, get_strategy, is_authorized,
    is_initialized, is_paused, set_admin, set_authorized, set_circuit_breaker_bps,
    set_last_aggregated, set_max_price_age, set_min_sources, set_outlier_bps, set_paused,
    set_price, set_source, set_source_count, set_strategy,
};
use crate::types::{AggregatedPrice, AggregationStrategy, Error, PriceEntry, Source};

// Maximum number of registered sources to bound computation.
const MAX_SOURCES: u32 = 32;

#[contract]
pub struct PriceAggregator;

#[contractimpl]
impl PriceAggregator {
    // ── Initialization ────────────────────────────────────────────────────────

    /// Initialize the contract. Can only be called once.
    ///
    /// - `strategy`: aggregation method (default: Median).
    /// - `max_price_age`: seconds before a price is considered stale (default: 3600).
    /// - `outlier_bps`: deviation threshold in basis points to detect outliers (default: 2000 = 20%).
    /// - `circuit_breaker_bps`: max allowed price swing vs last aggregate before rejecting (default: 5000 = 50%).
    /// - `min_sources`: minimum valid sources required to produce an aggregated price (default: 1).
    pub fn initialize(
        env: Env,
        admin: Address,
        strategy: Option<AggregationStrategy>,
        max_price_age: Option<u64>,
        outlier_bps: Option<u32>,
        circuit_breaker_bps: Option<u32>,
        min_sources: Option<u32>,
    ) -> Result<(), Error> {
        if is_initialized(&env) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        set_admin(&env, &admin);
        if let Some(s) = strategy {
            set_strategy(&env, s);
        }
        if let Some(age) = max_price_age {
            set_max_price_age(&env, age);
        }
        if let Some(bps) = outlier_bps {
            set_outlier_bps(&env, bps);
        }
        if let Some(bps) = circuit_breaker_bps {
            set_circuit_breaker_bps(&env, bps);
        }
        if let Some(ms) = min_sources {
            set_min_sources(&env, ms);
        }
        env.events().publish((symbol_short!("init"),), admin);
        Ok(())
    }

    // ── Admin: pause / unpause ────────────────────────────────────────────────

    pub fn pause(env: Env, admin: Address) -> Result<(), Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        set_paused(&env, true);
        env.events().publish((symbol_short!("paused"),), admin);
        Ok(())
    }

    pub fn unpause(env: Env, admin: Address) -> Result<(), Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        set_paused(&env, false);
        env.events().publish((symbol_short!("unpaused"),), admin);
        Ok(())
    }

    // ── Source management ─────────────────────────────────────────────────────

    /// Register a new price source. Returns the new source ID.
    pub fn add_source(
        env: Env,
        admin: Address,
        name: String,
        weight: u32,
    ) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        not_paused(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        if name.is_empty() {
            return Err(Error::EmptyAsset);
        }
        if weight == 0 || weight > 100 {
            return Err(Error::InvalidWeight);
        }
        let count = get_source_count(&env);
        if count >= MAX_SOURCES {
            return Err(Error::MaxSourcesReached);
        }
        let id = count;
        let source = Source { id, name, weight, active: true };
        set_source(&env, &source);
        set_authorized(&env, id, true);
        set_source_count(&env, count + 1);
        env.events().publish((symbol_short!("srcAdd"),), id);
        Ok(id)
    }

    /// Deactivate a source (it can no longer submit prices).
    pub fn remove_source(env: Env, admin: Address, source_id: u32) -> Result<(), Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        let mut source = get_source(&env, source_id)?;
        source.active = false;
        set_source(&env, &source);
        set_authorized(&env, source_id, false);
        env.events().publish((symbol_short!("srcRm"),), source_id);
        Ok(())
    }

    /// Update the weight for a source (1–100). Used in WeightedAverage mode.
    pub fn set_weight(
        env: Env,
        admin: Address,
        source_id: u32,
        weight: u32,
    ) -> Result<(), Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        if weight == 0 || weight > 100 {
            return Err(Error::InvalidWeight);
        }
        let mut source = get_source(&env, source_id)?;
        source.weight = weight;
        set_source(&env, &source);
        Ok(())
    }

    /// Change the aggregation strategy.
    pub fn set_strategy(
        env: Env,
        admin: Address,
        strategy: AggregationStrategy,
    ) -> Result<(), Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        set_strategy(&env, strategy);
        Ok(())
    }

    // ── Price submission ──────────────────────────────────────────────────────

    /// Submit a price for an asset. Must be called by an authorized source.
    ///
    /// `price` must be scaled to 18 decimal places (price × 10^18).
    pub fn update_price(
        env: Env,
        source_addr: Address,
        source_id: u32,
        asset: String,
        price: i128,
    ) -> Result<(), Error> {
        ensure_initialized(&env)?;
        not_paused(&env)?;
        source_addr.require_auth();

        if !is_authorized(&env, source_id) {
            return Err(Error::Unauthorized);
        }
        let source = get_source(&env, source_id)?;
        if !source.active {
            return Err(Error::SourceInactive);
        }
        if asset.is_empty() {
            return Err(Error::EmptyAsset);
        }
        if price <= 0 {
            return Err(Error::InvalidPrice);
        }

        let entry = PriceEntry { price, timestamp: env.ledger().timestamp(), source_id };
        set_price(&env, source_id, &asset, &entry);
        env.events().publish((symbol_short!("priceUp"),), (source_id, asset, price));
        Ok(())
    }

    // ── Price queries ─────────────────────────────────────────────────────────

    /// Return the most recent price from a single source. Errors if stale.
    pub fn get_price(env: Env, source_id: u32, asset: String) -> Result<PriceEntry, Error> {
        ensure_initialized(&env)?;
        let entry = get_price(&env, source_id, &asset).ok_or(Error::SourceNotFound)?;
        let max_age = get_max_price_age(&env);
        let now = env.ledger().timestamp();
        if now.saturating_sub(entry.timestamp) > max_age {
            return Err(Error::PriceStale);
        }
        Ok(entry)
    }

    /// Compute and return the aggregated price for an asset.
    ///
    /// Applies staleness filtering, outlier detection, then the configured
    /// aggregation strategy. Checks the circuit breaker against the last
    /// accepted aggregated price before persisting.
    pub fn get_aggregated_price(env: Env, asset: String) -> Result<AggregatedPrice, Error> {
        ensure_initialized(&env)?;
        if asset.is_empty() {
            return Err(Error::EmptyAsset);
        }

        let now = env.ledger().timestamp();
        let max_age = get_max_price_age(&env);
        let count = get_source_count(&env);
        let strategy = get_strategy(&env);

        // Collect fresh prices from active sources.
        let mut prices: Vec<(i128, u32)> = vec![&env]; // (price, weight)
        for i in 0..count {
            let Ok(src) = get_source(&env, i) else { continue };
            if !src.active { continue }
            let Some(entry) = get_price(&env, i, &asset) else { continue };
            if now.saturating_sub(entry.timestamp) > max_age { continue }
            prices.push_back((entry.price, src.weight));
        }

        let min_required = get_min_sources(&env);
        if (prices.len() as u32) < min_required {
            return Err(Error::InsufficientSources);
        }

        // Sort prices ascending (insertion sort – bounded by MAX_SOURCES=32).
        let n = prices.len();
        for i in 1..n {
            let mut j = i;
            while j > 0 && prices.get(j - 1).unwrap().0 > prices.get(j).unwrap().0 {
                let a = prices.get(j - 1).unwrap();
                let b = prices.get(j).unwrap();
                prices.set(j - 1, b);
                prices.set(j, a);
                j -= 1;
            }
        }

        // Outlier filtering: remove entries deviating > outlier_bps from median.
        let median = {
            let mid = n / 2;
            if n % 2 == 1 {
                prices.get(mid).unwrap().0
            } else {
                (prices.get(mid - 1).unwrap().0 + prices.get(mid).unwrap().0) / 2
            }
        };
        let outlier_bps = get_outlier_bps(&env) as i128;
        let mut filtered: Vec<(i128, u32)> = vec![&env];
        for i in 0..n {
            let (p, w) = prices.get(i).unwrap();
            let deviation = abs_diff(p, median) * 10_000 / median;
            if deviation <= outlier_bps {
                filtered.push_back((p, w));
            }
        }
        if (filtered.len() as u32) < min_required {
            return Err(Error::InsufficientSources);
        }

        let fn_len = filtered.len();
        let aggregated = match strategy {
            AggregationStrategy::Median => {
                let mid = fn_len / 2;
                if fn_len % 2 == 1 {
                    filtered.get(mid).unwrap().0
                } else {
                    (filtered.get(mid - 1).unwrap().0 + filtered.get(mid).unwrap().0) / 2
                }
            }
            AggregationStrategy::WeightedAverage => {
                let mut sum: i128 = 0;
                let mut total_weight: i128 = 0;
                for i in 0..fn_len {
                    let (p, w) = filtered.get(i).unwrap();
                    sum += p * (w as i128);
                    total_weight += w as i128;
                }
                if total_weight == 0 { return Err(Error::InsufficientSources); }
                sum / total_weight
            }
            AggregationStrategy::TrimmedMean => {
                // Drop lowest and highest if we have > 2 sources.
                let (start, end) = if fn_len > 2 { (1, fn_len - 1) } else { (0, fn_len) };
                let mut sum: i128 = 0;
                let trim_count = (end - start) as i128;
                if trim_count == 0 { return Err(Error::InsufficientSources); }
                for i in start..end {
                    sum += filtered.get(i).unwrap().0;
                }
                sum / trim_count
            }
        };

        // Circuit breaker: reject if swing vs last accepted price is too large.
        let cb_bps = get_circuit_breaker_bps(&env) as i128;
        if let Some(last) = get_last_aggregated(&env, &asset) {
            if last > 0 {
                let swing = abs_diff(aggregated, last) * 10_000 / last;
                if swing > cb_bps {
                    return Err(Error::CircuitBreakerTripped);
                }
            }
        }

        set_last_aggregated(&env, &asset, aggregated);

        let result = AggregatedPrice {
            asset: asset.clone(),
            price: aggregated,
            timestamp: now,
            num_sources: fn_len as u32,
            strategy,
        };
        env.events().publish(
            (symbol_short!("aggPrice"),),
            (asset, aggregated, fn_len as u32),
        );
        Ok(result)
    }

    // ── Read-only helpers ─────────────────────────────────────────────────────

    pub fn get_source(env: Env, source_id: u32) -> Result<Source, Error> {
        ensure_initialized(&env)?;
        get_source(&env, source_id)
    }

    pub fn get_source_count(env: Env) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        Ok(get_source_count(&env))
    }

    pub fn is_paused(env: Env) -> bool {
        is_paused(&env)
    }

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        get_admin(&env)
    }

    pub fn get_strategy(env: Env) -> Result<AggregationStrategy, Error> {
        ensure_initialized(&env)?;
        Ok(get_strategy(&env))
    }
}

// ── Private helpers ───────────────────────────────────────────────────────────

fn ensure_initialized(env: &Env) -> Result<(), Error> {
    if !is_initialized(env) {
        return Err(Error::NotInitialized);
    }
    Ok(())
}

fn not_paused(env: &Env) -> Result<(), Error> {
    if is_paused(env) {
        return Err(Error::ContractPaused);
    }
    Ok(())
}

fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
    if get_admin(env)? != *caller {
        return Err(Error::Unauthorized);
    }
    Ok(())
}

fn abs_diff(a: i128, b: i128) -> i128 {
    if a > b { a - b } else { b - a }
}
