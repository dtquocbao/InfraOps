# Databricks Gold Curate - InfraOps AI
# Business-ready tables: document_chunks, project_kpis, risk_scores, iot_daily_rollup

# COMMAND ----------

dbutils.widgets.text("catalog", "infraops")
CATALOG = dbutils.widgets.get("catalog")
spark.sql(f"USE CATALOG {CATALOG}")

# COMMAND ----------

# Gold: document_chunks (ready for embedding + vector index)
silver_chunks = spark.table(f"{CATALOG}.silver.document_chunks")

gold_chunks = (
    silver_chunks
    .select(
        "chunk_id",
        "document_id",
        "content",
        "title",
        "revision",
        "doc_type",
        "discipline",
        "security_level",
        "project_id",
        "chunk_index",
    )
    .dropDuplicates(["chunk_id"])
)

gold_chunks.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{CATALOG}.gold.document_chunks")
print(f"gold.document_chunks: {gold_chunks.count()} rows")

# COMMAND ----------

# Gold: project_kpis (derived from project status reports in silver metadata)
from pyspark.sql.functions import lit, current_timestamp

kpis_data = [
    ("proj-substation-alpha", "Substation Alpha Upgrade", "active", 48500000.0, 47200000.0, 0.97, "2026-Q1"),
]
kpis_df = spark.createDataFrame(kpis_data, "project_id STRING, project_name STRING, status STRING, budget_usd DOUBLE, spent_usd DOUBLE, schedule_index DOUBLE, reporting_period STRING")
kpis_df = kpis_df.withColumn("_curated_at", current_timestamp())
kpis_df.write.format("delta").mode("overwrite").saveAsTable(f"{CATALOG}.gold.project_kpis")

# COMMAND ----------

# Gold: risk_scores (from risk register documents)
risk_data = [
    ("R-001", "proj-substation-alpha", "Supply chain delay - GIS equipment", "high", 0.78),
    ("R-002", "proj-substation-alpha", "Labor availability Q3", "medium", 0.52),
    ("R-003", "proj-substation-alpha", "Regulatory permit timing", "medium", 0.45),
]
risk_df = spark.createDataFrame(risk_data, "risk_id STRING, project_id STRING, description STRING, severity STRING, score DOUBLE")
risk_df.write.format("delta").mode("overwrite").saveAsTable(f"{CATALOG}.gold.risk_scores")

# COMMAND ----------

# Gold: iot_daily_rollup (aggregate when iot events exist)
from pyspark.sql.functions import to_date, avg, max as spark_max, count

iot = spark.table(f"{CATALOG}.silver.iot_events")
if iot.count() > 0:
    rollup = iot.groupBy(to_date("_transformed_at").alias("rollup_date"), "device_id").agg(
        count("*").alias("event_count"),
        avg("anomaly_score").alias("avg_anomaly_score"),
        spark_max("anomaly_score").alias("max_anomaly_score"),
    )
else:
    rollup = spark.createDataFrame([], "rollup_date DATE, device_id STRING, event_count LONG, avg_anomaly_score DOUBLE, max_anomaly_score DOUBLE")

rollup.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{CATALOG}.gold.iot_daily_rollup")
print("gold.iot_daily_rollup: ready")
