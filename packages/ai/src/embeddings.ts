/**
 * Embeddings Service
 *
 * Generate and manage vector embeddings for semantic search
 */

import type { EmbeddingOptions, EmbeddingResult } from './types'

export interface EmbeddingsConfig {
  voyageApiKey?: string
  googleApiKey?: string
  defaultModel?: string
}

// Voyage AI models (1024 dimensions)
const VOYAGE_MODEL = 'voyage-3'
const VOYAGE_DIMENSIONS = 1024

// Google embedding model (768 dimensions)
const GOOGLE_MODEL = 'text-embedding-004'
const GOOGLE_DIMENSIONS = 768

export class EmbeddingsService {
  private voyageApiKey?: string
  private googleApiKey?: string
  private defaultModel: string

  constructor(config: EmbeddingsConfig) {
    this.voyageApiKey = config.voyageApiKey
    this.googleApiKey = config.googleApiKey
    this.defaultModel = config.defaultModel || (this.voyageApiKey ? VOYAGE_MODEL : GOOGLE_MODEL)
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string, options: EmbeddingOptions = {}): Promise<EmbeddingResult> {
    const model = options.model || this.defaultModel

    if (model.startsWith('voyage')) {
      return this.embedWithVoyage(text, model)
    } else if (model.startsWith('text-embedding')) {
      return this.embedWithGoogle(text, model)
    } else {
      throw new Error(`Unknown embedding model: ${model}`)
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async embedBatch(texts: string[], options: EmbeddingOptions = {}): Promise<EmbeddingResult[]> {
    const model = options.model || this.defaultModel

    if (model.startsWith('voyage')) {
      return this.embedBatchWithVoyage(texts, model)
    } else if (model.startsWith('text-embedding')) {
      return this.embedBatchWithGoogle(texts, model)
    } else {
      throw new Error(`Unknown embedding model: ${model}`)
    }
  }

  /**
   * Generate embedding using Voyage AI
   */
  private async embedWithVoyage(text: string, model: string): Promise<EmbeddingResult> {
    if (!this.voyageApiKey) {
      throw new Error('VOYAGE_API_KEY is required for Voyage embeddings')
    }

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.voyageApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        input_type: 'document',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Voyage API error: ${error}`)
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>
      model: string
    }

    const firstEmbedding = data.data[0]
    if (!firstEmbedding) {
      throw new Error('No embedding returned from Voyage API')
    }

    return {
      embedding: firstEmbedding.embedding,
      model: data.model,
      dimensions: firstEmbedding.embedding.length,
    }
  }

  /**
   * Generate batch embeddings using Voyage AI
   */
  private async embedBatchWithVoyage(texts: string[], model: string): Promise<EmbeddingResult[]> {
    if (!this.voyageApiKey) {
      throw new Error('VOYAGE_API_KEY is required for Voyage embeddings')
    }

    // Voyage supports up to 128 texts per batch
    const batchSize = 128
    const results: EmbeddingResult[] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)

      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.voyageApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: batch,
          input_type: 'document',
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Voyage API error: ${error}`)
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[] }>
        model: string
      }

      for (const item of data.data) {
        results.push({
          embedding: item.embedding,
          model: data.model,
          dimensions: item.embedding.length,
        })
      }

      // Rate limit: wait between batches
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  }

  /**
   * Generate embedding using Google AI
   */
  private async embedWithGoogle(text: string, model: string): Promise<EmbeddingResult> {
    if (!this.googleApiKey) {
      throw new Error('GOOGLE_API_KEY is required for Google embeddings')
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${this.googleApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: `models/${model}`,
          content: {
            parts: [{ text }],
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Google AI error: ${error}`)
    }

    const data = await response.json() as {
      embedding: { values: number[] }
    }

    return {
      embedding: data.embedding.values,
      model,
      dimensions: data.embedding.values.length,
    }
  }

  /**
   * Generate batch embeddings using Google AI
   */
  private async embedBatchWithGoogle(texts: string[], model: string): Promise<EmbeddingResult[]> {
    if (!this.googleApiKey) {
      throw new Error('GOOGLE_API_KEY is required for Google embeddings')
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${this.googleApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: texts.map(text => ({
            model: `models/${model}`,
            content: {
              parts: [{ text }],
            },
          })),
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Google AI error: ${error}`)
    }

    const data = await response.json() as {
      embeddings: Array<{ values: number[] }>
    }

    return data.embeddings.map(e => ({
      embedding: e.values,
      model,
      dimensions: e.values.length,
    }))
  }

  /**
   * Get model dimensions
   */
  getDimensions(model?: string): number {
    const m = model || this.defaultModel
    if (m.startsWith('voyage')) {
      return VOYAGE_DIMENSIONS
    } else if (m.startsWith('text-embedding')) {
      return GOOGLE_DIMENSIONS
    }
    return VOYAGE_DIMENSIONS // default
  }
}

/**
 * Create an embeddings service with environment variables
 */
export function createEmbeddingsService(config?: Partial<EmbeddingsConfig>): EmbeddingsService {
  return new EmbeddingsService({
    voyageApiKey: config?.voyageApiKey || process.env.VOYAGE_API_KEY,
    googleApiKey: config?.googleApiKey || process.env.GOOGLE_API_KEY,
    defaultModel: config?.defaultModel,
  })
}
