// app/api/indexer/route.ts
// ============================================================
// ENDPOINT D'INDEXATION DES DOCUMENTS
// Support: HuggingFace + Ollama + Streaming
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  indexerTousLesDocuments,
  indexerDocumentParId,
  ProgressionIndexation,
  getProviderInfo,
} from '@/lib/ai/indexer'

// ============================================================
// POST — Lancer l'indexation avec streaming
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // ── Authentification ────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[API] ❌ Authentification échouée:', authError?.message)
      return NextResponse.json(
        { erreur: 'Non authentifié', details: authError?.message },
        { status: 401 }
      )
    }

    console.log(`[API] 👤 Utilisateur: ${user.id}`)

    // ── Vérification du rôle ────────────────────────────────
    const { data: profil, error: profilError } = await supabase
      .from('profils')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profilError || !profil) {
      console.error('[API] ❌ Profil non trouvé:', profilError?.message)
      return NextResponse.json(
        { erreur: 'Profil non trouvé' },
        { status: 404 }
      )
    }

    const rolesAutorises = ['administrateur', 'gestionnaire', 'agent_saisie']
    if (!profil.role || !rolesAutorises.includes(profil.role)) {
      console.warn(`[API] ⚠️ Accès refusé pour rôle: ${profil.role}`)
      return NextResponse.json(
        { erreur: 'Accès non autorisé', rolesAutorises },
        { status: 403 }
      )
    }

    console.log(`[API] ✅ Rôle autorisé: ${profil.role}`)

    // ── Récupérer documentId si présent ─────────────────────
    let documentId: string | undefined
    try {
      const corps = await req.json()
      documentId = corps.documentId?.trim()
      if (documentId) {
        console.log(`[API] 📄 Indexation d'un document: ${documentId}`)
      }
    } catch (jsonError) {
      console.log('[API] 📋 Pas de body JSON (indexation globale)')
    }

    // ── Vérifier permission indexation globale ──────────────
    if (!documentId && profil.role !== 'administrateur') {
      console.warn(`[API] ⚠️ Indexation globale refusée pour: ${profil.role}`)
      return NextResponse.json(
        { erreur: 'Indexation globale réservée aux administrateurs' },
        { status: 403 }
      )
    }

    // ── Créer le stream ────────────────────────────────────
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const provider = getProviderInfo()

        // Fonction d'envoi SSE
        const envoyer = (data: object) => {
          try {
            const json = JSON.stringify(data)
            controller.enqueue(encoder.encode(`data: ${json}\n\n`))
            console.log(`[API] 📤 SSE:`, JSON.stringify(data).slice(0, 100))
          } catch (error) {
            console.error('[API] ❌ Erreur envoi SSE:', error)
            /* stream fermé */
          }
        }

        try {
          // ── Envoyer info provider ───────────────────────────
          envoyer({
            status: `🤗 Provider: ${provider.nom} (${provider.dimensionEmbedding} dimensions)`,
            pourcentage: 1,
            provider: provider.nom,
            dimensionEmbedding: provider.dimensionEmbedding,
          })

          if (documentId) {
            // ════════════════════════════════════════════════════
            // INDEXATION D'UN SEUL DOCUMENT
            // ════════════════════════════════════════════════════

            envoyer({
              status: '🔍 Récupération du document...',
              pourcentage: 5,
              type: 'single',
            })

            console.log(`[API] 🔄 Indexation document: ${documentId}`)
            const debut = Date.now()
            const resultat = await indexerDocumentParId(documentId)
            const duree = Date.now() - debut

            if (resultat.succes) {
              const msg = `✅ ${resultat.documentsTraites} document indexé — ${resultat.chunksCreees} chunks en ${(duree / 1000).toFixed(2)}s`
              console.log(`[API] 🎉 ${msg}`)

              envoyer({
                status: msg,
                pourcentage: 100,
                succes: true,
                type: 'single',
                resultat: {
                  documentsTraites: resultat.documentsTraites,
                  chunksCreees: resultat.chunksCreees,
                  dimensionEmbedding: resultat.dimensionEmbedding,
                  duree,
                },
              })
            } else {
              const erreurMsg = resultat.erreurs[0] || 'Erreur inconnue'
              console.error(`[API] ❌ Indexation échouée:`, erreurMsg)

              envoyer({
                status: `❌ Échec : ${erreurMsg}`,
                pourcentage: 100,
                succes: false,
                type: 'single',
                resultat: {
                  erreurs: resultat.erreurs,
                  duree,
                },
              })
            }

          } else {
            // ════════════════════════════════════════════════════
            // INDEXATION GLOBALE (tous les documents)
            // ════════════════════════════════════════════════════

            envoyer({
              status: '📚 Recherche des documents à indexer...',
              pourcentage: 2,
              type: 'batch',
            })

            console.log('[API] 🔄 Indexation globale lancée')
            const debut = Date.now()

            const resultat = await indexerTousLesDocuments(
              (progression: ProgressionIndexation) => {
                envoyer({
                  status: `📄 ${progression.etape}`,
                  documentsTraites: progression.documentsTraites,
                  documentsTotal: progression.documentsTotal,
                  pourcentage: progression.pourcentage,
                  type: 'batch',
                })
              }
            )

            const duree = Date.now() - debut
            const msg = (
              `✅ Indexation terminée — ` +
              `${resultat.documentsTraites} documents, ` +
              `${resultat.chunksCreees} chunks en ${(duree / 1000).toFixed(2)}s`
            )
            console.log(`[API] 🎉 ${msg}`)

            envoyer({
              status: msg,
              pourcentage: 100,
              succes: resultat.succes,
              type: 'batch',
              resultat: {
                documentsTraites: resultat.documentsTraites,
                documentsEchoues: resultat.documentsEchoues,
                chunksCreees: resultat.chunksCreees,
                erreurs: resultat.erreurs,
                dimensionEmbedding: resultat.dimensionEmbedding,
                duree,
              },
            })
          }

        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur inconnue'
          const stack = error instanceof Error ? error.stack : ''

          console.error('[API] ❌ Erreur indexation:', message)
          console.error('[API] Stack:', stack)

          envoyer({
            status: `❌ Erreur : ${message}`,
            erreur: message,
            succes: false,
            pourcentage: 100,
          })
        } finally {
          console.log('[API] ✅ Stream fermé')
          controller.close()
        }
      },
    })

    console.log('[API] 📡 Stream créé, envoi au client')
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      },
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    const stack = error instanceof Error ? error.stack : ''

    console.error('[API] ❌ Erreur globale:', message)
    console.error('[API] Stack:', stack)

    return NextResponse.json(
      {
        erreur: message,
        details: stack,
      },
      { status: 500 }
    )
  }
}

