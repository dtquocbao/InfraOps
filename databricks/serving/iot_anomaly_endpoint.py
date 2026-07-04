"""
Deploy / update the InfraOps IoT anomaly Model Serving endpoint.

Cost policy (see docs/iot-anomaly-model.md):
  - DEV / day-to-day: scale_to_zero_enabled=True  (default below)
  - DEMO / low-latency: scale_to_zero_enabled=False, min_provisioned_concurrency=1
    Use only during an active demo window, then tear down or revert.

Usage (Databricks notebook or local with DATABRICKS_HOST + DATABRICKS_TOKEN):

  python databricks/serving/iot_anomaly_endpoint.py --mode dev
  python databricks/serving/iot_anomaly_endpoint.py --mode demo
  python databricks/serving/iot_anomaly_endpoint.py --mode delete
"""

from __future__ import annotations

import argparse

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.serving import EndpointCoreConfigInput, ServedEntityInput

ENDPOINT_NAME = "infraops-iot-anomaly"
ENTITY_NAME = "infraops.gold.iot_anomaly_model"
ENTITY_VERSION = "1"


def config_dev() -> EndpointCoreConfigInput:
    """Cost-safe: scale to zero when idle."""
    return EndpointCoreConfigInput(
        served_entities=[
            ServedEntityInput(
                entity_name=ENTITY_NAME,
                entity_version=ENTITY_VERSION,
                workload_size="Small",
                scale_to_zero_enabled=True,
            )
        ]
    )


def config_demo() -> EndpointCoreConfigInput:
    """Low-latency demo: always warm — billable; tear down after demo."""
    return EndpointCoreConfigInput(
        served_entities=[
            ServedEntityInput(
                entity_name=ENTITY_NAME,
                entity_version=ENTITY_VERSION,
                workload_size="Small",
                scale_to_zero_enabled=False,
                min_provisioned_concurrency=1,
                max_provisioned_concurrency=4,
            )
        ]
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["dev", "demo", "delete"], default="dev")
    args = parser.parse_args()

    w = WorkspaceClient()

    if args.mode == "delete":
        w.serving_endpoints.delete(name=ENDPOINT_NAME)
        print(f"Deleted endpoint {ENDPOINT_NAME}")
        return

    cfg = config_dev() if args.mode == "dev" else config_demo()
    existing = [e.name for e in w.serving_endpoints.list()]
    if ENDPOINT_NAME in existing:
        w.serving_endpoints.update_config_and_wait(name=ENDPOINT_NAME, served_entities=cfg.served_entities)
        print(f"Updated endpoint {ENDPOINT_NAME} ({args.mode})")
    else:
        w.serving_endpoints.create_and_wait(name=ENDPOINT_NAME, config=cfg)
        print(f"Created endpoint {ENDPOINT_NAME} ({args.mode})")

    ep = w.serving_endpoints.get(name=ENDPOINT_NAME)
    print(f"Invoke URL: .../serving-endpoints/{ENDPOINT_NAME}/invocations")
    print(f"State: {ep.state}")


if __name__ == "__main__":
    main()
