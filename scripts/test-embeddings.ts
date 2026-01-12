import { createEmbeddingsService } from '../packages/ai/src/embeddings'

async function test() {
  const service = createEmbeddingsService({
    googleApiKey: process.env.GOOGLE_API_KEY
  })

  console.log('Testing Google embeddings...')
  console.log('API Key:', process.env.GOOGLE_API_KEY ? 'Set' : 'Not set')

  try {
    const result = await service.embed('Hello, this is a test for vehicle rental business.', {
      model: 'text-embedding-004'
    })

    console.log('✅ Success!')
    console.log('Model:', result.model)
    console.log('Dimensions:', result.dimensions)
    console.log('First 5 values:', result.embedding.slice(0, 5))
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

test()
