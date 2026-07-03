-- Full-text search index for hybrid retrieval
CREATE INDEX IF NOT EXISTS document_chunks_content_fts
  ON document_chunks USING gin(to_tsvector('english', content));
