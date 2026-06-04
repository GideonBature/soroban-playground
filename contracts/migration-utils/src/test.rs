// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

use crate::types::{BatchStatus, MigrationStatus};
use crate::{Error, MigrationUtils, MigrationUtilsClient};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn setup() -> (Env, Address, MigrationUtilsClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register_contract(None, MigrationUtils);
    let client = MigrationUtilsClient::new(&env, &id);
    let admin = Address::generate(&env);
    (env, admin, client)
}

fn s(env: &Env, v: &str) -> String {
    String::from_str(env, v)
}

fn hash(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

fn zero_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}

fn build_op(
    env: &Env,
    source: &Address,
    target: &Address,
    key: &str,
    checksum: &BytesN<32>,
) -> crate::types::MigrationOp {
    crate::types::MigrationOp {
        source: source.clone(),
        target: target.clone(),
        key: s(env, key),
        checksum: checksum.clone(),
        gas_budget: 100_000,
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Initialisation & admin
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_initialize_ok() {
    let (_env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    assert_eq!(client.get_admin(), admin);
    assert!(client.is_initialized());
    assert!(!client.is_paused());
}

#[test]
fn test_initialize_twice_fails() {
    let (_env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    assert_eq!(
        client.try_initialize(&admin).unwrap_err().unwrap(),
        Error::AlreadyInitialized
    );
}

#[test]
fn test_get_admin_before_init_fails() {
    let (_env, _admin, client) = setup();
    assert_eq!(
        client.try_get_admin().unwrap_err().unwrap(),
        Error::NotInitialized
    );
}

#[test]
fn test_is_initialized_before_init_false() {
    let (_env, _admin, client) = setup();
    assert!(!client.is_initialized());
}

#[test]
fn test_pause_then_unpause() {
    let (_env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    client.try_pause(&admin).unwrap();
    assert!(client.is_paused());
    client.try_unpause(&admin).unwrap();
    assert!(!client.is_paused());
}

#[test]
fn test_pause_before_init_fails() {
    let (_env, admin, client) = setup();
    assert_eq!(
        client.try_pause(&admin).unwrap_err().unwrap(),
        Error::NotInitialized
    );
}

#[test]
fn test_pause_by_non_admin_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let other = Address::generate(&env);
    assert_eq!(
        client.try_pause(&other).unwrap_err().unwrap(),
        Error::Unauthorized
    );
}

#[test]
fn test_unpause_by_non_admin_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    client.try_pause(&admin).unwrap();
    let other = Address::generate(&env);
    assert_eq!(
        client.try_unpause(&other).unwrap_err().unwrap(),
        Error::Unauthorized
    );
}

#[test]
fn test_unpause_before_init_fails() {
    let (_env, admin, client) = setup();
    assert_eq!(
        client.try_unpause(&admin).unwrap_err().unwrap(),
        Error::NotInitialized
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// MigrationExecutor
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_queue_migration_ok() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let source = Address::generate(&env);
    let target = Address::generate(&env);
    let id = client
        .try_queue_migration(
            &admin,
            &source,
            &target,
            &s(&env, "balances"),
            &hash(&env, 7),
            &10_000u64,
        )
        .unwrap()
        .unwrap();
    assert_eq!(id, 0);
    assert_eq!(client.get_migration_count(), 1);
    let rec = client.get_migration(&0);
    assert_eq!(rec.id, 0);
    assert_eq!(rec.status, MigrationStatus::Pending);
    assert_eq!(rec.op.key, s(&env, "balances"));
    assert_eq!(rec.op.gas_budget, 10_000);
}

#[test]
fn test_queue_migration_id_increments() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let id0 = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k1"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    let id1 = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k2"), &hash(&env, 2), &10_000u64)
        .unwrap()
        .unwrap();
    assert_eq!(id0, 0);
    assert_eq!(id1, 1);
    assert_eq!(client.get_migration_count(), 2);
}

#[test]
fn test_queue_migration_non_admin_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let other = Address::generate(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    assert_eq!(
        client
            .try_queue_migration(&other, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
            .unwrap_err()
            .unwrap(),
        Error::Unauthorized
    );
}

#[test]
fn test_queue_migration_empty_key_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    assert_eq!(
        client
            .try_queue_migration(&admin, &a, &b, &s(&env, ""), &hash(&env, 1), &10_000u64)
            .unwrap_err()
            .unwrap(),
        Error::InvalidInput
    );
}

#[test]
fn test_queue_migration_identical_contracts_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    assert_eq!(
        client
            .try_queue_migration(&admin, &a, &a, &s(&env, "k"), &hash(&env, 1), &10_000u64)
            .unwrap_err()
            .unwrap(),
        Error::IdenticalContracts
    );
}

