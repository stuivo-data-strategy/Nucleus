import { useState, useRef, useEffect, useCallback } from "react";

/*
  EXPENSES PoC — "Hearts & Minds" Demo
  ─────────────────────────────────────
  Design principles:
  1. SCAN-FIRST: Receipt photo triggers the entire flow. Camera opens, OCR fills the form.
  2. TEAMS-NATIVE: Approval notifications, queries, and responses happen in Teams. No separate app to check.
  3. TRANSPARENT WORKFLOW: Every claim shows exactly where it is, who has it, and what happens next.
*/

// ─── Mock data ───
const USER = { name: "Sarah Chen", initials: "SC", role: "Senior Analyst", team: "Data & Analytics" };
const APPROVAL_CHAIN = [
  { name: "James Morton", initials: "JM", role: "Line Manager", type: "line_manager" },
  { name: "Finance Team", initials: "FN", role: "Cost Centre Owner", type: "finance" },
];

const CATEGORIES = [
  { id: "travel", label: "Travel", icon: "✈️", limit: 500 },
  { id: "meals", label: "Meals", icon: "🍽️", limit: 75 },
  { id: "hotel", label: "Hotel", icon: "🏨", limit: 200 },
  { id: "transport", label: "Transport", icon: "🚕", limit: 50 },
  { id: "supplies", label: "Supplies", icon: "📦", limit: 100 },
  { id: "training", label: "Training", icon: "🎓", limit: 1000 },
];

const MOCK_CLAIMS = [
  {
    id: "EXP-044", date: "2026-04-07", desc: "Client lunch — Hawksmoor", category: "meals",
    amount: 62.50, receipt: true,
    workflow: {
      steps: [
        { approver: APPROVAL_CHAIN[0], status: "approved", at: "2026-04-07T14:32", note: null },
        { approver: APPROVAL_CHAIN[1], status: "approved", at: "2026-04-08T09:15", note: null },
      ],
      current: 2, submitted: "2026-04-07T12:01",
    },
    teamsMessages: [
      { from: "system", text: "Claim submitted — routed to James Morton", time: "12:01" },
      { from: "James Morton", text: "Approved ✓", time: "14:32" },
      { from: "system", text: "Forwarded to Finance Team", time: "14:32" },
      { from: "Finance Team", text: "Approved ✓ — reimbursement queued", time: "09:15 +1d" },
    ],
  },
  {
    id: "EXP-043", date: "2026-04-05", desc: "Train Manchester → London", category: "travel",
    amount: 186.00, receipt: true,
    workflow: {
      steps: [
        { approver: APPROVAL_CHAIN[0], status: "approved", at: "2026-04-05T16:10", note: null },
        { approver: APPROVAL_CHAIN[1], status: "pending", at: null, note: null },
      ],
      current: 1, submitted: "2026-04-05T11:44",
    },
    teamsMessages: [
      { from: "system", text: "Claim submitted — routed to James Morton", time: "11:44" },
      { from: "James Morton", text: "Approved ✓", time: "16:10" },
      { from: "system", text: "Forwarded to Finance Team — awaiting review", time: "16:10" },
    ],
  },
  {
    id: "EXP-042", date: "2026-04-03", desc: "Hotel — 1 night London", category: "hotel",
    amount: 189.00, receipt: true,
    workflow: {
      steps: [
        { approver: APPROVAL_CHAIN[0], status: "queried", at: "2026-04-04T10:22", note: "Was this for the SurrealDB vendor meeting? Need to code it to the right cost centre." },
        { approver: APPROVAL_CHAIN[1], status: "waiting", at: null, note: null },
      ],
      current: 0, submitted: "2026-04-03T18:30",
    },
    teamsMessages: [
      { from: "system", text: "Claim submitted — routed to James Morton", time: "18:30" },
      { from: "James Morton", text: "Query: Was this for the SurrealDB vendor meeting? Need to code it to the right cost centre.", time: "10:22 +1d" },
      { from: "system", text: "⚠️ Waiting for your response — reply in Teams or tap here", time: "10:22 +1d" },
    ],
  },
];

