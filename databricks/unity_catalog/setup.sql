-- Unity Catalog setup for InfraOps AI (Meridian Grid Services)
-- Run in Databricks SQL editor or as first cell in a setup notebook.
-- Requires Free Edition workspace with Unity Catalog enabled.

CREATE CATALOG IF NOT EXISTS infraops;
CREATE SCHEMA IF NOT EXISTS infraops.bronze COMMENT 'Raw immutable ingest - documents and IoT events';
CREATE SCHEMA IF NOT EXISTS infraops.silver COMMENT 'Parsed, validated, conformed data';
CREATE SCHEMA IF NOT EXISTS infraops.gold   COMMENT 'Business-ready curated tables for apps and vector search';

-- Optional: volume for seed file upload (Free Edition - use workspace upload if volumes unavailable)
-- CREATE VOLUME IF NOT EXISTS infraops.bronze.seed_files;

GRANT USE CATALOG ON CATALOG infraops TO `account users`;
GRANT USE SCHEMA ON SCHEMA infraops.bronze TO `account users`;
GRANT USE SCHEMA ON SCHEMA infraops.silver TO `account users`;
GRANT USE SCHEMA ON SCHEMA infraops.gold TO `account users`;
