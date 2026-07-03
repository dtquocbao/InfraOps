# Databricks Bronze Ingest - InfraOps AI
# Load raw seed documents and IoT events into Delta (immutable + ingestion metadata).
#
# Prerequisites:
#   1. Run databricks/unity_catalog/setup.sql (creates UC volume infraops.bronze.seed_files)
#   2. Upload seed/ to the volume (public DBFS is often disabled):
#        databricks fs cp -r seed/documents /Volumes/infraops/bronze/seed_files/documents --overwrite
#
# Run order: 01 → 02 → 03 → 04

# COMMAND ----------

dbutils.widgets.text("catalog", "infraops")
dbutils.widgets.text("seed_path", "/Volumes/infraops/bronze/seed_files")

CATALOG = dbutils.widgets.get("catalog")
SEED_PATH = dbutils.widgets.get("seed_path")

spark.sql(f"USE CATALOG {CATALOG}")

# COMMAND ----------

# Bronze: raw documents (one row per file, content as-is)
from pyspark.sql.functions import current_timestamp, input_file_name, lit
import json

manifest_path = f"{SEED_PATH}/documents/manifest.json"
manifest = json.loads(dbutils.fs.head(manifest_path, 500000))

rows = []
for entry in manifest:
    file_path = f"{SEED_PATH}/documents/{entry['filename']}"
    content = dbutils.fs.head(file_path, 500000)
    rows.append({
        "document_id": entry["id"],
        "title": entry["title"],
        "doc_type": entry["doc_type"],
        "project_id": entry["project_id"],
        "discipline": entry["discipline"],
        "revision": entry["revision"],
        "approval_status": entry["approval_status"],
        "department": entry["department"],
        "security_level": entry["security_level"],
        "created_date": entry["created_date"],
        "source_filename": entry["filename"],
        "raw_content": content,
    })

doc_df = spark.createDataFrame(rows)
doc_df = doc_df.withColumn("_ingested_at", current_timestamp()).withColumn("_source", lit("seed/documents"))

doc_df.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{CATALOG}.bronze.documents_raw")

print(f"Bronze documents_raw: {doc_df.count()} rows")

# COMMAND ----------

# Bronze: IoT events placeholder (populated by app simulator; seed baseline from Postgres export optional)
iot_schema = "device_id STRING, device_type STRING, reading STRING, event_timestamp STRING"
iot_df = spark.createDataFrame([], iot_schema)
iot_df = iot_df.withColumn("_ingested_at", current_timestamp()).withColumn("_source", lit("seed/iot"))

iot_df.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{CATALOG}.bronze.iot_events_raw")

print("Bronze iot_events_raw: table created (events streamed from app simulator)")