#[test]
fn test_queue_migration_tiny_budget_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    assert_eq!(
        client
            .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &500u64)
            .unwrap_err()
            .unwrap(),
        Error::InvalidInput
    );
}

#[test]
fn test_queue_migration_paused_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    client.try_pause(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    assert_eq!(
        client
            .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
            .unwrap_err()
            .unwrap(),
        Error::ContractPaused
    );
}

#[test]
fn test_execute_migration_matching_hash_completes() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let id = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 9), &10_000u64)
        .unwrap()
        .unwrap();
    let status = client
        .try_execute_migration(&admin, &id, &hash(&env, 9))
        .unwrap()
        .unwrap();
    assert_eq!(status, MigrationStatus::Completed);
    let rec = client.get_migration(&id);
    assert_eq!(rec.status, MigrationStatus::Completed);
}

#[test]
fn test_execute_migration_mismatched_hash_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let id = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 9), &10_000u64)
        .unwrap()
        .unwrap();
    let status = client
        .try_execute_migration(&admin, &id, &hash(&env, 8))
        .unwrap()
        .unwrap();
    assert_eq!(status, MigrationStatus::Failed);
    let rec = client.get_migration(&id);
    assert_eq!(rec.status, MigrationStatus::Failed);
}

#[test]
fn test_execute_migration_already_completed_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let id = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 9), &10_000u64)
        .unwrap()
        .unwrap();
    client.try_execute_migration(&admin, &id, &hash(&env, 9)).unwrap();
    assert_eq!(
        client
            .try_execute_migration(&admin, &id, &hash(&env, 9))
            .unwrap_err()
            .unwrap(),
        Error::InvalidMigrationState
    );
}

#[test]
fn test_execute_migration_non_admin_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let id = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    let other = Address::generate(&env);
    assert_eq!(
        client
            .try_execute_migration(&other, &id, &hash(&env, 1))
            .unwrap_err()
            .unwrap(),
        Error::Unauthorized
    );
}

#[test]
fn test_execute_migration_paused_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let id = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    client.try_pause(&admin).unwrap();
    assert_eq!(
        client
            .try_execute_migration(&admin, &id, &hash(&env, 1))
            .unwrap_err()
            .unwrap(),
        Error::ContractPaused
    );
}

#[test]
fn test_execute_migration_not_found() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    assert_eq!(
        client.try_execute_migration(&admin, &42, &hash(&env, 1)).unwrap_err().unwrap(),
        Error::MigrationNotFound
    );
}

#[test]
fn test_get_migration_not_found() {
    let (_env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    assert_eq!(
        client.try_get_migration(&0).unwrap_err().unwrap(),
        Error::MigrationNotFound
    );
}

#[test]
fn test_get_migration_count_before_init_fails() {
    let (_env, _admin, client) = setup();
    assert_eq!(
        client.try_get_migration_count().unwrap_err().unwrap(),
        Error::NotInitialized
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// StateMigrator
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_transfer_state_ok() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let id = client
        .try_transfer_state(&admin, &a, &b, &s(&env, "config"))
        .unwrap()
        .unwrap();
    assert_eq!(id, 0);
    assert_eq!(client.get_transfer_count(), 1);
    let log = client.get_transfer(&0);
    assert!(log.success);
    assert_eq!(log.key, s(&env, "config"));
}

#[test]
fn test_transfer_state_multiple() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    for i in 0..5 {
        let key = match i {
            0 => "k0",
            1 => "k1",
            2 => "k2",
            3 => "k3",
            _ => "k4",
        };
        client.try_transfer_state(&admin, &a, &b, &s(&env, key)).unwrap();
    }
    assert_eq!(client.get_transfer_count(), 5);
}

#[test]
fn test_transfer_state_non_admin_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let other = Address::generate(&env);
    assert_eq!(
        client
            .try_transfer_state(&other, &a, &b, &s(&env, "k"))
            .unwrap_err()
            .unwrap(),
        Error::Unauthorized
    );
}

#[test]
fn test_transfer_state_empty_key_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    assert_eq!(
        client
            .try_transfer_state(&admin, &a, &b, &s(&env, ""))
            .unwrap_err()
            .unwrap(),
        Error::InvalidInput
    );
}

#[test]
fn test_transfer_state_identical_contracts_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    assert_eq!(
        client
            .try_transfer_state(&admin, &a, &a, &s(&env, "k"))
            .unwrap_err()
            .unwrap(),
        Error::IdenticalContracts
    );
}

