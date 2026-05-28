'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Send, Bot, User, ArrowLeft,
  FileText, Loader2, Zap, Shield, Brain,
  MessageSquare, ChevronRight, Building2,
  LayoutDashboard, FilePlus, FolderOpen,
  Search, Users, ClipboardList, LogOut,
  Menu, X, Lightbulb, Clock, Plus, ExternalLink
} from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

interface Source {
  id: string
  intitule: string
  type_document: string | null
  score: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: Source[]
}

// ============================================================
// CONSTANTES
// ============================================================

const SUGGESTIONS = [
  "Quels sont les documents confidentiels récents ?",
  "Résume les dernières archives ajoutées",
  "Combien de documents par direction ?",
  "Quels types de documents sont les plus fréquents ?",
  "Liste les circulaires disponibles",
]

const MAX_HISTORIQUE = 10

const MESSAGE_BIENVENUE = `Bonjour ! Je suis **ARIA** — Assistante de Recherche et d'Intelligence Administrative de la DGPPE.

Je suis connectée à la base documentaire institutionnelle et je peux vous aider à :

• 🔍 **Rechercher** des documents spécifiques
• 📊 **Analyser** les statistiques documentaires
• 📋 **Résumer** le contenu des archives
• 🗂️ **Naviguer** dans les différentes directions

Que souhaitez-vous savoir ?`

// ============================================================
// PAGE PRINCIPALE
// ============================================================

