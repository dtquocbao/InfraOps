# Governance (MVP)

## Implemented

- **RBAC** - role-based access via JWT `role` field; review decisions restricted to `safety`, `pm`, `executive`, `admin`
- **Document security levels** - retrieval filtered by `ROLE_CLEARANCE` map in `@infraops/shared`
- **Audit log** - all review decisions and IoT alerts write to `audit_log`
- **Human-in-the-loop** - configurable `REVIEW_TRIGGER_RULES` table flags outputs for review
- **Evaluation feedback loop** - reviewer approve/reject updates `evaluations.user_rating`

## Review trigger rules

Defined in `packages/shared/src/review-rules.ts`:

| Rule ID | Trigger |
|---------|---------|
| `low_confidence` | Retrieval confidence < 0.35 |
| `safety_recommendation` | Safety keywords in Q&A |
| `contract_summary` | Contract citations or liability terms |
| `executive_report` | Executive/portfolio/budget keywords |

## Out of scope (roadmap)

- Azure Entra ID SSO
- Per-field encryption
- Formal compliance certifications (SOC 2, ISO 27001)
- Databricks Unity Catalog RBAC (Phase 4 stretch)