#[test]
fn test_transfer_state_paused_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    client.try_pause(&admin).unwrap();
    assert_eq!(
        client.try_transfer_state(&admin, &a, &b, &s(&env, "k")).unwrap_err().unwrap(),
        Error::ContractPaused
    );
}

#[test]
fn test_record_transfer_failure_ok() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let id = client
        .try_record_transfer_failure(&admin, &a, &b, &s(&env, "k"))
        .unwrap()
        .unwrap();
    assert_eq!(id, 0);
    let log = client.get_transfer(&0);
    assert!(!log.success);
}

#[test]
fn test_record_transfer_failure_non_admin_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let other = Address::generate(&env);
    assert_eq!(
        client
            .try_record_transfer_failure(&other, &a, &b, &s(&env, "k"))
            .unwrap_err()
            .unwrap(),
        Error::Unauthorized
    );
}

#[test]
fn test_get_transfer_not_found() {
    let (_env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    assert_eq!(
        client.try_get_transfer(&0).unwrap_err().unwrap(),
        Error::TransferNotFound
    );
}

#[test]
fn test_get_transfer_count_before_init_fails() {
    let (_env, _admin, client) = setup();
    assert_eq!(
        client.try_get_transfer_count().unwrap_err().unwrap(),
        Error::NotInitialized
    );
}

#[test]
fn test_transfer_state_paused_does_not_block_failure_log() {
    // The failure path does not require `not_paused` so logs can be kept
    // even while the contract is paused.
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    client.try_pause(&admin).unwrap();
    let id = client
        .try_record_transfer_failure(&admin, &a, &b, &s(&env, "k"))
        .unwrap()
        .unwrap();
    assert_eq!(id, 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// DataValidator
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_validate_hash_match() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let id = client
        .try_validate_hash(&admin, &0, &hash(&env, 5), &hash(&env, 5))
        .unwrap()
        .unwrap();
    assert_eq!(id, 0);
    let r = client.get_validation(&0);
    assert!(r.passed);
    assert_eq!(r.error_code, 0);
}

#[test]
fn test_validate_hash_mismatch() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let id = client
        .try_validate_hash(&admin, &0, &hash(&env, 5), &hash(&env, 6))
        .unwrap()
        .unwrap();
    let r = client.get_validation(&0);
    assert!(!r.passed);
    assert_ne!(r.error_code, 0);
    assert_eq!(id, 0);
}

#[test]
fn test_validate_hash_non_admin_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let other = Address::generate(&env);
    assert_eq!(
        client
            .try_validate_hash(&other, &0, &hash(&env, 1), &hash(&env, 1))
            .unwrap_err()
            .unwrap(),
        Error::Unauthorized
    );
}

#[test]
fn test_validate_hash_with_unknown_migration_id_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    assert_eq!(
        client
            .try_validate_hash(&admin, &99, &hash(&env, 1), &hash(&env, 1))
            .unwrap_err()
            .unwrap(),
        Error::MigrationNotFound
    );
}

#[test]
fn test_validate_hash_before_init_fails() {
    let (env, admin, client) = setup();
    assert_eq!(
        client
            .try_validate_hash(&admin, &0, &hash(&env, 1), &hash(&env, 1))
            .unwrap_err()
            .unwrap(),
        Error::NotInitialized
    );
}

#[test]
fn test_validate_migration_matching() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 11), &10_000u64)
        .unwrap()
        .unwrap();
    let id = client
        .try_validate_migration(&admin, &mid, &hash(&env, 11))
        .unwrap()
        .unwrap();
    let r = client.get_validation(&id);
    assert!(r.passed);
    assert_eq!(r.migration_id, mid);
    assert_eq!(r.expected_hash, hash(&env, 11));
}

#[test]
fn test_validate_migration_mismatch() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 11), &10_000u64)
        .unwrap()
        .unwrap();
    let id = client
        .try_validate_migration(&admin, &mid, &hash(&env, 22))
        .unwrap()
        .unwrap();
    let r = client.get_validation(&id);
    assert!(!r.passed);
    assert_ne!(r.error_code, 0);
}

#[test]
fn test_validate_migration_not_found() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    assert_eq!(
        client
            .try_validate_migration(&admin, &42, &hash(&env, 1))
            .unwrap_err()
            .unwrap(),
        Error::MigrationNotFound
    );
}

#[test]
fn test_validate_migration_non_admin_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    let other = Address::generate(&env);
    assert_eq!(
        client.try_validate_migration(&other, &mid, &hash(&env, 1)).unwrap_err().unwrap(),
        Error::Unauthorized
    );
}

