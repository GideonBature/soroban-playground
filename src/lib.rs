// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

// Core modules directly in src/
pub mod backup_logic;
pub mod config;
pub mod multi;
pub mod postgres;
pub mod sqlite;
pub mod r#trait;

/// Compatibility alias for code referencing the old 'db' namespace
pub mod db {
    pub use crate::backup_logic;
    pub use crate::config;
    pub use crate::multi;
    pub use crate::postgres;
    pub use crate::r#trait;
    pub use crate::sqlite;
}
