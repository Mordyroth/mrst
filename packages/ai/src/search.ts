/**
 * Semantic Search
 *
 * Vector similarity search using pgvector for RAG queries
 */

import { sql } from 'drizzle-orm'
import type { EmbeddingsService } from './embeddings'
import type { ClaudeClient } from './claude'
import type { Source, RAGOptions, RAGResult } from './types'

interface DrizzleDB {
  execute: (query: any) => Promise<{ rows: any[] }>
  query: any
}

interface SearchConfig {
  db: DrizzleDB
  embeddings: EmbeddingsService
  claude?: ClaudeClient
  tenantId: string
}

interface SearchResult {
  id: string
  sourceType: string
  sourceId: string
  content: string
  metadata: Record<string, unknown>
  similarity: number
}

/**
 * Perform vector similarity search
 */
export async function vectorSearch(
  config: SearchConfig,
  query: string,
  options: {
    topK?: number
    minSimilarity?: number
    filterTypes?: string[]
    filterCustomerIds?: string[]
    filterVehicleIds?: string[]
  } = {}
): Promise<SearchResult[]> {
  const { db, embeddings, tenantId } = config
  const { topK = 10, minSimilarity = 0.5, filterTypes, filterCustomerIds, filterVehicleIds } = options

  // Generate query embedding
  const queryEmbedding = await embeddings.embed(query)
  const embeddingArray = `[${queryEmbedding.embedding.join(',')}]`

  // Build filter conditions
  const conditions: string[] = [`tenant_id = '${tenantId}'`]

  if (filterTypes && filterTypes.length > 0) {
    conditions.push(`source_type IN (${filterTypes.map(t => `'${t}'`).join(',')})`)
  }

  if (filterCustomerIds && filterCustomerIds.length > 0) {
    conditions.push(`metadata->'customerIds' ?| array[${filterCustomerIds.map(id => `'${id}'`).join(',')}]`)
  }

  if (filterVehicleIds && filterVehicleIds.length > 0) {
    conditions.push(`metadata->'vehicleIds' ?| array[${filterVehicleIds.map(id => `'${id}'`).join(',')}]`)
  }

  const whereClause = conditions.join(' AND ')

  // Perform vector similarity search using pgvector
  const result = await db.execute(sql.raw(`
    SELECT
      id,
      source_type,
      source_id,
      content,
      metadata,
      1 - (embedding::vector(${queryEmbedding.dimensions}) <=> '${embeddingArray}'::vector(${queryEmbedding.dimensions})) as similarity
    FROM embeddings
    WHERE ${whereClause}
    ORDER BY embedding::vector(${queryEmbedding.dimensions}) <=> '${embeddingArray}'::vector(${queryEmbedding.dimensions})
    LIMIT ${topK}
  `))

  return (result.rows as any[])
    .filter((row: any) => row.similarity >= minSimilarity)
    .map((row: any) => ({
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      content: row.content,
      metadata: row.metadata || {},
      similarity: row.similarity,
    }))
}

/**
 * RAG (Retrieval Augmented Generation) query
 * Searches for relevant content and generates an answer using Claude
 */
export async function ragQuery(
  config: SearchConfig,
  options: RAGOptions
): Promise<RAGResult> {
  const { db, embeddings, claude, tenantId } = config

  if (!claude) {
    throw new Error('Claude client required for RAG queries')
  }

  // Search for relevant content
  const searchResults = await vectorSearch(config, options.query, {
    topK: options.topK || 10,
    minSimilarity: options.minRelevance || 0.5,
    filterTypes: options.filterTypes,
    filterCustomerIds: options.filterCustomerIds,
    filterVehicleIds: options.filterVehicleIds,
  })

  if (searchResults.length === 0) {
    return {
      answer: "I couldn't find any relevant information to answer your question.",
      sources: [],
      model: 'none',
      promptTokens: 0,
      completionTokens: 0,
    }
  }

  // Build context from search results
  const contextParts = searchResults.map((result, i) => {
    return `[${i + 1}] ${result.sourceType}: ${result.content}`
  })
  const context = contextParts.join('\n\n')

  // Build system prompt
  const systemPrompt = `You are an AI assistant for a vehicle rental and collision repair business. You have access to data from multiple sources including emails, reservations, customer records, vehicle information, and GPS tracking.

Answer the user's question based ONLY on the context provided below. If the context doesn't contain enough information to fully answer the question, say so. Always cite your sources using [n] notation.

CONTEXT:
${context}`

  // Generate answer with Claude
  const result = await claude.chat(
    [{ role: 'user', content: options.query }],
    { systemPrompt, maxTokens: 1024 }
  )

  // Build sources list
  const sources: Source[] = searchResults.map((result, i) => ({
    type: result.sourceType,
    id: result.sourceId,
    content: result.content.substring(0, 200),
    relevance: result.similarity,
  }))

  return {
    answer: result.content,
    sources,
    model: result.model,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
  }
}