#[test]
fn test_validation_count_increments() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    client.try_validate_hash(&admin, &0, &hash(&env, 1), &hash(&env, 1)).unwrap();
    client.try_validate_hash(&admin, &0, &hash(&env, 2), &hash(&env, 2)).unwrap();
    client.try_validate_hash(&admin, &0, &hash(&env, 3), &hash(&env, 4)).unwrap();
    assert_eq!(client.get_validation_count(), 3);
}

#[test]
fn test_get_validation_not_found() {
    let (_env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    assert_eq!(
        client.try_get_validation(&0).unwrap_err().unwrap(),
        Error::ValidationNotFound
    );
}

#[test]
fn test_get_validation_count_before_init_fails() {
    let (_env, _admin, client) = setup();
    assert_eq!(
        client.try_get_validation_count().unwrap_err().unwrap(),
        Error::NotInitialized
    );
}

#[test]
fn test_validate_zero_hash_matches_zero_hash() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let id = client
        .try_validate_hash(&admin, &0, &zero_hash(&env), &zero_hash(&env))
        .unwrap()
        .unwrap();
    let r = client.get_validation(&id);
    assert!(r.passed);
}

// ═════════════════════════════════════════════════════════════════════════════
// BatchMigrator
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_open_batch_ok() {
    let (_env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let id = client.try_open_batch(&admin).unwrap().unwrap();
    assert_eq!(id, 0);
    let batch = client.get_batch(&0);
    assert_eq!(batch.status, BatchStatus::Open);
    assert_eq!(batch.executed_count, 0);
    assert!(batch.ops.is_empty());
}

#[test]
fn test_open_batch_non_admin_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let other = Address::generate(&env);
    assert_eq!(
        client.try_open_batch(&other).unwrap_err().unwrap(),
        Error::Unauthorized
    );
}

#[test]
fn test_open_batch_paused_fails() {
    let (_env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    client.try_pause(&admin).unwrap();
    assert_eq!(
        client.try_open_batch(&admin).unwrap_err().unwrap(),
        Error::ContractPaused
    );
}

#[test]
fn test_open_batch_before_init_fails() {
    let (_env, admin, client) = setup();
    assert_eq!(
        client.try_open_batch(&admin).unwrap_err().unwrap(),
        Error::NotInitialized
    );
}

#[test]
fn test_append_to_batch_ok() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let op = build_op(&env, &a, &b, "k1", &hash(&env, 1));
    client.try_append_to_batch(&admin, &batch_id, &op).unwrap();
    let batch = client.get_batch(&batch_id);
    assert_eq!(batch.ops.len(), 1);
}

#[test]
fn test_append_to_batch_non_admin_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let op = build_op(&env, &a, &b, "k1", &hash(&env, 1));
    let other = Address::generate(&env);
    assert_eq!(
        client.try_append_to_batch(&other, &batch_id, &op).unwrap_err().unwrap(),
        Error::Unauthorized
    );
}

#[test]
fn test_append_to_batch_empty_key_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let op = build_op(&env, &a, &b, "", &hash(&env, 1));
    assert_eq!(
        client.try_append_to_batch(&admin, &batch_id, &op).unwrap_err().unwrap(),
        Error::InvalidInput
    );
}

#[test]
fn test_append_to_batch_identical_contracts_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let op = build_op(&env, &a, &a, "k", &hash(&env, 1));
    assert_eq!(
        client.try_append_to_batch(&admin, &batch_id, &op).unwrap_err().unwrap(),
        Error::IdenticalContracts
    );
}

#[test]
fn test_append_to_batch_paused_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let op = build_op(&env, &a, &b, "k", &hash(&env, 1));
    client.try_pause(&admin).unwrap();
    assert_eq!(
        client.try_append_to_batch(&admin, &batch_id, &op).unwrap_err().unwrap(),
        Error::ContractPaused
    );
}

#[test]
fn test_append_to_batch_after_execute_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let op = build_op(&env, &a, &b, "k", &hash(&env, 1));
    client.try_append_to_batch(&admin, &batch_id, &op).unwrap();
    client.try_execute_batch(&admin, &batch_id).unwrap();
    let op2 = build_op(&env, &a, &b, "k2", &hash(&env, 2));
    assert_eq!(
        client.try_append_to_batch(&admin, &batch_id, &op2).unwrap_err().unwrap(),
        Error::BatchNotOpen
    );
}

