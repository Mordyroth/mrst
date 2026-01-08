/**
 * Claude Client
 *
 * Anthropic Claude API client for chat completions
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  ImageAnalysisOptions,
  ImageAnalysisResult,
} from './types'

export interface ClaudeConfig {
  apiKey: string
  defaultModel?: string
  maxRetries?: number
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const MAX_RETRIES = 3

export class ClaudeClient {
  private client: Anthropic
  private defaultModel: string
  private maxRetries: number

  constructor(config: ClaudeConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    })
    this.defaultModel = config.defaultModel || DEFAULT_MODEL
    this.maxRetries = config.maxRetries || MAX_RETRIES
  }

  /**
   * Generate a chat completion
   */
  async chat(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResult> {
    const model = options.model || this.defaultModel
    const maxTokens = options.maxTokens || 4096
    const temperature = options.temperature ?? 0.7

    // Separate system message from conversation
    const systemPrompt = options.systemPrompt || messages.find(m => m.role === 'system')?.content
    const conversationMessages = messages.filter(m => m.role !== 'system')

    let lastError: Error | null = null
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages: conversationMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          stop_sequences: options.stopSequences,
        })

        const textContent = response.content.find(c => c.type === 'text')
        const content = textContent?.type === 'text' ? textContent.text : ''

        return {
          content,
          model: response.model,
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          stopReason: response.stop_reason || 'unknown',
        }
      } catch (error) {
        lastError = error as Error

        // Check if rate limited - wait and retry
        if (error instanceof Anthropic.RateLimitError) {
          const waitMs = Math.min(1000 * Math.pow(2, attempt), 30000)
          console.warn(`Claude rate limited, waiting ${waitMs}ms before retry ${attempt + 1}/${this.maxRetries}`)
          await new Promise(resolve => setTimeout(resolve, waitMs))
          continue
        }

        // For other errors, throw immediately
        throw error
      }
    }

    throw lastError || new Error('Max retries exceeded')
  }

  /**
   * Analyze an image with vision
   */
  async analyzeImage(
    imageData: Buffer | string,
    options: ImageAnalysisOptions
  ): Promise<ImageAnalysisResult> {
    const model = 'claude-sonnet-4-20250514' // Vision-capable model
    const maxTokens = options.maxTokens || 4096

    // Convert buffer to base64 if needed
    let base64Data: string
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'

    if (Buffer.isBuffer(imageData)) {
      base64Data = imageData.toString('base64')
      // Try to detect media type from magic bytes
      if (imageData[0] === 0x89 && imageData[1] === 0x50) {
        mediaType = 'image/png'
      } else if (imageData[0] === 0x47 && imageData[1] === 0x49) {
        mediaType = 'image/gif'
      } else if (imageData[0] === 0x52 && imageData[1] === 0x49) {
        mediaType = 'image/webp'
      }
    } else {
      // Assume it's already base64
      base64Data = imageData
    }

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: options.prompt,
            },
          ],
        },
      ],
    })

    const textContent = response.content.find(c => c.type === 'text')
    const content = textContent?.type === 'text' ? textContent.text : ''

    return {
      content,
      model: response.model,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
    }
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
}

/**
 * Create a Claude client with environment variables
 */
export function createClaudeClient(apiKey?: string): ClaudeClient {
  const key = apiKey || process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY is required')
  }
  return new ClaudeClient({ apiKey: key })
}
