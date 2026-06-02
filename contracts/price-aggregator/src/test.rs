// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::{PriceAggregator, PriceAggregatorClient};
use crate::types::{AggregationStrategy, Error};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn setup() -> (Env, Address, PriceAggregatorClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register_contract(None, PriceAggregator);
    let client = PriceAggregatorClient::new(&env, &id);
    let admin = Address::generate(&env);
    (env, admin, client)
}

fn asset(env: &Env) -> String {
    String::from_str(env, "BTC/USD")
}

fn eth(env: &Env) -> String {
    String::from_str(env, "ETH/USD")
}

/// Scale a human-readable price to 18-decimal representation.
fn p(val: i128) -> i128 {
    val * 1_000_000_000_000_000_000i128
}

// ── initialize ────────────────────────────────────────────────────────────────

#[test]
fn test_initialize_ok() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    assert_eq!(client.get_admin().unwrap(), admin);
}

#[test]
fn test_initialize_twice_fails() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    let err = client.initialize(&admin, &None, &None, &None, &None, &None).unwrap_err();
    assert_eq!(err, Error::AlreadyInitialized);
}

#[test]
fn test_initialize_custom_strategy() {
    let (env, admin, client) = setup();
    client
        .initialize(&admin, &Some(AggregationStrategy::WeightedAverage), &None, &None, &None, &None)
        .unwrap();
    assert_eq!(client.get_strategy().unwrap(), AggregationStrategy::WeightedAverage);
}

// ── pause / unpause ───────────────────────────────────────────────────────────

#[test]
fn test_pause_unpause() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    assert!(!client.is_paused());
    client.pause(&admin).unwrap();
    assert!(client.is_paused());
    client.unpause(&admin).unwrap();
    assert!(!client.is_paused());
}

#[test]
fn test_pause_blocks_add_source() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    client.pause(&admin).unwrap();
    let name = String::from_str(&env, "Oracle1");
    let err = client.add_source(&admin, &name, &50).unwrap_err();
    assert_eq!(err, Error::ContractPaused);
}

#[test]
fn test_non_admin_cannot_pause() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    let other = Address::generate(&env);
    let err = client.pause(&other).unwrap_err();
    assert_eq!(err, Error::Unauthorized);
}

// ── add_source / remove_source / set_weight ───────────────────────────────────

#[test]
fn test_add_source_ok() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    let name = String::from_str(&env, "Chainlink");
    let id = client.add_source(&admin, &name, &50).unwrap();
    assert_eq!(id, 0);
    assert_eq!(client.get_source_count().unwrap(), 1);
    let src = client.get_source(&id).unwrap();
    assert!(src.active);
    assert_eq!(src.weight, 50);
}

#[test]
fn test_add_source_invalid_weight_zero_fails() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    let name = String::from_str(&env, "Bad");
    let err = client.add_source(&admin, &name, &0).unwrap_err();
    assert_eq!(err, Error::InvalidWeight);
}

#[test]
fn test_add_source_invalid_weight_over_100_fails() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    let name = String::from_str(&env, "Bad");
    let err = client.add_source(&admin, &name, &101).unwrap_err();
    assert_eq!(err, Error::InvalidWeight);
}

#[test]
fn test_remove_source() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    let name = String::from_str(&env, "X");
    let id = client.add_source(&admin, &name, &50).unwrap();
    client.remove_source(&admin, &id).unwrap();
    let src = client.get_source(&id).unwrap();
    assert!(!src.active);
}

#[test]
fn test_set_weight() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    let name = String::from_str(&env, "Y");
    let id = client.add_source(&admin, &name, &50).unwrap();
    client.set_weight(&admin, &id, &75).unwrap();
    assert_eq!(client.get_source(&id).unwrap().weight, 75);
}

#[test]
fn test_non_admin_cannot_add_source() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    let other = Address::generate(&env);
    let name = String::from_str(&env, "Z");
    let err = client.add_source(&other, &name, &50).unwrap_err();
    assert_eq!(err, Error::Unauthorized);
}