#[test]
fn test_execute_batch_empty_fails() {
    let (_env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    assert_eq!(
        client.try_execute_batch(&admin, &batch_id).unwrap_err().unwrap(),
        Error::InvalidInput
    );
}

#[test]
fn test_execute_batch_single_op() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let op = build_op(&env, &a, &b, "k", &hash(&env, 1));
    client.try_append_to_batch(&admin, &batch_id, &op).unwrap();
    let status = client.try_execute_batch(&admin, &batch_id).unwrap().unwrap();
    assert_eq!(status, BatchStatus::Completed);
    let batch = client.get_batch(&batch_id);
    assert_eq!(batch.status, BatchStatus::Completed);
    assert_eq!(batch.executed_count, 1);
}

#[test]
fn test_execute_batch_multiple_ops() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    for i in 0..4u8 {
        let key = match i {
            0 => "k0",
            1 => "k1",
            2 => "k2",
            _ => "k3",
        };
        let op = build_op(&env, &a, &b, key, &hash(&env, i));
        client.try_append_to_batch(&admin, &batch_id, &op).unwrap();
    }
    let status = client.try_execute_batch(&admin, &batch_id).unwrap().unwrap();
    assert_eq!(status, BatchStatus::Completed);
    let batch = client.get_batch(&batch_id);
    assert_eq!(batch.executed_count, 4);
}

#[test]
fn test_execute_batch_already_executed_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let op = build_op(&env, &a, &b, "k", &hash(&env, 1));
    client.try_append_to_batch(&admin, &batch_id, &op).unwrap();
    client.try_execute_batch(&admin, &batch_id).unwrap();
    assert_eq!(
        client.try_execute_batch(&admin, &batch_id).unwrap_err().unwrap(),
        Error::BatchNotOpen
    );
}

#[test]
fn test_execute_batch_non_admin_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let op = build_op(&env, &a, &b, "k", &hash(&env, 1));
    client.try_append_to_batch(&admin, &batch_id, &op).unwrap();
    let other = Address::generate(&env);
    assert_eq!(
        client.try_execute_batch(&other, &batch_id).unwrap_err().unwrap(),
        Error::Unauthorized
    );
}

#[test]
fn test_execute_batch_paused_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let op = build_op(&env, &a, &b, "k", &hash(&env, 1));
    client.try_append_to_batch(&admin, &batch_id, &op).unwrap();
    client.try_pause(&admin).unwrap();
    assert_eq!(
        client.try_execute_batch(&admin, &batch_id).unwrap_err().unwrap(),
        Error::ContractPaused
    );
}

#[test]
fn test_batch_count_independent() {
    let (_env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    client.try_open_batch(&admin).unwrap();
    client.try_open_batch(&admin).unwrap();
    assert_eq!(client.get_batch_count(), 2);
}

#[test]
fn test_get_batch_not_found() {
    let (_env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    assert_eq!(
        client.try_get_batch(&0).unwrap_err().unwrap(),
        Error::BatchNotFound
    );
}

#[test]
fn test_get_batch_count_before_init_fails() {
    let (_env, _admin, client) = setup();
    assert_eq!(
        client.try_get_batch_count().unwrap_err().unwrap(),
        Error::NotInitialized
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// RollbackHandler
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_rollback_migration_ok() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    let rid = client
        .try_rollback_migration(&admin, &mid, &s(&env, "checksum mismatch"))
        .unwrap()
        .unwrap();
    assert_eq!(rid, 0);
    let rec = client.get_migration(&mid);
    assert_eq!(rec.status, MigrationStatus::RolledBack);
    let rb = client.get_rollback(&0);
    assert_eq!(rb.migration_id, mid);
    assert_eq!(rb.scope, 0);
}

#[test]
fn test_rollback_migration_empty_reason_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    assert_eq!(
        client
            .try_rollback_migration(&admin, &mid, &s(&env, ""))
            .unwrap_err()
            .unwrap(),
        Error::InvalidInput
    );
}

#[test]
fn test_rollback_migration_not_found() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    assert_eq!(
        client
            .try_rollback_migration(&admin, &99, &s(&env, "oops"))
            .unwrap_err()
            .unwrap(),
        Error::MigrationNotFound
    );
}

#[test]
fn test_rollback_migration_already_rolled_back_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    client.try_rollback_migration(&admin, &mid, &s(&env, "first")).unwrap();
    assert_eq!(
        client
            .try_rollback_migration(&admin, &mid, &s(&env, "second"))
            .unwrap_err()
            .unwrap(),
        Error::InvalidMigrationState
    );
}

