-- AlterTable
ALTER TABLE "iot_events" ADD COLUMN "scoring_backend" TEXT NOT NULL DEFAULT 'heuristic';
ALTER TABLE "iot_events" ADD COLUMN "model_version" TEXT;
ALTER TABLE "iot_events" ADD COLUMN "explanation" TEXT;
