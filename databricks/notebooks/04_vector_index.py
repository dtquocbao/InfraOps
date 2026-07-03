# Databricks Vector Search Index - InfraOps AI
# Creates a Vector Search index on gold.document_chunks.
#
# NOTE (Free Edition): Vector Search may be quota-limited. If this cell fails,
# document the error and use RETRIEVAL_BACKEND=pgvector OR the app's SQL fallback
# which queries gold.document_chunks via the Databricks SQL API.
#
# Requires: embedding column populated - run the embedding enrichment cell first.

# COMMAND ----------

dbutils.widgets.text("catalog", "infraops")
dbutils.widgets.text("index_name", "document_chunks_index")
CATALOG = dbutils.widgets.get("catalog")
INDEX_NAME = dbutils.widgets.get("index_name")

spark.sql(f"USE CATALOG {CATALOG}")

# COMMAND ----------

# Enrich gold chunks with embeddings via Databricks Foundation Model API or OpenAI
# For demo: use mlflow embeddings or external API - placeholder uses OpenAI if secret configured
try:
    import openai
    import os

    chunks_pdf = spark.table(f"{CATALOG}.gold.document_chunks").limit(500).toPandas()
    api_key = dbutils.secrets.get(scope="infraops", key="openai_api_key")
    client = openai.OpenAI(api_key=api_key)

    embeddings = []
    for content in chunks_pdf["content"]:
        resp = client.embeddings.create(model="text-embedding-3-small", input=content[:8000])
        embeddings.append(resp.data[0].embedding)

    chunks_pdf["embedding"] = embeddings
    embed_df = spark.createDataFrame(chunks_pdf)
    embed_df.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{CATALOG}.gold.document_chunks_embedded")
    source_table = f"{CATALOG}.gold.document_chunks_embedded"
    print(f"Embeddings written: {embed_df.count()} rows")
except Exception as e:
    print(f"Embedding enrichment skipped or failed: {e}")
    print("Using gold.document_chunks without embeddings - SQL/keyword fallback only")
    source_table = f"{CATALOG}.gold.document_chunks"

# COMMAND ----------

# Create Vector Search index (Delta Sync)
from databricks.vector_search.client import VectorSearchClient

vsc = VectorSearchClient()

full_index_name = f"{CATALOG}.gold.{INDEX_NAME}"

try:
    vsc.create_delta_sync_index_and_wait(
        endpoint_name="infraops_vs_endpoint",  # create endpoint in UI if needed
        index_name=full_index_name,
        source_table_name=source_table,
        pipeline_type="TRIGGERED",
        primary_key="chunk_id",
        embedding_source_column="embedding",
        embedding_model_endpoint_name="text-embedding-3-small",  # or pre-computed embeddings
    )
    print(f"Vector Search index created: {full_index_name}")
except Exception as e:
    print(f"Vector Search index creation failed (Free Edition quota likely): {e}")
    print("Set DATABRICKS_USE_SQL_FALLBACK=true in app .env to query Gold table via SQL API")

# COMMAND ----------

# Verify index query
try:
    results = vsc.get_index(full_index_name).describe()
    print(results)
except Exception as e:
    print(f"Index verification: {e}")