#[test]
fn test_rollback_migration_non_admin_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    let other = Address::generate(&env);
    assert_eq!(
        client
            .try_rollback_migration(&other, &mid, &s(&env, "r"))
            .unwrap_err()
            .unwrap(),
        Error::Unauthorized
    );
}

#[test]
fn test_rollback_migration_before_init_fails() {
    let (env, admin, client) = setup();
    assert_eq!(
        client
            .try_rollback_migration(&admin, &0, &s(&env, "r"))
            .unwrap_err()
            .unwrap(),
        Error::NotInitialized
    );
}

#[test]
fn test_rollback_batch_ok() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let op = build_op(&env, &a, &b, "k", &hash(&env, 1));
    client.try_append_to_batch(&admin, &batch_id, &op).unwrap();
    let rid = client
        .try_rollback_batch(&admin, &batch_id, &s(&env, "aborted"))
        .unwrap()
        .unwrap();
    assert_eq!(rid, 0);
    let batch = client.get_batch(&batch_id);
    assert_eq!(batch.status, BatchStatus::RolledBack);
    let rb = client.get_rollback(&0);
    assert_eq!(rb.scope, 1);
    assert_eq!(rb.migration_id, batch_id);
}

#[test]
fn test_rollback_batch_empty_reason_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    assert_eq!(
        client
            .try_rollback_batch(&admin, &batch_id, &s(&env, ""))
            .unwrap_err()
            .unwrap(),
        Error::InvalidInput
    );
}

#[test]
fn test_rollback_batch_not_found() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    assert_eq!(
        client.try_rollback_batch(&admin, &99, &s(&env, "r")).unwrap_err().unwrap(),
        Error::BatchNotFound
    );
}

#[test]
fn test_rollback_batch_already_rolled_back_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let op = build_op(&env, &a, &b, "k", &hash(&env, 1));
    client.try_append_to_batch(&admin, &batch_id, &op).unwrap();
    client.try_rollback_batch(&admin, &batch_id, &s(&env, "first")).unwrap();
    assert_eq!(
        client
            .try_rollback_batch(&admin, &batch_id, &s(&env, "second"))
            .unwrap_err()
            .unwrap(),
        Error::InvalidMigrationState
    );
}

#[test]
fn test_rollback_batch_non_admin_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let batch_id = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let op = build_op(&env, &a, &b, "k", &hash(&env, 1));
    client.try_append_to_batch(&admin, &batch_id, &op).unwrap();
    let other = Address::generate(&env);
    assert_eq!(
        client
            .try_rollback_batch(&other, &batch_id, &s(&env, "r"))
            .unwrap_err()
            .unwrap(),
        Error::Unauthorized
    );
}

#[test]
fn test_rollback_count_increments() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid1 = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k1"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    let mid2 = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k2"), &hash(&env, 2), &10_000u64)
        .unwrap()
        .unwrap();
    client.try_rollback_migration(&admin, &mid1, &s(&env, "r1")).unwrap();
    client.try_rollback_migration(&admin, &mid2, &s(&env, "r2")).unwrap();
    assert_eq!(client.get_rollback_count(), 2);
}

#[test]
fn test_get_rollback_not_found() {
    let (_env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    assert_eq!(
        client.try_get_rollback(&0).unwrap_err().unwrap(),
        Error::RollbackNotFound
    );
}

#[test]
fn test_get_rollback_count_before_init_fails() {
    let (_env, _admin, client) = setup();
    assert_eq!(
        client.try_get_rollback_count().unwrap_err().unwrap(),
        Error::NotInitialized
    );
}

#[test]
fn test_rollback_migration_after_failure() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    // Force a failed execution.
    client.try_execute_migration(&admin, &mid, &hash(&env, 99)).unwrap();
    // Rollback should still be allowed on a Failed migration.
    let rid = client
        .try_rollback_migration(&admin, &mid, &s(&env, "reverting"))
        .unwrap()
        .unwrap();
    assert_eq!(rid, 0);
    let rec = client.get_migration(&mid);
    assert_eq!(rec.status, MigrationStatus::RolledBack);
}

// ═════════════════════════════════════════════════════════════════════════════
// Cross-cutting / integration
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_full_migration_lifecycle() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    // Queue
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    // Validate
    let vid = client
        .try_validate_migration(&admin, &mid, &hash(&env, 1))
        .unwrap()
        .unwrap();
    assert!(client.get_validation(&vid).passed);
    // Execute
    let status = client
        .try_execute_migration(&admin, &mid, &hash(&env, 1))
        .unwrap()
        .unwrap();
    assert_eq!(status, MigrationStatus::Completed);
    // Transfer state
    let tid = client
        .try_transfer_state(&admin, &a, &b, &s(&env, "k"))
        .unwrap()
        .unwrap();
    assert_eq!(tid, 0);
    // Counts
    assert_eq!(client.get_migration_count(), 1);
    assert_eq!(client.get_validation_count(), 1);
    assert_eq!(client.get_transfer_count(), 1);
    assert_eq!(client.get_rollback_count(), 0);
}

