function object(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('expected object');
    return value;
}
function string(value, field, max = 8000) {
    if (typeof value !== 'string' || !value.trim() || value.length > max)
        throw new Error(`invalid ${field}`);
    return value;
}
function list(value, field, max = 30) {
    if (!Array.isArray(value) || value.length > max)
        throw new Error(`invalid ${field}`);
    return value;
}
function strings(value, field) { return list(value, field).map(v => string(v, field)); }
function refs(value, known) {
    const result = strings(value, 'sourceMessageIds');
    if (!result.length || result.some(id => !known.has(id)))
        throw new Error('unknown or empty sourceMessageIds');
    return result;
}
export function parseJson(text) {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}
export function validateHat(value, known) {
    const v = object(value);
    const observations = list(v.observations, 'observations', 12).map(item => { const o = object(item); return { text: string(o.text, 'observation'), sourceMessageIds: refs(o.sourceMessageIds, known) }; });
    if (!observations.length)
        throw new Error('empty observations');
    return { summary: string(v.summary, 'summary', 2000), observations, questions: strings(v.questions, 'questions') };
}
export function validateCard(value, review, author) {
    const v = object(value);
    if (v.schemaVersion !== 1)
        throw new Error('invalid schemaVersion');
    const known = new Set(review.messages.map(m => m.id));
    const evidence = new Set(review.evidence.map(e => e.id));
    const claims = list(v.claims, 'claims', 20).map(item => {
        const c = object(item);
        const origin = c.origin;
        const verification = c.verification;
        if (!['user-material', 'ai-analysis', 'external-source'].includes(String(origin)))
            throw new Error('invalid origin');
        if (!['unverified', 'supported', 'conflicting', 'insufficient'].includes(String(verification)))
            throw new Error('invalid verification');
        const sourceMessageIds = refs(c.sourceMessageIds, known);
        const evidenceIds = strings(c.evidenceIds, 'evidenceIds');
        if (evidenceIds.some(id => !evidence.has(id)))
            throw new Error('unknown evidenceIds');
        if ((verification === 'supported' || origin === 'external-source') && !evidenceIds.length)
            throw new Error('external verification requires registered evidence');
        if (origin === 'user-material' && sourceMessageIds.some(id => review.messages.find(m => m.id === id)?.kind !== 'material'))
            throw new Error('user material origin mismatch');
        if (origin === 'ai-analysis' && !sourceMessageIds.some(id => review.messages.find(m => m.id === id)?.author !== 'user'))
            throw new Error('AI origin mismatch');
        return { id: string(c.id, 'claim id', 120), text: string(c.text, 'claim'), origin: origin, verification: verification, sourceMessageIds, evidenceIds };
    });
    if (!claims.length || new Set(claims.map(c => c.id)).size !== claims.length)
        throw new Error('empty or duplicate claims');
    let humanDecision = null;
    if (v.humanDecision !== null) {
        if (author !== 'user')
            throw new Error('AI cannot fill humanDecision');
        const h = object(v.humanDecision);
        if (h.author !== 'user')
            throw new Error('invalid human author');
        humanDecision = { author: 'user', text: string(h.text, 'humanDecision') };
    }
    const experiments = list(v.experiments, 'experiments', 12).map(item => {
        const e = object(item);
        return { action: string(e.action, 'action'), metric: string(e.metric, 'metric'), passCondition: string(e.passCondition, 'passCondition') };
    });
    if (!experiments.length)
        throw new Error('missing actionable experiment');
    return { schemaVersion: 1, decision: string(v.decision, 'decision'), claims,
        assumptions: strings(v.assumptions, 'assumptions'), risks: strings(v.risks, 'risks'), alternatives: strings(v.alternatives, 'alternatives'),
        disagreements: strings(v.disagreements, 'disagreements'), experiments, humanDecision };
}
export function exportMarkdown(review) {
    const card = review.card;
    if (!card)
        throw new Error('NO_CARD');
    const bullet = (xs) => xs.length ? xs.map(s => `- ${s}`).join('\n') : '- 暂无；保留信息缺口。';
    const provenance = review.messages.map(m => `- ${m.id}：${m.author} / ${m.kind}`).join('\n');
    return `# HexaMind 决策卡\n\n评审 ID：${review.id}\n卡片版本：${review.cardVersion}\n更新时间：${review.updatedAt}\n\n## 当前决策\n\n${card.decision}\n\n## 关键依据\n\n${card.claims.map(c => `- [${c.id}] ${c.text}\n  - 来源类型：${c.origin}；核验状态：${c.verification}\n  - 来源消息：${c.sourceMessageIds.join(', ')}；外部证据：${c.evidenceIds.join(', ') || '无'}`).join('\n')}\n\n## 关键假设\n\n${bullet(card.assumptions)}\n\n## 风险\n\n${bullet(card.risks)}\n\n## 替代方案\n\n${bullet(card.alternatives)}\n\n## 未解决分歧\n\n${bullet(card.disagreements)}\n\n## 下一步实验\n\n${card.experiments.map((e, i) => `${i + 1}. ${e.action}\n   - 观察指标：${e.metric}\n   - 通过条件：${e.passCondition}`).join('\n')}\n\n## 用户最终决定\n\n${card.humanDecision?.text || '尚未填写；AI 不代替用户决定。'}\n\n## 来源索引\n\n${provenance}\n\n## 调用记录\n\n${review.calls.map(c => `- ${c.hat} / ${c.purpose} / ${c.state} / ${c.selection.provider}:${c.selection.model} / ${c.usage ? JSON.stringify(c.usage) : '用量未返回'}`).join('\n')}\n\n外部核验工具未启用。来源关联不等于事实已经核实。传输层内部重试次数不可观测。\n`;
}
//# sourceMappingURL=card.js.map