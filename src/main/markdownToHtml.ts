// Converts markdown to raw HTML for Electron's printToPDF renderer.
// NOTE: Does NOT escape HTML entities — Chromium renders the output directly,
// so <strong>, <em> etc. must be literal tags. This is intentionally different
// from renderer/src/utils/renderMarkdown.ts, which escapes first for safe
// injection into the React UI.
export function markdownToHtml(md: string): string {
  let html = md
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold / italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // List items (collected into <ul> blocks below)
    .replace(/^[-*•]\s+(.+)$/gm, '<li>$1</li>')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr>')
    // Paragraphs: wrap consecutive non-tag lines
    .split('\n')
    .map(line => {
      if (line.startsWith('<') || line.trim() === '') return line
      return `<p>${line}</p>`
    })
    .join('\n')
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
  return html
}