#[test]
fn test_full_batch_lifecycle() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let bid = client.try_open_batch(&admin).unwrap().unwrap();
    for i in 0u8..3 {
        let key = match i {
            0 => "k0",
            1 => "k1",
            _ => "k2",
        };
        let op = build_op(&env, &a, &b, key, &hash(&env, i));
        client.try_append_to_batch(&admin, &bid, &op).unwrap();
    }
    let status = client.try_execute_batch(&admin, &bid).unwrap().unwrap();
    assert_eq!(status, BatchStatus::Completed);
    let batch = client.get_batch(&bid);
    assert_eq!(batch.executed_count, 3);
    assert_eq!(batch.ops.len(), 3);
}

#[test]
fn test_full_failed_migration_with_rollback() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    // Bad execution
    client.try_execute_migration(&admin, &mid, &hash(&env, 99)).unwrap();
    // Bad validation
    let vid = client
        .try_validate_migration(&admin, &mid, &hash(&env, 99))
        .unwrap()
        .unwrap();
    assert!(!client.get_validation(&vid).passed);
    // Rollback
    let rid = client
        .try_rollback_migration(&admin, &mid, &s(&env, "bad hash"))
        .unwrap()
        .unwrap();
    assert_eq!(rid, 0);
    assert_eq!(client.get_migration(&mid).status, MigrationStatus::RolledBack);
}

#[test]
fn test_counters_independent() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    // 2 migrations
    client.try_queue_migration(&admin, &a, &b, &s(&env, "k1"), &hash(&env, 1), &10_000u64).unwrap();
    client.try_queue_migration(&admin, &a, &b, &s(&env, "k2"), &hash(&env, 2), &10_000u64).unwrap();
    // 1 batch
    let bid = client.try_open_batch(&admin).unwrap().unwrap();
    let op = build_op(&env, &a, &b, "k", &hash(&env, 1));
    client.try_append_to_batch(&admin, &bid, &op).unwrap();
    client.try_execute_batch(&admin, &bid).unwrap();
    // 1 validation
    client.try_validate_hash(&admin, &0, &hash(&env, 1), &hash(&env, 1)).unwrap();
    // 3 transfers
    client.try_transfer_state(&admin, &a, &b, &s(&env, "t1")).unwrap();
    client.try_transfer_state(&admin, &a, &b, &s(&env, "t2")).unwrap();
    client.try_record_transfer_failure(&admin, &a, &b, &s(&env, "t3")).unwrap();

    assert_eq!(client.get_migration_count(), 2);
    assert_eq!(client.get_batch_count(), 1);
    assert_eq!(client.get_validation_count(), 1);
    assert_eq!(client.get_transfer_count(), 3);
    assert_eq!(client.get_rollback_count(), 0);
}

#[test]
fn test_revoke_then_re_execute_migration_fails() {
    // After a rollback, the migration is no longer Pending, so re-execute
    // must be rejected.
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    client.try_rollback_migration(&admin, &mid, &s(&env, "r")).unwrap();
    assert_eq!(
        client
            .try_execute_migration(&admin, &mid, &hash(&env, 1))
            .unwrap_err()
            .unwrap(),
        Error::InvalidMigrationState
    );
}

#[test]
fn test_pause_blocks_mutation_paths_only() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    // Rollback is allowed while paused (incident response).
    client.try_pause(&admin).unwrap();
    client.try_rollback_migration(&admin, &mid, &s(&env, "incident")).unwrap();
    // Reads still work.
    assert_eq!(client.is_paused(), true);
    assert_eq!(client.get_migration(&mid).status, MigrationStatus::RolledBack);
}

#[test]
fn test_unpause_restores_mutation_paths() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    client.try_pause(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    assert_eq!(
        client
            .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
            .unwrap_err()
            .unwrap(),
        Error::ContractPaused
    );
    client.try_unpause(&admin).unwrap();
    client.try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64).unwrap();
}

