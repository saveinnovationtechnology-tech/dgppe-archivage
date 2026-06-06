// app/api/chat/route.ts
// API Route de chat ARIA — RAG + Groq + Streaming
// Recherche documentaire + Génération de réponses avec contexte

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { creerEmbedding } from '@/lib/embeddings'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ============================================================
// CONFIGURATION
// ============================================================

const MODELE_CHAT = process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant'
const GROQ_HOST = 'api.groq.com'
const TIMEOUT_MS = 60000
const NB_RESULTATS_RAG = 5
const SEUIL_SIMILARITE = 0.3

// ============================================================
// TYPES
// ============================================================

interface ChunkResultat {
  id: string
  document_id: string
  contenu: string
  similarite: number
  intitule?: string
  type_document?: string | null
  direction_origine?: string | null
  niveau_confidentialite?: string
  score?: number
}

interface MessageChat {
  role: 'user' | 'assistant'
  content: string
}

interface Source {
  id: string
  document_id: string
  contenu: string
  similarite: number
  intitule?: string
  type_document?: string | null
  direction_origine?: string | null
}

interface ReponseStream {
  token?: string
  content?: string
  sources?: Source[]
  erreur?: string
  done?: boolean
}

// ============================================================
// GÉNÉRER EMBEDDING VIA GROQ
// ============================================================

/**
 * Génère un embedding vectoriel via l'API Groq
 * Remplace HuggingFace pour plus de cohérence
 */


// ============================================================
// RECHERCHE PAR SIMILARITÉ (RAG)
// ============================================================

/**
 * Recherche les documents pertinents via RPC Supabase
 * Utilise la similarité vectorielle (pgvector)
 */
async function rechercherDocuments(query: string, userRole: string = 'agent_consultation'): Promise<ChunkResultat[]> {
  try {
    if (!query || query.trim().length === 0) {
      console.warn('[CHAT] ⚠️ Query vide')
      return []
    }

    console.log(`[CHAT] 🔍 Recherche "${query.substring(0, 50)}..."`)
    console.log(`[CHAT] 👤 Rôle utilisateur: ${userRole}`)

    // Générer embedding de la requête
    const queryEmbedding = await creerEmbedding(query)

console.log(
  '[CHAT] Query embedding:',
  queryEmbedding.length,
  'dimensions'
)

    if (!queryEmbedding) {
      console.error('[CHAT] ❌ Impossible de générer embedding pour la query')
      return []
    }

    const supabase = await createClient()

    console.log('[CHAT] 🔎 Appel RPC search_embeddings...')

    const { data: resultats, error } = await supabase.rpc(
      'search_embeddings',
      {
        query_embedding: queryEmbedding,
        match_count: NB_RESULTATS_RAG,
        similarity_threshold: SEUIL_SIMILARITE
      }
    )

    if (error) {
      console.error('[CHAT] ❌ Erreur RPC search_embeddings:', error.message)
      return []
    }

    if (!resultats || resultats.length === 0) {
      console.warn('[CHAT] ⚠️ Aucun document trouvé (score > ' + SEUIL_SIMILARITE + ')')
      return []
    }

    // Valider et mapper les résultats
    const resultsValides = (resultats as any[]).filter(r => {
      return r.id && r.document_id && r.contenu
    })

    console.log(`[CHAT] ✅ ${resultsValides.length} résultat(s) trouvé(s)`)
    resultsValides.forEach((r, i) => {
      const sim = ((r.similarite ?? r.score ?? 0) * 100).toFixed(1)
      console.log(`   [${i + 1}] ${r.intitule || r.document_id} (${sim}%)`)
    })

    return resultsValides as ChunkResultat[]

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[CHAT] ❌ Erreur rechercherDocuments:', msg)
    console.error(error)
    return []
  }
}

// ============================================================
// CONSTRUIRE CONTEXTE DOCUMENTAIRE
// ============================================================

/**
 * Formate les chunks trouvés en contexte utilisable
 */
function construireContexte(chunks: ChunkResultat[]): string {
  if (!chunks || chunks.length === 0) {
    return ''
  }

  return chunks
    .map((chunk, index) => {
      const similarite = (chunk.similarite ?? chunk.score ?? 0) * 100
      const label = chunk.intitule || chunk.document_id || `Document ${index + 1}`
      const type = chunk.type_document ? ` [${chunk.type_document}]` : ''
      const direction = chunk.direction_origine ? ` • ${chunk.direction_origine}` : ''

      return `📄 ${label}${type}${direction}
Score: ${similarite.toFixed(1)}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${chunk.contenu.substring(0, 1000)}${chunk.contenu.length > 1000 ? '\n[...troncaturé...]' : ''}
`
    })
    .join('\n\n')
}