/**
 * Find similar items to a given source
 */
export async function findSimilar(
  config: SearchConfig,
  sourceType: string,
  sourceId: string,
  topK: number = 5
): Promise<SearchResult[]> {
  const { db, tenantId } = config

  // Get the embedding for the source
  const result = await db.execute(sql.raw(`
    SELECT embedding, embedding_dimensions
    FROM embeddings
    WHERE tenant_id = '${tenantId}'
      AND source_type = '${sourceType}'
      AND source_id = '${sourceId}'
    LIMIT 1
  `))

  if (result.rows.length === 0) {
    return []
  }

  const row = result.rows[0] as any
  const embedding = row.embedding
  const dimensions = row.embedding_dimensions

  // Find similar items (excluding the source itself)
  const similarResult = await db.execute(sql.raw(`
    SELECT
      id,
      source_type,
      source_id,
      content,
      metadata,
      1 - (embedding::vector(${dimensions}) <=> '${embedding}'::vector(${dimensions})) as similarity
    FROM embeddings
    WHERE tenant_id = '${tenantId}'
      AND NOT (source_type = '${sourceType}' AND source_id = '${sourceId}')
    ORDER BY embedding::vector(${dimensions}) <=> '${embedding}'::vector(${dimensions})
    LIMIT ${topK}
  `))

  return (similarResult.rows as any[]).map((row: any) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    content: row.content,
    metadata: row.metadata || {},
    similarity: row.similarity,
  }))
}

/**
 * Cluster similar items together
 */
export async function clusterContent(
  config: SearchConfig,
  sourceType: string,
  threshold: number = 0.8
): Promise<Array<{ centroid: SearchResult; members: SearchResult[] }>> {
  // This is a simplified clustering - for production, use proper clustering algorithms
  const { db, tenantId } = config

  // Get all embeddings of the source type
  const result = await db.execute(sql.raw(`
    SELECT
      id,
      source_type,
      source_id,
      content,
      metadata,
      embedding,
      embedding_dimensions
    FROM embeddings
    WHERE tenant_id = '${tenantId}'
      AND source_type = '${sourceType}'
    LIMIT 1000
  `))

  const items = result.rows as any[]
  if (items.length === 0) return []

  // Simple greedy clustering
  const clusters: Array<{ centroid: any; members: any[] }> = []
  const assigned = new Set<string>()

  for (const item of items) {
    if (assigned.has(item.id)) continue

    // Start a new cluster with this item as centroid
    const cluster = { centroid: item, members: [item] }
    assigned.add(item.id)

    // Find similar items not yet assigned
    for (const other of items) {
      if (assigned.has(other.id)) continue

      // Calculate similarity (would need actual vector comparison)
      // For now, skip clustering and just return individual items
    }

    clusters.push(cluster)
  }

  return clusters.map(c => ({
    centroid: {
      id: c.centroid.id,
      sourceType: c.centroid.source_type,
      sourceId: c.centroid.source_id,
      content: c.centroid.content,
      metadata: c.centroid.metadata || {},
      similarity: 1,
    },
    members: c.members.map((m: any) => ({
      id: m.id,
      sourceType: m.source_type,
      sourceId: m.source_id,
      content: m.content,
      metadata: m.metadata || {},
      similarity: 1,
    })),
  }))
}
