// lib/ai/embeddings.ts (partie HuggingFace)

async function creerEmbeddingHuggingFace(texte: string): Promise<number[]> {
  const apiKey = process.env.HUGGINGFACE_API_KEY
  const model = process.env.HUGGINGFACE_EMBED_MODEL || 'sentence-transformers/all-mpnet-base-v2'

  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY non défini')
  }

  const url = `https://api-inference.huggingface.co/models/${model}`

  try {
    console.log(`[EMBED] 🤗 Appel HuggingFace: ${model}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: texte,
        options: {
          wait_for_model: true,  // ✅ Attendre si modèle pas chargé
        },
      }),
    })

    // Log détaillé
    console.log(`[EMBED] 📊 Status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const erreurText = await response.text()
      console.error(`[EMBED] ❌ Erreur ${response.status}:`, erreurText)

      if (response.status === 401) {
        throw new Error(`Clé API HuggingFace invalide ou expirée`)
      }
      if (response.status === 429) {
        throw new Error(`Rate limit HuggingFace atteint (429). Attendre 1min.`)
      }
      if (response.status === 503) {
        throw new Error(`Modèle en chargement. Réessayer dans quelques secondes.`)
      }

      throw new Error(`HuggingFace API error ${response.status}: ${erreurText}`)
    }

    const data = await response.json()

    // ✅ Vérifier le format de réponse
    let embedding: number[]

    if (Array.isArray(data) && Array.isArray(data[0])) {
      // Format: [[embedding]]
      embedding = data[0]
    } else if (Array.isArray(data)) {
      // Format: [embedding]
      embedding = data
    } else if (data.embedding) {
      // Format: {embedding: [...]}
      embedding = data.embedding
    } else {
      console.error('[EMBED] ❌ Format réponse inattendu:', JSON.stringify(data).slice(0, 200))
      throw new Error(`Format réponse HuggingFace inattendu`)
    }

    // ✅ Vérifier dimension
    const expectedDim = 768
    if (embedding.length !== expectedDim) {
      throw new Error(`Dimension embedding incorrect: ${embedding.length} au lieu de ${expectedDim}`)
    }

    console.log(`[EMBED] ✅ Embedding créé (${embedding.length} dimensions)`)
    return embedding

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[EMBED] ❌ Erreur HuggingFace:`, message)
    throw error
  }
}