// ============================================================
// CONSTRUIRE PROMPT SYSTÈME
// ============================================================

function construirePromptSysteme(contexte: string): string {
  const hasContext = contexte && contexte.trim().length > 0

  const basePrompt = `Tu es ARIA (Assistante de Recherche et d'Intelligence Administrative), l'assistante IA officielle de la DGPPE.

Tu es intégrée dans un système de Gestion Électronique des Documents (GED) pour aider les agents administratifs.

═══════════════════════════════════════════════════════════
INSTRUCTIONS DE RÉPONSE
═══════════════════════════════════════════════════════════

📋 Contenu:
- Réponds UNIQUEMENT en français
- Sois précis, factuel et concis
- Utilise un ton professionnel et courtois
- Cite TOUJOURS les sources documentaires utilisées

🎯 Sources:
${hasContext
      ? `Des documents pertinents ont été trouvés. Base ta réponse principalement sur ces documents.\n\n${contexte}`
      : `AUCUN document pertinent n'a été trouvé dans la base GED pour cette requête. 
Indique-le clairement à l'utilisateur et suggère des actions alternatives.`
}

⚠️ Sécurité:
- Ne divulgue JAMAIS d'informations confidentielles sans vérification d'accès
- Ne confonds pas les documents
- Si tu as un doute, demande une clarification
- Ne fais JAMAIS d'interpolation ou de supposition sans sources

