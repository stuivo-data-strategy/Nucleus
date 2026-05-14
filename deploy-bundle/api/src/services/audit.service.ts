import { Surreal, StringRecordId } from 'surrealdb';

export interface AuditQueueItem {
  id: string;
  reference: string;
  claimant_id: string;
  claimant_name: string;
  claimant_initials: string;
  claimant_job_title: string;
  category: string;
  description: string;
  date: string;
  amount: number;
  receipt_amount?: number;
  claim_amount?: number;
  partial_claim?: boolean;
  partial_reason?: string;
  exception_requested?: boolean;
  exception_justification?: string;
  has_receipt: boolean;
  status: string;
  audit_status: string;
  audit_flag?: { reason: string; notes: string; flagged_by: string; flagged_at: string };
  policy_result: any;
  workflow: any;
  created_at: string;
}

export interface AuditStats {
  ready_for_audit: number;
  flagged: number;
  cleared_today: number;
  avg_processing_hours: number | null;
}

export class AuditService {
  constructor(private db: Surreal) {}

  private personName(p: any) {
    return `${p?.first_name || ''} ${p?.last_name || ''}`.trim();
  }
  private initials(p: any) {
    return `${(p?.first_name || '')[0] || ''}${(p?.last_name || '')[0] || ''}`.toUpperCase();
  }

  private async enrichClaim(raw: any): Promise<AuditQueueItem> {
    const claimantId = raw.claimant?.toString ? raw.claimant.toString() : raw.claimant;
    let person: any = null;
    try {
      const pr = await this.db.query(`SELECT * FROM type::record($id)`, { id: claimantId });
      const pa = pr[0] as any[];
      person = pa && pa.length > 0 ? pa[0] : null;
    } catch { /* skip */ }

    let workflow: any = null;
    if (raw.workflow_instance) {
      try {
        const wiId = raw.workflow_instance?.toString ? raw.workflow_instance.toString() : raw.workflow_instance;
        const wr = await this.db.query(`SELECT * FROM type::record($id)`, { id: wiId });
        const wa = wr[0] as any[];
        workflow = wa && wa.length > 0 ? wa[0] : null;
      } catch { /* skip */ }
    }

    return {
      id: raw.id?.toString ? raw.id.toString() : raw.id,
      reference: raw.reference ?? '',
      claimant_id: claimantId,
      claimant_name: person ? this.personName(person) : claimantId,
      claimant_initials: person ? this.initials(person) : '??',
      claimant_job_title: person?.job_title ?? '',
      category: raw.category ?? '',
      description: raw.description ?? '',
      date: raw.date ?? '',
      amount: raw.amount ?? 0,
      receipt_amount: raw.receipt_amount,
      claim_amount: raw.claim_amount,
      partial_claim: raw.partial_claim,
      partial_reason: raw.partial_reason,
      exception_requested: raw.exception_requested,
      exception_justification: raw.exception_justification,
      has_receipt: raw.has_receipt ?? false,
      status: raw.status ?? '',
      audit_status: raw.audit_status ?? 'pending_audit',
      audit_flag: raw.audit_flag,
      policy_result: raw.policy_result ?? null,
      workflow,
      created_at: raw.created_at ?? '',
    };
  }

  // ─── GET /audit/queue ────────────────────────────────────────────────────────

  async getQueue(): Promise<AuditQueueItem[]> {
    const res = await this.db.query(`
      SELECT * FROM expense_claim
      WHERE status IN ['approved', 'cleared_for_payment', 'posted', 'exception_requested']
        AND (audit_status = 'pending_audit' OR audit_status IS NONE OR audit_status = NONE)
      ORDER BY created_at ASC
    `);
    const raws = res[0] as any[];
    if (!raws || raws.length === 0) return [];
    return Promise.all(raws.map(r => this.enrichClaim(r)));
  }

  // ─── GET /audit/flagged ──────────────────────────────────────────────────────

