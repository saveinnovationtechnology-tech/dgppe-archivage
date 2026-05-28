'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Brain, Database, CheckCircle2, AlertCircle, Loader2,
  RefreshCw, FileText, Building2, LayoutDashboard, FilePlus,
  FolderOpen, Search, Users, ClipboardList, LogOut,
  Menu, X, ChevronRight, Play, BarChart3, Zap, TrendingUp
} from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

interface StatutIndexation {
  totalChunks: number
  totalDocuments: number
  documentsIndexes: number
  documentsNonIndexes: number
  tauxIndexation?: number
  derniereSync?: string
}

interface LogEntry {
  id: string
  timestamp: Date
  message: string
  type: 'info' | 'succes' | 'erreur' | 'progression' | 'avertissement'
}

interface ResultatFinal {
  documentsTraites: number
  documentsEchoues: number
  chunksCreees: number
  embeddingsGeneres: number
  duree: number
  tempsDebut: string
  tempsFin: string
  erreurs: string[]
}

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
  actif?: boolean
}

// ============================================================
// PAGE ADMINISTRATION IA
// ============================================================

export default function AdminIAPage() {
  // ============================================================
  // STATE
  // ============================================================

  const [user, setUser] = useState<any>(null)
  const [profil, setProfil] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [statut, setStatut] = useState<StatutIndexation | null>(null)
  const [chargementStatut, setChargementStatut] = useState(true)
  const [indexationEnCours, setIndexationEnCours] = useState(false)
  const [pourcentage, setPourcentage] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [resultatFinal, setResultatFinal] = useState<ResultatFinal | null>(null)
  const [erreurAcces, setErreurAcces] = useState(false)

  const logsEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // ============================================================
  // INITIALISATION
  // ============================================================

  useEffect(() => {
    const init = async () => {
      try {
        // Vérifier authentification
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        setUser(user)

        // Charger profil utilisateur
        const { data: profilData, error: profilError } = await supabase
          .from('profils')
          .select('id, prenom, nom, email, role, direction, created_at')
          .eq('id', user.id)
          .single()

        if (profilError) {
          console.error('[ADMIN IA] Erreur chargement profil:', profilError.message)
          setErreurAcces(true)
          return
        }

        setProfil(profilData)

        // Vérifier droits admin
        if (profilData?.role !== 'administrateur') {
          console.warn('[ADMIN IA] Accès refusé — rôle insuffisant:', profilData?.role)
          setErreurAcces(true)
          return
        }

        // Charger statistiques
        await chargerStatut()

      } catch (error) {
        console.error('[ADMIN IA] Erreur initialisation:', error)
        setErreurAcces(true)
      }
    }

    init()
  }, [router, supabase])

  // Auto-scroll des logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // ============================================================
  // CHARGER STATISTIQUES
  // ============================================================

  const chargerStatut = useCallback(async () => {
    setChargementStatut(true)
    try {
      console.log('[ADMIN IA] 🔄 Chargement statistiques...')

      const response = await fetch('/api/indexer', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.erreur) {
        console.error('[ADMIN IA] ❌ Erreur API:', data.erreur)
        return
      }

      // Calculer taux indexation
      const tauxIndexation = data.totalDocuments > 0
        ? Math.round((data.documentsIndexes / data.totalDocuments) * 100)
        : 0

      setStatut({
        ...data,
        tauxIndexation,
        derniereSync: new Date().toISOString()
      })

      console.log('[ADMIN IA] ✅ Statistiques chargées:', data)

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue'
      console.error('[ADMIN IA] Erreur chargement statut:', msg)
    } finally {
      setChargementStatut(false)
    }
  }, [])

  // ============================================================
  // GESTION DES LOGS
  // ============================================================

  const ajouterLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const log: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      message,
      type
    }

    setLogs(prev => [...prev, log])

    // Log dans la console
    const prefixes = {
      'succes': '✅',
      'erreur': '❌',
      'progression': '📄',
      'avertissement': '⚠️',
      'info': 'ℹ️'
    }

    console.log(`[ADMIN IA] ${prefixes[type]} ${message}`)
  }, [])

  // ============================================================
  // LANCER L'INDEXATION (SSE)
  // ============================================================

  const lancerIndexation = useCallback(async () => {
    setIndexationEnCours(true)
    setLogs([])
    setResultatFinal(null)
    setPourcentage(0)
    setStatusMessage('Initialisation...')

    ajouterLog('🚀 Lancement de l\'indexation globale des documents...', 'info')

    try {
      console.log('[ADMIN IA] 📤 POST /api/indexer avec action=indexer_tout')

      const response = await fetch('/api/indexer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'indexer_tout' })
      })

      if (!response.ok) {
        const err = await response.json()
        const message = err.erreur || err.message || response.statusText
        ajouterLog(`❌ Erreur serveur (${response.status}): ${message}`, 'erreur')
        console.error('[ADMIN IA] Erreur réponse:', err)
        return
      }

      if (!response.body) {
        ajouterLog('❌ Pas de body dans la réponse', 'erreur')
        return
      }

      // Lire le stream SSE
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      ajouterLog('🔄 Connexion au stream d\'indexation...', 'info')

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          console.log('[ADMIN IA] 📭 Stream terminé')
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lignes = buffer.split('\n')
        buffer = lignes.pop() || ''

        for (const ligne of lignes) {
          if (!ligne.trim()) continue
          if (!ligne.startsWith('data: ')) continue

          const jsonStr = ligne.slice(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') continue

          try {
            const data = JSON.parse(jsonStr)

            // Mise à jour progression
            if (data.pourcentage !== undefined) {
              setPourcentage(Math.min(100, data.pourcentage))
            }

            // Mise à jour statut
            if (data.status) {
              setStatusMessage(data.status)

              const type: LogEntry['type'] =
                data.status.includes('✅') ? 'succes' :
                data.status.includes('❌') ? 'erreur' :
                data.status.includes('⚠️') ? 'avertissement' :
                data.status.includes('📄') ? 'progression' : 'info'

              ajouterLog(data.status, type)
            }

            // Résultat final
            if (data.resultat) {
              setResultatFinal(data.resultat)

              // Afficher les erreurs
              if (data.resultat.erreurs && Array.isArray(data.resultat.erreurs)) {
                data.resultat.erreurs.forEach((e: string) => {
                  ajouterLog(`⚠️ ${e}`, 'avertissement')
                })
              }
            }

          } catch (parseError) {
            console.warn('[ADMIN IA] ⚠️ Erreur parsing JSON:', parseError)
          }
        }
      }

      ajouterLog('✅ Indexation terminée avec succès', 'succes')

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue'
      ajouterLog(`❌ Erreur critique: ${msg}`, 'erreur')
      console.error('[ADMIN IA] Erreur lancerIndexation:', error)

    } finally {
      setIndexationEnCours(false)
      setPourcentage(100)
      setStatusMessage('Terminé')

      // Recharger statistiques
      setTimeout(() => {
        chargerStatut()
      }, 1000)
    }
  }, [ajouterLog, chargerStatut])

  // ============================================================
  // NAVIGATION SIDEBAR
  // ============================================================

  const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: 'Tableau de bord', href: '/dashboard' },
    { icon: FilePlus, label: 'Nouveau document', href: '/dashboard/documents/add' },
    { icon: FolderOpen, label: 'Mes documents', href: '/dashboard/documents/view' },
    { icon: Search, label: 'Recherche', href: '/dashboard/search' },
    { icon: Brain, label: 'Assistant IA', href: '/dashboard/ia' },
    { icon: Users, label: 'Utilisateurs', href: '/dashboard/users' },
    { icon: ClipboardList, label: 'Administration IA', href: '/dashboard/admin/ia', actif: true },
  ]

  const handleDeconnexion = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }, [supabase, router])

  // ============================================================
  // RENDU — ÉTAT DE CHARGEMENT
  // ============================================================

  if (chargementStatut && !profil) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-600 font-medium">Chargement de l\'administration...</p>
        </div>
      </div>
    )
  }

  // ============================================================
  // RENDU — ACCÈS REFUSÉ
  // ============================================================

  if (erreurAcces || (profil && profil.role !== 'administrateur')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md shadow-lg">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Accès refusé</h1>
          <p className="text-slate-600 mb-6">
            Vous n\'avez pas les permissions nécessaires pour accéder à cette page.
            Seuls les administrateurs peuvent gérer l\'indexation IA.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    )
  }

  if (!profil) {
    return null
  }

  // ============================================================
  // RENDU — PAGE PRINCIPALE
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* ── SIDEBAR ────────────────────────────────────────────── */}
      <aside className={`${
        sidebarOpen ? 'w-64' : 'w-16'
      } bg-gradient-to-b from-slate-900 to-slate-950 text-white flex flex-col transition-all duration-300 flex-shrink-0 fixed h-screen left-0 top-0 border-r border-slate-800`}>

        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-slate-700">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity"
          >
            {sidebarOpen ? (
              <>
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white">ARIA</span>
              </>
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mx-auto shadow-lg">
                <Zap className="w-4 h-4 text-white" />
              </div>
            )}
          </button>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400 hover:text-white ml-auto transition-colors p-1"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left text-sm font-medium ${
                  item.actif
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Profil + déconnexion */}
        {sidebarOpen && profil && (
          <div className="p-4 border-t border-slate-700 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                <span className="text-sm font-bold text-white">
                  {profil.prenom?.[0]}{profil.nom?.[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {profil.prenom} {profil.nom}
                </p>
                <p className="text-xs text-slate-400 truncate capitalize">{profil.role}</p>
              </div>
            </div>
            <button
              onClick={handleDeconnexion}
              className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        )}
      </aside>

      {/* ── CONTENU PRINCIPAL ──────────────────────────────────── */}
      <div className={`flex-1 flex flex-col ${sidebarOpen ? 'ml-64' : 'ml-16'} transition-all duration-300`}>

        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 sticky top-0 z-10 shadow-sm">
          <nav className="flex items-center gap-2 text-sm text-slate-500">
            <span>Administration</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-800 font-semibold">Gestion IA & Indexation</span>
          </nav>
        </header>

        {/* Contenu scrollable */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* ── STATISTIQUES ────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: 'Documents actifs',
                  value: chargementStatut ? '...' : statut?.totalDocuments ?? 0,
                  icon: FileText,
                  couleur: 'blue',
                  subtext: statut ? `${statut.documentsIndexes} indexés` : ''
                },
                {
                  label: 'Taux d\'indexation',
                  value: chargementStatut ? '...' : `${statut?.tauxIndexation ?? 0}%`,
                  icon: TrendingUp,
                  couleur: 'emerald',
                  subtext: `${statut?.documentsIndexes ?? 0} / ${statut?.totalDocuments ?? 0}`
                },
                {
                  label: 'Documents non indexés',
                  value: chargementStatut ? '...' : statut?.documentsNonIndexes ?? 0,
                  icon: AlertCircle,
                  couleur: statut?.documentsNonIndexes === 0 ? 'emerald' : 'amber',
                  subtext: 'À traiter'
                },
                {
                  label: 'Total chunks',
                  value: chargementStatut ? '...' : statut?.totalChunks ?? 0,
                  icon: Database,
                  couleur: 'violet',
                  subtext: 'Vecteurs stockés'
                },
              ].map((stat, i) => {
                const Icon = stat.icon
                const bgColor = {
                  'blue': 'from-blue-50 to-blue-100/50',
                  'emerald': 'from-emerald-50 to-emerald-100/50',
                  'amber': 'from-amber-50 to-amber-100/50',
                  'violet': 'from-violet-50 to-violet-100/50'
                }[stat.couleur]

                const iconColor = {
                  'blue': 'text-blue-600',
                  'emerald': 'text-emerald-600',
                  'amber': 'text-amber-600',
                  'violet': 'text-violet-600'
                }[stat.couleur]

                return (
                  <div
                    key={i}
                    className={`bg-gradient-to-br ${bgColor} border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <Icon className={`w-5 h-5 ${iconColor}`} />
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                    <p className="text-xs text-slate-600 mt-1 font-medium">{stat.label}</p>
                    {stat.subtext && <p className="text-xs text-slate-500 mt-1">{stat.subtext}</p>}
                  </div>
                )
              })}
            </div>

            {/* ── PANNEAU D'INDEXATION ───────────────────────── */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

              {/* En-tête */}
              <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-600" />
                    Indexation des documents
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Génère les embeddings vectoriels pour la recherche sémantique IA
                  </p>
                </div>
                <div className="flex gap-3 flex-shrink-0">
                  <button
                    onClick={() => chargerStatut()}
                    disabled={chargementStatut || indexationEnCours}
                    className="flex items-center gap-2 px-4 py-2 text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                  >
                    <RefreshCw className={`w-4 h-4 ${chargementStatut ? 'animate-spin' : ''}`} />
                    Actualiser
                  </button>
                  <button
                    onClick={lancerIndexation}
                    disabled={indexationEnCours}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {indexationEnCours ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Indexation en cours...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Indexer tous les documents
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Barre de progression */}
              {indexationEnCours && (
                <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-blue-900 font-semibold">{statusMessage}</span>
                    <span className="text-sm text-blue-700 font-bold">{pourcentage}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-blue-500 h-2.5 rounded-full transition-all duration-500 shadow-lg"
                      style={{ width: `${pourcentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Résultat final */}
              {resultatFinal && !indexationEnCours && (
                <div className={`px-6 py-5 border-b ${
                  resultatFinal.documentsEchoues > 0
                    ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
                    : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
                }`}>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-emerald-700">{resultatFinal.documentsTraites}</p>
                      <p className="text-xs text-emerald-600 font-medium mt-1">Documents traités</p>
                    </div>
                    {resultatFinal.documentsEchoues > 0 && (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">{resultatFinal.documentsEchoues}</p>
                        <p className="text-xs text-red-500 font-medium mt-1">Échecs</p>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-700">{resultatFinal.chunksCreees}</p>
                      <p className="text-xs text-blue-600 font-medium mt-1">Chunks créés</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-violet-700">{resultatFinal.embeddingsGeneres}</p>
                      <p className="text-xs text-violet-600 font-medium mt-1">Embeddings</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-700">
                        {Math.round(resultatFinal.duree / 1000)}s
                      </p>
                      <p className="text-xs text-slate-500 font-medium mt-1">Durée totale</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Console de logs */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Journal d&apos;exécution
                  </span>
                  {logs.length > 0 && (
                    <span className="ml-auto text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-full font-medium">
                      {logs.length} événement{logs.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="bg-slate-900 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs space-y-1 border border-slate-700">
                  {logs.length === 0 ? (
                    <p className="text-slate-500 italic py-32 text-center">
                      En attente... Cliquez sur &quot;Indexer tous les documents&quot; pour démarrer.
                    </p>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 text-slate-300 hover:bg-slate-800/50 px-2 py-1 rounded transition-colors">
                        <span className="text-slate-600 flex-shrink-0 w-20">
                          {log.timestamp.toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                        <span className={`flex-1 ${
                          log.type === 'succes'
                            ? 'text-emerald-400 font-semibold'
                            : log.type === 'erreur'
                            ? 'text-red-400 font-semibold'
                            : log.type === 'avertissement'
                            ? 'text-amber-400'
                            : log.type === 'progression'
                            ? 'text-blue-400'
                            : 'text-slate-300'
                        }`}>
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>

            {/* ── INFORMATIONS TECHNIQUES ────────────────────── */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-600" />
                Configuration technique
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  {
                    label: 'Modèle d\'embedding',
                    value: 'nomic-embed-text-v1.5'
                  },
                  {
                    label: 'Provider embedding',
                    value: 'Groq API'
                  },
                  {
                    label: 'Modèle de génération',
                    value: 'llama-3.1-8b-instant'
                  },
                  {
                    label: 'Provider chat',
                    value: 'Groq API'
                  },
                  {
                    label: 'Taille des chunks',
                    value: '500 caractères, chevauchement 50'
                  },
                  {
                    label: 'Base vectorielle',
                    value: 'Supabase + pgvector'
                  },
                  {
                    label: 'Recherche',
                    value: 'Similarité cosinus (RPC SQL)'
                  },
                  {
                    label: 'Indexation auto',
                    value: 'À chaque création de document'
                  },
                ].map((info, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 pb-4 border-b border-slate-100 last:border-0"
                  >
                    <span className="text-slate-500 text-sm font-medium min-w-max">{info.label}:</span>
                    <span className="text-slate-700 text-sm font-semibold">{info.value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
