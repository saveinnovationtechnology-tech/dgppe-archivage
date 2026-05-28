// lib/ai/indexer.ts
// ============================================================
// INDEXATION DES DOCUMENTS
// Provider: HuggingFace (Production) + Ollama (Local/Fallback)
// ============================================================

import { createClient } from '@/lib/supabase/server'

const TAILLE_CHUNK = 500
const CHEVAUCHEMENT = 50
const TIMEOUT_MS = 30000
const RETRY_ATTEMPTS = 3
const RETRY_DELAY = 2000

// ============================================================
// POLYFILLS NODE.JS (requis par pdf-parse)
// ============================================================

function appliquerPolyfills() {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    // @ts-ignore
    globalThis.DOMMatrix = class DOMMatrix {
      m11 = 1; m12 = 0; m13 = 0; m14 = 0
      m21 = 0; m22 = 1; m23 = 0; m24 = 0
      m31 = 0; m32 = 0; m33 = 1; m34 = 0
      m41 = 0; m42 = 0; m43 = 0; m44 = 1
      static fromMatrix() { return new (globalThis as any).DOMMatrix() }
      static fromFloat32Array() { return new (globalThis as any).DOMMatrix() }
      static fromFloat64Array() { return new (globalThis as any).DOMMatrix() }
      translate() { return this }
      scale() { return this }
      rotate() { return this }
      multiply() { return this }
      inverse() { return this }
    }
  }

  if (typeof globalThis.ImageData === 'undefined') {
    // @ts-ignore
    globalThis.ImageData = class ImageData {
      data: Uint8ClampedArray
      width: number
      height: number
      constructor(dataOrWidth: any, widthOrHeight: number, height?: number) {
        if (typeof dataOrWidth === 'number') {
          this.width = dataOrWidth
          this.height = widthOrHeight
          this.data = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4)
        } else {
          this.data = dataOrWidth
          this.width = widthOrHeight
          this.height = height || Math.floor(dataOrWidth.length / (4 * widthOrHeight))
        }
      }
    }
  }

  if (typeof globalThis.Path2D === 'undefined') {
    // @ts-ignore
    globalThis.Path2D = class Path2D {
      constructor(_path?: any) {}
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
    }
  }
}

// ============================================================
// TYPES
// ============================================================

export interface ResultatIndexation {
  succes: boolean
  documentsTraites: number
  documentsEchoues: number
  chunksCreees: number
  erreurs: string[]
  duree: number
  dimensionEmbedding?: number
}

export interface ProgressionIndexation {
  etape: string
  documentsTotal: number
  documentsTraites: number
  pourcentage: number
  enCours: boolean
}

interface DocumentBrut {
  id: string
  intitule: string
  fichier_base64: string | null
  observations: string | null
  type_document: string | null
  niveau_confidentialite: string | null
}

interface ResultatDocument {
  erreur?: string
  chunksCreees: number
}

interface EmbeddingProvider {
  nom: string
  dimensionEmbedding: number
}

// ============================================================
// DÉTECTEUR PROVIDER EMBEDDINGS
// ============================================================

function detecterProvider(): EmbeddingProvider {
  const provider = process.env.EMBEDDING_PROVIDER || 'huggingface'

  if (provider === 'ollama') {
    return {
      nom: 'ollama',
      dimensionEmbedding: 384, // nomic-embed-text
    }
  }

  if (provider === 'huggingface') {
    return {
      nom: 'huggingface',
      dimensionEmbedding: 768, // all-mpnet-base-v2
    }
  }

  // Fallback
  console.warn('[INDEXER] ⚠️ Provider non reconnu, utilisation HuggingFace par défaut')
  return {
    nom: 'huggingface',
    dimensionEmbedding: 768,
  }
}

// ============================================================
// EXTRAIRE TEXTE DEPUIS BASE64 PDF
// ============================================================

