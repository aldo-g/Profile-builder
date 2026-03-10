export function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-*•]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^---+$/gm, '<hr>')
    .split('\n')
    .map(line => {
      if (/^<(h[1-3]|li|hr|ul|\/ul)/.test(line) || line.trim() === '') return line
      return `<p>${line}</p>`
    })
    .join('\n')
  html = html.replace(/((<li>[\s\S]*?<\/li>\n?)+)/g, '<ul>$1</ul>')
  return html
}