// ============================================================
// GET — Statistiques d'indexation
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    // ── Authentification ────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[API/Stats] ❌ Authentification échouée:', authError?.message)
      return NextResponse.json(
        { erreur: 'Non authentifié' },
        { status: 401 }
      )
    }

    console.log(`[API/Stats] 👤 Utilisateur: ${user.id}`)

    // ── Vérification du rôle ────────────────────────────────
    const { data: profil, error: profilError } = await supabase
      .from('profils')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profilError || !profil) {
      console.error('[API/Stats] ❌ Profil non trouvé:', profilError?.message)
      return NextResponse.json(
        { erreur: 'Profil non trouvé' },
        { status: 404 }
      )
    }

    if (profil.role !== 'administrateur') {
      console.warn(`[API/Stats] ⚠️ Accès refusé pour rôle: ${profil.role}`)
      return NextResponse.json(
        { erreur: 'Accès réservé aux administrateurs' },
        { status: 403 }
      )
    }

    console.log('[API/Stats] ✅ Récupération des statistiques...')

    // ── Compter les chunks ──────────────────────────────────
    const { count: totalChunks, error: chunksError } = await supabase
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true })

    if (chunksError) {
      console.error('[API/Stats] ❌ Erreur comptage chunks:', chunksError.message)
    }

    // ── Compter les documents actifs ────────────────────────
    const { count: totalDocuments, error: docsError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('statut', 'actif')

    if (docsError) {
      console.error('[API/Stats] ❌ Erreur comptage documents:', docsError.message)
    }

    // ── Récupérer les IDs uniques des documents indexés ─────
    const { data: documentsIndexes, error: indexError } = await supabase
      .from('document_embeddings')
      .select('document_id', { head: false })

    if (indexError) {
      console.error('[API/Stats] ❌ Erreur récupération index:', indexError.message)
    }

    const idsUniques = new Set(
      (documentsIndexes || []).map((d: { document_id: string }) => d.document_id)
    )

    const stats = {
      totalChunks: totalChunks || 0,
      totalDocuments: totalDocuments || 0,
      documentsIndexes: idsUniques.size,
      documentsNonIndexes: Math.max(0, (totalDocuments || 0) - idsUniques.size),
      provider: getProviderInfo(),
    }

    console.log('[API/Stats] 📊 Résultat:', stats)

    return NextResponse.json(stats)

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    const stack = error instanceof Error ? error.stack : ''

    console.error('[API/Stats] ❌ Erreur globale:', message)
    console.error('[API/Stats] Stack:', stack)

    return NextResponse.json(
      {
        erreur: message,
        details: stack,
      },
      { status: 500 }
    )
  }
}

// ============================================================
// OPTIONS — CORS (si nécessaire)
// ============================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
