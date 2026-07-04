-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN "mlflow_run_id" TEXT;
ALTER TABLE "evaluations" ADD COLUMN "eval_backend" TEXT NOT NULL DEFAULT 'heuristic';
ALTER TABLE "evaluations" ADD COLUMN "judge_scores" JSONB;
