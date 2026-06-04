// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

//! # Migration Utils Contract  (Issue #604)
//!
//! A unified set of contract-migration utility contracts.  This module exposes
//! five surfaces that work together to provide a secure, auditable, and
//! roll-back-friendly migration toolkit for Soroban applications:
//!
//! 1. **`MigrationExecutor`** — secure wrapper for executing single migration
//!    operations, with admin-gated access and a status audit trail.
//! 2. **`StateMigrator`** — utility for transferring state between contracts;
//!    every transfer is recorded on-chain with a success/failure flag.
//! 3. **`DataValidator`** — utility for verifying the integrity of migrated
//!    data via SHA-256-style `BytesN<32>` checksums.
//! 4. **`BatchMigrator`** — utility for executing multiple migration
//!    operations together, with atomic accounting of completed steps.
//! 5. **`RollbackHandler`** — utility for reverting failed migrations and
//!    recording the reason for the rollback.
//!
//! ## Lifecycle
//! 1. Admin calls `initialize(admin)` once.
//! 2. Admin registers single migrations, transfers state, and validates data.
//! 3. Admin opens batches, appends operations, then executes them as a unit.
//! 4. Admin may roll back a single migration or an entire batch at any time
//!    after a failure.
//! 5. Anyone can read the public history; admin can `pause`/`unpause` to
//!    halt sensitive operations during an incident.

#![no_std]

mod storage;
mod test;
mod types;

use soroban_sdk::{contract, contracterror, contractimpl, symbol_short, Address, BytesN, Env, String, Vec};

use crate::storage::{
    get_admin, get_batch_count, get_migration_count, get_rollback_count, get_transfer_count,
    get_validation_count, is_initialized, is_paused, load_batch, load_migration, load_rollback,
    load_transfer, load_validation, set_admin, set_batch_count, set_migration_count, set_paused,
    set_rollback_count, set_transfer_count, set_validation_count, store_batch, store_migration,
    store_rollback, store_transfer, store_validation,
};
use crate::types::{
    BatchMigration, BatchStatus, MigrationOp, MigrationRecord, MigrationStatus, RollbackRecord,
    TransferLog, ValidationResult,
};

/// Errors returned by the migration-utils contract.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    ContractPaused = 4,
    InvalidInput = 5,
    MigrationNotFound = 6,
    BatchNotFound = 7,
    ValidationNotFound = 8,
    TransferNotFound = 9,
    RollbackNotFound = 10,
    /// Operation attempted on a batch that is not in `Open` status.
    BatchNotOpen = 11,
    /// Operation attempted on a batch that is not in `Executing` status.
    BatchNotExecuting = 12,
    /// Migration is not in a state that allows the requested action.
    InvalidMigrationState = 13,
    /// Source and target addresses are identical — a no-op migration.
    IdenticalContracts = 14,
    /// Batch execution would exceed its declared operation count.
    BatchOverrun = 15,
}

#[contract]
pub struct MigrationUtils;

#[contractimpl]
impl MigrationUtils {
    // ── Initialisation ────────────────────────────────────────────────────────

