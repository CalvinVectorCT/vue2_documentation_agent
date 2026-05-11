import { addChangelogHeader } from './changelogHeader';

describe('addChangelogHeader', () => {
  it('prepends a new updated header when none exists', () => {
    const content = '# Title\n\nBody';
    const result = addChangelogHeader(content, 'Updated docs');

    expect(result).toContain('Updated docs');
    expect(result).toContain('# Title');
    expect(result).toMatch(/^> \*\*Updated:\*\* \d{4}-\d{2}-\d{2} — Updated docs\n\n/);
  });

  it('replaces existing updated header and keeps remaining content', () => {
    const existing = '> **Updated:** 2025-01-01 — Old summary\n\n# Title\n\nBody';
    const result = addChangelogHeader(existing, 'New summary');

    expect(result).toContain('New summary');
    expect(result).toContain('# Title\n\nBody');
    expect(result).not.toContain('Old summary');
  });
});