/**
 * Gemini Client
 *
 * Google Gemini API client for image analysis and fallback chat
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import type {
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  ImageAnalysisOptions,
  ImageAnalysisResult,
} from './types'

export interface GeminiConfig {
  apiKey: string
  defaultModel?: string
}

const DEFAULT_MODEL = 'gemini-1.5-flash'
const VISION_MODEL = 'gemini-1.5-flash'

export class GeminiClient {
  private client: GoogleGenerativeAI
  private defaultModel: string

  constructor(config: GeminiConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey)
    this.defaultModel = config.defaultModel || DEFAULT_MODEL
  }

  /**
   * Generate a chat completion
   */
  async chat(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResult> {
    const modelName = options.model || this.defaultModel
    const model = this.client.getGenerativeModel({
      model: modelName,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    })

    // Build conversation history
    const systemPrompt = options.systemPrompt || messages.find(m => m.role === 'system')?.content
    const conversationMessages = messages.filter(m => m.role !== 'system')

    // For single turn, use generateContent
    const firstMessage = conversationMessages[0]
    if (conversationMessages.length === 1 && firstMessage) {
      const prompt = systemPrompt
        ? `${systemPrompt}\n\n${firstMessage.content}`
        : firstMessage.content

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.7,
        },
      })

      const response = result.response
      const text = response.text()
      const usage = response.usageMetadata

      return {
        content: text,
        model: modelName,
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
        stopReason: response.candidates?.[0]?.finishReason || 'unknown',
      }
    }

    // For multi-turn, use chat
    const chat = model.startChat({
      history: conversationMessages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        maxOutputTokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
      },
    })

    const lastMessage = conversationMessages[conversationMessages.length - 1]
    if (!lastMessage) {
      throw new Error('No messages provided')
    }
    const prompt = systemPrompt && conversationMessages.length === 1
      ? `${systemPrompt}\n\n${lastMessage.content}`
      : lastMessage.content

    const result = await chat.sendMessage(prompt)
    const response = result.response
    const text = response.text()
    const usage = response.usageMetadata

    return {
      content: text,
      model: modelName,
      promptTokens: usage?.promptTokenCount || 0,
      completionTokens: usage?.candidatesTokenCount || 0,
      stopReason: response.candidates?.[0]?.finishReason || 'unknown',
    }
  }

  /**
   * Analyze an image with vision
   */
  async analyzeImage(
    imageData: Buffer | string,
    options: ImageAnalysisOptions
  ): Promise<ImageAnalysisResult> {
    const model = this.client.getGenerativeModel({ model: VISION_MODEL })

    // Convert buffer to base64 if needed
    let base64Data: string
    let mimeType = 'image/jpeg'

    if (Buffer.isBuffer(imageData)) {
      base64Data = imageData.toString('base64')
      // Try to detect media type from magic bytes
      if (imageData[0] === 0x89 && imageData[1] === 0x50) {
        mimeType = 'image/png'
      } else if (imageData[0] === 0x47 && imageData[1] === 0x49) {
        mimeType = 'image/gif'
      } else if (imageData[0] === 0x52 && imageData[1] === 0x49) {
        mimeType = 'image/webp'
      }
    } else {
      base64Data = imageData
    }

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      },
      { text: options.prompt },
    ])

    const response = result.response
    const text = response.text()
    const usage = response.usageMetadata

    return {
      content: text,
      model: VISION_MODEL,
      promptTokens: usage?.promptTokenCount || 0,
      completionTokens: usage?.candidatesTokenCount || 0,
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
 * Create a Gemini client with environment variables
 */
export function createGeminiClient(apiKey?: string): GeminiClient {
  const key = apiKey || process.env.GOOGLE_API_KEY
  if (!key) {
    throw new Error('GOOGLE_API_KEY is required')
  }
  return new GeminiClient({ apiKey: key })
}
