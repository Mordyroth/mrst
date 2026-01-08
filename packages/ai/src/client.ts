/**
 * AI Client
 *
 * Unified AI client with Claude primary and Gemini fallback
 */

import { ClaudeClient, createClaudeClient } from './claude'
import { GeminiClient, createGeminiClient } from './gemini'
import { EmbeddingsService, createEmbeddingsService } from './embeddings'
import type {
  AIClientConfig,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  ImageAnalysisOptions,
  ImageAnalysisResult,
  EmbeddingOptions,
  EmbeddingResult,
} from './types'

export class AIClient {
  private claude?: ClaudeClient
  private gemini?: GeminiClient
  private embeddings?: EmbeddingsService
  private useFallback: boolean = false

  constructor(config: AIClientConfig = {}) {
    // Initialize Claude if API key available
    const anthropicKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY
    if (anthropicKey) {
      this.claude = new ClaudeClient({
        apiKey: anthropicKey,
        defaultModel: config.defaultChatModel,
      })
    }

    // Initialize Gemini if API key available
    const googleKey = config.googleApiKey || process.env.GOOGLE_API_KEY
    if (googleKey) {
      this.gemini = new GeminiClient({
        apiKey: googleKey,
      })
    }

    // Initialize embeddings
    const voyageKey = config.voyageApiKey || process.env.VOYAGE_API_KEY
    if (voyageKey || googleKey) {
      this.embeddings = new EmbeddingsService({
        voyageApiKey: voyageKey,
        googleApiKey: googleKey,
        defaultModel: config.defaultEmbeddingModel,
      })
    }

    if (!this.claude && !this.gemini) {
      console.warn('No AI providers configured. Set ANTHROPIC_API_KEY or GOOGLE_API_KEY.')
    }
  }

  /**
   * Generate a chat completion (Claude primary, Gemini fallback)
   */
  async chat(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResult> {
    // Try Claude first
    if (this.claude && !this.useFallback) {
      try {
        return await this.claude.chat(messages, options)
      } catch (error) {
        console.warn('Claude failed, falling back to Gemini:', error)
        // Fall through to Gemini
      }
    }

    // Fallback to Gemini
    if (this.gemini) {
      return await this.gemini.chat(messages, options)
    }

    throw new Error('No AI provider available')
  }

  /**
   * Analyze an image (Claude primary, Gemini fallback)
   */
  async analyzeImage(
    imageData: Buffer | string,
    options: ImageAnalysisOptions
  ): Promise<ImageAnalysisResult> {
    // Try Claude first for vision
    if (this.claude && !this.useFallback) {
      try {
        return await this.claude.analyzeImage(imageData, options)
      } catch (error) {
        console.warn('Claude vision failed, falling back to Gemini:', error)
        // Fall through to Gemini
      }
    }

    // Fallback to Gemini (which is actually excellent for images)
    if (this.gemini) {
      return await this.gemini.analyzeImage(imageData, options)
    }

    throw new Error('No AI provider available for image analysis')
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string, options: EmbeddingOptions = {}): Promise<EmbeddingResult> {
    if (!this.embeddings) {
      throw new Error('No embeddings provider available. Set VOYAGE_API_KEY or GOOGLE_API_KEY.')
    }
    return this.embeddings.embed(text, options)
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async embedBatch(texts: string[], options: EmbeddingOptions = {}): Promise<EmbeddingResult[]> {
    if (!this.embeddings) {
      throw new Error('No embeddings provider available. Set VOYAGE_API_KEY or GOOGLE_API_KEY.')
    }
    return this.embeddings.embedBatch(texts, options)
  }

  /**
   * Get embedding dimensions for current model
   */
  getEmbeddingDimensions(model?: string): number {
    if (!this.embeddings) {
      return 1024 // default
    }
    return this.embeddings.getDimensions(model)
  }

  /**
   * Simple text completion helper
   */
  async complete(prompt: string, options: ChatCompletionOptions = {}): Promise<string> {
    const result = await this.chat(
      [{ role: 'user', content: prompt }],
      options
    )
    return result.content
  }

  /**
   * Force use of fallback provider (Gemini)
   */
  setUseFallback(useFallback: boolean): void {
    this.useFallback = useFallback
  }

  /**
   * Check if Claude is available
   */
  hasClaudeClient(): boolean {
    return !!this.claude
  }

  /**
   * Check if Gemini is available
   */
  hasGeminiClient(): boolean {
    return !!this.gemini
  }

  /**
   * Check if embeddings are available
   */
  hasEmbeddings(): boolean {
    return !!this.embeddings
  }
}

/**
 * Create an AI client with environment variables
 */
export function createAIClient(config?: AIClientConfig): AIClient {
  return new AIClient(config)
}

// Export singleton instance
let _client: AIClient | null = null

/**
 * Get the default AI client singleton
 */
export function getAIClient(): AIClient {
  if (!_client) {
    _client = createAIClient()
  }
  return _client
}