// ─── Styles ───
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --navy: #1B2A4A; --navy-60: rgba(27,42,74,0.6);
    --teal: #2E8B8B; --teal-bright: #35a3a3; --teal-bg: #eaf5f5; --teal-subtle: #f0fafa;
    --surface: #ffffff; --raised: #f8fafc; --hover: #f1f5f9;
    --text: #1e293b; --text2: #64748b; --muted: #94a3b8;
    --border: #e2e8f0; --border-focus: var(--teal);
    --green: #059669; --green-bg: #ecfdf5;
    --amber: #d97706; --amber-bg: #fffbeb;
    --red: #dc2626; --red-bg: #fef2f2;
    --purple: #7c3aed; --purple-bg: #f5f3ff;
    --teams: #6264A7;
    --r: 12px; --r-sm: 8px;
    --shadow: 0 1px 3px rgba(0,0,0,0.04); --shadow-md: 0 4px 16px rgba(0,0,0,0.07); --shadow-lg: 0 12px 40px rgba(0,0,0,0.10);
    --ease: cubic-bezier(0.4, 0, 0.2, 1);
  }

  .app { max-width: 420px; margin: 0 auto; min-height: 100vh; background: #f0f2f5; font-family: 'DM Sans', sans-serif; color: var(--text); position: relative; }

  /* ── Header ── */
  .header { background: var(--navy); padding: 16px 20px 14px; position: sticky; top: 0; z-index: 100; }
  .header-row { display: flex; align-items: center; justify-content: space-between; }
  .header h1 { color: #fff; font-size: 19px; font-weight: 600; letter-spacing: -0.3px; }
  .header-sub { color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 1px; letter-spacing: 0.3px; }
  .avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--teal); display: grid; place-items: center; color: #fff; font-size: 12px; font-weight: 600; border: 2px solid rgba(255,255,255,0.15); cursor: pointer; transition: 0.15s var(--ease); }
  .avatar:hover { border-color: rgba(255,255,255,0.4); }

  /* ── Tabs ── */
  .tabs { display: flex; background: var(--navy); padding: 0 20px; gap: 20px; }
  .tab { padding: 9px 0 11px; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.4); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: 0.15s; position: relative; }
  .tab:hover { color: rgba(255,255,255,0.65); }
  .tab.on { color: #fff; border-color: var(--teal-bright); }
  .badge { margin-left: 5px; background: var(--teal); color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px; }

  /* ── Scan banner ── */
  .scan-banner {
    margin: 16px 16px 0; padding: 18px 20px; border-radius: var(--r);
    background: linear-gradient(135deg, var(--navy) 0%, #2d4a6e 100%);
    color: #fff; cursor: pointer; transition: 0.2s var(--ease);
    display: flex; align-items: center; gap: 16px;
    box-shadow: var(--shadow-md);
  }
  .scan-banner:hover { transform: translateY(-1px); box-shadow: var(--shadow-lg); }
  .scan-banner:active { transform: scale(0.985); }
  .scan-icon { font-size: 36px; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
  .scan-title { font-size: 15px; font-weight: 600; }
  .scan-sub { font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 2px; line-height: 1.3; }

  /* ── Summary strip ── */
  .summary { display: flex; gap: 10px; margin: 16px 16px 0; }
  .stat { flex: 1; background: var(--surface); border-radius: var(--r); padding: 14px 16px; box-shadow: var(--shadow); }
  .stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; font-weight: 500; }
  .stat-val { font-size: 22px; font-weight: 700; color: var(--navy); margin-top: 3px; letter-spacing: -0.5px; font-family: 'JetBrains Mono', monospace; }
  .stat-val.teal { color: var(--teal); }
  .stat-note { font-size: 11px; color: var(--text2); margin-top: 1px; }

  /* ── Section label ── */
  .section { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.7px; margin: 20px 16px 10px; }

  /* ── Claim card ── */
  .claim { background: var(--surface); border-radius: var(--r); margin: 0 16px 10px; box-shadow: var(--shadow); overflow: hidden; cursor: pointer; transition: 0.2s var(--ease); }
  .claim:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
  .claim-main { padding: 14px 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .claim-left { flex: 1; min-width: 0; }
  .claim-cat { font-size: 18px; margin-right: 6px; vertical-align: middle; }
  .claim-desc { font-size: 14px; font-weight: 500; }
  .claim-meta { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .claim-amt { font-size: 17px; font-weight: 700; color: var(--navy); font-family: 'JetBrains Mono', monospace; white-space: nowrap; }

  /* ── Workflow tracker ── */
  .wf { padding: 0 16px 14px; }
  .wf-track { display: flex; align-items: stretch; position: relative; gap: 0; }
  .wf-step { flex: 1; position: relative; }
  .wf-bar { height: 4px; border-radius: 2px; margin-bottom: 8px; transition: 0.4s var(--ease); }
  .wf-bar.done { background: var(--green); }
  .wf-bar.active { background: var(--amber); animation: glow 2s infinite; }
  .wf-bar.queried { background: var(--purple); animation: glow 2s infinite; }
  .wf-bar.waiting { background: var(--border); }
  @keyframes glow { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  .wf-name { font-size: 11px; font-weight: 500; color: var(--text2); }
  .wf-status { font-size: 10px; margin-top: 1px; }
  .wf-status.done { color: var(--green); }
  .wf-status.active { color: var(--amber); }
  .wf-status.queried { color: var(--purple); }
  .wf-status.waiting { color: var(--muted); }

  /* ── Teams thread ── */
  .teams-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: var(--teams); margin: 0 16px 12px; background: #f0f0ff; padding: 4px 10px; border-radius: 20px; }
  .teams-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--teams); }
  .thread { margin: 0 16px 14px; border-left: 2px solid var(--border); padding-left: 12px; }
  .msg { margin-bottom: 8px; }
  .msg-from { font-size: 11px; font-weight: 600; color: var(--navy); }
  .msg-from.system { color: var(--muted); font-weight: 500; }
  .msg-text { font-size: 12.5px; color: var(--text2); line-height: 1.4; margin-top: 1px; }
  .msg-time { font-size: 10px; color: var(--muted); margin-top: 1px; }
  .msg-query { background: var(--purple-bg); padding: 8px 10px; border-radius: var(--r-sm); margin-top: 2px; }
  .msg-query .msg-text { color: var(--purple); font-weight: 500; }

  .reply-bar {
    margin: 0 16px 14px; display: flex; gap: 8px;
  }
  .reply-input {
    flex: 1; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--r-sm);
    font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; background: var(--raised);
    transition: 0.15s;
  }
  .reply-input:focus { border-color: var(--teams); box-shadow: 0 0 0 3px rgba(98,100,167,0.1); }
  .reply-send {
    padding: 9px 14px; border: none; border-radius: var(--r-sm); background: var(--teams); color: #fff;
    font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif;
    transition: 0.15s; white-space: nowrap;
  }
  .reply-send:hover { background: #5254a0; }

  /* ── OCR / Scan modal ── */
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; align-items: flex-end; justify-content: center; animation: fadeIn 0.2s; }
  @keyframes fadeIn { from { opacity: 0; } }
  .modal { background: var(--surface); border-radius: 20px 20px 0 0; width: 100%; max-width: 420px; max-height: 92vh; overflow-y: auto; animation: slideUp 0.3s var(--ease); }
  @keyframes slideUp { from { transform: translateY(100%); } }
  .modal-bar { width: 32px; height: 4px; border-radius: 2px; background: var(--border); margin: 12px auto 0; }
  .modal-pad { padding: 20px; }
  .modal h2 { font-size: 18px; font-weight: 700; color: var(--navy); margin-bottom: 4px; }
  .modal-sub { font-size: 13px; color: var(--text2); margin-bottom: 20px; }

  /* ── Camera / scan area ── */
  .camera-area {
    border: 2px dashed var(--border); border-radius: var(--r); padding: 32px 20px;
    text-align: center; cursor: pointer; transition: 0.2s var(--ease); background: var(--raised);
    position: relative; overflow: hidden;
  }
  .camera-area:hover { border-color: var(--teal); background: var(--teal-subtle); }
  .camera-area.captured { border: 2px solid var(--green); background: var(--green-bg); }
  .camera-emoji { font-size: 40px; margin-bottom: 8px; }
  .camera-text { font-size: 14px; color: var(--text2); }
  .camera-text strong { color: var(--teal); }
  .camera-hint { font-size: 11px; color: var(--muted); margin-top: 4px; }

  /* ── OCR result ── */
  .ocr-result {
    margin-top: 16px; padding: 16px; background: var(--raised); border: 1px solid var(--border);
    border-radius: var(--r); animation: fadeUp 0.3s var(--ease);
  }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .ocr-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .ocr-tag { font-size: 11px; font-weight: 600; color: var(--teal); background: var(--teal-bg); padding: 2px 8px; border-radius: 4px; }
  .ocr-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border); }
  .ocr-row:last-child { border: none; }
  .ocr-label { font-size: 13px; color: var(--muted); }
  .ocr-value { font-size: 13px; font-weight: 600; color: var(--navy); }
  .ocr-editable { background: #fffde7; padding: 1px 6px; border-radius: 3px; border: 1px dashed #e0d68a; cursor: pointer; }

  /* ── Form fields ── */
  .field { margin-bottom: 14px; }
  .field-label { font-size: 12px; font-weight: 500; color: var(--text2); margin-bottom: 5px; }
  .field-input {
    width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r-sm);
    font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; background: var(--raised);
    transition: 0.15s;
  }
  .field-input:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(46,139,139,0.08); }
  .amt-wrap { position: relative; }
  .amt-sym { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 15px; font-weight: 600; color: var(--text2); font-family: 'JetBrains Mono', monospace; }
  .amt-input { padding-left: 26px; font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 16px; }

  .cat-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .cat-chip {
    padding: 7px 12px; border: 1.5px solid var(--border); border-radius: 20px;
    font-size: 12.5px; font-weight: 500; cursor: pointer; background: var(--surface);
    transition: 0.15s; display: flex; align-items: center; gap: 5px; font-family: 'DM Sans', sans-serif;
  }
  .cat-chip:hover { border-color: var(--teal); }
  .cat-chip.on { border-color: var(--teal); background: var(--teal-bg); color: var(--teal); font-weight: 600; }

  /* ── Policy ── */
  .policy { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: var(--r-sm); font-size: 12.5px; margin-top: 6px; }
  .policy.pass { background: var(--green-bg); color: var(--green); }
  .policy.warn { background: var(--amber-bg); color: var(--amber); }
  .policy.fail { background: var(--red-bg); color: var(--red); }

  /* ── Approval route preview ── */
  .route { margin-top: 16px; padding: 14px 16px; background: var(--raised); border: 1px solid var(--border); border-radius: var(--r); }
  .route-title { font-size: 12px; font-weight: 600; color: var(--navy); margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
  .route-step { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
  .route-num { width: 22px; height: 22px; border-radius: 50%; background: var(--teal-bg); color: var(--teal); font-size: 11px; font-weight: 700; display: grid; place-items: center; }
  .route-info { font-size: 13px; }
  .route-role { font-size: 11px; color: var(--muted); }
  .route-teams { font-size: 11px; color: var(--teams); font-weight: 500; margin-top: 8px; display: flex; align-items: center; gap: 4px; }

  /* ── Submit button ── */
  .submit {
    width: 100%; padding: 14px; border: none; border-radius: var(--r); font-size: 15px; font-weight: 600;
    font-family: 'DM Sans', sans-serif; cursor: pointer; transition: 0.2s var(--ease); margin-top: 20px;
    background: var(--teal); color: #fff;
  }
  .submit:hover:not(:disabled) { background: var(--teal-bright); transform: translateY(-1px); box-shadow: var(--shadow-md); }
  .submit:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── Success ── */
  .success { text-align: center; padding: 48px 20px 20px; animation: fadeUp 0.35s var(--ease); }
  .success-ring { width: 64px; height: 64px; border-radius: 50%; background: var(--green-bg); display: grid; place-items: center; font-size: 30px; margin: 0 auto 16px; animation: pop 0.35s var(--ease) 0.1s both; }
  @keyframes pop { from { transform: scale(0); } to { transform: scale(1); } }
  .success h3 { font-size: 20px; font-weight: 700; color: var(--navy); }
  .success p { font-size: 13px; color: var(--text2); margin-top: 6px; line-height: 1.5; }
  .success-card { margin-top: 20px; text-align: left; background: var(--raised); border: 1px solid var(--border); border-radius: var(--r); padding: 14px 16px; }
  .success-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
  .success-row .l { color: var(--muted); }
  .success-row .v { font-weight: 600; color: var(--navy); }
  .success-teams { margin-top: 12px; padding: 10px 14px; background: #f0f0ff; border-radius: var(--r-sm); font-size: 12.5px; color: var(--teams); font-weight: 500; display: flex; align-items: center; gap: 6px; }

  /* ── Approver tab ── */
  .approve-card { background: var(--surface); border-radius: var(--r); margin: 0 16px 10px; box-shadow: var(--shadow); padding: 14px 16px; }
  .approve-who { display: flex; align-items: center; gap: 10px; }
  .approve-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--navy); display: grid; place-items: center; color: #fff; font-size: 11px; font-weight: 600; }
  .approve-name { font-size: 14px; font-weight: 500; }
  .approve-date { font-size: 11px; color: var(--muted); }
  .approve-detail { margin-top: 10px; font-size: 13px; color: var(--text2); display: flex; align-items: center; gap: 6px; }
  .approve-receipt { font-size: 11px; color: var(--teal); font-weight: 600; }
  .approve-actions { display: flex; gap: 8px; margin-top: 12px; }
  .act-btn { flex: 1; padding: 10px; border: none; border-radius: var(--r-sm); font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: 0.15s; }
  .act-approve { background: var(--green); color: #fff; }
  .act-approve:hover { background: #047857; }
  .act-query { background: var(--purple-bg); color: var(--purple); }
  .act-query:hover { background: #ede9fe; }
  .act-reject { background: var(--red-bg); color: var(--red); }
  .act-reject:hover { background: #fee2e2; }
  .act-done { text-align: center; padding: 16px; animation: fadeUp 0.25s; }
  .act-done-icon { font-size: 32px; }
  .act-done-label { font-size: 14px; font-weight: 600; color: var(--navy); margin-top: 4px; }
  .act-done-sub { font-size: 12px; color: var(--text2); margin-top: 2px; }

  /* ── FAB ── */
  .fab { position: fixed; bottom: 20px; right: calc(50% - 190px); width: 52px; height: 52px; border-radius: 50%; border: none; background: var(--teal); color: #fff; font-size: 28px; font-weight: 300; cursor: pointer; box-shadow: 0 4px 20px rgba(46,139,139,0.35); transition: 0.2s var(--ease); z-index: 50; display: grid; place-items: center; }
  .fab:hover { background: var(--teal-bright); transform: scale(1.06); }

  /* ── Util ── */
  .mono { font-family: 'JetBrains Mono', monospace; }
  .mb0 { margin-bottom: 0; }
`;

// ═══════ COMPONENTS ═══════

function ScanBanner({ onClick }) {
  return (
    <div className="scan-banner" onClick={onClick}>
      <div className="scan-icon">📸</div>
      <div>
        <div className="scan-title">Scan a receipt</div>
        <div className="scan-sub">Take a photo — we'll read the amount, date, and vendor automatically</div>
      </div>
    </div>
  );
}

function WorkflowTracker({ workflow }) {
  return (
    <div className="wf">
      <div className="wf-track">
        {workflow.steps.map((step, i) => {
          const st = step.status === "approved" ? "done" : step.status === "queried" ? "queried" : i === workflow.current ? "active" : "waiting";
          return (
            <div className="wf-step" key={i}>
              <div className={`wf-bar ${st}`} />
              <div className="wf-name">{step.approver.name}</div>
              <div className={`wf-status ${st}`}>
                {st === "done" && `✓ Approved${step.at ? " · " + step.at.slice(11, 16) : ""}`}
                {st === "active" && "⏳ Reviewing..."}
                {st === "queried" && "❓ Queried — response needed"}
                {st === "waiting" && "Waiting"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamsThread({ claim }) {
  const [reply, setReply] = useState("");
  const [msgs, setMsgs] = useState(claim.teamsMessages);
  const hasQuery = claim.workflow.steps.some(s => s.status === "queried");

  const sendReply = () => {
    if (!reply.trim()) return;
    setMsgs(prev => [...prev, { from: USER.name, text: reply, time: "now" }]);
    setReply("");
    setTimeout(() => {
      setMsgs(prev => [...prev, { from: "system", text: "Reply sent to James Morton via Teams — awaiting re-review", time: "now" }]);
    }, 800);
  };

  return (
    <>
      <div className="teams-tag"><span className="teams-dot" /> Teams Activity</div>
      <div className="thread">
        {msgs.map((m, i) => (
          <div className={`msg ${m.from === "system" ? "" : ""}`} key={i}>
            <div className={`msg-from ${m.from === "system" ? "system" : ""}`}>{m.from === "system" ? "System" : m.from}</div>
            <div className={m.from !== "system" && m.text.startsWith("Query:") ? "msg-query" : ""}>
              <div className="msg-text">{m.text}</div>
            </div>
            <div className="msg-time">{m.time}</div>
          </div>
        ))}
      </div>
      {hasQuery && (
        <div className="reply-bar">
          <input className="reply-input" placeholder="Reply via Teams..." value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === "Enter" && sendReply()} />
          <button className="reply-send" onClick={sendReply}>Send</button>
        </div>
      )}
    </>
  );
}

function ClaimDetail({ claim, onBack }) {
  const cat = CATEGORIES.find(c => c.id === claim.category);
  return (
    <div style={{ padding: "16px 0 80px", animation: "fadeUp 0.25s var(--ease)" }}>
      <div style={{ padding: "0 16px 14px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={onBack}>
        <span style={{ fontSize: 18, color: "var(--teal)" }}>←</span>
        <span style={{ fontSize: 13, color: "var(--text2)" }}>Back to claims</span>
      </div>
      <div style={{ padding: "0 16px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{cat?.icon} {claim.desc}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{claim.id} · {claim.date}</div>
        </div>
        <div className="claim-amt">£{claim.amount.toFixed(2)}</div>
      </div>
      <div className="section" style={{ marginTop: 0 }}>Approval Progress</div>
      <WorkflowTracker workflow={claim.workflow} />
      <div className="section">Activity</div>
      <TeamsThread claim={claim} />
    </div>
  );
}

// ── New Claim Modal ──
function NewClaimModal({ onClose, onSubmit }) {
  const [phase, setPhase] = useState("scan"); // scan → form → success
  const [captured, setCaptured] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [ocrData, setOcrData] = useState(null);
  const [category, setCategory] = useState(null);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("2026-04-08");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const simulateOCR = () => {
    setCaptured(true);
    setTimeout(() => {
      const data = { vendor: "Dishoom Manchester", date: "2026-04-08", amount: "47.80", category: "meals" };
      setOcrData(data);
      setOcrDone(true);
      setAmount(data.amount);
      setDesc(`Lunch — ${data.vendor}`);
      setDate(data.date);
      setCategory(data.category);
    }, 1500);
  };

  const cat = CATEGORIES.find(c => c.id === category);
  const amtNum = parseFloat(amount) || 0;
  const overLimit = cat && amtNum > cat.limit;
  const needsReceipt = amtNum > 25;
  const valid = category && amtNum > 0 && desc && !overLimit && captured;

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setPhase("success"); }, 1000);
  };

  if (phase === "success") {
    return (
      <div className="overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-bar" />
          <div className="success">
            <div className="success-ring">✓</div>
            <h3>Claim Submitted</h3>
            <p>Routed to {APPROVAL_CHAIN[0].name} for approval. You'll be notified in Teams when it's reviewed.</p>
            <div className="success-card">
              <div className="success-row"><span className="l">Reference</span><span className="v mono">EXP-2026-045</span></div>
              <div className="success-row"><span className="l">Amount</span><span className="v mono">£{amtNum.toFixed(2)}</span></div>
              <div className="success-row"><span className="l">Category</span><span className="v">{cat?.icon} {cat?.label}</span></div>
              <div className="success-row"><span className="l">Step 1</span><span className="v">{APPROVAL_CHAIN[0].name}</span></div>
              <div className="success-row"><span className="l">Step 2</span><span className="v">{APPROVAL_CHAIN[1].name}</span></div>
            </div>
            <div className="success-teams">
              <span className="teams-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--teams)", flexShrink: 0 }} />
              Teams notification sent to {APPROVAL_CHAIN[0].name}
            </div>
            <button className="submit" onClick={() => { onSubmit(); onClose(); }}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-bar" />
        <div className="modal-pad">
          <h2>{phase === "scan" && !ocrDone ? "Scan Receipt" : "New Expense"}</h2>
          <div className="modal-sub">
            {phase === "scan" && !ocrDone ? "Point your camera at the receipt — we'll do the rest" : "Review the details and submit"}
          </div>

          {/* Camera / scan */}
          <div className={`camera-area ${captured ? "captured" : ""}`} onClick={() => { if (!captured) { fileRef.current?.click(); simulateOCR(); } }}>
            {!captured ? (
              <>
                <div className="camera-emoji">📷</div>
                <div className="camera-text">Tap to <strong>open camera</strong> or upload</div>
                <div className="camera-hint">We'll extract vendor, date, and amount automatically</div>
              </>
            ) : !ocrDone ? (
              <>
                <div className="camera-emoji" style={{ animation: "glow 1s infinite" }}>🔍</div>
                <div className="camera-text">Reading receipt...</div>
              </>
            ) : (
              <>
                <div className="camera-emoji">✅</div>
                <div className="camera-text">Receipt captured — <strong>tap to retake</strong></div>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} />

          {/* OCR result */}
          {ocrDone && ocrData && (
            <>
              <div className="ocr-result">
                <div className="ocr-header">
                  <span className="ocr-tag">AI Extracted</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Tap values to edit</span>
                </div>
                <div className="ocr-row"><span className="ocr-label">Vendor</span><span className="ocr-value ocr-editable">{ocrData.vendor}</span></div>
                <div className="ocr-row"><span className="ocr-label">Date</span><span className="ocr-value ocr-editable">{ocrData.date}</span></div>
                <div className="ocr-row"><span className="ocr-label">Amount</span><span className="ocr-value ocr-editable mono">£{ocrData.amount}</span></div>
                <div className="ocr-row"><span className="ocr-label">Category</span><span className="ocr-value">🍽️ Meals (auto-detected)</span></div>
              </div>

              {/* Editable form */}
              <div style={{ marginTop: 16 }}>
                <div className="field">
                  <div className="field-label">Category</div>
                  <div className="cat-row">
                    {CATEGORIES.map(c => (
                      <button key={c.id} className={`cat-chip ${category === c.id ? "on" : ""}`} onClick={() => setCategory(c.id)}>
                        {c.icon} {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <div className="field-label">Amount</div>
                  <div className="amt-wrap">
                    <span className="amt-sym">£</span>
                    <input className="field-input amt-input" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  {cat && amtNum > 0 && (
                    <div className={`policy ${overLimit ? "fail" : "pass"}`}>
                      {overLimit ? "✗" : "✓"} {overLimit ? `Over ${cat.label} limit (£${cat.limit})` : `Within ${cat.label} limit (£${cat.limit})`}
                    </div>
                  )}
                  {needsReceipt && captured && (
                    <div className="policy pass">✓ Receipt attached (required over £25)</div>
                  )}
                </div>

                <div className="field">
                  <div className="field-label">Description</div>
                  <input className="field-input" value={desc} onChange={e => setDesc(e.target.value)} />
                </div>

                <div className="field mb0">
                  <div className="field-label">Date</div>
                  <input className="field-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
              </div>

              {/* Approval route */}
              <div className="route">
                <div className="route-title">📋 Approval Route</div>
                {APPROVAL_CHAIN.map((a, i) => (
                  <div className="route-step" key={i}>
                    <div className="route-num">{i + 1}</div>
                    <div>
                      <div className="route-info">{a.name}</div>
                      <div className="route-role">{a.role}</div>
                    </div>
                  </div>
                ))}
                <div className="route-teams">
                  <span className="teams-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--teams)", flexShrink: 0 }} />
                  Notifications via Microsoft Teams
                </div>
              </div>

              <button className={`submit ${submitting ? "" : ""}`} disabled={!valid || submitting} onClick={handleSubmit}>
                {submitting ? "Submitting..." : `Submit · £${amtNum.toFixed(2)}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Approver View ──
function ApproverView() {
  const [actions, setActions] = useState({});
  const pending = [
    { id: "EXP-042-A", from: { name: "Sarah Chen", initials: "SC" }, date: "Apr 3", desc: "Hotel — 1 night London", cat: "hotel", amount: 189.00, receipt: true },
    { id: "EXP-046-A", from: { name: "Priya Sharma", initials: "PS" }, date: "Apr 7", desc: "Taxi to Leeds client site", cat: "transport", amount: 42.50, receipt: true },
    { id: "EXP-047-A", from: { name: "Tom Bradley", initials: "TB" }, date: "Apr 8", desc: "Team lunch — quarterly planning", cat: "meals", amount: 148.60, receipt: true },
  ];

  const actionConfigs = {
    approved: { icon: "✓", label: "Approved", sub: "Forwarded to Finance · claimant notified via Teams" },
    queried: { icon: "❓", label: "Query Sent", sub: "Claimant notified via Teams — awaiting reply" },
    rejected: { icon: "✗", label: "Rejected", sub: "Claimant notified via Teams" },
  };

  return (
    <div style={{ paddingTop: 16, paddingBottom: 80 }}>
      <div className="summary">
        <div className="stat">
          <div className="stat-label">To Review</div>
          <div className="stat-val teal">{pending.filter(p => !actions[p.id]).length}</div>
          <div className="stat-note">pending claims</div>
        </div>
        <div className="stat">
          <div className="stat-label">Approved (Apr)</div>
          <div className="stat-val">£1,247</div>
          <div className="stat-note">across 8 claims</div>
        </div>
      </div>

      <div className="section">Awaiting Your Approval</div>

      {pending.map(p => {
        const action = actions[p.id];
        const cat = CATEGORIES.find(c => c.id === p.cat);
        if (action) {
          const c = actionConfigs[action];
          return (
            <div className="approve-card" key={p.id}>
              <div className="act-done">
                <div className="act-done-icon">{c.icon}</div>
                <div className="act-done-label">{c.label}</div>
                <div className="act-done-sub">{c.sub}</div>
              </div>
            </div>
          );
        }
        return (
          <div className="approve-card" key={p.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="approve-who">
                <div className="approve-avatar">{p.from.initials}</div>
                <div>
                  <div className="approve-name">{p.from.name}</div>
                  <div className="approve-date">{p.date} · {p.id.split("-A")[0]}</div>
                </div>
              </div>
              <div className="claim-amt">£{p.amount.toFixed(2)}</div>
            </div>
            <div className="approve-detail">{cat?.icon} {p.desc}</div>
            {p.receipt && <div className="approve-receipt">📎 Receipt attached</div>}
            <div className="approve-actions">
              <button className="act-btn act-approve" onClick={() => setActions(s => ({ ...s, [p.id]: "approved" }))}>✓ Approve</button>
              <button className="act-btn act-query" onClick={() => setActions(s => ({ ...s, [p.id]: "queried" }))}>❓ Query</button>
              <button className="act-btn act-reject" onClick={() => setActions(s => ({ ...s, [p.id]: "rejected" }))}>✗ Reject</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════ MAIN APP ═══════
export default function App() {
  const [tab, setTab] = useState("my");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState(null);

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="header">
          <div className="header-row">
            <div><h1>Expenses</h1><div className="header-sub">DATA & ANALYTICS PLATFORM</div></div>
            <div className="avatar">{USER.initials}</div>
          </div>
        </div>
        <div className="tabs">
          <button className={`tab ${tab === "my" ? "on" : ""}`} onClick={() => { setTab("my"); setSelected(null); }}>My Claims <span className="badge">4</span></button>
          <button className={`tab ${tab === "approve" ? "on" : ""}`} onClick={() => { setTab("approve"); setSelected(null); }}>Approvals <span className="badge">3</span></button>
        </div>

        {tab === "my" && !selected && (
          <div style={{ paddingBottom: 80 }}>
            <ScanBanner onClick={() => setShowNew(true)} />
            <div className="summary">
              <div className="stat">
                <div className="stat-label">This Month</div>
                <div className="stat-val">£484</div>
                <div className="stat-note">4 claims</div>
              </div>
              <div className="stat">
                <div className="stat-label">Pending</div>
                <div className="stat-val teal">£375</div>
                <div className="stat-note">2 awaiting approval</div>
              </div>
            </div>
            <div className="section">Recent Claims</div>
            {MOCK_CLAIMS.map(c => {
              const cat = CATEGORIES.find(ct => ct.id === c.category);
              const wfStatus = c.workflow.steps.some(s => s.status === "queried") ? "queried" : c.workflow.steps.every(s => s.status === "approved") ? "approved" : "pending";
              return (
                <div className="claim" key={c.id} onClick={() => setSelected(c)}>
                  <div className="claim-main">
                    <div className="claim-left">
                      <div><span className="claim-cat">{cat?.icon}</span><span className="claim-desc">{c.desc}</span></div>
                      <div className="claim-meta">{c.id} · {c.date}</div>
                    </div>
                    <div className="claim-amt">£{c.amount.toFixed(2)}</div>
                  </div>
                  <WorkflowTracker workflow={c.workflow} />
                </div>
              );
            })}
          </div>
        )}

        {tab === "my" && selected && (
          <ClaimDetail claim={selected} onBack={() => setSelected(null)} />
        )}

        {tab === "approve" && <ApproverView />}

        {tab === "my" && !selected && (
          <button className="fab" onClick={() => setShowNew(true)}>+</button>
        )}

        {showNew && <NewClaimModal onClose={() => setShowNew(false)} onSubmit={() => {}} />}
      </div>
    </>
  );
}
