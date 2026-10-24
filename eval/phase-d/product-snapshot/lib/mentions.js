const aliases = { '白帽': 'white', '红帽': 'red', '黑帽': 'black', '黄帽': 'yellow', '绿帽': 'green', '蓝帽': 'blue', white: 'white', red: 'red', black: 'black', yellow: 'yellow', green: 'green', blue: 'blue' };
/** Ignore quoted lines, fenced code and inline code. Routing stores stable IDs. */
export function mentionIds(text) {
    let fence = '';
    const visible = [];
    for (const line of text.split(/\r?\n/)) {
        if (/^\s*>/.test(line))
            continue;
        const marker = line.match(/^\s*(`{3,}|~{3,})/);
        if (marker) {
            if (!fence)
                fence = marker[1];
            else if (fence[0] === marker[1][0] && marker[1].length >= fence.length)
                fence = '';
            continue;
        }
        if (!fence)
            visible.push(line.replace(/(`+)[\s\S]*?\1/g, ''));
    }
    const ids = new Set();
    for (const match of visible.join('\n').matchAll(/(?:^|[\s（(，,：:])@(白帽|红帽|黑帽|黄帽|绿帽|蓝帽|white|red|black|yellow|green|blue)(?=$|[\s，,。.!！?？:：;；)）])/giu))
        ids.add(aliases[match[1].toLowerCase()]);
    return [...ids];
}
export function resolveHat(text, fallback) {
    const ids = mentionIds(text);
    if (ids.length > 1)
        throw new Error('ONE_HAT_REQUIRED');
    const hat = ids[0] ?? fallback;
    if (typeof hat !== 'string' || !['white', 'red', 'black', 'yellow', 'green', 'blue'].includes(hat))
        throw new Error('INVALID_HAT');
    return hat;
}
//# sourceMappingURL=mentions.js.map