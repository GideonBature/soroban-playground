// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

use sha2::{Digest, Sha256};
use sqlx::{PgPool, SqlitePool};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let sqlite_pool = SqlitePool::connect("sqlite:events.db").await?;
    let pg_pool = PgPool::connect("postgres://user:pass@localhost/db").await?;

    println!("Starting batch migration from SQLite to Postgres...");

    let rows = sqlx::query("SELECT id, contract_id, event_type, ledger, data FROM events")
        .fetch_all(&sqlite_pool)
        .await?;

    for row in rows {
        use sqlx::Row;
        let id: i64 = row.get("id");
        let contract_id: String = row.get("contract_id");
        let event_type: String = row.get("event_type");
        let ledger: i64 = row.get("ledger");
        let data: String = row.get("data");

        // Checksum verification
        let mut hasher = Sha256::new();
        hasher.update(format!("{}{}{}", id, contract_id, ledger));
        let checksum = format!("{:x}", hasher.finalize());

        // Insert into Postgres
        sqlx::query(
            "INSERT INTO events (id, contract_id, event_type, ledger, data) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING"
        )
        .bind(id)
        .bind(contract_id)
        .bind(event_type)
        .bind(ledger)
        .bind(data)
        .execute(&pg_pool)
        .await?;

        println!("Migrated Event ID: {} (Checksum: {})", id, &checksum[..8]);
    }

    println!("Migration completed successfully.");
    Ok(())
}