async function extraireTexteDepuisBase64(base64: string): Promise<string> {
  try {
    if (!base64 || typeof base64 !== 'string' || base64.length === 0) {
      console.warn('[INDEXER] ⚠️ Base64 vide ou invalide')
      return ''
    }

    const base64Data = base64.replace(/^data:[^;]+;base64,/, '')

    if (!base64Data || base64Data.length === 0) {
      console.warn('[INDEXER] ⚠️ Données base64 invalides')
      return ''
    }

    const buffer = Buffer.from(base64Data, 'base64')

    if (buffer.length === 0) {
      console.warn('[INDEXER] ⚠️ Buffer vide après décodage')
      return ''
    }

    // ✅ Appliquer les polyfills AVANT d'importer pdf-parse
    appliquerPolyfills()

    try {
      // ✅ Import dynamique pour éviter les effets de bord au module load
      const pdfModule = await import('pdf-parse-fork')
      const pdfParse = typeof pdfModule.default === 'function'
        ? pdfModule.default
        : (pdfModule as any)

      const data = await Promise.race([
        pdfParse(buffer, {
          pagerender: undefined,
          max: 0,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout extraction PDF')), TIMEOUT_MS)
        )
      ])

      if (data?.text && data.text.trim().length > 0) {
        const texte = nettoyerTexte(data.text)
        console.log(`[INDEXER] ✅ PDF extrait : ${texte.length} caractères, ${data.numpages} pages`)
        return texte
      }

      console.warn('[INDEXER] ⚠️ PDF vide ou non lisible (PDF scanné ?)')
      return ''

    } catch (pdfError) {
      const pdfMsg = pdfError instanceof Error ? pdfError.message : 'Erreur PDF'
      console.warn(`[INDEXER] ⚠️ Extraction PDF échouée (${pdfMsg})`)
      return ''
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[INDEXER] ❌ Erreur extraction PDF:', msg)
    return ''
  }
}

// ============================================================
// NETTOYER TEXTE
// ============================================================

function nettoyerTexte(texte: string): string {
  return (texte || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ============================================================
// DÉCOUPER EN CHUNKS
// ============================================================

function decoupeEnChunks(texte: string): string[] {
  const chunks: string[] = []
  const mots = texte.split(/\s+/).filter(m => m.length > 0)

  let position = 0
  while (position < mots.length) {
    const fin = Math.min(position + TAILLE_CHUNK, mots.length)
    const chunk = mots.slice(position, fin).join(' ')
    if (chunk.trim().length > 0) {
      chunks.push(chunk)
    }
    position += TAILLE_CHUNK - CHEVAUCHEMENT
  }

  return chunks
}



// ============================================================
// GÉNÉRER EMBEDDING AVEC HUGGINGFACE
// ============================================================

async function genererEmbeddingHuggingFace(
  texte: string,
  tentative = 1
): Promise<number[] | null> {
  try {
    if (!texte || texte.trim().length === 0) {
      console.warn('[INDEXER] ⚠️ Texte vide pour embedding')
      return null
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY
    if (!apiKey) {
      throw new Error('❌ HUGGINGFACE_API_KEY manquante dans .env.local')
    }

    const model =
      process.env.HUGGINGFACE_EMBED_MODEL ||
      'sentence-transformers/all-mpnet-base-v2'

    const texteTronque = texte.slice(0, 512) // HuggingFace: 512 tokens max

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(
        `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: texteTronque,
            options: {
              wait_for_model: true,
            },
          }),
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        const erreur = await response.text()

        // ✅ Retry si rate limit (429)
        if (response.status === 429 && tentative < RETRY_ATTEMPTS) {
          console.warn(`[INDEXER] ⏳ Rate limit HF, tentative ${tentative + 1}/${RETRY_ATTEMPTS}`)
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          return genererEmbeddingHuggingFace(texte, tentative + 1)
        }

        throw new Error(`HuggingFace ${response.status}: ${erreur}`)
      }

      const data = await response.json()

      // HuggingFace retourne directement: [768 dimensions] ou [[...]]
      let embedding: number[] | null = null

      if (Array.isArray(data)) {
        if (typeof data[0] === 'number') {
          embedding = data as number[]
        } else if (Array.isArray(data[0])) {
          embedding = data[0] as number[]
        }
      }

      if (embedding && embedding.length > 0) {
        console.log(`[INDEXER] ✅ Embedding HF: ${embedding.length} dimensions`)
        return embedding
      }

      console.warn('[INDEXER] ⚠️ Format embedding HuggingFace inattendu:', JSON.stringify(data).slice(0, 100))
      return null

    } finally {
      clearTimeout(timeoutId)
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[INDEXER] ❌ Erreur embedding HuggingFace:', msg)
    return null
  }
}

// ============================================================
// GÉNÉRER EMBEDDING AVEC OLLAMA (Fallback Local)
// ============================================================

async function genererEmbeddingOllama(texte: string): Promise<number[] | null> {
  try {
    if (!texte || texte.trim().length === 0) {
      console.warn('[INDEXER] ⚠️ Texte vide pour embedding')
      return null
    }

    const host = process.env.OLLAMA_HOST || 'http://localhost:11434'
    const model = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const response = await fetch(`${host}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: texte.slice(0, 2048),
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Ollama ${response.status}`)
      }

      const data = await response.json()

      if (data.embedding && Array.isArray(data.embedding) && data.embedding.length > 0) {
        console.log(`[INDEXER] ✅ Embedding Ollama: ${data.embedding.length} dimensions`)
        return data.embedding as number[]
      }

      console.warn('[INDEXER] ⚠️ Format embedding Ollama inattendu')
      return null

    } finally {
      clearTimeout(timeoutId)
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[INDEXER] ❌ Erreur embedding Ollama:', msg)
    return null
  }
}

// ============================================================
// WRAPPER GÉNÉRER EMBEDDING (Auto-détection Provider)
// ============================================================

async function genererEmbedding(texte: string): Promise<number[] | null> {
  const provider = detecterProvider()

  if (provider.nom === 'huggingface') {
    return genererEmbeddingHuggingFace(texte)
  }

  if (provider.nom === 'ollama') {
    return genererEmbeddingOllama(texte)
  }

  console.error('[INDEXER] ❌ Provider embedding non reconnu')
  return null
}

// ============================================================
// SUPPRIMER LES ANCIENS EMBEDDINGS D'UN DOCUMENT
// ============================================================

async function supprimerAnciensEmbeddings(documentId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('document_embeddings')
    .delete()
    .eq('document_id', documentId)

  if (error) {
    console.warn(`[INDEXER] ⚠️ Suppression anciens embeddings échouée: ${error.message}`)
  }
}

// ============================================================
// INDEXER UN DOCUMENT
// ============================================================

async function indexerDocument(doc: DocumentBrut): Promise<ResultatDocument> {
  try {
    console.log(`[INDEXER] 📄 Indexation de "${doc.intitule}"...`)

    let texte = ''

    // ── Extraction PDF ──────────────────────────────────────
    if (doc.fichier_base64) {
      console.log('[INDEXER] 📥 Extraction du PDF...')
      texte = await extraireTexteDepuisBase64(doc.fichier_base64)
    }

    // ── Fallback : observations ─────────────────────────────
    if (!texte && doc.observations) {
      console.log('[INDEXER] 📝 Utilisation des observations...')
      texte = nettoyerTexte(doc.observations)
    }

    // ── Fallback ultime : métadonnées ───────────────────────
    if (!texte) {
      const meta = [
        doc.intitule,
        doc.type_document,
        doc.niveau_confidentialite,
      ].filter(Boolean).join(' — ')

      if (meta.trim().length > 0) {
        console.log('[INDEXER] 🏷️ Utilisation des métadonnées...')
        texte = nettoyerTexte(meta)
      }
    }

    if (!texte) {
      console.warn(`[INDEXER] ⚠️ "${doc.intitule}" : aucun contenu à indexer`)
      return { erreur: 'Aucun contenu à indexer', chunksCreees: 0 }
    }

    // ── Découpe en chunks ───────────────────────────────────
    const chunks = decoupeEnChunks(texte)
    console.log(`[INDEXER] ✂️ "${doc.intitule}" : ${chunks.length} chunks créés`)

    // ── Supprimer anciens embeddings ────────────────────────
    await supprimerAnciensEmbeddings(doc.id)

    // ── Insérer nouveaux embeddings ─────────────────────────
    const supabase = await createClient()
    let chunksInseres = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      try {
        const embedding = await genererEmbedding(chunk)

        if (!embedding) {
          console.warn(`[INDEXER] ⚠️ Embedding échoué pour chunk ${i + 1}/${chunks.length}`)
          continue
        }

        const { error: insertError } = await supabase
          .from('document_embeddings')
          .insert({
            document_id: doc.id,
            contenu: chunk,
            embedding: embedding,
            chunk_index: i,
            created_at: new Date().toISOString(),
          })

        if (insertError) {
          console.error(`[INDEXER] ❌ Erreur insertion chunk ${i + 1}:`, insertError.message)
        } else {
          chunksInseres++
          console.log(`[INDEXER] ✅ Chunk ${i + 1}/${chunks.length} inséré`)
        }

      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Erreur inconnue'
        console.error(`[INDEXER] ❌ Erreur traitement chunk ${i + 1}:`, msg)
      }

      // ✅ Délai entre chunks pour respecter les rate limits
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log(`[INDEXER] ✅ "${doc.intitule}" : ${chunksInseres}/${chunks.length} chunks indexés`)
    return { chunksCreees: chunksInseres }

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error(`[INDEXER] ❌ Erreur indexation "${doc.intitule}":`, msg)
    return { erreur: msg, chunksCreees: 0 }
  }
}

// ============================================================
// INDEXER TOUS LES DOCUMENTS
// ============================================================

export async function indexerTousLesDocuments(
  progression?: (p: ProgressionIndexation) => void
): Promise<ResultatIndexation> {
  const debut = Date.now()
  const erreurs: string[] = []
  let documentsTraites = 0
  let documentsEchoues = 0
  let chunksCreees = 0
  const provider = detecterProvider()

  try {
    const supabase = await createClient()

    console.log(`[INDEXER] 🤗 Provider: ${provider.nom} (${provider.dimensionEmbedding} dimensions)`)
    console.log('[INDEXER] 📚 Récupération des documents...')

    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, intitule, fichier_base64, observations, type_document, niveau_confidentialite')
      .order('created_at', { ascending: false })

    if (error || !documents) {
      const msg = error?.message || 'Erreur inconnue'
      console.error('[INDEXER] ❌ Erreur récupération documents:', msg)
      return {
        succes: false,
        documentsTraites: 0,
        documentsEchoues: 0,
        chunksCreees: 0,
        erreurs: [msg],
        duree: Date.now() - debut,
        dimensionEmbedding: provider.dimensionEmbedding,
      }
    }

    console.log(`[INDEXER] 📊 ${documents.length} documents trouvés`)

    if (documents.length === 0) {
      return {
        succes: true,
        documentsTraites: 0,
        documentsEchoues: 0,
        chunksCreees: 0,
        erreurs: [],
        duree: Date.now() - debut,
        dimensionEmbedding: provider.dimensionEmbedding,
      }
    }

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i] as DocumentBrut

      if (progression) {
        progression({
          etape: `Indexation de "${doc.intitule}"`,
          documentsTotal: documents.length,
          documentsTraites: i,
          pourcentage: Math.round((i / documents.length) * 100),
          enCours: true,
        })
      }

      try {
        const resultat = await indexerDocument(doc)

        if (resultat.erreur) {
          documentsEchoues++
          erreurs.push(`"${doc.intitule}": ${resultat.erreur}`)
        } else {
          documentsTraites++
          chunksCreees += resultat.chunksCreees
        }

      } catch (error) {
        documentsEchoues++
        const msg = error instanceof Error ? error.message : 'Erreur inconnue'
        erreurs.push(`"${doc.intitule}": ${msg}`)
        console.error(`[INDEXER] ❌ Erreur "${doc.intitule}":`, msg)
      }

      await new Promise(resolve => setTimeout(resolve, 500))
    }

    if (progression) {
      progression({
        etape: 'Indexation terminée',
        documentsTotal: documents.length,
        documentsTraites: documents.length,
        pourcentage: 100,
        enCours: false,
      })
    }

    const duree = Date.now() - debut
    console.log(
      `[INDEXER] 🎉 Terminé : ${documentsTraites} réussis, ` +
      `${documentsEchoues} échoués, ${chunksCreees} chunks en ${(duree / 1000).toFixed(2)}s`
    )

    return {
      succes: documentsEchoues === 0,
      documentsTraites,
      documentsEchoues,
      chunksCreees,
      erreurs,
      duree,
      dimensionEmbedding: provider.dimensionEmbedding,
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[INDEXER] ❌ Erreur globale:', msg)
    return {
      succes: false,
      documentsTraites,
      documentsEchoues: documentsEchoues + 1,
      chunksCreees,
      erreurs: [...erreurs, msg],
      duree: Date.now() - debut,
      dimensionEmbedding: provider.dimensionEmbedding,
    }
  }
}

// ============================================================
// INDEXER UN DOCUMENT PAR ID
// ============================================================

export async function indexerDocumentParId(documentId: string): Promise<ResultatIndexation> {
  const debut = Date.now()
  const provider = detecterProvider()

  if (!documentId || typeof documentId !== 'string' || documentId.trim().length === 0) {
    return {
      succes: false,
      documentsTraites: 0,
      documentsEchoues: 1,
      chunksCreees: 0,
      erreurs: ['ID document invalide'],
      duree: Date.now() - debut,
      dimensionEmbedding: provider.dimensionEmbedding,
    }
  }

  const supabase = await createClient()

  try {
    const { data: doc, error } = await supabase
      .from('documents')
      .select('id, intitule, fichier_base64, observations, type_document, niveau_confidentialite')
      .eq('id', documentId)
      .single()

    if (error || !doc) {
      const msg = error?.message || 'Document introuvable'
      return {
        succes: false,
        documentsTraites: 0,
        documentsEchoues: 1,
        chunksCreees: 0,
        erreurs: [`${msg}: ${documentId}`],
        duree: Date.now() - debut,
        dimensionEmbedding: provider.dimensionEmbedding,
      }
    }

    const resultat = await indexerDocument(doc as DocumentBrut)

    return {
      succes: !resultat.erreur,
      documentsTraites: resultat.erreur ? 0 : 1,
      documentsEchoues: resultat.erreur ? 1 : 0,
      chunksCreees: resultat.chunksCreees,
      erreurs: resultat.erreur ? [resultat.erreur] : [],
      duree: Date.now() - debut,
      dimensionEmbedding: provider.dimensionEmbedding,
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return {
      succes: false,
      documentsTraites: 0,
      documentsEchoues: 1,
      chunksCreees: 0,
      erreurs: [message],
      duree: Date.now() - debut,
      dimensionEmbedding: provider.dimensionEmbedding,
    }
  }
}


// ============================================================
// INFO PROVIDER (pour debug)
// ============================================================

export function getProviderInfo(): EmbeddingProvider {
  return detecterProvider()
}
