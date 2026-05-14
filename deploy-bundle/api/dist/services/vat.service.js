"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VatService = void 0;
// Auto-classification rules
function autoClassify(category, description, partialReason) {
    const desc = (description || '').toLowerCase();
    const cat = (category || '').toLowerCase();
    if (cat === 'meals') {
        if (partialReason === 'personal_guest')
            return { classification: 'partially_reclaimable', reason: 'Mixed personal/business meal' };
        if (desc.includes('client') || desc.includes('entertainment'))
            return { classification: 'not_reclaimable', reason: 'Client entertainment' };
        return { classification: 'fully_reclaimable', reason: 'Business subsistence' };
    }
    if (cat === 'accommodation')
        return { classification: 'fully_reclaimable', reason: 'Business accommodation' };
    if (cat === 'travel')
        return { classification: 'zero_rated', reason: 'Public transport — zero-rated' };
    if (cat === 'transport')
        return { classification: 'fully_reclaimable', reason: 'Taxi/transport — standard rated' };
    if (cat === 'training')
        return { classification: 'fully_reclaimable', reason: 'Training — standard rated' };
    if (cat === 'office_supplies' || cat === 'supplies')
        return { classification: 'fully_reclaimable', reason: 'Office supplies' };
    if (cat === 'mileage')
        return { classification: 'partially_reclaimable', reason: 'Fuel portion only' };
    return { classification: 'fully_reclaimable', reason: 'Standard rated expense' };
}
// Standard UK VAT: 20% so reclaimable = amount / 6
function vatAmount(amount, classification, businessPortion) {
    if (classification === 'zero_rated' || classification === 'not_reclaimable')
        return 0;
    const gross = amount;
    const vat = gross / 6; // 20% inclusive
    if (classification === 'partially_reclaimable' && businessPortion != null) {
        return Math.round(vat * businessPortion) / 100;
    }
    return Math.round(vat * 100) / 100;
}
class VatService {
    db;
    constructor(db) {
        this.db = db;
    }
    personName(p) {
        return `${p?.first_name || ''} ${p?.last_name || ''}`.trim();
    }
    initials(p) {
        return `${(p?.first_name || '')[0] || ''}${(p?.last_name || '')[0] || ''}`.toUpperCase();
    }
    async enrichClaim(raw) {
        const claimantId = raw.claimant?.toString ? raw.claimant.toString() : raw.claimant;
        let person = null;
        try {
            const pr = await this.db.query(`SELECT * FROM type::record($id)`, { id: claimantId });
            const pa = pr[0];
            person = pa && pa.length > 0 ? pa[0] : null;
        }
        catch { /* skip */ }
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
    async getQueue(period) {
        const res = await this.db.query(`
      SELECT * FROM expense_claim
      WHERE audit_status = 'cleared'
        AND (vat_status = 'pending_classification' OR vat_status IS NONE OR vat_status = NONE)
      ORDER BY created_at ASC
    `);
        const raws = res[0];
        if (!raws || raws.length === 0)
            return [];
        return Promise.all(raws.map(r => this.enrichClaim(r)));
    }
    // ─── GET /vat/summary ────────────────────────────────────────────────────────
    async getSummary(period) {
        const res = await this.db.query(`
      SELECT category, count() AS claim_count,
             math::sum(amount) AS total_amount,
             math::sum(vat_reclaimable_amount) AS reclaimable_vat,
             vat_classification
      FROM expense_claim
      WHERE vat_period = $period AND vat_status = 'classified'
      GROUP BY category, vat_classification
    `, { period });
        const rows = res[0];
        if (!rows || rows.length === 0)
            return [];
        // Aggregate by category
        const byCategory = {};
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
            entry.vat_amount += Math.round((total / 6) * 100) / 100;
            entry.reclaimable_vat += row.reclaimable_vat ?? 0;
            entry.classification_breakdown[row.vat_classification ?? 'unclassified'] =
                (entry.classification_breakdown[row.vat_classification ?? 'unclassified'] ?? 0) + (row.claim_count ?? 0);
        }
        return Object.values(byCategory).sort((a, b) => b.reclaimable_vat - a.reclaimable_vat);
    }
    // ─── GET /vat/stats ──────────────────────────────────────────────────────────
    async getStats(period) {
        const [pendingRes, classifiedRes, reclaimableRes, totalRes] = await Promise.all([
            this.db.query(`SELECT count() AS n FROM expense_claim WHERE audit_status = 'cleared' AND (vat_status = 'pending_classification' OR vat_status IS NONE) GROUP ALL`),
            this.db.query(`SELECT count() AS n FROM expense_claim WHERE vat_period = $period AND vat_status = 'classified' GROUP ALL`, { period }),
            this.db.query(`SELECT math::sum(vat_reclaimable_amount) AS total FROM expense_claim WHERE vat_period = $period AND vat_status = 'classified' GROUP ALL`, { period }),
            this.db.query(`SELECT math::sum(amount / 6) AS total FROM expense_claim WHERE vat_period = $period AND vat_status = 'classified' GROUP ALL`, { period }),
        ]);
        const pending = (pendingRes[0]?.[0]?.n ?? 0);
        const classified = (classifiedRes[0]?.[0]?.n ?? 0);
        const reclaimable = (reclaimableRes[0]?.[0]?.total ?? 0);
        const totalVat = (totalRes[0]?.[0]?.total ?? 0);
        const recoveryRate = totalVat > 0 ? Math.round((reclaimable / totalVat) * 100) : 0;
        return { pending_classification: pending, classified, total_reclaimable: Math.round(reclaimable * 100) / 100, recovery_rate: recoveryRate };
    }
    // ─── POST /vat/:id/classify ──────────────────────────────────────────────────
    async classifyClaim(claimId, officerId, classification, businessPortion, supplierVatNumber, period) {
        // Fetch current claim amount
        const claimRes = await this.db.query(`SELECT amount, claim_amount FROM type::record($id)`, { id: claimId });
        const claim = claimRes[0]?.[0];
        const effectiveAmount = claim?.claim_amount ?? claim?.amount ?? 0;
        const reclaimable = vatAmount(effectiveAmount, classification, businessPortion);
        await this.db.query(`UPDATE type::record($id) MERGE {
        vat_status: 'classified',
        vat_classification: $classification,
        vat_reclaimable_amount: $reclaimable,
        vat_business_portion: $businessPortion,
        supplier_vat_number: $supplierVatNumber,
        vat_classified_by: type::record($officer),
        vat_classified_at: time::now(),
        vat_period: $period
      }`, { id: claimId, classification, reclaimable, businessPortion: businessPortion ?? null, supplierVatNumber: supplierVatNumber ?? null, officer: officerId, period });
    }
    // ─── POST /vat/export ────────────────────────────────────────────────────────
    async exportVAT(period) {
        const res = await this.db.query(`
      SELECT reference, date, category, description, amount, vat_classification, vat_reclaimable_amount, supplier_vat_number
      FROM expense_claim
      WHERE vat_period = $period AND vat_status = 'classified'
      ORDER BY category ASC, date ASC
    `, { period });
        const rows = res[0];
        if (!rows || rows.length === 0)
            return 'Reference,Date,Category,Description,Gross Amount,VAT Classification,Reclaimable VAT,Supplier VAT No.\n';
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
exports.VatService = VatService;