🔍 Qualité:
- Structure ta réponse avec des titres si approprié
- Utilise des listes à puces pour la clarté
- Fournis des références précises (document, date, référence)
- Si information manquante, propose une recherche ultérieure`

  return basePrompt
}

// ============================================================
// ENDPOINT POST /api/chat
// ============================================================

export async function POST(request: NextRequest) {
  let timeoutId: NodeJS.Timeout | null = null
  let streamClosed = false

  try {
    // ============================================================
    // VALIDATION DE LA REQUÊTE
    // ============================================================

    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { erreur: 'Content-Type doit être application/json' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const messages: MessageChat[] = body.messages || []
    const userRole: string = body.userRole || 'agent_consultation'

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { erreur: 'Messages invalides ou vides' },
        { status: 400 }
      )
    }

    const dernierMessage = messages[messages.length - 1]

    if (!dernierMessage || dernierMessage.role !== 'user') {
      return NextResponse.json(
        { erreur: 'Le dernier message doit venir de l\'utilisateur' },
        { status: 400 }
      )
    }

    const query = dernierMessage.content?.trim()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { erreur: 'Requête vide ou invalide' },
        { status: 400 }
      )
    }

    console.log('\n' + '═'.repeat(70))
    console.log('[CHAT] 📨 NOUVELLE REQUÊTE')
    console.log('═'.repeat(70))
    console.log(`[CHAT] ❓ Question: "${query.substring(0, 80)}${query.length > 80 ? '...' : ''}"`)
    console.log(`[CHAT] 👤 Rôle: ${userRole}`)
    console.log('[CHAT] ⏱️ Timestamp:', new Date().toISOString())

    // ============================================================
    // RECHERCHE RAG
    // ============================================================

    console.log('\n[CHAT] 🔍 PHASE 1: RECHERCHE RAG')
    console.log('─'.repeat(70))

    const chunks = await rechercherDocuments(query, userRole)
    const contexte = construireContexte(chunks)

    if (chunks.length > 0) {
      console.log(`[CHAT] ✅ ${chunks.length} document(s) trouvé(s)`)
    } else {
      console.log('[CHAT] ⚠️ Aucun document trouvé — réponse générique')
    }

    // ============================================================
    // STREAMING AVEC GROQ
    // ============================================================

    console.log('\n[CHAT] 🤖 PHASE 2: GÉNÉRATION GROQ')
    console.log('─'.repeat(70))

    const stream = new ReadableStream<Uint8Array>({
      async start(streamController) {
        let contenuComplet = ''

        try {
          const systemPrompt = construirePromptSysteme(contexte)

          console.log('[CHAT] 📤 Appel groq.chat.completions.create...')

          const groqStream = await groq.chat.completions.create({
            model: MODELE_CHAT,
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              ...messages.map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content
              }))
            ],
            stream: true,
            temperature: 0.3,
            max_tokens: 2048,
            top_p: 0.9
          })

          // Timeout global
          timeoutId = setTimeout(() => {
            if (!streamClosed) {
              streamClosed = true
              console.warn(`[CHAT] ⏱️ TIMEOUT: Dépassement de ${TIMEOUT_MS}ms`)
              try {
                streamController.close()
              } catch (e) {
                console.warn('[CHAT] ⚠️ Erreur fermeture stream:', e)
              }
            }
          }, TIMEOUT_MS)

          console.log('[CHAT] 🔄 Streaming Groq en cours...')

          // Boucle sur les chunks du stream
          try {
            for await (const chunk of groqStream) {
              if (streamClosed) {
                console.warn('[CHAT] ⚠️ Stream déjà fermé, arrêt de la boucle')
                break
              }

              const token = chunk.choices[0]?.delta?.content || ''

              if (token) {
                contenuComplet += token

                // Envoyer au client
                try {
                  const message: ReponseStream = {
                    token: token,
                    content: contenuComplet
                  }

                  const sse = `data: ${JSON.stringify(message)}\n\n`
                  streamController.enqueue(new TextEncoder().encode(sse))

                } catch (enqueueError) {
                  console.error('[CHAT] ❌ Erreur enqueue token:', enqueueError)
                  streamClosed = true
                  break
                }
              }
            }

            console.log('[CHAT] ✅ Streaming Groq terminé')
            console.log(`[CHAT] 📊 Réponse générée: ${contenuComplet.length} caractères`)

          } catch (streamError) {
            console.error('[CHAT] ❌ Erreur lecture stream:', streamError)
            streamClosed = true
            throw streamError
          }

          // ============================================================
          // ENVOI DES SOURCES
          // ============================================================

          if (!streamClosed && chunks.length > 0) {
            console.log('[CHAT] 📚 Envoi des sources...')

            const sources: Source[] = chunks.map(c => ({
              id: c.id,
              document_id: c.document_id,
              contenu: c.contenu,
              similarite: c.similarite ?? c.score ?? 0,
              intitule: c.intitule,
              type_document: c.type_document,
              direction_origine: c.direction_origine
            }))

            try {
              const sourcesMessage: ReponseStream = {
                sources: sources,
                done: false
              }

              streamController.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify(sourcesMessage)}\n\n`
                )
              )

              console.log(`[CHAT] ✅ ${sources.length} source(s) envoyée(s)`)

            } catch (sourcesError) {
              console.warn('[CHAT] ⚠️ Erreur envoi sources:', sourcesError)
            }
          }

          // ============================================================
          // FINALISATION
          // ============================================================

          if (!streamClosed) {
            try {
              const finalMessage: ReponseStream = { done: true }
              streamController.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify(finalMessage)}\n\n`
                )
              )

              streamController.enqueue(
                new TextEncoder().encode('data: [DONE]\n\n')
              )

              console.log('[CHAT] 🏁 Finalisation stream')

            } catch (finalError) {
              console.warn('[CHAT] ⚠️ Erreur finalisation:', finalError)
            }
          }

          if (!streamClosed) {
            try {
              streamController.close()
            } catch (closeError) {
              console.warn('[CHAT] ⚠️ Erreur fermeture stream:', closeError)
            }
          }

          console.log('\n' + '═'.repeat(70))
          console.log('[CHAT] ✨ REQUÊTE COMPLÉTÉE')
          console.log('═'.repeat(70) + '\n')

        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Erreur inconnue'
          console.error('[CHAT] 💥 Erreur streaming:', msg)

          if (timeoutId) clearTimeout(timeoutId)

          if (!streamClosed) {
            try {
              const errMessage: ReponseStream = {
                erreur: msg,
                done: true
              }

              streamController.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify(errMessage)}\n\n`
                )
              )

              streamController.close()
              streamClosed = true

            } catch (handleError) {
              console.warn('[CHAT] ⚠️ Erreur gestion erreur:', handleError)
            }
          }
        }
      }
    })

    console.log('[CHAT] 📤 Retour réponse streaming')

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    const stack = error instanceof Error ? error.stack : ''

    console.error('[CHAT] 💥 ERREUR POST:')
    console.error('[CHAT]', msg)
    console.error('[CHAT]', stack)

    return NextResponse.json(
      {
        erreur: 'Erreur serveur',
        details: msg
      },
      { status: 500 }
    )
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

// ============================================================
// ENDPOINT GET /api/chat (Health Check)
// ============================================================

/**
 * Endpoint de santé — retourne l'état des services
 */
export async function GET() {
  try {
    return NextResponse.json(
      {
        status: 'healthy',
        service: 'ARIA Chat API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'

    return NextResponse.json(
      {
        status: 'error',
        erreur: msg
      },
      { status: 500 }
    )
  }
}

// ============================================================
// EXPORTS POUR TESTING
// ============================================================

export const runtime = 'nodejs'
export const maxDuration = 60
