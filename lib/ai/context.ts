// lib/ai/context.ts
// Récupération du contexte documentaire pour ARIA
// Recherche RAG (Retrieval Augmented Generation) via Supabase + Groq

import { createClient } from '@/lib/supabase/server'
import { DocumentContexte } from './prompt'

// ============================================================
// TYPES
// ============================================================

export interface ResultatRecherche {
  documents: DocumentContexte[]
  totalTrouve: number
  requeteOriginale: string
  tempsRecherche: number
}

export interface OptionsRecherche {
  userRole?: string
  maxDocs?: number
  seuilSimilarite?: number
  filtreType?: string
  filtreDirection?: string
  filtreAnnee?: number
}

// ============================================================
// NIVEAUX DE CONFIDENTIALITÉ (du moins au plus sensible)
// Normal < Confidentiel < Secret
//
// RÔLES ET ACCÈS :
// administrateur    → Normal + Confidentiel + Secret
// gestionnaire      → Normal + Confidentiel
// agent_saisie      → Normal + Confidentiel
// agent_consultation→ Normal uniquement
// ============================================================

function verifierAcces(
  niveauConfidentialite: string,
  userRole: string
): boolean {
  switch (userRole) {
    case 'administrateur':
      return true
    case 'gestionnaire':
      return ['Normal', 'Confidentiel'].includes(niveauConfidentialite)
    case 'agent_saisie':
      return ['Normal', 'Confidentiel'].includes(niveauConfidentialite)
    case 'agent_consultation':
      return niveauConfidentialite === 'Normal'
    default:
      return false
  }
}

function niveauxAutorises(userRole: string): string[] {
  switch (userRole) {
    case 'administrateur':
      return ['Normal', 'Confidentiel', 'Secret']
    case 'gestionnaire':
    case 'agent_saisie':
      return ['Normal', 'Confidentiel']
    case 'agent_consultation':
      return ['Normal']
    default:
      return []
  }
}

// ============================================================
// FONCTION PRINCIPALE — Obtenir le contexte pour ARIA
// ============================================================

export async function obtenirContexteDocuments(
  question: string,
  options: OptionsRecherche = {}
): Promise<ResultatRecherche> {

  const debut = Date.now()

  const {
    userRole = 'agent_consultation',
    maxDocs = parseInt(process.env.ARIA_CONTEXT_DOCS || '5'),
    seuilSimilarite = 0.3,
    filtreType,
    filtreDirection,
    filtreAnnee
  } = options

  try {
    // Étape 1 — Générer l'embedding de la question
    const embedding = await genererEmbedding(question)

    if (!embedding) {
      console.error('[ARIA Context] ❌ Échec génération embedding')
      return resultatVide(question, Date.now() - debut)
    }

    // Étape 2 — Recherche vectorielle dans Supabase
    const documents = await rechercheVectorielle(
      embedding,
      userRole,
      maxDocs,
      seuilSimilarite
    )

    // Étape 3 — Enrichir avec les métadonnées des documents
    const documentsEnrichis = await enrichirDocuments(documents)

    // Étape 4 — Filtrer selon le rôle (sécurité)
    const documentsAutorises = documentsEnrichis.filter(doc =>
      verifierAcces(doc.niveau_confidentialite || 'Normal', userRole)
    )

    // Étape 5 — Appliquer filtres supplémentaires si demandés
    const documentsFiltres = appliquerFiltres(documentsAutorises, {
      filtreType,
      filtreDirection,
      filtreAnnee
    })

    const tempsRecherche = Date.now() - debut

    console.log(`[ARIA Context] ✅ ${documentsFiltres.length} docs trouvés en ${tempsRecherche}ms pour rôle "${userRole}"`)

    return {
      documents: documentsFiltres,
      totalTrouve: documentsFiltres.length,
      requeteOriginale: question,
      tempsRecherche
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[ARIA Context] ❌ Erreur:', msg)
    return resultatVide(question, Date.now() - debut)
  }
}

// ============================================================
// GÉNÉRER UN EMBEDDING VIA GROQ
// ============================================================

export async function genererEmbedding(texte: string): Promise<number[] | null> {
  try {
    if (!texte || texte.trim().length === 0) {
      console.warn('[ARIA Embedding] ⚠️ Texte vide')
      return null
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      throw new Error('GROQ_API_KEY manquante dans les variables d\'environnement')
    }

    console.log('[ARIA Embedding] 🔄 Génération embedding via Groq...')

    // Tronquer à 8000 tokens max (limite Groq)
    const texteTronque = texte.slice(0, 8000)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(
        'https://api.groq.com/openai/v1/embeddings',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'nomic-embed-text-v1.5',
            input: texteTronque,
          }),
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        const erreur = await response.text()
        throw new Error(`Groq ${response.status}: ${erreur}`)
      }

      const data = await response.json()

      // Format standard OpenAI: { data: [{ embedding: [...] }] }
      if (data.data && Array.isArray(data.data) && data.data[0]?.embedding) {
        const embedding = data.data[0].embedding
        if (Array.isArray(embedding) && embedding.length > 0) {
          console.log(`[ARIA Embedding] ✅ Embedding généré : ${embedding.length} dimensions`)
          return embedding as number[]
        }
      }

      console.warn('[ARIA Embedding] ⚠️ Format embedding inattendu:', JSON.stringify(data).slice(0, 100))
      return null

    } finally {
      clearTimeout(timeoutId)
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[ARIA Embedding] ❌ Erreur génération embedding:', msg)
    return null
  }
}

