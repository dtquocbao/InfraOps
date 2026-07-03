-- Unity Catalog setup for InfraOps AI (Meridian Grid Services)
-- Run in Databricks SQL editor (SQL → SQL Editor) before notebooks.
-- Requires Free Edition / workspace with Unity Catalog enabled.
--
-- Public DBFS root is disabled on many workspaces — use the UC volume below
-- instead of dbfs:/FileStore/...

CREATE CATALOG IF NOT EXISTS infraops;
CREATE SCHEMA IF NOT EXISTS infraops.bronze COMMENT 'Raw immutable ingest - documents and IoT events';
CREATE SCHEMA IF NOT EXISTS infraops.silver COMMENT 'Parsed, validated, conformed data';
CREATE SCHEMA IF NOT EXISTS infraops.gold   COMMENT 'Business-ready curated tables for apps and vector search';

-- Managed volume for seed files (replaces dbfs:/FileStore when public DBFS is disabled)
CREATE VOLUME IF NOT EXISTS infraops.bronze.seed_files
  COMMENT 'Seed documents and IoT fixtures for bronze ingest';

-- Optional grants (may require admin; skip if you own the catalog)
-- GRANT USE CATALOG ON CATALOG infraops TO `account users`;
-- GRANT USE SCHEMA ON SCHEMA infraops.bronze TO `account users`;
-- GRANT USE SCHEMA ON SCHEMA infraops.silver TO `account users`;
-- GRANT USE SCHEMA ON SCHEMA infraops.gold TO `account users`;
-- GRANT READ VOLUME ON VOLUME infraops.bronze.seed_files TO `account users`;