#[test]
fn test_pause_blocks_open_batch() {
    let (_env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    client.try_pause(&admin).unwrap();
    assert_eq!(
        client.try_open_batch(&admin).unwrap_err().unwrap(),
        Error::ContractPaused
    );
}

#[test]
fn test_rollback_records_ledger() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    let rid = client
        .try_rollback_migration(&admin, &mid, &s(&env, "r"))
        .unwrap()
        .unwrap();
    let rb = client.get_rollback(&rid);
    // The test ledger timestamp defaults to 0, so we only assert that the
    // field is stored and round-trips intact.  In production the contract
    // populates this with `env.ledger().timestamp()`.
    assert_eq!(rb.ledger, env.ledger().timestamp());
    assert_eq!(rb.migration_id, mid);
    assert_eq!(rb.scope, 0);
}

#[test]
fn test_queue_migration_zero_budget_ok() {
    // A budget of zero is allowed (caller signals "unknown / unlimited").
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let id = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &0u64)
        .unwrap()
        .unwrap();
    let rec = client.get_migration(&id);
    assert_eq!(rec.op.gas_budget, 0);
}

#[test]
fn test_queue_migration_min_budget_ok() {
    // Budget of 1000 (the minimum allowed) is accepted.
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let id = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &1_000u64)
        .unwrap()
        .unwrap();
    assert_eq!(id, 0);
}

#[test]
fn test_execute_migration_already_failed_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    client.try_execute_migration(&admin, &mid, &hash(&env, 2)).unwrap();
    assert_eq!(
        client
            .try_execute_migration(&admin, &mid, &hash(&env, 1))
            .unwrap_err()
            .unwrap(),
        Error::InvalidMigrationState
    );
}

#[test]
fn test_transfer_state_paused_does_not_block_failure_log_v2() {
    // Companion test exercising the same path with a unique assertion.
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    client.try_pause(&admin).unwrap();
    let id = client
        .try_record_transfer_failure(&admin, &a, &b, &s(&env, "audit"))
        .unwrap()
        .unwrap();
    let log = client.get_transfer(&id);
    assert!(!log.success);
    assert_eq!(log.key, s(&env, "audit"));
}

#[test]
fn test_validate_hash_then_migration() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    client.try_validate_hash(&admin, &mid, &hash(&env, 1), &hash(&env, 1)).unwrap();
    let id = client.try_validate_migration(&admin, &mid, &hash(&env, 1)).unwrap().unwrap();
    assert!(client.get_validation(&id).passed);
}

#[test]
fn test_rollback_batch_executed() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let bid = client.try_open_batch(&admin).unwrap().unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let op = build_op(&env, &a, &b, "k", &hash(&env, 1));
    client.try_append_to_batch(&admin, &bid, &op).unwrap();
    client.try_execute_batch(&admin, &bid).unwrap();
    // Completed batches are still roll-backable for incident response.
    client.try_rollback_batch(&admin, &bid, &s(&env, "post-mortem")).unwrap();
    assert_eq!(client.get_batch(&bid).status, BatchStatus::RolledBack);
}

#[test]
fn test_rollback_migration_after_pause_still_allowed() {
    // Rollback is allowed even while paused (incident response).
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let mid = client
        .try_queue_migration(&admin, &a, &b, &s(&env, "k"), &hash(&env, 1), &10_000u64)
        .unwrap()
        .unwrap();
    client.try_pause(&admin).unwrap();
    client.try_rollback_migration(&admin, &mid, &s(&env, "incident")).unwrap();
    assert_eq!(client.get_migration(&mid).status, MigrationStatus::RolledBack);
}

#[test]
fn test_append_to_batch_unknown_batch_fails() {
    let (env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let op = build_op(&env, &a, &b, "k", &hash(&env, 1));
    assert_eq!(
        client.try_append_to_batch(&admin, &99, &op).unwrap_err().unwrap(),
        Error::BatchNotFound
    );
}

#[test]
fn test_execute_batch_unknown_batch_fails() {
    let (_env, admin, client) = setup();
    client.try_initialize(&admin).unwrap();
    assert_eq!(
        client.try_execute_batch(&admin, &99).unwrap_err().unwrap(),
        Error::BatchNotFound
    );
}

#[test]
fn test_rollback_batch_before_init_fails() {
    let (env, admin, client) = setup();
    assert_eq!(
        client.try_rollback_batch(&admin, &0, &s(&env, "r")).unwrap_err().unwrap(),
        Error::NotInitialized
    );
}

#[test]
fn test_record_transfer_failure_before_init_fails() {
    let (env, admin, client) = setup();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    assert_eq!(
        client
            .try_record_transfer_failure(&admin, &a, &b, &s(&env, "k"))
            .unwrap_err()
            .unwrap(),
        Error::NotInitialized
    );
}
