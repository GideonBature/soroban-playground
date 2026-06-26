-- Contract events indexed from Soroban RPC getEvents polling daemon.
-- @phase: expand
CREATE TABLE IF NOT EXISTS contract_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id TEXT NOT NULL,
  ledger_sequence INTEGER NOT NULL,
  topics TEXT NOT NULL,
  value TEXT,
  raw_xdr TEXT,
  event_type TEXT DEFAULT 'contract',
  indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ce_contract_id ON contract_events(contract_id);
CREATE INDEX IF NOT EXISTS idx_ce_ledger ON contract_events(ledger_sequence);

-- Single-row cursor table: stores the last processed ledger so the indexer
-- can resume without gaps after a restart.
CREATE TABLE IF NOT EXISTS contract_event_cursor (
  id INTEGER PRIMARY KEY DEFAULT 1,
  cursor TEXT NOT NULL,
  last_ledger INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