// ── update_price / get_price ──────────────────────────────────────────────────

#[test]
fn test_update_and_get_price() {
    let (env, admin, client) = setup();
    // max_price_age = large so prices stay fresh
    client.initialize(&admin, &None, &Some(86400u64), &None, &None, &None).unwrap();
    let src_addr = Address::generate(&env);
    let name = String::from_str(&env, "Oracle1");
    let sid = client.add_source(&admin, &name, &50).unwrap();
    let btc = asset(&env);
    client.update_price(&src_addr, &sid, &btc, &p(50_000)).unwrap();
    let entry = client.get_price(&sid, &btc).unwrap();
    assert_eq!(entry.price, p(50_000));
    assert_eq!(entry.source_id, sid);
}

#[test]
fn test_update_price_unauthorized_source_fails() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    let src_addr = Address::generate(&env);
    let btc = asset(&env);
    // source_id 99 never registered
    let err = client.update_price(&src_addr, &99, &btc, &p(50_000)).unwrap_err();
    assert_eq!(err, Error::Unauthorized);
}

#[test]
fn test_update_price_zero_fails() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    let src_addr = Address::generate(&env);
    let name = String::from_str(&env, "O");
    let sid = client.add_source(&admin, &name, &50).unwrap();
    let btc = asset(&env);
    let err = client.update_price(&src_addr, &sid, &btc, &0).unwrap_err();
    assert_eq!(err, Error::InvalidPrice);
}

#[test]
fn test_update_price_inactive_source_fails() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    let src_addr = Address::generate(&env);
    let name = String::from_str(&env, "O");
    let sid = client.add_source(&admin, &name, &50).unwrap();
    client.remove_source(&admin, &sid).unwrap();
    let btc = asset(&env);
    let err = client.update_price(&src_addr, &sid, &btc, &p(50_000)).unwrap_err();
    assert_eq!(err, Error::SourceInactive);
}

#[test]
fn test_get_price_stale_fails() {
    let (env, admin, client) = setup();
    // max_price_age = 10 seconds
    client.initialize(&admin, &None, &Some(10u64), &None, &None, &None).unwrap();
    let src_addr = Address::generate(&env);
    let name = String::from_str(&env, "O");
    let sid = client.add_source(&admin, &name, &50).unwrap();
    let btc = asset(&env);
    client.update_price(&src_addr, &sid, &btc, &p(50_000)).unwrap();
    // Advance ledger timestamp by 20s (beyond max_price_age)
    env.ledger().with_mut(|l| l.timestamp += 20);
    let err = client.get_price(&sid, &btc).unwrap_err();
    assert_eq!(err, Error::PriceStale);
}

// ── get_aggregated_price (Median) ─────────────────────────────────────────────

#[test]
fn test_aggregated_median_single_source() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &Some(86400u64), &None, &None, &Some(1u32)).unwrap();
    let src_addr = Address::generate(&env);
    let name = String::from_str(&env, "A");
    let sid = client.add_source(&admin, &name, &50).unwrap();
    let btc = asset(&env);
    client.update_price(&src_addr, &sid, &btc, &p(50_000)).unwrap();
    let agg = client.get_aggregated_price(&btc).unwrap();
    assert_eq!(agg.price, p(50_000));
    assert_eq!(agg.num_sources, 1);
}

#[test]
fn test_aggregated_median_three_sources_odd() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &Some(86400u64), &None, &None, &Some(1u32)).unwrap();
    let btc = asset(&env);

    for (name_str, price_val) in [("A", 40_000i128), ("B", 50_000i128), ("C", 60_000i128)] {
        let src_addr = Address::generate(&env);
        let name = String::from_str(&env, name_str);
        let sid = client.add_source(&admin, &name, &50).unwrap();
        client.update_price(&src_addr, &sid, &btc, &p(price_val)).unwrap();
    }

    let agg = client.get_aggregated_price(&btc).unwrap();
    assert_eq!(agg.price, p(50_000)); // median of [40k, 50k, 60k] = 50k
    assert_eq!(agg.num_sources, 3);
}

