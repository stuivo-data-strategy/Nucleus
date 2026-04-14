import { Surreal, StringRecordId } from 'surrealdb';

export type VatClassification = 'fully_reclaimable' | 'partially_reclaimable' | 'not_reclaimable' | 'zero_rated';
export type VatStatus = 'pending_classification' | 'classified' | 'excluded';

export interface VatQueueItem {
  id: string;
  reference: string;
  claimant_name: string;
  claimant_initials: string;
  category: string;
  description: string;
  date: string;
  amount: number;
  receipt_amount?: number;
  claim_amount?: number;
  partial_claim?: boolean;
  partial_reason?: string;
  has_receipt: boolean;
  status: string;
  audit_status: string;
  vat_status: VatStatus;
  vat_classification?: VatClassification;
  vat_reclaimable_amount?: number;
  vat_business_portion?: number;
  supplier_vat_number?: string;
  auto_classification?: VatClassification;
  auto_reason?: string;
  vat_period?: string;
  created_at: string;
}

export interface VatSummaryRow {
  category: string;
  claim_count: number;
  total_amount: number;
  vat_amount: number;
  reclaimable_vat: number;
  classification_breakdown: Record<string, number>;
}

export interface VatStats {
  pending_classification: number;
  classified: number;
  total_reclaimable: number;
  recovery_rate: number;
}

// Auto-classification rules
function autoClassify(category: string, description: string, partialReason?: string): { classification: VatClassification; reason: string } {
  const desc = (description || '').toLowerCase();
  const cat  = (category  || '').toLowerCase();

  if (cat === 'meals') {
    if (partialReason === 'personal_guest') return { classification: 'partially_reclaimable', reason: 'Mixed personal/business meal' };
    if (desc.includes('client') || desc.includes('entertainment')) return { classification: 'not_reclaimable', reason: 'Client entertainment' };
    return { classification: 'fully_reclaimable', reason: 'Business subsistence' };
  }
  if (cat === 'accommodation') return { classification: 'fully_reclaimable', reason: 'Business accommodation' };
  if (cat === 'travel')        return { classification: 'zero_rated',         reason: 'Public transport — zero-rated' };
  if (cat === 'transport')     return { classification: 'fully_reclaimable', reason: 'Taxi/transport — standard rated' };
  if (cat === 'training')      return { classification: 'fully_reclaimable', reason: 'Training — standard rated' };
  if (cat === 'office_supplies' || cat === 'supplies') return { classification: 'fully_reclaimable', reason: 'Office supplies' };
  if (cat === 'mileage')       return { classification: 'partially_reclaimable', reason: 'Fuel portion only' };

  return { classification: 'fully_reclaimable', reason: 'Standard rated expense' };
}

// Standard UK VAT: 20% so reclaimable = amount / 6
function vatAmount(amount: number, classification: VatClassification, businessPortion?: number): number {
  if (classification === 'zero_rated' || classification === 'not_reclaimable') return 0;
  const gross = amount;
  const vat = gross / 6; // 20% inclusive
  if (classification === 'partially_reclaimable' && businessPortion != null) {
    return Math.round(vat * businessPortion) / 100;
  }
  return Math.round(vat * 100) / 100;
}

export class VatService {
  constructor(private db: Surreal) {}

  private personName(p: any) {
    return `${p?.first_name || ''} ${p?.last_name || ''}`.trim();
  }
  private initials(p: any) {
    return `${(p?.first_name || '')[0] || ''}${(p?.last_name || '')[0] || ''}`.toUpperCase();
  }

  private async enrichClaim(raw: any): Promise<VatQueueItem> {
    const claimantId = raw.claimant?.toString ? raw.claimant.toString() : raw.claimant;
    let person: any = null;
    try {
      const pr = await this.db.query(`SELECT * FROM type::record($id)`, { id: claimantId });
      const pa = pr[0] as any[];
      person = pa && pa.length > 0 ? pa[0] : null;
    } catch { /* skip */ }

    const auto = autoClassify(raw.category, raw.description, raw.partial_reason);

    return {
      id: raw.id?.toString ? raw.id.toString() : raw.id,
      reference: raw.reference ?? '',
      claimant_name: person ? this.personName(person) : claimantId,
      claimant_initials: person ? this.initials(person) : '??',
      category: raw.category ?? '',
      description: raw.description ?? '',
      date: raw.date ?? '',
      amount: raw.amount ?? 0,
      receipt_amount: raw.receipt_amount,
      claim_amount: raw.claim_amount,
      partial_claim: raw.partial_claim,
      partial_reason: raw.partial_reason,
      has_receipt: raw.has_receipt ?? false,
      status: raw.status ?? '',
      audit_status: raw.audit_status ?? '',
      vat_status: raw.vat_status ?? 'pending_classification',
      vat_classification: raw.vat_classification,
      vat_reclaimable_amount: raw.vat_reclaimable_amount,
      vat_business_portion: raw.vat_business_portion,
      supplier_vat_number: raw.supplier_vat_number,
      vat_period: raw.vat_period,
      auto_classification: auto.classification,
      auto_reason: auto.reason,
      created_at: raw.created_at ?? '',
    };
  }

  // ─── GET /vat/queue ──────────────────────────────────────────────────────────

  async getQueue(period: string): Promise<VatQueueItem[]> {
    const res = await this.db.query(`
      SELECT * FROM expense_claim
      WHERE audit_status = 'cleared'
        AND (vat_status = 'pending_classification' OR vat_status IS NONE OR vat_status = NONE)
      ORDER BY created_at ASC
    `);
    const raws = res[0] as any[];
    if (!raws || raws.length === 0) return [];
    return Promise.all(raws.map(r => this.enrichClaim(r)));
  }