    /// Initialise the contract. Can only be called once.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if is_initialized(&env) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        set_admin(&env, &admin);
        env.events().publish((symbol_short!("init"),), admin);
        Ok(())
    }

    // ── Pause / Unpause ───────────────────────────────────────────────────────

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

    // ══════════════════════════════════════════════════════════════════════════
    // 1) MigrationExecutor — secure wrapper for single migration operations.
    // ══════════════════════════════════════════════════════════════════════════

    /// Queue a migration operation. The status is `Pending` until executed.
    /// Returns the assigned migration id.
    pub fn queue_migration(
        env: Env,
        admin: Address,
        source: Address,
        target: Address,
        key: String,
        checksum: BytesN<32>,
        gas_budget: u64,
    ) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        not_paused(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        validate_op(&source, &target, &key, gas_budget)?;

        let id = get_migration_count(&env);
        let op = MigrationOp { source, target, key, checksum, gas_budget };
        let rec = MigrationRecord {
            id,
            op,
            status: MigrationStatus::Pending,
            ledger: env.ledger().timestamp(),
        };
        store_migration(&env, &rec);
        set_migration_count(&env, id + 1);

        env.events()
            .publish((symbol_short!("mig_q"),), (id, admin));
        Ok(id)
    }

    /// Execute a previously queued migration. Admin only.  The `actual_hash`
    /// argument is the SHA-256 (or WASM-style) hash computed for the data
    /// actually moved at execution time.  When it matches the queued
    /// `checksum` the migration is marked `Completed`; otherwise `Failed`.
    pub fn execute_migration(
        env: Env,
        admin: Address,
        migration_id: u32,
        actual_hash: BytesN<32>,
    ) -> Result<MigrationStatus, Error> {
        ensure_initialized(&env)?;
        not_paused(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;

        let mut rec = load_migration(&env, migration_id)?;
        if rec.status != MigrationStatus::Pending {
            return Err(Error::InvalidMigrationState);
        }
        rec.status = MigrationStatus::InProgress;
        store_migration(&env, &rec);

        let final_status = if rec.op.checksum == actual_hash {
            MigrationStatus::Completed
        } else {
            MigrationStatus::Failed
        };
        rec.status = final_status;
        store_migration(&env, &rec);

        env.events().publish(
            (symbol_short!("mig_ex"),),
            (migration_id, final_status as u32),
        );
        Ok(final_status)
    }

    pub fn get_migration(env: Env, id: u32) -> Result<MigrationRecord, Error> {
        ensure_initialized(&env)?;
        load_migration(&env, id)
    }

    pub fn get_migration_count(env: Env) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        Ok(get_migration_count(&env))
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 2) StateMigrator — utility for transferring state between contracts.
    // ══════════════════════════════════════════════════════════════════════════

    /// Record a state-transfer from `source` to `target` for the given
    /// `key`.  Admin only.  Returns the assigned transfer id.
    pub fn transfer_state(
        env: Env,
        admin: Address,
        source: Address,
        target: Address,
        key: String,
    ) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        not_paused(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        validate_op(&source, &target, &key, 0)?;

        let id = get_transfer_count(&env);
        let log = TransferLog {
            id,
            source,
            target,
            key,
            success: true,
            ledger: env.ledger().timestamp(),
        };
        store_transfer(&env, &log);
        set_transfer_count(&env, id + 1);

        env.events().publish((symbol_short!("xfer"),), id);
        Ok(id)
    }

    /// Record a failed state transfer (e.g. destination contract rejected it).
    pub fn record_transfer_failure(
        env: Env,
        admin: Address,
        source: Address,
        target: Address,
        key: String,
    ) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        validate_op(&source, &target, &key, 0)?;

        let id = get_transfer_count(&env);
        let log = TransferLog {
            id,
            source,
            target,
            key,
            success: false,
            ledger: env.ledger().timestamp(),
        };
        store_transfer(&env, &log);
        set_transfer_count(&env, id + 1);

        env.events().publish((symbol_short!("xfer_f"),), id);
        Ok(id)
    }

    pub fn get_transfer(env: Env, id: u32) -> Result<TransferLog, Error> {
        ensure_initialized(&env)?;
        load_transfer(&env, id)
    }

    pub fn get_transfer_count(env: Env) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        Ok(get_transfer_count(&env))
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 3) DataValidator — utility for validating migrated data integrity.
    // ══════════════════════════════════════════════════════════════════════════

    /// Validate a hash pair out-of-band. Returns a new validation id.
    /// `migration_id = 0` is allowed for ad-hoc validations.
    pub fn validate_hash(
        env: Env,
        admin: Address,
        migration_id: u32,
        expected: BytesN<32>,
        actual: BytesN<32>,
    ) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;

        if migration_id != 0 {
            // Cross-check: the supplied migration must exist.
            let _ = load_migration(&env, migration_id)?;
        }

        let id = get_validation_count(&env);
        let (passed, error_code) = if expected == actual {
            (true, 0u32)
        } else {
            (false, Error::InvalidInput as u32)
        };
        let result = ValidationResult {
            id,
            migration_id,
            passed,
            error_code,
            expected_hash: expected,
            actual_hash: actual,
            ledger: env.ledger().timestamp(),
        };
        store_validation(&env, &result);
        set_validation_count(&env, id + 1);

        env.events()
            .publish((symbol_short!("val"),), (id, passed));
        Ok(id)
    }

    /// Re-validate a stored migration by comparing its queued `checksum`
    /// against the supplied `actual_hash`.
    pub fn validate_migration(
        env: Env,
        admin: Address,
        migration_id: u32,
        actual_hash: BytesN<32>,
    ) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;

        let rec = load_migration(&env, migration_id)?;
        let id = get_validation_count(&env);
        let (passed, error_code) = if rec.op.checksum == actual_hash {
            (true, 0u32)
        } else {
            (false, Error::InvalidMigrationState as u32)
        };
        let result = ValidationResult {
            id,
            migration_id,
            passed,
            error_code,
            expected_hash: rec.op.checksum,
            actual_hash,
            ledger: env.ledger().timestamp(),
        };
        store_validation(&env, &result);
        set_validation_count(&env, id + 1);

        env.events()
            .publish((symbol_short!("valm"),), (id, passed));
        Ok(id)
    }

    pub fn get_validation(env: Env, id: u32) -> Result<ValidationResult, Error> {
        ensure_initialized(&env)?;
        load_validation(&env, id)
    }

    pub fn get_validation_count(env: Env) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        Ok(get_validation_count(&env))
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 4) BatchMigrator — utility for executing multiple ops atomically.
    // ══════════════════════════════════════════════════════════════════════════

    /// Open a new batch and return its id. Admin only.
    pub fn open_batch(env: Env, admin: Address) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        not_paused(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;

        let id = get_batch_count(&env);
        let batch = BatchMigration {
            id,
            ops: Vec::new(&env),
            status: BatchStatus::Open,
            executed_count: 0,
            ledger: env.ledger().timestamp(),
        };
        store_batch(&env, &batch);
        set_batch_count(&env, id + 1);

        env.events().publish((symbol_short!("b_open"),), id);
        Ok(id)
    }

    /// Append an operation to an open batch. Admin only.
    pub fn append_to_batch(
        env: Env,
        admin: Address,
        batch_id: u32,
        op: MigrationOp,
    ) -> Result<(), Error> {
        ensure_initialized(&env)?;
        not_paused(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;

        let mut batch = load_batch(&env, batch_id)?;
        if batch.status != BatchStatus::Open {
            return Err(Error::BatchNotOpen);
        }
        validate_op(&op.source, &op.target, &op.key, op.gas_budget)?;
        batch.ops.push_back(op);
        store_batch(&env, &batch);

        env.events()
            .publish((symbol_short!("b_app"),), (batch_id, batch.ops.len()));
        Ok(())
    }

    /// Execute every operation in a batch.  The status is marked `Completed`
    /// if all ops are appended and `Executing` is traversed.  In a richer
    /// integration this would invoke cross-contract calls; here it provides
    /// atomic accounting and audit trail.
    pub fn execute_batch(env: Env, admin: Address, batch_id: u32) -> Result<BatchStatus, Error> {
        ensure_initialized(&env)?;
        not_paused(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;

        let mut batch = load_batch(&env, batch_id)?;
        if batch.status != BatchStatus::Open {
            return Err(Error::BatchNotOpen);
        }
        if batch.ops.is_empty() {
            return Err(Error::InvalidInput);
        }
        batch.status = BatchStatus::Executing;
        store_batch(&env, &batch);

        // Walk every op and mark them complete.  In a real cross-contract
        // deployment each op would invoke its target contract; the audit
        // trail is what this contract guarantees.
        let total = batch.ops.len();
        for _ in 0..total {
            batch.executed_count += 1;
            if batch.executed_count > total {
                return Err(Error::BatchOverrun);
            }
        }
        batch.status = BatchStatus::Completed;
        store_batch(&env, &batch);

        env.events()
            .publish((symbol_short!("b_done"),), (batch_id, total));
        Ok(BatchStatus::Completed)
    }

    pub fn get_batch(env: Env, id: u32) -> Result<BatchMigration, Error> {
        ensure_initialized(&env)?;
        load_batch(&env, id)
    }

    pub fn get_batch_count(env: Env) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        Ok(get_batch_count(&env))
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 5) RollbackHandler — utility for handling failed migrations gracefully.
    // ══════════════════════════════════════════════════════════════════════════

    /// Roll back a single migration.  The reason is recorded for audit.
    /// Admin only.
    pub fn rollback_migration(
        env: Env,
        admin: Address,
        migration_id: u32,
        reason: String,
    ) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        if reason.is_empty() {
            return Err(Error::InvalidInput);
        }

        let mut rec = load_migration(&env, migration_id)?;
        if rec.status == MigrationStatus::RolledBack {
            return Err(Error::InvalidMigrationState);
        }
        rec.status = MigrationStatus::RolledBack;
        store_migration(&env, &rec);

        let id = get_rollback_count(&env);
        let log = RollbackRecord {
            id,
            migration_id,
            scope: 0,
            reason,
            ledger: env.ledger().timestamp(),
        };
        store_rollback(&env, &log);
        set_rollback_count(&env, id + 1);

        env.events()
            .publish((symbol_short!("rb_m"),), (migration_id, id));
        Ok(id)
    }

    /// Roll back every operation in a batch. Admin only.
    pub fn rollback_batch(
        env: Env,
        admin: Address,
        batch_id: u32,
        reason: String,
    ) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        if reason.is_empty() {
            return Err(Error::InvalidInput);
        }

        let mut batch = load_batch(&env, batch_id)?;
        if batch.status == BatchStatus::RolledBack {
            return Err(Error::InvalidMigrationState);
        }
        batch.status = BatchStatus::RolledBack;
        store_batch(&env, &batch);

        let id = get_rollback_count(&env);
        let log = RollbackRecord {
            id,
            migration_id: batch_id,
            scope: 1,
            reason,
            ledger: env.ledger().timestamp(),
        };
        store_rollback(&env, &log);
        set_rollback_count(&env, id + 1);

        env.events()
            .publish((symbol_short!("rb_b"),), (batch_id, id));
        Ok(id)
    }

    pub fn get_rollback(env: Env, id: u32) -> Result<RollbackRecord, Error> {
        ensure_initialized(&env)?;
        load_rollback(&env, id)
    }

    pub fn get_rollback_count(env: Env) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        Ok(get_rollback_count(&env))
    }

    // ── Read-only ─────────────────────────────────────────────────────────────

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        get_admin(&env)
    }

    pub fn is_initialized(env: Env) -> bool {
        is_initialized(&env)
    }

    pub fn is_paused(env: Env) -> bool {
        is_paused(&env)
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

fn validate_op(
    source: &Address,
    target: &Address,
    key: &String,
    gas_budget: u64,
) -> Result<(), Error> {
    if key.is_empty() {
        return Err(Error::InvalidInput);
    }
    if source == target {
        return Err(Error::IdenticalContracts);
    }
    if gas_budget > 0 && gas_budget < 1_000 {
        // Reject pathologically small budgets.
        return Err(Error::InvalidInput);
    }
    Ok(())
}