#[test]
fn test_aggregated_median_two_sources_even() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &Some(86400u64), &None, &None, &Some(1u32)).unwrap();
    let btc = asset(&env);

    for (name_str, price_val) in [("A", 40_000i128), ("B", 60_000i128)] {
        let src_addr = Address::generate(&env);
        let name = String::from_str(&env, name_str);
        let sid = client.add_source(&admin, &name, &50).unwrap();
        client.update_price(&src_addr, &sid, &btc, &p(price_val)).unwrap();
    }

    let agg = client.get_aggregated_price(&btc).unwrap();
    assert_eq!(agg.price, p(50_000)); // (40k + 60k) / 2
}

// ── get_aggregated_price (WeightedAverage) ────────────────────────────────────

#[test]
fn test_aggregated_weighted_average() {
    let (env, admin, client) = setup();
    client
        .initialize(
            &admin,
            &Some(AggregationStrategy::WeightedAverage),
            &Some(86400u64),
            &None,
            &None,
            &Some(1u32),
        )
        .unwrap();
    let btc = asset(&env);

    // Source A: weight 75, price 40000 → contribution: 40000*75
    // Source B: weight 25, price 80000 → contribution: 80000*25
    // Weighted avg = (40000*75 + 80000*25) / 100 = (3000000 + 2000000) / 100 = 50000
    for (name_str, w, price_val) in [("A", 75u32, 40_000i128), ("B", 25u32, 80_000i128)] {
        let src_addr = Address::generate(&env);
        let name = String::from_str(&env, name_str);
        let sid = client.add_source(&admin, &name, &w).unwrap();
        client.update_price(&src_addr, &sid, &btc, &p(price_val)).unwrap();
    }

    let agg = client.get_aggregated_price(&btc).unwrap();
    assert_eq!(agg.price, p(50_000));
    assert_eq!(agg.strategy, AggregationStrategy::WeightedAverage);
}

// ── get_aggregated_price (TrimmedMean) ────────────────────────────────────────

#[test]
fn test_aggregated_trimmed_mean_three_sources() {
    let (env, admin, client) = setup();
    client
        .initialize(
            &admin,
            &Some(AggregationStrategy::TrimmedMean),
            &Some(86400u64),
            &None,
            &None,
            &Some(1u32),
        )
        .unwrap();
    let btc = asset(&env);

    // Prices: [10_000, 50_000, 90_000] → trim min/max → [50_000] → mean = 50_000
    for (name_str, price_val) in [("A", 10_000i128), ("B", 50_000i128), ("C", 90_000i128)] {
        let src_addr = Address::generate(&env);
        let name = String::from_str(&env, name_str);
        let sid = client.add_source(&admin, &name, &50).unwrap();
        client.update_price(&src_addr, &sid, &btc, &p(price_val)).unwrap();
    }

    let agg = client.get_aggregated_price(&btc).unwrap();
    assert_eq!(agg.price, p(50_000));
    assert_eq!(agg.strategy, AggregationStrategy::TrimmedMean);
}

// ── Insufficient sources ──────────────────────────────────────────────────────

#[test]
fn test_aggregated_insufficient_sources_fails() {
    let (env, admin, client) = setup();
    // Require at least 3 sources
    client.initialize(&admin, &None, &Some(86400u64), &None, &None, &Some(3u32)).unwrap();
    let btc = asset(&env);

    // Only add 2
    for (name_str, price_val) in [("A", 50_000i128), ("B", 51_000i128)] {
        let src_addr = Address::generate(&env);
        let name = String::from_str(&env, name_str);
        let sid = client.add_source(&admin, &name, &50).unwrap();
        client.update_price(&src_addr, &sid, &btc, &p(price_val)).unwrap();
    }

    let err = client.get_aggregated_price(&btc).unwrap_err();
    assert_eq!(err, Error::InsufficientSources);
}

