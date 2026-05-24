'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, LayoutDashboard, FilePlus, FolderOpen,
  Search, Users, ClipboardList, LogOut, ChevronRight,
  Menu, Bell, X, RefreshCw, Filter, Eye,
  LogIn, LogOut as LogOutIcon, FileText, Edit2,
  Trash2, Download, UserPlus, UserCheck, UserX,
  Activity, Globe, Calendar, AlertCircle
} from 'lucide-react'

const supabase = createClient()

interface User {
  id: string
  email: string
  nom: string
  prenom: string
}

interface LogEntry {
  id: string
  utilisateur_id: string
  action: string
  document_id: string | null
  details: string | null
  ip_address: string | null
  created_at: string
  profils: User | null
  documents: { id: string; intitule: string } | null
}

interface Stats {
  totalLogs: number
  connexions: number
  consultations: number
  modifications: number
  suppressions: number
}

const ACTIONS = [
  'connexion', 'deconnexion', 'creation_document', 'modification_document',
  'suppression_document', 'consultation_document', 'telechargement_document',
  'creation_utilisateur', 'modification_utilisateur', 'suppression_utilisateur'
]

export default function LogsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userEmail, setUserEmail] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [stats, setStats] = useState<Stats>({
    totalLogs: 0, connexions: 0, consultations: 0, modifications: 0, suppressions: 0
  })
  const [filters, setFilters] = useState({
    search: '', utilisateur_id: '', action: '', dateFrom: '', dateTo: ''
  })

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) { router.push('/login'); return }
        setUser(authUser)
        setUserEmail(authUser.email || '')

        const { data: profil } = await supabase.from('profils').select('role').eq('id', authUser.id).single()
        if (!['administrateur', 'gestionnaire', 'superviseur'].includes(profil?.role)) {
          router.push('/dashboard'); return
        }

        await loadUsers()
        await loadLogs()
      } catch (error) {
        console.error('Erreur:', error)
      }
    }
    init()
  }, [])

  const loadUsers = async () => {
    const { data } = await supabase.from('profils').select('id, email, nom, prenom').eq('actif', true).order('nom')
    setUsers(data || [])
  }

  const loadLogs = async (f: typeof filters = filters) => {
    setLoading(true)
    try {
      let query = supabase.from('logs_activite').select(`
        id, utilisateur_id, action, document_id, details, ip_address, created_at,
        profils(id, email, nom, prenom),
        documents(id, intitule)
      `)

      if (f.utilisateur_id) query = query.eq('utilisateur_id', f.utilisateur_id)
      if (f.action) query = query.eq('action', f.action)
      if (f.dateFrom) query = query.gte('created_at', f.dateFrom)
      if (f.dateTo) {
        const endDate = new Date(f.dateTo)
        endDate.setHours(23, 59, 59, 999)
        query = query.lte('created_at', endDate.toISOString())
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(500)
      if (error) throw error

      let transformed: LogEntry[] = (data || []).map((log: any) => ({
        ...log,
        profils: Array.isArray(log.profils) ? log.profils[0] || null : log.profils,
        documents: Array.isArray(log.documents) ? log.documents[0] || null : log.documents,
      }))

      if (f.search) {
        const s = f.search.toLowerCase()
        transformed = transformed.filter(log =>
          log.details?.toLowerCase().includes(s) ||
          log.profils?.email?.toLowerCase().includes(s) ||
          log.profils?.nom?.toLowerCase().includes(s) ||
          log.profils?.prenom?.toLowerCase().includes(s) ||
          log.documents?.intitule?.toLowerCase().includes(s)
        )
      }

      setLogs(transformed)
      setStats({
        totalLogs: transformed.length,
        connexions: transformed.filter(l => l.action === 'connexion').length,
        consultations: transformed.filter(l => l.action === 'consultation_document').length,
        modifications: transformed.filter(l => l.action.includes('modification')).length,
        suppressions: transformed.filter(l => l.action.includes('suppression')).length,
      })
    } catch (error) {
      console.error('Erreur logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    loadLogs(newFilters)
  }

  const resetFilters = () => {
    const newFilters = { search: '', utilisateur_id: '', action: '', dateFrom: '', dateTo: '' }
    setFilters(newFilters)
    loadLogs(newFilters)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getActionConfig = (action: string) => {
    const config: Record<string, { icon: any; color: string; bg: string; label: string }> = {
      connexion: { icon: LogIn, color: 'text-emerald-700', bg: 'bg-emerald-100 border-emerald-200', label: 'Connexion' },
      deconnexion: { icon: LogOutIcon, color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200', label: 'Déconnexion' },
      creation_document: { icon: FilePlus, color: 'text-blue-700', bg: 'bg-blue-100 border-blue-200', label: 'Création doc.' },
      modification_document: { icon: Edit2, color: 'text-amber-700', bg: 'bg-amber-100 border-amber-200', label: 'Modif. doc.' },
      suppression_document: { icon: Trash2, color: 'text-red-700', bg: 'bg-red-100 border-red-200', label: 'Suppr. doc.' },
      consultation_document: { icon: Eye, color: 'text-cyan-700', bg: 'bg-cyan-100 border-cyan-200', label: 'Consultation' },
      telechargement_document: { icon: Download, color: 'text-violet-700', bg: 'bg-violet-100 border-violet-200', label: 'Téléchargement' },
      creation_utilisateur: { icon: UserPlus, color: 'text-teal-700', bg: 'bg-teal-100 border-teal-200', label: 'Création user' },
      modification_utilisateur: { icon: UserCheck, color: 'text-orange-700', bg: 'bg-orange-100 border-orange-200', label: 'Modif. user' },
      suppression_utilisateur: { icon: UserX, color: 'text-pink-700', bg: 'bg-pink-100 border-pink-200', label: 'Suppr. user' },
    }
    return config[action] || { icon: Activity, color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200', label: action }
  }

  const navItems = [
    { icon: LayoutDashboard, label: 'Tableau de bord', href: '/dashboard' },
    { icon: FilePlus, label: 'Ajouter document', href: '/dashboard/documents/add' },
    { icon: FolderOpen, label: 'Documents', href: '/dashboard/documents/view' },
    { icon: Search, label: 'Recherche', href: '/dashboard/search' },
    { icon: Users, label: 'Utilisateurs', href: '/dashboard/users' },
    { icon: ClipboardList, label: 'Journaux', href: '/dashboard/logs', active: true },
  ]

  const statsCards = [
    { label: 'Total logs', value: stats.totalLogs, icon: Activity, color: 'from-slate-600 to-slate-700' },
    { label: 'Connexions', value: stats.connexions, icon: LogIn, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Consultations', value: stats.consultations, icon: Eye, color: 'from-cyan-500 to-cyan-600' },
    { label: 'Modifications', value: stats.modifications, icon: Edit2, color: 'from-amber-500 to-amber-600' },
    { label: 'Suppressions', value: stats.suppressions, icon: Trash2, color: 'from-red-500 to-red-600' },
  ]

  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-slate-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm">Vérification des droits...</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-gradient-to-b from-slate-800 to-slate-900 flex flex-col overflow-hidden shrink-0`}>
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">GED Ministère</p>
              <p className="text-slate-400 text-xs">Gestion documentaire</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <a key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${item.active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </a>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <div className="px-3 py-2 mb-2">
            <p className="text-slate-400 text-xs truncate">{userEmail}</p>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all">
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>GED</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-800 font-semibold">Journaux d'activité</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Bell className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{userEmail?.[0]?.toUpperCase() || 'U'}</span>
              </div>
              <span className="text-sm font-medium text-slate-700 hidden md:block">{userEmail}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">

          {/* Banner */}
          <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-800 px-8 py-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Journaux d'activité</h1>
            </div>
            <p className="text-teal-200 text-sm ml-[52px]">Suivi complet des actions des utilisateurs</p>
          </div>

          <div className="p-6 space-y-5">

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {statsCards.map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{value}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Filtres */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-slate-500" />
                <h2 className="font-semibold text-slate-800">Filtres</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Recherche</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Nom, email, détails..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Utilisateur</label>
                  <select value={filters.utilisateur_id}
                    onChange={(e) => handleFilterChange('utilisateur_id', e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="">Tous</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Action</label>
                  <select value={filters.action}
                    onChange={(e) => handleFilterChange('action', e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="">Toutes</option>
                    {ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Du</label>
                  <input type="datetime-local" value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="flex flex-col justify-end gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Au</label>
                    <input type="datetime-local" value={filters.dateTo}
                      onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <button onClick={resetFilters}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl text-sm font-medium transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" /> Réinitialiser
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-teal-600" />
                  </div>
                  <h2 className="font-semibold text-slate-800">
                    Historique
                    <span className="ml-2 text-sm font-normal text-slate-400">{logs.length} entrée{logs.length > 1 ? 's' : ''}</span>
                  </h2>
                </div>
                <button onClick={() => loadLogs()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> Actualiser
                </button>
              </div>

              {loading ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-slate-200 border-t-teal-600 rounded-full animate-spin"></div>
                  <p className="text-slate-400 text-sm">Chargement des journaux...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <ClipboardList className="w-7 h-7 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium">Aucun log trouvé</p>
                  <p className="text-slate-400 text-sm">Modifiez vos filtres</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {['Date', 'Utilisateur', 'Action', 'Détails', 'Document', 'IP', ''].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((log) => {
                        const cfg = getActionConfig(log.action)
                        const ActionIcon = cfg.icon
                        return (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {new Date(log.created_at).toLocaleString('fr-FR', {
                                  day: '2-digit', month: '2-digit', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              {log.profils ? (
                                <div>
                                  <p className="text-sm font-medium text-slate-800">{log.profils.prenom} {log.profils.nom}</p>
                                  <p className="text-xs text-slate-400">{log.profils.email}</p>
                                </div>
                              ) : <span className="text-slate-400 text-sm">—</span>}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
                                <ActionIcon className="w-3 h-3" />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-5 py-3 max-w-[200px]">
                              {log.details ? (
                                <span className="text-sm text-slate-600 truncate block" title={log.details}>
                                  {log.details.length > 35 ? log.details.substring(0, 35) + '…' : log.details}
                                </span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-5 py-3 max-w-[160px]">
                              {log.documents ? (
                                <div className="flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                  <span className="text-xs text-blue-600 truncate" title={log.documents.intitule}>
                                    {log.documents.intitule.length > 22 ? log.documents.intitule.substring(0, 22) + '…' : log.documents.intitule}
                                  </span>
                                </div>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-5 py-3">
                              {log.ip_address ? (
                                <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                                  <Globe className="w-3 h-3 text-slate-400" />
                                  {log.ip_address}
                                </div>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-5 py-3">
                              <button onClick={() => setSelectedLog(log)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-xs font-medium transition-colors">
                                <Eye className="w-3 h-3" /> Détails
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modal */}
      {selectedLog && (() => {
        const cfg = getActionConfig(selectedLog.action)
        const ActionIcon = cfg.icon
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-teal-600" />
                  </div>
                  <h3 className="font-bold text-slate-800">Détails du log</h3>
                </div>
                <button onClick={() => setSelectedLog(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Date et heure</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {new Date(selectedLog.created_at).toLocaleString('fr-FR', {
                        weekday: 'long', year: 'numeric', month: 'long',
                        day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Utilisateur</p>
                  {selectedLog.profils ? (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                        <span className="text-white text-sm font-bold">
                          {selectedLog.profils.prenom?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{selectedLog.profils.prenom} {selectedLog.profils.nom}</p>
                        <p className="text-xs text-slate-500">{selectedLog.profils.email}</p>
                      </div>
                    </div>
                  ) : <p className="text-slate-400">Inconnu</p>}
                </div>

                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Action</p>
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold border ${cfg.bg} ${cfg.color}`}>
                    <ActionIcon className="w-4 h-4" />
                    {cfg.label}
                  </span>
                </div>

                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Détails complets</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                    {selectedLog.details || '—'}
                  </p>
                </div>

                {selectedLog.ip_address && (
                  <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Adresse IP</p>
                      <p className="text-sm font-mono font-semibold text-slate-800">{selectedLog.ip_address}</p>
                    </div>
                  </div>
                )}

                {selectedLog.documents && (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-2">Document associé</p>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <Link
                        href={`/dashboard/documents/view?search=${encodeURIComponent(selectedLog.documents.intitule)}`}
                        className="text-sm font-semibold text-blue-700 hover:underline">
                        {selectedLog.documents.intitule}
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-slate-100">
                <button onClick={() => setSelectedLog(null)}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors">
                  <X className="w-4 h-4" /> Fermer
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