  // ─── GET /vat/summary ────────────────────────────────────────────────────────

  async getSummary(period: string): Promise<VatSummaryRow[]> {
    const res = await this.db.query(`
      SELECT category, count() AS claim_count,
             math::sum(amount) AS total_amount,
             math::sum(vat_reclaimable_amount) AS reclaimable_vat,
             vat_classification
      FROM expense_claim
      WHERE vat_period = $period AND vat_status = 'classified'
      GROUP BY category, vat_classification
    `, { period });

    const rows = res[0] as any[];
    if (!rows || rows.length === 0) return [];

    // Aggregate by category
    const byCategory: Record<string, VatSummaryRow> = {};
    for (const row of rows) {
      const cat = row.category ?? 'other';
      if (!byCategory[cat]) {
        byCategory[cat] = {
          category: cat,
          claim_count: 0,
          total_amount: 0,
          vat_amount: 0,
          reclaimable_vat: 0,
          classification_breakdown: {},
        };
      }
      const entry = byCategory[cat];
      entry.claim_count += row.claim_count ?? 0;
      const total = row.total_amount ?? 0;
      entry.total_amount += total;
      entry.vat_amount   += Math.round((total / 6) * 100) / 100;
      entry.reclaimable_vat += row.reclaimable_vat ?? 0;
      entry.classification_breakdown[row.vat_classification ?? 'unclassified'] =
        (entry.classification_breakdown[row.vat_classification ?? 'unclassified'] ?? 0) + (row.claim_count ?? 0);
    }

    return Object.values(byCategory).sort((a, b) => b.reclaimable_vat - a.reclaimable_vat);
  }

  // ─── GET /vat/stats ──────────────────────────────────────────────────────────

  async getStats(period: string): Promise<VatStats> {
    const [pendingRes, classifiedRes, reclaimableRes, totalRes] = await Promise.all([
      this.db.query(`SELECT count() AS n FROM expense_claim WHERE audit_status = 'cleared' AND (vat_status = 'pending_classification' OR vat_status IS NONE) GROUP ALL`),
      this.db.query(`SELECT count() AS n FROM expense_claim WHERE vat_period = $period AND vat_status = 'classified' GROUP ALL`, { period }),
      this.db.query(`SELECT math::sum(vat_reclaimable_amount) AS total FROM expense_claim WHERE vat_period = $period AND vat_status = 'classified' GROUP ALL`, { period }),
      this.db.query(`SELECT math::sum(amount / 6) AS total FROM expense_claim WHERE vat_period = $period AND vat_status = 'classified' GROUP ALL`, { period }),
    ]);

    const pending    = ((pendingRes[0] as any[])?.[0]?.n ?? 0);
    const classified = ((classifiedRes[0] as any[])?.[0]?.n ?? 0);
    const reclaimable = ((reclaimableRes[0] as any[])?.[0]?.total ?? 0);
    const totalVat    = ((totalRes[0] as any[])?.[0]?.total ?? 0);
    const recoveryRate = totalVat > 0 ? Math.round((reclaimable / totalVat) * 100) : 0;

    return { pending_classification: pending, classified, total_reclaimable: Math.round(reclaimable * 100) / 100, recovery_rate: recoveryRate };
  }

  // ─── POST /vat/:id/classify ──────────────────────────────────────────────────

  async classifyClaim(
    claimId: string,
    officerId: string,
    classification: VatClassification,
    businessPortion: number | undefined,
    supplierVatNumber: string | undefined,
    period: string,
  ): Promise<void> {
    // Fetch current claim amount
    const claimRes = await this.db.query(`SELECT amount, claim_amount FROM type::record($id)`, { id: claimId });
    const claim = (claimRes[0] as any[])?.[0];
    const effectiveAmount = claim?.claim_amount ?? claim?.amount ?? 0;

    const reclaimable = vatAmount(effectiveAmount, classification, businessPortion);

    await this.db.query(
      `UPDATE type::record($id) MERGE {
        vat_status: 'classified',
        vat_classification: $classification,
        vat_reclaimable_amount: $reclaimable,
        vat_business_portion: $businessPortion,
        supplier_vat_number: $supplierVatNumber,
        vat_classified_by: type::record($officer),
        vat_classified_at: time::now(),
        vat_period: $period
      }`,
      { id: claimId, classification, reclaimable, businessPortion: businessPortion ?? null, supplierVatNumber: supplierVatNumber ?? null, officer: officerId, period }
    );
  }

  // ─── POST /vat/export ────────────────────────────────────────────────────────

  async exportVAT(period: string): Promise<string> {
    const res = await this.db.query(`
      SELECT reference, date, category, description, amount, vat_classification, vat_reclaimable_amount, supplier_vat_number
      FROM expense_claim
      WHERE vat_period = $period AND vat_status = 'classified'
      ORDER BY category ASC, date ASC
    `, { period });

    const rows = res[0] as any[];
    if (!rows || rows.length === 0) return 'Reference,Date,Category,Description,Gross Amount,VAT Classification,Reclaimable VAT,Supplier VAT No.\n';

    const header = 'Reference,Date,Category,Description,Gross Amount,VAT Classification,Reclaimable VAT,Supplier VAT No.';
    const lines = rows.map(r => [
      r.reference ?? '',
      r.date ?? '',
      r.category ?? '',
      `"${(r.description ?? '').replace(/"/g, '""')}"`,
      (r.amount ?? 0).toFixed(2),
      r.vat_classification ?? '',
      (r.vat_reclaimable_amount ?? 0).toFixed(2),
      r.supplier_vat_number ?? '',
    ].join(','));

    return [header, ...lines].join('\n');
  }
}
