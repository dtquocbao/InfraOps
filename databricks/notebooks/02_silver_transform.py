# Databricks Silver Transform - InfraOps AI
# Parse documents, validate manifest schema, chunk text, normalize IoT events.

# COMMAND ----------

dbutils.widgets.text("catalog", "infraops")
CATALOG = dbutils.widgets.get("catalog")
spark.sql(f"USE CATALOG {CATALOG}")

# COMMAND ----------

from pyspark.sql.functions import col, current_timestamp, length, trim, udf, lit, posexplode
from pyspark.sql.types import ArrayType, StringType
import re

def chunk_text_udf(content: str, chunk_size: int = 800) -> list:
    if not content:
        return []
    paragraphs = re.split(r"\n{2,}", content.strip())
    chunks, current = [], ""
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current) + len(para) + 2 <= chunk_size:
            current = f"{current}\n\n{para}" if current else para
        else:
            if current:
                chunks.append(current)
            current = para if len(para) <= chunk_size else para[:chunk_size]
    if current:
        chunks.append(current)
    return chunks

chunk_udf = udf(chunk_text_udf, ArrayType(StringType()))

bronze_docs = spark.table(f"{CATALOG}.bronze.documents_raw")

# Validate required manifest fields present
required = ["document_id", "title", "doc_type", "project_id", "discipline", "security_level"]
for field in required:
    assert field in bronze_docs.columns, f"Missing required field: {field}"

silver_docs = (
    bronze_docs
    .filter(length(trim(col("raw_content"))) > 0)
    .withColumn("chunks", chunk_udf(col("raw_content")))
    .withColumn("_transformed_at", current_timestamp())
)

silver_docs.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{CATALOG}.silver.documents_parsed")

# Explode chunks for embedding step
chunks_df = (
    silver_docs
    .select(
        col("document_id"),
        col("title"),
        col("doc_type"),
        col("project_id"),
        col("discipline"),
        col("revision"),
        col("security_level"),
        col("department"),
        posexplode(col("chunks")).alias("chunk_index", "content"),
    )
    .withColumn("chunk_id", col("document_id") + lit("-chunk-") + col("chunk_index").cast("string"))
)

chunks_df.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{CATALOG}.silver.document_chunks")

print(f"Silver document_chunks: {chunks_df.count()} rows")

# COMMAND ----------

# Silver: IoT events (pass-through + type conformance when data exists)
from pyspark.sql.functions import lit

iot_bronze = spark.table(f"{CATALOG}.bronze.iot_events_raw")
if iot_bronze.count() > 0:
    iot_silver = iot_bronze.withColumn("_transformed_at", current_timestamp())
else:
    iot_silver = spark.createDataFrame([], "device_id STRING, device_type STRING, reading STRING, event_timestamp STRING, _transformed_at TIMESTAMP")

iot_silver.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{CATALOG}.silver.iot_events")

print("Silver iot_events: ready")