#[test]
fn test_aggregated_no_sources_fails() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &Some(1u32)).unwrap();
    let btc = asset(&env);
    let err = client.get_aggregated_price(&btc).unwrap_err();
    assert_eq!(err, Error::InsufficientSources);
}

// ── Outlier detection ─────────────────────────────────────────────────────────

#[test]
fn test_outlier_excluded() {
    let (env, admin, client) = setup();
    // outlier_bps = 1000 (10%), require 1 source after filtering
    client
        .initialize(&admin, &None, &Some(86400u64), &Some(1000u32), &None, &Some(1u32))
        .unwrap();
    let btc = asset(&env);

    // Prices: [50_000, 51_000, 500_000]
    // Median raw = 51_000; 500_000 deviates ~880% → excluded
    // After filter: [50_000, 51_000]; median = 50_500
    for (name_str, price_val) in
        [("A", 50_000i128), ("B", 51_000i128), ("C", 500_000i128)]
    {
        let src_addr = Address::generate(&env);
        let name = String::from_str(&env, name_str);
        let sid = client.add_source(&admin, &name, &50).unwrap();
        client.update_price(&src_addr, &sid, &btc, &p(price_val)).unwrap();
    }

    let agg = client.get_aggregated_price(&btc).unwrap();
    assert_eq!(agg.num_sources, 2);
    // median of [50_000, 51_000] = (50_000+51_000)/2 = 50_500
    assert_eq!(agg.price, p(50_500));
}

// ── Circuit breaker ───────────────────────────────────────────────────────────

#[test]
fn test_circuit_breaker_trips() {
    let (env, admin, client) = setup();
    // circuit_breaker_bps = 1000 (10%)
    client
        .initialize(&admin, &None, &Some(86400u64), &None, &Some(1000u32), &Some(1u32))
        .unwrap();
    let btc = asset(&env);

    let src_addr = Address::generate(&env);
    let name = String::from_str(&env, "A");
    let sid = client.add_source(&admin, &name, &50).unwrap();

    // First aggregation: 50_000 → accepted, stored as last_aggregated
    client.update_price(&src_addr, &sid, &btc, &p(50_000)).unwrap();
    client.get_aggregated_price(&btc).unwrap();

    // Now swing to 80_000: 60% change > 10% threshold → circuit breaker
    client.update_price(&src_addr, &sid, &btc, &p(80_000)).unwrap();
    let err = client.get_aggregated_price(&btc).unwrap_err();
    assert_eq!(err, Error::CircuitBreakerTripped);
}

#[test]
fn test_circuit_breaker_allows_small_swing() {
    let (env, admin, client) = setup();
    // circuit_breaker_bps = 2000 (20%)
    client
        .initialize(&admin, &None, &Some(86400u64), &None, &Some(2000u32), &Some(1u32))
        .unwrap();
    let btc = asset(&env);

    let src_addr = Address::generate(&env);
    let name = String::from_str(&env, "A");
    let sid = client.add_source(&admin, &name, &50).unwrap();

    // First aggregation
    client.update_price(&src_addr, &sid, &btc, &p(50_000)).unwrap();
    client.get_aggregated_price(&btc).unwrap();

    // 5% change – within 20% threshold
    client.update_price(&src_addr, &sid, &btc, &p(52_500)).unwrap();
    let agg = client.get_aggregated_price(&btc).unwrap();
    assert_eq!(agg.price, p(52_500));
}

// ── Stale price excluded from aggregation ─────────────────────────────────────