  async getFlagged(): Promise<AuditQueueItem[]> {
    const res = await this.db.query(`
      SELECT * FROM expense_claim WHERE audit_status = 'flagged' ORDER BY created_at ASC
    `);
    const raws = res[0] as any[];
    if (!raws || raws.length === 0) return [];
    return Promise.all(raws.map(r => this.enrichClaim(r)));
  }

  // ─── POST /audit/:id/clear ────────────────────────────────────────────────────

  async clearClaim(claimId: string, auditorId: string): Promise<void> {
    await this.db.query(
      `UPDATE type::record($id) MERGE {
        audit_status: 'cleared',
        status: 'cleared_for_payment',
        audited_by: type::record($auditor),
        audited_at: time::now()
      }`,
      { id: claimId, auditor: auditorId }
    );
    await this.db.query(`CREATE audit_action CONTENT $data`, {
      data: {
        claim: new StringRecordId(claimId),
        auditor: new StringRecordId(auditorId),
        action: 'cleared',
      }
    });
  }

  // ─── POST /audit/batch-clear ──────────────────────────────────────────────────

  async batchClear(claimIds: string[], auditorId: string): Promise<number> {
    let count = 0;
    for (const id of claimIds) {
      try { await this.clearClaim(id, auditorId); count++; } catch { /* skip */ }
    }
    return count;
  }

  // ─── POST /audit/:id/flag ─────────────────────────────────────────────────────

  async flagClaim(claimId: string, auditorId: string, reason: string, notes: string): Promise<void> {
    await this.db.query(
      `UPDATE type::record($id) MERGE {
        audit_status: 'flagged',
        audit_flag: {
          reason: $reason,
          notes: $notes,
          flagged_by: $auditor,
          flagged_at: time::now()
        }
      }`,
      { id: claimId, auditor: auditorId, reason, notes }
    );
    await this.db.query(`CREATE audit_action CONTENT $data`, {
      data: {
        claim: new StringRecordId(claimId),
        auditor: new StringRecordId(auditorId),
        action: 'flagged',
        reason,
        notes: notes || null,
      }
    });
  }

  // ─── POST /audit/:id/resolve ──────────────────────────────────────────────────

  async resolveClaim(claimId: string, auditorId: string): Promise<void> {
    await this.db.query(
      `UPDATE type::record($id) MERGE { audit_status: 'pending_audit', audit_flag: NONE }`,
      { id: claimId }
    );
    await this.db.query(`CREATE audit_action CONTENT $data`, {
      data: {
        claim: new StringRecordId(claimId),
        auditor: new StringRecordId(auditorId),
        action: 'resolved',
      }
    });
  }

  // ─── GET /audit/stats ─────────────────────────────────────────────────────────

  async getStats(): Promise<AuditStats> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [queueRes, flaggedRes, clearedTodayRes, avgRes] = await Promise.all([
      this.db.query(`SELECT count() AS n FROM expense_claim WHERE status IN ['approved','posted','exception_requested'] AND (audit_status = 'pending_audit' OR audit_status IS NONE) GROUP ALL`),
      this.db.query(`SELECT count() AS n FROM expense_claim WHERE audit_status = 'flagged' GROUP ALL`),
      this.db.query(`SELECT count() AS n FROM audit_action WHERE action = 'cleared' AND created_at >= $ts GROUP ALL`, { ts: todayStart.toISOString() }),
      this.db.query(`SELECT count() AS n, math::mean(duration::secs(audited_at - created_at)) AS avg_secs FROM expense_claim WHERE audit_status = 'cleared' AND audited_at != NONE GROUP ALL`),
    ]);

    const queue       = ((queueRes[0] as any[])?.[0]?.n ?? 0);
    const flagged     = ((flaggedRes[0] as any[])?.[0]?.n ?? 0);
    const clearedToday = ((clearedTodayRes[0] as any[])?.[0]?.n ?? 0);
    const avgSecsRaw  = (avgRes[0] as any[])?.[0]?.avg_secs;
    const avgHours    = avgSecsRaw != null ? Math.round((avgSecsRaw / 3600) * 10) / 10 : null;

    return { ready_for_audit: queue, flagged, cleared_today: clearedToday, avg_processing_hours: avgHours };
  }
}