// ============================================================
// RECHERCHE VECTORIELLE DANS SUPABASE
// ============================================================

async function rechercheVectorielle(
  embedding: number[],
  userRole: string,
  maxDocs: number,
  seuilSimilarite: number
): Promise<DocumentContexte[]> {

  const supabase = await createClient()

  console.log(`[ARIA Vectorielle] 🔍 Recherche parmi les embeddings (${maxDocs} docs max)...`)

  try {
    const { data, error } = await supabase.rpc('recherche_documents', {
      query_embedding: embedding,
      match_count: maxDocs,
      user_role: userRole
    })

    if (error) {
      console.error('[ARIA Vectorielle] ❌ Erreur RPC:', error.message)
      return []
    }

    if (!data || data.length === 0) {
      console.warn('[ARIA Vectorielle] ⚠️ Aucun document trouvé')
      return []
    }

    console.log(`[ARIA Vectorielle] ✅ ${data.length} résultats bruts`)

    return data
      .filter((doc: any) => doc.similarite >= seuilSimilarite)
      .map((doc: any): DocumentContexte => ({
        document_id: doc.document_id,
        contenu: doc.contenu,
        similarite: doc.similarite
      }))

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[ARIA Vectorielle] ❌ Exception:', msg)
    return []
  }
}

// ============================================================
// ENRICHIR LES DOCUMENTS AVEC LEURS MÉTADONNÉES
// ============================================================

