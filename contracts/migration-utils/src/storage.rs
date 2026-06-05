// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

use soroban_sdk::{Address, Env};

use crate::types::{
    BatchMigration, DataKey, InstanceKey, MigrationRecord, RollbackRecord, TransferLog,
    ValidationResult,
};
use crate::Error;

pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&InstanceKey::Admin)
}

pub fn set_admin(env: &Env, a: &Address) {
    env.storage().instance().set(&InstanceKey::Admin, a);
}

pub fn get_admin(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&InstanceKey::Admin)
        .ok_or(Error::NotInitialized)
}

pub fn is_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&InstanceKey::Paused)
        .unwrap_or(false)
}

pub fn set_paused(env: &Env, v: bool) {
    env.storage().instance().set(&InstanceKey::Paused, &v);
}

// ── Counters ──────────────────────────────────────────────────────────────────

macro_rules! counter_fns {
    ($get:ident, $set:ident, $key:ident) => {
        pub fn $get(env: &Env) -> u32 {
            env.storage()
                .instance()
                .get(&InstanceKey::$key)
                .unwrap_or(0)
        }
        pub fn $set(env: &Env, v: u32) {
            env.storage().instance().set(&InstanceKey::$key, &v);
        }
    };
}

counter_fns!(get_migration_count, set_migration_count, MigrationCount);
counter_fns!(get_batch_count, set_batch_count, BatchCount);
counter_fns!(get_validation_count, set_validation_count, ValidationCount);
counter_fns!(get_transfer_count, set_transfer_count, TransferCount);
counter_fns!(get_rollback_count, set_rollback_count, RollbackCount);

// ── Record storage ────────────────────────────────────────────────────────────

pub fn store_migration(env: &Env, r: &MigrationRecord) {
    env.storage().persistent().set(&DataKey::Migration(r.id), r);
}

pub fn load_migration(env: &Env, id: u32) -> Result<MigrationRecord, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Migration(id))
        .ok_or(Error::MigrationNotFound)
}

pub fn store_batch(env: &Env, b: &BatchMigration) {
    env.storage().persistent().set(&DataKey::Batch(b.id), b);
}

pub fn load_batch(env: &Env, id: u32) -> Result<BatchMigration, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Batch(id))
        .ok_or(Error::BatchNotFound)
}

pub fn store_validation(env: &Env, v: &ValidationResult) {
    env.storage()
        .persistent()
        .set(&DataKey::Validation(v.id), v);
}

pub fn load_validation(env: &Env, id: u32) -> Result<ValidationResult, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Validation(id))
        .ok_or(Error::ValidationNotFound)
}

pub fn store_transfer(env: &Env, t: &TransferLog) {
    env.storage().persistent().set(&DataKey::Transfer(t.id), t);
}

pub fn load_transfer(env: &Env, id: u32) -> Result<TransferLog, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Transfer(id))
        .ok_or(Error::TransferNotFound)
}

pub fn store_rollback(env: &Env, r: &RollbackRecord) {
    env.storage().persistent().set(&DataKey::Rollback(r.id), r);
}

pub fn load_rollback(env: &Env, id: u32) -> Result<RollbackRecord, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Rollback(id))
        .ok_or(Error::RollbackNotFound)
}