export default function IAPage() {
  const [user, setUser] = useState<any>(null)
  const [profil, setProfil] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: MESSAGE_BIENVENUE,
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [nombreDocuments, setNombreDocuments] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // ============================================================
  // INITIALISATION
  // ============================================================

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: profilData } = await supabase
        .from('profils')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfil(profilData)

      const { count } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
      setNombreDocuments(count || 0)
    }
    init()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // ============================================================
  // DÉCONNEXION
  // ============================================================

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ============================================================
  // NOUVELLE CONVERSATION
  // ============================================================

  const nouvelleConversation = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: MESSAGE_BIENVENUE,
        timestamp: new Date(),
      }
    ])
    setStreamingContent('')
    setInput('')
  }

  // ============================================================
  // ENVOI MESSAGE + STREAMING
  // ============================================================

  const handleSend = useCallback(async (text?: string) => {
    const question = text || input.trim()
    if (!question || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date()
    }

    const nouveauxMessages = [...messages, userMsg]
    setMessages(nouveauxMessages)
    setInput('')
    setLoading(true)
    setStreamingContent('')

    try {
      const messagesToSend = nouveauxMessages
        .slice(-MAX_HISTORIQUE)
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesToSend })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erreur API : ${response.status} — ${errorText}`)
      }

      if (!response.body) {
        throw new Error('Pas de stream disponible')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let contenuAccumule = ''
      let sourcesFinales: Source[] = []
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lignes = buffer.split('\n')
        buffer = lignes.pop() || ''

        for (const ligne of lignes) {
          const trimmed = ligne.trim()
          if (!trimmed || trimmed === '[DONE]') continue

          let data = trimmed
          if (trimmed.startsWith('data: ')) {
            data = trimmed.slice(6).trim()
          }
          if (!data || data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)

            if (typeof parsed.token === 'string') {
              contenuAccumule += parsed.token
              setStreamingContent(contenuAccumule)
            } else if (typeof parsed.response === 'string') {
              contenuAccumule += parsed.response
              setStreamingContent(contenuAccumule)
            }

            if (Array.isArray(parsed.sources)) {
              sourcesFinales = parsed.sources
            }

            if (parsed.erreur) {
              throw new Error(parsed.erreur)
            }

          } catch {
            // texte brut non-JSON
            if (data && data !== '[DONE]') {
              contenuAccumule += data
              setStreamingContent(contenuAccumule)
            }
          }
        }
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: contenuAccumule || "Je n'ai pas pu générer de réponse.",
        timestamp: new Date(),
        sources: sourcesFinales.length > 0 ? sourcesFinales : undefined
      }

      setMessages(prev => [...prev, assistantMsg])
      setStreamingContent('')

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue'

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ Une erreur s'est produite : ${message}\n\nVeuillez réessayer ou contacter l'administrateur.`,
        timestamp: new Date()
      }])
      setStreamingContent('')
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ============================================================
  // UTILITAIRES
  // ============================================================

  const userInitial = (profil?.prenom || user?.email)?.charAt(0).toUpperCase() || 'U'
  const displayName = profil?.prenom && profil?.nom
    ? `${profil.prenom} ${profil.nom}` : user?.email

  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      return (
        <p
          key={i}
          className={`${line === '' ? 'mt-2' : ''} leading-relaxed`}
          dangerouslySetInnerHTML={{ __html: bold }}
        />
      )
    })
  }

  const ouvrirDocument = (documentId: string) => {
    router.push(`/dashboard/documents/${documentId}`)
  }

  // ============================================================
  // NAVIGATION SIDEBAR
  // ============================================================

  const navItems = [
    { href: '/dashboard',                   icon: LayoutDashboard, label: 'Tableau de bord' },
    { href: '/dashboard/documents/add',     icon: FilePlus,        label: 'Ajouter un document' },
    { href: '/dashboard/documents/view',    icon: FolderOpen,      label: 'Documents' },
    { href: '/dashboard/search',            icon: Search,          label: 'Rechercher' },
    { href: '/dashboard/users',             icon: Users,           label: 'Utilisateurs' },
    { href: '/dashboard/logs',              icon: ClipboardList,   label: "Journaux d'activité" },
    { href: '/dashboard/ia',                icon: Sparkles,        label: 'ARIA — IA Interne', active: true },
  ]

  // ============================================================
  // RENDU
  // ============================================================

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">

      {/* ── SIDEBAR ──────────────────────────────────────── */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 ease-in-out bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col shadow-2xl relative z-10`}>
        <div className="flex items-center gap-3 p-6 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">DGPPE</h1>
              <p className="text-slate-400 text-xs">Archivage numérique</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-slate-400 hover:text-white transition-colors"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                item.active
                  ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              {sidebarOpen && item.active && <ChevronRight className="w-4 h-4 ml-auto" />}
            </a>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          {sidebarOpen && (
            <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-xl bg-white/5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {userInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{displayName}</p>
                <p className="text-slate-400 text-xs capitalize">{profil?.role || 'Utilisateur'}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* ── CONTENU PRINCIPAL ────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-md">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-800">ARIA</h2>
                  <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-semibold rounded-full">
                    IA Interne
                  </span>
                </div>
                <p className="text-slate-500 text-xs">
                  Assistante de Recherche et d&apos;Intelligence Administrative · {nombreDocuments} documents indexés
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={nouvelleConversation}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              Nouvelle conversation
            </button>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs text-emerald-700 font-medium">En ligne</span>
            </div>

            <button
              onClick={() => router.push('/dashboard/profile')}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold hover:opacity-90 transition-all shadow-md"
            >
              {userInitial}
            </button>
          </div>
        </header>

        {/* ZONE CHAT */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

            {/* Banner capacités — visible au démarrage */}
            {messages.length === 1 && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  {
                    icon: <FileText className="w-5 h-5 text-blue-600" />,
                    title: 'Analyse documentaire',
                    desc: 'Interrogez la base de données en langage naturel'
                  },
                  {
                    icon: <Shield className="w-5 h-5 text-violet-600" />,
                    title: 'Accès sécurisé',
                    // ✅ Corrigé : mention des vrais niveaux de confidentialité
                    desc: 'Données filtrées selon votre rôle (Normal / Confidentiel / Secret)'
                  },
                  {
                    icon: <Zap className="w-5 h-5 text-amber-600" />,
                    title: 'Réponses en streaming',
                    // ✅ Corrigé : plus de mention Ollama
                    desc: 'Génération en temps réel via HuggingFace + Mistral'
                  },
                ].map((cap, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="mb-2">{cap.icon}</div>
                    <p className="text-sm font-semibold text-slate-800">{cap.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{cap.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Liste des messages */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${
                  msg.role === 'assistant'
                    ? 'bg-gradient-to-br from-violet-500 to-blue-600'
                    : 'bg-gradient-to-br from-blue-400 to-purple-500'
                }`}>
                  {msg.role === 'assistant'
                    ? <Brain className="w-4 h-4 text-white" />
                    : <span className="text-white text-xs font-bold">{userInitial}</span>
                  }
                </div>

                {/* Bulle */}
                <div className={`max-w-2xl flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-5 py-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === 'assistant'
                      ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                      : 'bg-gradient-to-br from-blue-600 to-violet-600 text-white rounded-tr-sm'
                  }`}>
                    <div className="space-y-0.5">
                      {formatContent(msg.content)}
                    </div>

                    {/* Sources citées */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400 font-medium mb-2 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Sources référencées ({msg.sources.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((source, i) => (
                            <button
                              key={i}
                              onClick={() => ouvrirDocument(source.id)}
                              className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs text-blue-700 transition-all group"
                              title={`Score de pertinence : ${Math.round(source.score * 100)}%`}
                            >
                              <FileText className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate max-w-[180px]">{source.intitule}</span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 px-1">
                    <Clock className="w-3 h-3 text-slate-300" />
                    <span className="text-xs text-slate-400">
                      {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Message en cours de streaming */}
            {loading && streamingContent && (
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
                  <div className="text-sm text-slate-800 space-y-0.5">
                    {formatContent(streamingContent)}
                  </div>
                  <span className="inline-block w-1.5 h-4 bg-violet-500 animate-pulse ml-0.5 rounded-sm" />
                </div>
              </div>
            )}

            {/* Indicateur chargement initial */}
            {loading && !streamingContent && (
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                    <span className="text-sm">ARIA réfléchit...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 2 && !loading && (
            <div className="px-6 pb-2">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs text-slate-400 font-medium">Suggestions</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* INPUT */}
          <div className="bg-white border-t border-slate-200 px-6 py-4">
            <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
              <MessageSquare className="w-5 h-5 text-slate-400 flex-shrink-0 mb-0.5" />
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question sur les archives DGPPE..."
                rows={1}
                disabled={loading}
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none resize-none leading-relaxed disabled:opacity-50"
                style={{ minHeight: '24px', maxHeight: '120px' }}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md hover:scale-105 transition-all flex-shrink-0"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />
                }
              </button>
            </div>
            <p className="text-center text-xs text-slate-400 mt-2">
              ARIA · Données confidentielles — Accès restreint aux agents autorisés de la DGPPE
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
