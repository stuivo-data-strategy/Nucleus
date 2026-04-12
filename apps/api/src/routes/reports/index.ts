import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../../db/connection';

// ─── Types ────────────────────────────────────────────────────────────────────

type Intent =
  | 'claims_list'
  | 'largest_claims'
  | 'spend_by_category'
  | 'claims_by_status'
  | 'spend_over_time'
  | 'average_claim'
  | 'policy_changes'
  | 'top_spenders'
  | 'policy_violations'
  | 'duplicates'
  | 'unknown';

interface QueryParams {
  category?: string;
  status?: string | string[];
  dateFrom?: string;
  dateTo?: string;
  personName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtId(id: any): string {
  return id?.toString?.() ?? String(id ?? '');
}

function buildDateClauses(dateFrom?: string, dateTo?: string): string[] {
  const parts: string[] = [];
  if (dateFrom) parts.push(`date >= '${dateFrom}'`);
  if (dateTo)   parts.push(`date <= '${dateTo}'`);
  return parts;
}

function buildClaimConditions(params: QueryParams): string[] {
  const { category, status, dateFrom, dateTo, personName } = params;
  const conds: string[] = [];

  if (category) conds.push(`category = '${category}'`);

  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    conds.push(`status IN [${statuses.map(s => `'${s}'`).join(', ')}]`);
  }

  conds.push(...buildDateClauses(dateFrom, dateTo));

  if (personName) {
    const n = personName.toLowerCase();
    conds.push(`(string::lowercase(claimant.first_name) CONTAINS '${n}' OR string::lowercase(claimant.last_name) CONTAINS '${n}')`);
  }

  return conds;
}

// ─── Route ────────────────────────────────────────────────────────────────────

const reportsRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {

  fastify.post('/query', async (request: any, reply) => {
    const db = getDb();
    const { intent, params = {} }: { intent: Intent; params: QueryParams } = request.body as any;

    try {

      // ── claims_list ──────────────────────────────────────────────────────
      if (intent === 'claims_list' || intent === 'policy_violations') {
        const conds = buildClaimConditions(params);
        if (intent === 'policy_violations') conds.push(`policy_result.passed = false`);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

        const res = await db.query(
          `SELECT *, claimant.first_name AS cf, claimant.last_name AS cl, claimant.job_title AS ct
           FROM expense_claim ${where} ORDER BY date DESC LIMIT 100`
        );
        const rows = (res[0] as any[]) ?? [];

        const data = rows.map((r: any) => ({
          id:            fmtId(r.id),
          reference:     r.reference ?? fmtId(r.id),
          date:          r.date,
          description:   r.description ?? '',
          category:      r.category,
          amount:        r.amount,
          currency:      r.currency ?? 'GBP',
          status:        r.status,
          claimant:      `${r.cf ?? ''} ${r.cl ?? ''}`.trim() || fmtId(r.claimant),
          claimant_title: r.ct ?? '',
          policy_passed: r.policy_result?.passed ?? true,
          violations:    intent === 'policy_violations'
            ? (r.policy_result?.checks ?? []).filter((c: any) => !c.passed).map((c: any) => c.message)
            : undefined,
        }));

        return {
          responseType: 'table',
          data,
          meta: {
            total: data.length,
            totalAmount: parseFloat(data.reduce((s: number, r: any) => s + (r.amount ?? 0), 0).toFixed(2)),
          },
        };
      }

      // ── largest_claims ───────────────────────────────────────────────────
      if (intent === 'largest_claims') {
        const conds = buildClaimConditions(params);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

        const res = await db.query(
          `SELECT *, claimant.first_name AS cf, claimant.last_name AS cl
           FROM expense_claim ${where} ORDER BY amount DESC LIMIT 10`
        );
        const rows = (res[0] as any[]) ?? [];

        const data = rows.map((r: any) => ({
          id:           fmtId(r.id),
          reference:    r.reference ?? fmtId(r.id),
          date:         r.date,
          description:  r.description ?? '',
          category:     r.category,
          amount:       r.amount,
          currency:     r.currency ?? 'GBP',
          status:       r.status,
          claimant:     `${r.cf ?? ''} ${r.cl ?? ''}`.trim() || fmtId(r.claimant),
          policy_passed: r.policy_result?.passed ?? true,
        }));

        return {
          responseType: 'table',
          data,
          meta: {
            total: data.length,
            totalAmount: parseFloat(data.reduce((s: number, r: any) => s + (r.amount ?? 0), 0).toFixed(2)),
          },
        };
      }

      // ── spend_by_category ────────────────────────────────────────────────
      if (intent === 'spend_by_category') {
        const conds = buildClaimConditions(params);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

        const res = await db.query(
          `SELECT category, math::sum(amount) AS total, count() AS claims
           FROM expense_claim ${where} GROUP BY category ORDER BY total DESC`
        );
        const rows = (res[0] as any[]) ?? [];
        const grandTotal = rows.reduce((s: number, r: any) => s + (Number(r.total) || 0), 0);

        return {
          responseType: 'bar_chart',
          data: rows.map((r: any) => ({
            category: r.category,
            total:    parseFloat((Number(r.total) || 0).toFixed(2)),
            claims:   r.claims ?? 0,
          })),
          meta: { grandTotal: parseFloat(grandTotal.toFixed(2)) },
        };
      }

      // ── top_spenders ─────────────────────────────────────────────────────
      if (intent === 'top_spenders') {
        const conds = buildClaimConditions(params);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

        const res = await db.query(
          `SELECT claimant, claimant.first_name AS first_name, claimant.last_name AS last_name,
                  claimant.job_title AS job_title,
                  math::sum(amount) AS total, count() AS claims
           FROM expense_claim ${where} GROUP BY claimant ORDER BY total DESC LIMIT 20`
        );
        const rows = (res[0] as any[]) ?? [];

        return {
          responseType: 'bar_chart',
          data: rows.map((r: any, i: number) => ({
            rank:      i + 1,
            name:      `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || fmtId(r.claimant),
            job_title: r.job_title ?? '',
            total:     parseFloat((Number(r.total) || 0).toFixed(2)),
            claims:    r.claims ?? 0,
          })),
          meta: {},
        };
      }

      // ── claims_by_status ─────────────────────────────────────────────────
      if (intent === 'claims_by_status') {
        const conds = buildClaimConditions(params);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

        const res = await db.query(
          `SELECT status, count() AS count FROM expense_claim ${where} GROUP BY status ORDER BY count DESC`
        );
        const rows = (res[0] as any[]) ?? [];
        const totalCount = rows.reduce((s: number, r: any) => s + (r.count ?? 0), 0);

        return {
          responseType: 'donut_chart',
          data: rows.map((r: any) => ({
            status: r.status,
            count:  r.count ?? 0,
          })),
          meta: { total: totalCount },
        };
      }

      // ── spend_over_time ──────────────────────────────────────────────────
      if (intent === 'spend_over_time') {
        const conds = buildClaimConditions(params);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

        // Fetch all matching claims and group by month in JS
        // (SurrealDB date functions vary by version — safer to do in JS)
        const res = await db.query(
          `SELECT date, amount FROM expense_claim ${where} ORDER BY date ASC`
        );
        const rows = (res[0] as any[]) ?? [];

        // Group by YYYY-MM
        const byMonth: Record<string, { total: number; claims: number }> = {};
        for (const r of rows) {
          const month = (r.date ?? '').substring(0, 7); // 'YYYY-MM'
          if (!month || month.length < 7) continue;
          if (!byMonth[month]) byMonth[month] = { total: 0, claims: 0 };
          byMonth[month].total  += Number(r.amount) || 0;
          byMonth[month].claims += 1;
        }

        const data = Object.entries(byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, v]) => ({
            month,
            label: new Date(month + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
            total:  parseFloat(v.total.toFixed(2)),
            claims: v.claims,
          }));

        return {
          responseType: 'line_chart',
          data,
          meta: {
            totalAmount: parseFloat(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0).toFixed(2)),
            totalClaims: rows.length,
          },
        };
      }

      // ── average_claim ────────────────────────────────────────────────────
      if (intent === 'average_claim') {
        const conds = buildClaimConditions(params);
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

        const res = await db.query(
          `SELECT math::mean(amount) AS avg, math::sum(amount) AS total, count() AS claims
           FROM expense_claim ${where} GROUP ALL`
        );
        const row = ((res[0] as any[]) ?? [])[0] ?? {};

        return {
          responseType: 'summary_card',
          data: [],
          meta: {
            value:        parseFloat((Number(row.avg) || 0).toFixed(2)),
            total:        parseFloat((Number(row.total) || 0).toFixed(2)),
            claims:       row.claims ?? 0,
            valueLabel:   'Average claim value',
          },
        };
      }

      // ── policy_changes ───────────────────────────────────────────────────
      if (intent === 'policy_changes') {
        const res = await db.query(
          `SELECT * FROM policy_audit WHERE evaluation_point = 'admin_change' ORDER BY created_at DESC LIMIT 50`
        );
        const rows = (res[0] as any[]) ?? [];

        return {
          responseType: 'timeline',
          data: rows.map((r: any) => ({
            id:           fmtId(r.id),
            created_at:   r.created_at,
            evaluated_by: r.evaluated_by ?? 'system',
            previous:     r.result?.previous ?? {},
            updated:      r.result?.updated ?? {},
            changes:      r.result?.changes ?? {},
          })),
          meta: { total: rows.length },
        };
      }

      // ── duplicates ───────────────────────────────────────────────────────
      if (intent === 'duplicates') {
        const res = await db.query(
          `SELECT * FROM policy_audit
           WHERE evaluation_point = 'submission'
           AND result.checks[WHERE rule_name = 'Duplicate Detection' AND passed = false] != []
           ORDER BY created_at DESC LIMIT 50`
        );
        const rows = (res[0] as any[]) ?? [];

        return {
          responseType: 'timeline',
          data: rows.map((r: any) => ({
            id:           fmtId(r.id),
            claim_id:     r.claim_id,
            created_at:   r.created_at,
            evaluated_by: r.evaluated_by ?? '',
            message:      (r.result?.checks ?? []).find((c: any) => c.rule_name === 'Duplicate Detection')?.message ?? 'Potential duplicate detected',
          })),
          meta: { total: rows.length },
        };
      }

      // ── unknown ──────────────────────────────────────────────────────────
      return { responseType: 'unknown', data: [], meta: {} };

    } catch (err: any) {
      fastify.log.error({ err, intent, params }, 'reports/query failed');
      return reply.status(500).send({ error: err.message ?? 'Query failed' });
    }
  });
};

export default reportsRoutes;
