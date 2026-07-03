# Databricks Vector Search Index - InfraOps AI (OPTIONAL)
#
# Free Edition / Serverless often cannot:
#   - install `databricks-vector-search` via %pip
#   - create Vector Search endpoints (quota / SKU limits)
#
# For InfraOps AI this notebook is OPTIONAL. The app queries Gold via SQL when:
#   RETRIEVAL_BACKEND=databricks
#   DATABRICKS_USE_SQL_FALLBACK=true
#   DATABRICKS_WAREHOUSE_ID=<your SQL warehouse id>
#
# Success criteria on Free Edition: gold.document_chunks has rows (from notebook 03).
# Run order: 01 → 02 → 03 → (04 optional)

# COMMAND ----------

dbutils.widgets.text("catalog", "infraops")
dbutils.widgets.text("index_name", "document_chunks_index")
CATALOG = dbutils.widgets.get("catalog")
INDEX_NAME = dbutils.widgets.get("index_name")

spark.sql(f"USE CATALOG {CATALOG}")

# COMMAND ----------

# Verify Gold layer (required for app SQL fallback)
gold_table = f"{CATALOG}.gold.document_chunks"
try:
    count = spark.table(gold_table).count()
    print(f"✓ {gold_table}: {count} rows")
    if count == 0:
        raise ValueError("Gold table is empty — run notebook 03_gold_curate.py first")
    print("Gold layer is ready for DATABRICKS_USE_SQL_FALLBACK=true")
except Exception as e:
    print(f"✗ Gold verification failed: {e}")
    dbutils.notebook.exit(f"FAIL: {e}")

# COMMAND ----------

# Optional: Vector Search (skip cleanly when package / quota unavailable)
# Do NOT %pip install databricks-vector-search on Serverless — package is not published for that runtime.

full_index_name = f"{CATALOG}.gold.{INDEX_NAME}"
vector_search_ok = False

try:
    from databricks.vector_search.client import VectorSearchClient

    vsc = VectorSearchClient()
    # Prefer managed embedding on source text column (no pre-computed embedding table required)
    vsc.create_delta_sync_index_and_wait(
        endpoint_name="infraops_vs_endpoint",
        index_name=full_index_name,
        source_table_name=gold_table,
        pipeline_type="TRIGGERED",
        primary_key="chunk_id",
        embedding_source_column="content",
        embedding_model_endpoint_name="databricks-gte-large-en",
    )
    vector_search_ok = True
    print(f"✓ Vector Search index created: {full_index_name}")
except ImportError:
    print("○ databricks.vector_search not available on this runtime (normal on Serverless / Free Edition)")
except Exception as e:
    print(f"○ Vector Search index creation skipped: {e}")

# COMMAND ----------

# Final status — notebook should complete successfully either way
print("")
print("═══════════════════════════════════════════════════")
if vector_search_ok:
    print("  Vector Search: ENABLED")
    print(f"  Set DATABRICKS_VECTOR_INDEX={full_index_name}")
else:
    print("  Vector Search: NOT AVAILABLE (expected on Free Edition)")
    print("  App config for Gold SQL retrieval:")
    print("    RETRIEVAL_BACKEND=databricks")
    print("    DATABRICKS_USE_SQL_FALLBACK=true")
    print("    DATABRICKS_WAREHOUSE_ID=<SQL warehouse id>")
print("═══════════════════════════════════════════════════")
print("Notebook 04 complete — Gold layer is usable without Vector Search.")