async function enrichirDocuments(
  documents: DocumentContexte[]
): Promise<DocumentContexte[]> {

  if (documents.length === 0) return []

  const supabase = await createClient()
  const ids = documents.map(d => d.document_id)

  console.log(`[ARIA Enrichir] 📋 Récupération métadonnées pour ${ids.length} docs...`)

  try {
    const { data, error } = await supabase
      .from('documents')
      .select('id, intitule, type_document, niveau_confidentialite, created_at, direction_origine')
      .in('id', ids)

    if (error) {
      console.error('[ARIA Enrichir] ❌ Erreur métadonnées:', error.message)
      return documents
    }

    if (!data) {
      console.warn('[ARIA Enrichir] ⚠️ Aucune métadonnée trouvée')
      return documents
    }

    console.log(`[ARIA Enrichir] ✅ ${data.length} métadonnées récupérées`)

    return documents.map(doc => {
      const meta = data.find(d => d.id === doc.document_id)
      return {
        ...doc,
        intitule: meta?.intitule || 'Document sans titre',
        type_document: meta?.type_document || 'Autre',
        niveau_confidentialite: meta?.niveau_confidentialite || 'Normal',
        direction_origine: meta?.direction_origine || '',
        created_at: meta?.created_at || '',
      }
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[ARIA Enrichir] ❌ Exception:', msg)
    return documents
  }
}

// ============================================================
// APPLIQUER DES FILTRES SUPPLÉMENTAIRES
// ============================================================

function appliquerFiltres(
  documents: DocumentContexte[],
  filtres: {
    filtreType?: string
    filtreDirection?: string
    filtreAnnee?: number
  }
): DocumentContexte[] {

  let result = [...documents]

  if (filtres.filtreType) {
    result = result.filter(d =>
      d.type_document?.toLowerCase() === filtres.filtreType!.toLowerCase()
    )
    console.log(`[ARIA Filtres] 🏷️ Filtre type: ${result.length} docs restants`)
  }

  if (filtres.filtreDirection) {
    result = result.filter(d =>
      d.direction_origine?.toLowerCase() === filtres.filtreDirection!.toLowerCase()
    )
    console.log(`[ARIA Filtres] 🏢 Filtre direction: ${result.length} docs restants`)
  }

  if (filtres.filtreAnnee) {
    result = result.filter(d => {
      if (!d.created_at) return false
      return new Date(d.created_at).getFullYear() === filtres.filtreAnnee
    })
    console.log(`[ARIA Filtres] 📅 Filtre année: ${result.length} docs restants`)
  }

  return result
}

// ============================================================
// RECHERCHE TEXTUELLE CLASSIQUE (fallback si embedding échoue)
// ============================================================

export async function rechercheTextuelle(
  question: string,
  userRole: string = 'agent_consultation',
  maxDocs: number = 5
): Promise<DocumentContexte[]> {

  const supabase = await createClient()
  const motsCles = extraireMotsCles(question)

  if (motsCles.length === 0) {
    console.warn('[ARIA TextSearch] ⚠️ Aucun mot-clé extrait')
    return []
  }

  const termeRecherche = motsCles.join(' | ')
  const niveaux = niveauxAutorises(userRole)

  if (niveaux.length === 0) {
    console.warn('[ARIA TextSearch] ⚠️ Rôle non autorisé')
    return []
  }

  console.log(`[ARIA TextSearch] 🔎 Recherche textuelle: "${termeRecherche}"`)

  try {
    const { data, error } = await supabase
      .from('documents')
      .select('id, intitule, type_document, niveau_confidentialite, created_at, direction_origine')
      .textSearch('intitule', termeRecherche, {
        type: 'websearch',
        config: 'french'
      })
      .in('niveau_confidentialite', niveaux)
      .limit(maxDocs)

    if (error) {
      console.error('[ARIA TextSearch] ❌ Erreur:', error.message)
      return []
    }

    if (!data || data.length === 0) {
      console.warn('[ARIA TextSearch] ⚠️ Aucun résultat textuel')
      return []
    }

    console.log(`[ARIA TextSearch] ✅ ${data.length} résultats trouvés`)

    return data.map((doc: any): DocumentContexte => ({
      document_id: doc.id,
      contenu: `Document: ${doc.intitule}`,
      similarite: 0.5,
      intitule: doc.intitule,
      type_document: doc.type_document,
      niveau_confidentialite: doc.niveau_confidentialite,
      direction_origine: doc.direction_origine,
      created_at: doc.created_at
    }))

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[ARIA TextSearch] ❌ Exception:', msg)
    return []
  }
}

// ============================================================
// RECHERCHE HYBRIDE (vectorielle + textuelle combinées)
// ============================================================

export async function rechercheHybride(
  question: string,
  options: OptionsRecherche = {}
): Promise<ResultatRecherche> {

  const debut = Date.now()

  console.log(`[ARIA Hybride] 🚀 Recherche hybride lancée...`)

  try {
    const [resultVectoriel, resultTextuel] = await Promise.allSettled([
      obtenirContexteDocuments(question, options),
      rechercheTextuelle(question, options.userRole, 3)
    ])

    let documents: DocumentContexte[] = []

    if (resultVectoriel.status === 'fulfilled') {
      console.log(`[ARIA Hybride] ✅ Résultat vectoriel: ${resultVectoriel.value.documents.length} docs`)
      documents = [...resultVectoriel.value.documents]
    } else {
      console.warn('[ARIA Hybride] ⚠️ Recherche vectorielle échouée')
    }

    if (resultTextuel.status === 'fulfilled') {
      console.log(`[ARIA Hybride] ✅ Résultat textuel: ${resultTextuel.value.length} docs`)
      const idsExistants = new Set(documents.map(d => d.document_id))
      const nouveaux = resultTextuel.value.filter(d => !idsExistants.has(d.document_id))
      documents = [...documents, ...nouveaux]
      console.log(`[ARIA Hybride] 🔀 Après fusion: ${documents.length} docs uniques`)
    } else {
      console.warn('[ARIA Hybride] ⚠️ Recherche textuelle échouée')
    }

    // Trier par similarité (décroissante)
    documents.sort((a, b) => b.similarite - a.similarite)

    const maxDocs = options.maxDocs || 5
    documents = documents.slice(0, maxDocs)

    const tempsRecherche = Date.now() - debut
    console.log(`[ARIA Hybride] 🎉 Résultat final: ${documents.length} docs en ${tempsRecherche}ms`)

    return {
      documents,
      totalTrouve: documents.length,
      requeteOriginale: question,
      tempsRecherche
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[ARIA Hybride] ❌ Erreur:', msg)
    return resultatVide(question, Date.now() - debut)
  }
}

// ============================================================
// RÉCUPÉRER UN DOCUMENT COMPLET PAR ID
// ============================================================

export async function obtenirDocumentComplet(
  documentId: string,
  userRole: string = 'agent_consultation'
): Promise<DocumentContexte | null> {

  console.log(`[ARIA DocComplet] 📖 Récupération du document: ${documentId}`)

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('documents')
      .select('id, intitule, type_document, niveau_confidentialite, created_at, direction_origine, observations')
      .eq('id', documentId)
      .single()

    if (error) {
      console.error('[ARIA DocComplet] ❌ Erreur:', error.message)
      return null
    }

    if (!data) {
      console.warn('[ARIA DocComplet] ⚠️ Document introuvable')
      return null
    }

    if (!verifierAcces(data.niveau_confidentialite, userRole)) {
      console.warn(`[ARIA DocComplet] 🔒 Accès refusé — rôle: ${userRole}, niveau: ${data.niveau_confidentialite}`)
      return null
    }

    console.log(`[ARIA DocComplet] ✅ Document trouvé et autorisé`)

    return {
      document_id: data.id,
      contenu: data.observations || '',
      similarite: 1.0,
      intitule: data.intitule,
      type_document: data.type_document,
      niveau_confidentialite: data.niveau_confidentialite,
      direction_origine: data.direction_origine,
      created_at: data.created_at
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[ARIA DocComplet] ❌ Exception:', msg)
    return null
  }
}

// ============================================================
// RÉCUPÉRER LES DOCUMENTS RÉCENTS
// ============================================================

export async function obtenirDocumentsRecents(
  userRole: string = 'agent_consultation',
  limite: number = 5
): Promise<DocumentContexte[]> {

  console.log(`[ARIA Récents] 📅 Récupération des ${limite} docs récents pour rôle: ${userRole}`)

  const supabase = await createClient()
  const niveaux = niveauxAutorises(userRole)

  if (niveaux.length === 0) {
    console.warn('[ARIA Récents] ⚠️ Rôle non autorisé')
    return []
  }

  try {
    const { data, error } = await supabase
      .from('documents')
      .select('id, intitule, type_document, niveau_confidentialite, created_at, direction_origine')
      .in('niveau_confidentialite', niveaux)
      .order('created_at', { ascending: false })
      .limit(limite)

    if (error) {
      console.error('[ARIA Récents] ❌ Erreur:', error.message)
      return []
    }

    if (!data || data.length === 0) {
      console.warn('[ARIA Récents] ⚠️ Aucun document récent')
      return []
    }

    console.log(`[ARIA Récents] ✅ ${data.length} docs récents trouvés`)

    return data.map((doc: any): DocumentContexte => ({
      document_id: doc.id,
      contenu: '',
      similarite: 1.0,
      intitule: doc.intitule,
      type_document: doc.type_document,
      niveau_confidentialite: doc.niveau_confidentialite,
      direction_origine: doc.direction_origine,
      created_at: doc.created_at
    }))

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[ARIA Récents] ❌ Exception:', msg)
    return []
  }
}

// ============================================================
// UTILITAIRES INTERNES
// ============================================================

function extraireMotsCles(texte: string): string[] {
  const motsVides = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou',
    'est', 'sont', 'avec', 'pour', 'dans', 'sur', 'par', 'que', 'qui',
    'quoi', 'comment', 'quand', 'où', 'quel', 'quelle', 'quels', 'quelles',
    'me', 'te', 'se', 'nous', 'vous', 'je', 'tu', 'il', 'elle', 'on',
    'ce', 'cette', 'ces', 'mon', 'ton', 'son', 'ma', 'ta', 'sa',
    'avoir', 'être', 'faire', 'dire', 'aller', 'voir', 'vouloir', 'pouvoir',
    'à', 'au', 'aux', 'en', 'y', 'dont', 'donc', 'car', 'mais', 'si',
    'tous', 'tout', 'toute', 'toutes', 'plus', 'bien', 'très', 'pas', 'ne'
  ])

  return texte
    .toLowerCase()
    .replace(/[^a-zàâäéèêëîïôùûüç\s]/g, ' ')
    .split(/\s+/)
    .filter(mot => mot.length > 2 && !motsVides.has(mot))
    .slice(0, 10)
}

function resultatVide(question: string, temps: number): ResultatRecherche {
  return {
    documents: [],
    totalTrouve: 0,
    requeteOriginale: question,
    tempsRecherche: temps
  }
}

// ============================================================
// STATISTIQUES POUR LE DASHBOARD ADMIN
// ============================================================

export async function obtenirStatsIndexation(): Promise<{
  totalDocuments: number
  documentsIndexes: number
  documentsNonIndexes: number
  derniereMiseAJour: string | null
  tauxIndexation: number
}> {

  console.log('[ARIA Stats] 📊 Calcul des statistiques d\'indexation...')

  const supabase = await createClient()

  try {
    const [countDocs, countEmbeddings] = await Promise.all([
      supabase.from('documents').select('*', { count: 'exact', head: true }),
      supabase.from('document_embeddings').select('*', { count: 'exact', head: true })
    ])

    const totalDocs = countDocs.count || 0
    const totalEmbeddings = countEmbeddings.count || 0

    // Récupérer la dernière mise à jour
    const { data: dernierChunk } = await supabase
      .from('document_embeddings')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Récupérer les IDs uniques des documents avec embeddings
    const { data: docsIndexes } = await supabase
      .from('document_embeddings')
      .select('document_id')

    const idsUniques = new Set(docsIndexes?.map(d => d.document_id) || [])
    const documentsIndexes = idsUniques.size
    const documentsNonIndexes = totalDocs - documentsIndexes
    const tauxIndexation = totalDocs > 0 ? Math.round((documentsIndexes / totalDocs) * 100) : 0

    console.log(
      `[ARIA Stats] ✅ ${documentsIndexes}/${totalDocs} docs indexés ` +
      `(${tauxIndexation}%) — ${totalEmbeddings} chunks`
    )

    return {
      totalDocuments: totalDocs,
      documentsIndexes,
      documentsNonIndexes,
      derniereMiseAJour: dernierChunk?.created_at || null,
      tauxIndexation
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[ARIA Stats] ❌ Erreur:', msg)
    return {
      totalDocuments: 0,
      documentsIndexes: 0,
      documentsNonIndexes: 0,
      derniereMiseAJour: null,
      tauxIndexation: 0
    }
  }
}
