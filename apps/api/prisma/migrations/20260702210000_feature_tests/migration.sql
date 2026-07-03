-- CreateEnum
CREATE TYPE "FeatureTestCaseStatus" AS ENUM ('passed', 'failed', 'skipped', 'error');

-- CreateEnum
CREATE TYPE "FeatureTestRunStatus" AS ENUM ('running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "feature_test_runs" (
    "id" TEXT NOT NULL,
    "triggered_by_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'admin',
    "status" "FeatureTestRunStatus" NOT NULL DEFAULT 'running',
    "pass_count" INTEGER NOT NULL DEFAULT 0,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "skip_count" INTEGER NOT NULL DEFAULT 0,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "retrieval_backend" TEXT,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "feature_test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_test_results" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "test_case_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "FeatureTestCaseStatus" NOT NULL,
    "message" TEXT,
    "duration_ms" INTEGER,
    "details" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "feature_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feature_test_results_run_id_idx" ON "feature_test_results"("run_id");

-- CreateIndex
CREATE INDEX "feature_test_results_test_case_id_idx" ON "feature_test_results"("test_case_id");

-- AddForeignKey
ALTER TABLE "feature_test_runs" ADD CONSTRAINT "feature_test_runs_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_test_results" ADD CONSTRAINT "feature_test_results_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "feature_test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
