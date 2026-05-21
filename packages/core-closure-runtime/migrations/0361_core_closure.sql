CREATE TABLE IF NOT EXISTS atc_core_closure (
  id               CHAR(26)     NOT NULL,
  closure_id       CHAR(26)     NOT NULL,
  closure_type     VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  closure_nonce    VARCHAR(128) NOT NULL,
  closure_data     JSON,
  sealed_at        DATETIME(3),
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_core_closure_nonce (closure_nonce, owner_server_id),
  KEY idx_core_closure_status (status),
  KEY idx_core_closure_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
