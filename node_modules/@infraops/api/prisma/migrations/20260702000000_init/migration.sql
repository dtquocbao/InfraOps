-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('engineer', 'pm', 'safety', 'executive', 'admin');
CREATE TYPE "ReviewStatus" AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'published');
CREATE TYPE "AgentType" AS ENUM ('rag', 'contract', 'project', 'iot');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'engineer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "title" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "revision" TEXT NOT NULL DEFAULT '1.0',
    "approval_status" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "security_level" TEXT NOT NULL,
    "storage_uri" TEXT NOT NULL,
    "processing_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "chunk_index" INTEGER NOT NULL,
    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_type" "AgentType" NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "tool_calls" JSONB NOT NULL DEFAULT '[]',
    "citations" JSONB NOT NULL DEFAULT '[]',
    "trace_id" TEXT NOT NULL,
    "latency_ms" INTEGER,
    "token_count" INTEGER,
    "cost_usd" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "agent_run_id" TEXT NOT NULL,
    "reviewer_id" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'draft',
    "comments" TEXT,
    "decided_at" TIMESTAMP(3),
    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "iot_devices" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "device_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    CONSTRAINT "iot_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "iot_events" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "reading" JSONB NOT NULL,
    "anomaly_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "iot_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "agent_run_id" TEXT NOT NULL,
    "groundedness" DOUBLE PRECISION,
    "citation_accuracy" DOUBLE PRECISION,
    "hallucination_flag" BOOLEAN NOT NULL DEFAULT false,
    "relevance" DOUBLE PRECISION,
    "user_rating" INTEGER,
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "iot_events" ADD CONSTRAINT "iot_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "iot_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
