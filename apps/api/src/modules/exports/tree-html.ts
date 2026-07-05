export type PaperSize = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
export type TreeLayout = 'vertical' | 'horizontal' | 'fan';

export interface HtmlTreeNode {
  id: string;
  name: string;
  gender: 'male' | 'female';
  isDeceased: boolean;
}
export interface HtmlTreeEdge {
  parentId: string;
  childId: string;
}

export interface BuildTreeHtmlOptions {
  paper: PaperSize;
  layout: TreeLayout;
  title?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/**
 * Builds a self-contained, RTL, Arabic-font HTML document for the tree — the
 * exact input Puppeteer renders to PDF/PNG. Kept pure + unit-testable so CI can
 * assert direction/paper/structure without launching a browser (Spec §M4.2).
 */
export function buildTreeHtml(
  nodes: HtmlTreeNode[],
  edges: HtmlTreeEdge[],
  opts: BuildTreeHtmlOptions,
): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of edges) {
    childrenOf.set(e.parentId, [...(childrenOf.get(e.parentId) ?? []), e.childId]);
    hasParent.add(e.childId);
  }
  const roots = nodes.filter((n) => !hasParent.has(n.id));

  const renderNode = (id: string, seen: Set<string>): string => {
    const n = byId.get(id);
    if (!n || seen.has(id)) {
      return '';
    }
    seen.add(id);
    const label = `${escapeHtml(n.name)}${n.isDeceased ? ' †' : ''}`;
    const kids = (childrenOf.get(id) ?? []).map((c) => renderNode(c, seen)).join('');
    return `<li class="node ${n.gender}"><span class="label">${label}</span>${
      kids ? `<ul>${kids}</ul>` : ''
    }</li>`;
  };

  const seen = new Set<string>();
  const body = `<ul class="tree ${opts.layout}">${roots
    .map((r) => renderNode(r.id, seen))
    .join('')}</ul>`;

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(opts.title ?? 'Family Tree')}</title>
<style>
  @page { size: ${opts.paper}; margin: 12mm; }
  html, body { direction: rtl; }
  body { font-family: 'Noto Sans Arabic', 'Amiri', 'Arial', sans-serif; color: #111; }
  .tree, .tree ul { list-style: none; margin: 0; padding: 0 16px 0 0; }
  .node { margin: 4px 0; }
  .label { display: inline-block; padding: 2px 8px; border: 1px solid #999; border-radius: 6px; }
  .node.female > .label { border-color: #b45; }
  .tree.horizontal { display: flex; }
</style>
</head>
<body>
<main>${body}</main>
</body>
</html>`;
}
