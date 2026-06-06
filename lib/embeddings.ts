// lib/ai/embeddings.ts
console.log(
  '🚨 EMBEDDINGS VERSION 2026-06-06 23:40'
)

import { HfInference } from '@huggingface/inference'

const DEFAULT_MODEL =
  'sentence-transformers/paraphrase-multilingual-mpnet-base-v2'

const EXPECTED_DIMENSION = 768

export async function creerEmbedding(
  texte: string
): Promise<number[]> {
  const apiKey = process.env.HUGGINGFACE_API_KEY

  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY non défini')
  }

  const model =
    process.env.HUGGINGFACE_EMBED_MODEL ||
    DEFAULT_MODEL

  const hf = new HfInference(apiKey)

  console.log('[EMBED] 🤗 Génération embedding')
  console.log('[EMBED] 📦 Modèle:', model)

  const result = await hf.featureExtraction({
    model,
    inputs: texte.slice(0, 4000),
  })

  let embedding: number[]

  if (
    Array.isArray(result) &&
    typeof result[0] === 'number'
  ) {
    embedding = result as number[]
  } else if (
    Array.isArray(result) &&
    Array.isArray(result[0])
  ) {
    embedding = result[0] as number[]
  } else {
    throw new Error(
      'Format embedding HuggingFace inattendu'
    )
  }

  if (embedding.length !== EXPECTED_DIMENSION) {
    throw new Error(
      `Dimension incorrecte ${embedding.length}`
    )
  }

  return embedding
}

export function getEmbeddingProvider() {
  return {
    nom: 'huggingface',
    modele:
      process.env.HUGGINGFACE_EMBED_MODEL ||
      DEFAULT_MODEL,
    dimensionEmbedding: EXPECTED_DIMENSION,
  }
}