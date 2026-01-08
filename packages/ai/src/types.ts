/**
 * AI Types
 *
 * Type definitions for AI services
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatCompletionOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  stopSequences?: string[]
}

export interface ChatCompletionResult {
  content: string
  model: string
  promptTokens: number
  completionTokens: number
  stopReason: string
}

export interface EmbeddingOptions {
  model?: string
}

export interface EmbeddingResult {
  embedding: number[]
  model: string
  dimensions: number
}

export interface ImageAnalysisOptions {
  prompt: string
  maxTokens?: number
}

export interface ImageAnalysisResult {
  content: string
  model: string
  promptTokens: number
  completionTokens: number
}

export interface AIClientConfig {
  anthropicApiKey?: string
  googleApiKey?: string
  voyageApiKey?: string
  defaultChatModel?: string
  defaultEmbeddingModel?: string
}

export type AIProvider = 'anthropic' | 'google' | 'voyage'

export interface Source {
  type: string
  id: string
  title?: string
  content?: string
  relevance?: number
}

export interface RAGOptions {
  query: string
  topK?: number
  minRelevance?: number
  filterTypes?: string[]
  filterCustomerIds?: string[]
  filterVehicleIds?: string[]
}

export interface RAGResult {
  answer: string
  sources: Source[]
  model: string
  promptTokens: number
  completionTokens: number
}
