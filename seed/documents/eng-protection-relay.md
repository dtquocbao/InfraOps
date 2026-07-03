# Protection Relay Coordination Study

| Field | Value |
|-------|-------|
| **Document ID** | doc-eng-protection-relay |
| **Project** | Substation Alpha (proj-substation-alpha) |
| **Client** | Helix Power Cooperative |
| **Prepared by** | Meridian Grid Services - Electrical Engineering |
| **Revision** | 1.0 |
| **Approval Status** | Under Review |
| **Created** | 2026-05-18 |
| **Security** | Confidential |

## 1. Study Scope

This coordination study covers all protective relays at Substation Alpha for the 138 kV and 13.8 kV systems. Relay platform is SEL-411L (line differential) and SEL-787 (transformer differential) with IEC 61850 GOOSE messaging for breaker failure protection. Study software: ETAP 2024, model file `SA-Protection-20260518.ETAP`.

## 2. Fault Levels

| Location | 3-Phase Fault (kA) | SLG Fault (kA) |
|----------|-------------------|----------------|
| 138 kV Bus A | 28.4 | 31.2 |
| 138 kV Bus B | 27.8 | 30.6 |
| 13.8 kV Bus | 22.1 | 24.5 |

## 3. Relay Settings Summary

**Line Relay SEL-411L (Feeder F-101, Westfield tie):**
- Phase overcurrent (51P): pickup 800 A, time dial 0.15, inverse definite minimum
- Ground overcurrent (51G): pickup 400 A, time dial 0.10
- Line differential (87L): enabled, 87L pickup 0.2 × CT ratio (1200:5)

**Transformer Relay SEL-787 (MPT-1):**
- Differential (87T): slope 1 = 25%, slope 2 = 50%, unrestrained pickup 8.0 A
- Restricted earth fault (REF): pickup 0.2 A secondary, 0 ms delay
- Overcurrent backup (51): pickup 1.25 × MVA rating, time dial 0.30

Coordination margins between adjacent devices are ≥ 0.3 seconds at maximum fault current. CT ratios are 1200:5 at 138 kV and 3000:5 at 13.8 kV, class C800.

## 4. Outstanding Items

Relay settings for Feeder F-102 (future solar interconnection) are placeholder only pending Helix Power Cooperative interconnection study HPC-INT-2026-07. This document remains under review until HPC approves final GOOSE subscription mapping in the substation network diagram.

**Prepared by:** A. Nakamura, PE - Relay Protection Engineer, Meridian Grid Services
