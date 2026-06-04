# Migration Utils Contract

Implements a **unified suite of contract-migration utility contracts** for Soroban (Issue #604).

The contract exposes five complementary surfaces that work together to give
developers secure, auditable, and roll-back-friendly migration tooling:

1. **`MigrationExecutor`** — secure wrapper for executing single migration
   operations with admin-gated access and a `Pending → InProgress →
   Completed / Failed / RolledBack` audit trail.
2. **`StateMigrator`** — utility for recording state transfers between
   contracts (success and failure variants) with full key-level audit.
3. **`DataValidator`** — utility for verifying the integrity of migrated
   data via `BytesN<32>` checksums, both ad-hoc and against stored
   migrations.
4. **`BatchMigrator`** — utility for grouping multiple `MigrationOp`s
   into an atomic batch with `Open → Executing → Completed / RolledBack`
   accounting.
5. **`RollbackHandler`** — utility for reverting single migrations and
   full batches with a recorded human-readable reason.

## Key Features

- **Soroban-optimized**: every call goes through a single `cdylib` so all
  five utilities share instance storage and counters.
- **Comprehensive security**: admin-gated writes, pause/unpause, status
  guards that prevent re-execution of finished migrations, and
  validation of every input (`key.len > 0`, `source ≠ target`,
  `gas_budget ≥ 1_000` when supplied).
- **Gas-efficient**: typed storage keys, instance-level counters, and
  per-id persistent records; no unbounded loops.
- **Test coverage**: 100+ unit tests covering success, failure, pause,
  auth, and edge cases.
- **Documented**: every public function is described in this file.

## Functions

### Admin

| Function | Access | Description |
|---|---|---|
| `initialize(admin)` | Anyone (once) | Bootstrap the contract |
| `pause(admin)` | Admin | Halt mutation paths (rollbacks still allowed) |
| `unpause(admin)` | Admin | Resume mutation paths |
| `get_admin()` | Anyone | Current admin |
| `is_initialized()` | Anyone | Whether `initialize` was called |
| `is_paused()` | Anyone | Whether the contract is paused |

### 1) MigrationExecutor

| Function | Access | Description |
|---|---|---|
| `queue_migration(admin, source, target, key, checksum, gas_budget)` | Admin | Register a new migration as `Pending` |
| `execute_migration(admin, id, actual_hash)` | Admin | Run a queued migration; marks `Completed` on hash match, `Failed` otherwise |
| `get_migration(id)` | Anyone | Read a stored migration |
| `get_migration_count()` | Anyone | Total migrations ever queued |

### 2) StateMigrator

| Function | Access | Description |
|---|---|---|
| `transfer_state(admin, source, target, key)` | Admin | Record a successful state transfer |
| `record_transfer_failure(admin, source, target, key)` | Admin | Record a failed transfer (allowed even when paused) |
| `get_transfer(id)` | Anyone | Read a transfer log |
| `get_transfer_count()` | Anyone | Total transfer logs |

### 3) DataValidator

| Function | Access | Description |
|---|---|---|
| `validate_hash(admin, migration_id, expected, actual)` | Admin | Hash-pair check; `migration_id=0` is allowed for ad-hoc checks |
| `validate_migration(admin, migration_id, actual_hash)` | Admin | Re-check a stored migration against an actual hash |
| `get_validation(id)` | Anyone | Read a validation result |
| `get_validation_count()` | Anyone | Total validations stored |

### 4) BatchMigrator

| Function | Access | Description |
|---|---|---|
| `open_batch(admin)` | Admin | Create a new `Open` batch; returns id |
| `append_to_batch(admin, batch_id, op)` | Admin | Append a `MigrationOp` to an `Open` batch |
| `execute_batch(admin, batch_id)` | Admin | Walk all ops and mark the batch `Completed` |
| `get_batch(id)` | Anyone | Read a batch (with its `ops` vector) |
| `get_batch_count()` | Anyone | Total batches created |

### 5) RollbackHandler

| Function | Access | Description |
|---|---|---|
| `rollback_migration(admin, migration_id, reason)` | Admin | Revert a single migration; allowed even when paused |
| `rollback_batch(admin, batch_id, reason)` | Admin | Revert a whole batch; allowed even when paused |
| `get_rollback(id)` | Anyone | Read a rollback record |
| `get_rollback_count()` | Anyone | Total rollback records |

## Events

| Topic | Data |
|---|---|
| `init` | admin |
| `paused` / `unpaused` | admin |
| `mig_q` | (id, admin) |
| `mig_ex` | (id, final_status) |
| `xfer` | id |
| `xfer_f` | id |
| `val` | (id, passed) |
| `valm` | (id, passed) |
| `b_open` | id |
| `b_app` | (id, ops_len) |
| `b_done` | (id, ops_len) |
| `rb_m` | (migration_id, rollback_id) |
| `rb_b` | (batch_id, rollback_id) |

## Errors

```
AlreadyInitialized = 1
NotInitialized = 2
Unauthorized = 3
ContractPaused = 4
InvalidInput = 5
MigrationNotFound = 6
BatchNotFound = 7
ValidationNotFound = 8
TransferNotFound = 9
RollbackNotFound = 10
BatchNotOpen = 11
BatchNotExecuting = 12
InvalidMigrationState = 13
IdenticalContracts = 14
BatchOverrun = 15
```

## Usage

```rust
// Bootstrap
client.initialize(&admin);

// Single migration
let mid = client.queue_migration(
    &admin,
    &source_contract,
    &target_contract,
    &String::from_str(&env, "balances"),
    &expected_hash,
    &100_000u64,           // gas budget
);

// Validate it independently
client.validate_migration(&admin, &mid, &actual_hash)?;

// Execute
let status = client.execute_migration(&admin, &mid, &actual_hash);
// status == MigrationStatus::Completed | Failed

// Atomic batch
let bid = client.open_batch(&admin);
client.append_to_batch(&admin, &bid, &op1);
client.append_to_batch(&admin, &bid, &op2);
client.execute_batch(&admin, &bid);

// Roll back on incident
client.rollback_batch(&admin, &bid, &String::from_str(&env, "aborted"));
```

## Security Notes

- **Single admin**: only `get_admin()` can mutate state, queue migrations,
  execute batches, or roll back.
- **Pause** halts *mutation* paths (`queue_migration`, `execute_migration`,
  `transfer_state`, `open_batch`, `append_to_batch`, `execute_batch`).
  **Reads and rollbacks remain available** so the admin can respond to
  incidents even while the contract is paused.
- **Idempotency**: a migration can only be executed while `Pending`, and
  rolled back only once.  Re-execution returns `InvalidMigrationState`.
- **Input validation**: every write path checks that the key is
  non-empty, the source and target are different, and (for migrations)
  the gas budget is either `0` (unknown) or `≥ 1_000`.

## Location

```
contracts/migration-utils/
├── Cargo.toml
├── README.md
└── src/
    ├── lib.rs      — contract logic, all five surfaces
    ├── types.rs    — structs, enums, errors, storage keys
    ├── storage.rs  — typed storage helpers
    └── test.rs     — 100+ test cases
```
