CREATE TABLE IF NOT EXISTS atc_global_policies (
  id               CHAR(26)     NOT NULL,
  policy_id        VARCHAR(128) NOT NULL,
  policy_type      VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  policy_data      JSON         NULL,
  expires_at       DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_global_policies_policy_id (policy_id),
  INDEX idx_global_policies_status (status),
  INDEX idx_global_policies_owner (owner_server_id),
  INDEX idx_global_policies_type (policy_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
