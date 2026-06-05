// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize, Debug, sqlx::FromRow)]
pub struct Event {
    pub id: i64,
    pub contract_id: String,
    pub event_type: String,
    pub ledger: i64,
    pub data: String, // JSON representation
}

#[async_trait]
pub trait Database: Send + Sync {
    /// Stores a contract event in the database
    async fn store_event(&self, event: &Event) -> Result<(), String>;

    /// Retrieves an event by its ID
    async fn get_event(&self, id: i64) -> Result<Option<Event>, String>;
}
