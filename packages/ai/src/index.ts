/**
 * @mrst/ai - AI services (Claude, Gemini, embeddings)
 *
 * Provides unified AI client with:
 * - Claude (primary chat/completion)
 * - Gemini (fallback + excellent image analysis)
 * - Voyage/Google embeddings for semantic search
 * - Embedding pipeline for data processing
 */

// Types
export * from './types'

// Clients
export { ClaudeClient, createClaudeClient } from './claude'
export { GeminiClient, createGeminiClient } from './gemini'
export { EmbeddingsService, createEmbeddingsService } from './embeddings'

// Unified client
export { AIClient, createAIClient, getAIClient } from './client'

// Pipeline
export * from './pipeline'

// Search
export * from './search'

// Suggestions
export * from './suggestions'

// Version
export const AI_VERSION = '0.5.0'
