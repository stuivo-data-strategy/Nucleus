# Nucleus Database Setup

Self-contained SurrealDB setup package for the Nucleus PBAC expenses application.

## Prerequisites

- **SurrealDB** v2.x installed ([install guide](https://surrealdb.com/install))
- **Node.js** 18+ with `npx` available
- **surrealdb** npm package (installed via the API workspace)

## Starting SurrealDB

```bash
surreal start surrealkv://C:/nucleus_data --user root --pass root --bind 0.0.0.0:8000
```

> Update the path for your environment. On Linux/Mac: `surrealkv:///var/lib/nucleus_data`

This starts SurrealDB with persistent storage at the given path. The data survives restarts.

## Running Setup

From the project root:

```bash
# First-time setup — creates schema, seeds data, loads policies
npx tsx database/setup.ts

# Full reset — drops database and re-creates everything from scratch
# Safe to run before a demo to restore clean state
npx tsx database/reset.ts
```

### Environment Variables

All optional — defaults connect to a local SurrealDB instance:

| Variable | Default | Description |
|---|---|---|
| `SURREAL_URL` | `ws://localhost:8000/rpc` | SurrealDB WebSocket endpoint |
| `SURREAL_NS` | `nucleus` | Namespace |
| `SURREAL_DB` | `nucleus` | Database name |
| `SURREAL_USER` | `root` | Auth username |
| `SURREAL_PASS` | `root` | Auth password |

## File Structure

| File | Purpose |
|---|---|
| `01-schema.surql` | All `DEFINE TABLE` and `DEFINE FIELD` statements in dependency order |
| `02-seed.surql` | Org units, cost centres, people, graph edges, roles, vehicles |
| `03-policy.surql` | Policy rules, workflow templates, business rules |
| `04-sample-data.surql` | Sample expense claims, workflow instances for demo |
| `setup.ts` | Runs all four `.surql` files in order |
| `reset.ts` | Drops database and re-runs setup |

## Tables

### Core
- `org_unit` — Company → Business Unit → Division → Department → Team
- `cost_centre` — Financial cost centres with ownership
- `job_classification` — Grade/pay band definitions
- `position` — Organisational positions (filled, vacant, frozen)
- `person` — Employee records

### Graph Edges (Relations)
- `reports_to` — Person → Person (direct, matrix, dotted line)
- `holds_position` — Person → Position
- `owns_budget` — Person → Cost Centre
- `owns_vehicle` — Person → Vehicle
- `has_role` — Person → Role

### Expenses
- `expense_claim` — All claim types (single, batch, group, mileage)
- `vehicle` — Registered vehicles for mileage claims
- `saved_journey` — Frequently-used routes
- `mileage_summary` — Cumulative mileage per tax year

### Workflow Engine
- `workflow_template` — Configurable approval chains
- `workflow_instance` — Active approval flows
- `workflow_action` — Immutable audit trail of approvals

### Policy & Audit
- `policy_rule` — PBAC enforcement rules per category
- `policy_audit` — Policy check evaluation log
- `audit_action` — Auditor action log
- `business_rule` — Configurable business rules engine

### System
- `role` — RBAC role definitions with permissions
- `notification` — In-app notification queue
- `employment_event` — Employment lifecycle event log
- `schema_migration` — Migration tracking (used by API auto-migrate)

## Notes

- The `02-seed.surql` file only contains the ~11 named personas. The full seed (`apps/api/src/db/seed.ts`) generates ~80 people with random names — run `pnpm db:seed` from the API workspace for the complete dataset.
- All `.surql` files use `IF NOT EXISTS` / `UPSERT` so they are safe to re-run.
- Edge tables (`reports_to`, `holds_position`, etc.) are `DELETE`d before re-seeding to prevent duplicates.
