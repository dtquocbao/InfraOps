import { createRetriever } from './factory';

describe('createRetriever', () => {
  it('throws when databricks backend lacks credentials', () => {
    expect(() =>
      createRetriever({ backend: 'databricks', databricks: { host: '', token: '', catalog: 'infraops', goldSchema: 'gold' } }),
    ).toThrow('RETRIEVAL_BACKEND=databricks');
  });

  it('falls back to pgvector when databricks credentials missing but pg handler provided', async () => {
    const retriever = createRetriever({
      backend: 'databricks',
      databricks: { host: '', token: '', catalog: 'infraops', goldSchema: 'gold' },
      pgExecuteSql: async () => [],
    });
    await expect(retriever.search('test', [], { securityLevels: ['public'] })).resolves.toEqual([]);
  });

  it('throws when pgvector backend lacks sql handler', () => {
    expect(() => createRetriever({ backend: 'pgvector' })).toThrow('pgExecuteSql');
  });
});