#[test]
fn test_stale_price_excluded_from_aggregation() {
    let (env, admin, client) = setup();
    // max_price_age = 10s, require 1 source
    client.initialize(&admin, &None, &Some(10u64), &None, &None, &Some(1u32)).unwrap();
    let btc = asset(&env);

    let src1 = Address::generate(&env);
    let src2 = Address::generate(&env);
    let name1 = String::from_str(&env, "A");
    let name2 = String::from_str(&env, "B");
    let sid1 = client.add_source(&admin, &name1, &50).unwrap();
    let sid2 = client.add_source(&admin, &name2, &50).unwrap();

    // Both submit prices now
    client.update_price(&src1, &sid1, &btc, &p(50_000)).unwrap();
    client.update_price(&src2, &sid2, &btc, &p(60_000)).unwrap();

    // Advance time so sid1 is stale, sid2 remains fresh
    env.ledger().with_mut(|l| l.timestamp += 5);
    client.update_price(&src2, &sid2, &btc, &p(60_000)).unwrap(); // refresh sid2
    env.ledger().with_mut(|l| l.timestamp += 8); // sid1 now 13s old (stale), sid2 8s old (fresh)

    let agg = client.get_aggregated_price(&btc).unwrap();
    // Only sid2 contributes
    assert_eq!(agg.price, p(60_000));
    assert_eq!(agg.num_sources, 1);
}

// ── Multiple assets ───────────────────────────────────────────────────────────

#[test]
fn test_multiple_assets_independent() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &Some(86400u64), &None, &None, &Some(1u32)).unwrap();
    let btc = asset(&env);
    let eth_asset = eth(&env);

    let src_addr = Address::generate(&env);
    let name = String::from_str(&env, "A");
    let sid = client.add_source(&admin, &name, &50).unwrap();

    client.update_price(&src_addr, &sid, &btc, &p(50_000)).unwrap();
    client.update_price(&src_addr, &sid, &eth_asset, &p(3_000)).unwrap();

    let btc_agg = client.get_aggregated_price(&btc).unwrap();
    let eth_agg = client.get_aggregated_price(&eth_asset).unwrap();

    assert_eq!(btc_agg.price, p(50_000));
    assert_eq!(eth_agg.price, p(3_000));
}

// ── set_strategy ──────────────────────────────────────────────────────────────

#[test]
fn test_set_strategy() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    assert_eq!(client.get_strategy().unwrap(), AggregationStrategy::Median);
    client.set_strategy(&admin, &AggregationStrategy::TrimmedMean).unwrap();
    assert_eq!(client.get_strategy().unwrap(), AggregationStrategy::TrimmedMean);
}

// ── pause blocks update_price ─────────────────────────────────────────────────

#[test]
fn test_pause_blocks_update_price() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &Some(86400u64), &None, &None, &None).unwrap();
    let src_addr = Address::generate(&env);
    let name = String::from_str(&env, "A");
    let sid = client.add_source(&admin, &name, &50).unwrap();
    client.pause(&admin).unwrap();
    let btc = asset(&env);
    let err = client.update_price(&src_addr, &sid, &btc, &p(50_000)).unwrap_err();
    assert_eq!(err, Error::ContractPaused);
}

// ── get_source_count ──────────────────────────────────────────────────────────

#[test]
fn test_source_count_increments() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    assert_eq!(client.get_source_count().unwrap(), 0);
    for i in 0..5u32 {
        let label = if i == 0 { "A" } else if i == 1 { "B" } else if i == 2 { "C" } else if i == 3 { "D" } else { "E" };
        let name = String::from_str(&env, label);
        client.add_source(&admin, &name, &50).unwrap();
    }
    assert_eq!(client.get_source_count().unwrap(), 5);
}

// ── source not found ──────────────────────────────────────────────────────────

#[test]
fn test_get_source_not_found() {
    let (env, admin, client) = setup();
    client.initialize(&admin, &None, &None, &None, &None, &None).unwrap();
    let err = client.get_source(&99).unwrap_err();
    assert_eq!(err, Error::SourceNotFound);
}
