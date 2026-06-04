// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

use soroban_sdk::{contracttype, Address, BytesN, String, Vec};

/// Lifecycle status of a single migration operation.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum MigrationStatus {
    /// Registered but not yet executed.
    Pending = 0,
    /// Currently being executed.
    InProgress = 1,
    /// Successfully executed and validated.
    Completed = 2,
    /// Execution failed; eligible for rollback.
    Failed = 3,
    /// A rollback has been applied.
    RolledBack = 4,
}

/// Single migration step moving one piece of state from `source` to `target`.
#[contracttype]
#[derive(Clone, Debug)]
pub struct MigrationOp {
    /// Contract address where the state currently lives.
    pub source: Address,
    /// Contract address that will receive the state.
    pub target: Address,
    /// Storage key being moved.
    pub key: String,
    /// Pre-computed SHA-256 / WASM-style hash of the value being moved.
    pub checksum: BytesN<32>,
    /// Estimated gas budget for executing this step.
    pub gas_budget: u64,
}

/// Persistent record of a completed (or attempted) migration.
#[contracttype]
#[derive(Clone, Debug)]
pub struct MigrationRecord {
    pub id: u32,
    pub op: MigrationOp,
    pub status: MigrationStatus,
    pub ledger: u64,
}

/// Status of a batch of operations.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum BatchStatus {
    /// Just created; ops can still be appended.
    Open = 0,
    /// Currently being executed; no more appends.
    Executing = 1,
    /// All operations completed successfully.
    Completed = 2,
    /// At least one op failed; eligible for rollback.
    PartiallyFailed = 3,
    /// All operations were rolled back.
    RolledBack = 4,
}

/// Atomic batch of migration operations.
#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchMigration {
    pub id: u32,
    pub ops: Vec<MigrationOp>,
    pub status: BatchStatus,
    pub executed_count: u32,
    pub ledger: u64,
}

/// Result of a data-integrity validation.
#[contracttype]
#[derive(Clone, Debug)]
pub struct ValidationResult {
    pub id: u32,
    pub migration_id: u32,
    pub passed: bool,
    /// 0 = ok, otherwise a u32 error code mirroring `Error`.
    pub error_code: u32,
    pub expected_hash: BytesN<32>,
    pub actual_hash: BytesN<32>,
    pub ledger: u64,
}

/// Record of a state transfer from one contract to another.
#[contracttype]
#[derive(Clone, Debug)]
pub struct TransferLog {
    pub id: u32,
    pub source: Address,
    pub target: Address,
    pub key: String,
    pub success: bool,
    pub ledger: u64,
}

/// Record of a rollback event.
#[contracttype]
#[derive(Clone, Debug)]
pub struct RollbackRecord {
    pub id: u32,
    /// The migration id that was rolled back.
    pub migration_id: u32,
    /// 0 = full rollback of a single migration, 1 = batch rollback.
    pub scope: u32,
    pub reason: String,
    pub ledger: u64,
}

/// Instance-storage singleton keys.
#[contracttype]
pub enum InstanceKey {
    Admin,
    MigrationCount,
    BatchCount,
    ValidationCount,
    TransferCount,
    RollbackCount,
    Paused,
}

/// Persistent per-item storage keys.
#[contracttype]
pub enum DataKey {
    /// Migration record by id.
    Migration(u32),
    /// Batch migration by id.
    Batch(u32),
    /// Validation result by id.
    Validation(u32),
    /// State-transfer log by id.
    Transfer(u32),
    /// Rollback record by id.
    Rollback(u32),
}
