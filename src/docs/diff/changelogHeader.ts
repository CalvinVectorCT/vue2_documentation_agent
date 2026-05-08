/**
 * Prepend a dated changelog entry to a doc file's content.
 * Used by the /update command to mark what changed and when.
 */
export function addChangelogHeader(content: string, summary: string): string {
  const date = new Date().toISOString().split('T')[0];
  const header = `> **Updated:** ${date} — ${summary}\n\n`;

  // If the file already starts with a changelog header, replace the first one
  if (content.startsWith('> **Updated:**')) {
    const firstNewline = content.indexOf('\n\n');
    const rest = firstNewline !== -1 ? content.slice(firstNewline + 2) : content;
    return header + rest;
  }

  return header + content;
}
