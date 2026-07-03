import { chunkText } from './chunk-document';

describe('chunkText', () => {
  it('splits long text into multiple chunks', () => {
    const text = 'A'.repeat(2000);
    const chunks = chunkText(text, 800, 100);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('preserves paragraph boundaries when possible', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const chunks = chunkText(text, 500);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain('First paragraph');
    expect(chunks[0]).toContain('Third paragraph');
  });

  it('returns empty array for empty input', () => {
    expect(chunkText('   ')).toEqual([]);
  });
});
