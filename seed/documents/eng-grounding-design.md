# Substation Grounding Grid Design Criteria

| Field | Value |
|-------|-------|
| **Document ID** | doc-eng-grounding |
| **Project** | Substation Alpha (proj-substation-alpha) |
| **Client** | Helix Power Cooperative |
| **Prepared by** | Meridian Grid Services - Electrical Engineering |
| **Revision** | 1.2 |
| **Approval Status** | Approved |
| **Created** | 2026-04-01 |
| **Security** | Internal |

## 1. Design Basis

The grounding system for Substation Alpha is designed per IEEE Std 80-2013 and IEEE Std 81-2012. Design fault current is 31.2 kA (single-line-to-ground) with a fault duration of 0.5 seconds. Maximum allowable touch and step voltages are 1,067 V and 1,598 V respectively, based on a 50 kg body weight and 15 mS/cm surface layer resistivity.

## 2. Grid Configuration

The ground grid consists of 4/0 AWG bare copper conductors buried at 18 inches below grade in a 20 ft × 20 ft mesh pattern covering the entire 4.2-acre yard. Perimeter conductors are buried at 24 inches depth. A total of 48 vertical ground rods (5/8-inch × 10-foot copper-clad) are installed at grid intersections and at 50-foot intervals along the fence line.

Measured soil resistivity from test holes GH-01 through GH-12 ranges from 85 to 142 ohm-meters (average 108 ohm-m). A 4-inch layer of crushed granite (ρ = 3,000 ohm-m) is specified within the fenced area to reduce surface step potentials.

## 3. Equipment Bonding

All steel structures, transformer tanks, GIS enclosures, and fence posts shall be bonded to the grid with 2/0 AWG copper conductors. Control building grounding uses two separate ground bars (GB-1 and GB-2) connected to the yard grid via two independent 4/0 AWG risers spaced 40 feet apart.

Target grid resistance is ≤ 0.5 ohms. Fall-of-potential testing per IEEE 81 shall be performed before energization, with results submitted to Helix Power Cooperative within 5 business days.

## 4. Acceptance Criteria

Touch and step voltage calculations using WinIGS software (model v3.2) shall demonstrate compliance at 100% of grid nodes. Any node exceeding limits requires supplemental ground rods or grid conductor additions before approval.

**Approved by:** L. Okonkwo, PE - Protection & Grounding Engineer, Meridian Grid Services
