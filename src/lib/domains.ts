export const DOMAINS = [
  { id: 1, short: "Audit Process", name: "Information Systems Auditing Process", weight: 0.18,
    keywords: ["audit charter", "audit plan", "risk-based audit", "sampling", "evidence", "audit report", "follow-up", "control self-assessment", "materiality", "audit engagement", "isaca", "auditor", "workpapers", "compliance testing", "substantive"] },
  { id: 2, short: "Governance", name: "Governance and Management of IT", weight: 0.18,
    keywords: ["governance", "steering committee", "strategy", "board", "policy", "policies", "cobit", "enterprise architecture", "risk management", "maturity", "balanced scorecard", "outsourcing", "sla", "quality management", "it budget", "segregation of duties"] },
  { id: 3, short: "Acquisition & Dev", name: "IS Acquisition, Development and Implementation", weight: 0.12,
    keywords: ["sdlc", "project management", "feasibility", "requirements", "agile", "testing", "migration", "go-live", "post-implementation", "change management", "business case", "prototyp", "application controls", "input controls", "conversion"] },
  { id: 4, short: "Operations & Resilience", name: "IS Operations and Business Resilience", weight: 0.26,
    keywords: ["operations", "incident", "problem management", "backup", "disaster recovery", "business continuity", "bcp", "drp", "rto", "rpo", "capacity", "job scheduling", "database", "network", "hardware", "service level", "recovery site", "bia"] },
  { id: 5, short: "Asset Protection", name: "Protection of Information Assets", weight: 0.26,
    keywords: ["encryption", "firewall", "access control", "authentication", "password", "malware", "intrusion", "privacy", "pki", "vpn", "biometric", "physical security", "data classification", "security awareness", "cloud security", "vulnerability", "penetration"] },
] as const;

export type DomainId = 1 | 2 | 3 | 4 | 5;

export function classifyText(text: string): DomainId {
  const t = text.toLowerCase();
  let best: DomainId = 1, bestScore = -1;
  for (const d of DOMAINS) {
    let s = 0;
    for (const k of d.keywords) {
      let i = t.indexOf(k);
      while (i !== -1) { s++; i = t.indexOf(k, i + k.length); }
    }
    if (s > bestScore) { bestScore = s; best = d.id as DomainId; }
  }
  return best;
}

export const domainById = (id: number) => DOMAINS.find((d) => d.id === id)!;

/** Split 150 exam questions by official domain weights. */
export function examAllocation(total = 150): Record<number, number> {
  const out: Record<number, number> = {};
  let used = 0;
  DOMAINS.forEach((d, i) => {
    const n = i === DOMAINS.length - 1 ? total - used : Math.round(total * d.weight);
    out[d.id] = n; used += n;
  });
  return out;
}
