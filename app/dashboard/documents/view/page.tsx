'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { logAction } from '@/lib/supabase/logs'
import { getNonLues, marquerToutesLues, marquerCommeLue } from '@/lib/supabase/notifications'
import {
  Building2, LayoutDashboard, FilePlus, FolderOpen,
  Search, Users, ClipboardList, LogOut, ChevronRight,
  FileText, Download, Eye, Shield, Calendar, Filter,
  X, Menu, Bell, Plus, AlertTriangle, CheckCircle,
  SlidersHorizontal
} from 'lucide-react'

export default function DocumentsPage() {
  const [user, setUser] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [directions, setDirections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showFilters, setShowFilters] = useState(true)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [filters, setFilters] = useState({
    search: '', type: '', direction: '', confidentialite: '',
  })
  const router = useRouter()
  const supabase = createClient()

  const getPdfSrc = (base64: string) => {
    if (!base64) return ''
    return base64.startsWith('data:') ? base64 : `data:application/pdf;base64,${base64}`
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: dirs } = await supabase.from('directions').select('*').order('nom')
      setDirections(dirs || [])
      await fetchDocuments({ search: '', type: '', direction: '', confidentialite: '' })
      const notifs = await getNonLues(user.id)
      setNotifications(notifs)
    }
    init()
  }, [])

  const fetchDocuments = async (f: typeof filters) => {
    setLoading(true)
    let query = supabase.from('documents').select('*').order('created_at', { ascending: false })
    if (f.search) query = query.ilike('intitule', `%${f.search}%`)
    if (f.type) query = query.eq('type_document', f.type)
    if (f.direction) query = query.eq('direction_id', f.direction)
    if (f.confidentialite) query = query.eq('niveau_confidentialite', f.confidentialite)
    const { data } = await query
    setDocuments(data || [])
    setLoading(false)
  }

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    fetchDocuments(newFilters)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleVoirDoc = async (doc: any) => {
    setSelectedDoc(doc)
    await logAction('consultation', `Consultation du document : ${doc.intitule} (${doc.niveau_confidentialite})`, doc.id)
  }

  const handleTelechargement = async (doc: any) => {
    await logAction('telechargement', `Téléchargement du document : ${doc.intitule} (${doc.niveau_confidentialite})`, doc.id)
  }

  const handleMarquerToutesLues = async () => {
    if (!user) return
    setNotifLoading(true)
    await marquerToutesLues(user.id)
    setNotifications([])
    setNotifLoading(false)
  }

  const getDirectionNom = (direction_id: string) => {
    const dir = directions.find(d => d.id === direction_id)
    return dir ? dir.nom : '—'
  }

  const getConfBadge = (niveau: string) => {
    if (niveau === 'Secret') return 'bg-red-100 text-red-700 border border-red-200'
    if (niveau === 'Confidentiel') return 'bg-amber-100 text-amber-700 border border-amber-200'
    if (niveau === 'Interne') return 'bg-blue-100 text-blue-700 border border-blue-200'
    return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  }

  const getConfIcon = (niveau: string) => {
    if (niveau === 'Secret') return <AlertTriangle className="w-3 h-3" />
    if (niveau === 'Confidentiel') return <Shield className="w-3 h-3" />
    return <CheckCircle className="w-3 h-3" />
  }

  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U'

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
    { href: '/dashboard/documents/add', icon: FilePlus, label: 'Ajouter un document' },
    { href: '/dashboard/documents/view', icon: FolderOpen, label: 'Documents', active: true },
    { href: '/dashboard/search', icon: Search, label: 'Rechercher' },
    { href: '/dashboard/users', icon: Users, label: 'Utilisateurs' },
    { href: '/dashboard/logs', icon: ClipboardList, label: "Journaux d'activité" },
  ]

  const resetFilters = () => {
    const empty = { search: '', type: '', direction: '', confidentialite: '' }
    setFilters(empty)
    fetchDocuments(empty)
  }

  const hasActiveFilters = filters.search || filters.type || filters.direction || filters.confidentialite

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">

      {/* SIDEBAR */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col shadow-2xl z-10 flex-shrink-0`}>
        <div className="flex items-center gap-3 p-6 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <h1 className="text-white font-bold text-sm">DGPPE</h1>
              <p className="text-slate-400 text-xs">Archivage numérique</p>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="ml-auto text-slate-400 hover:text-white transition-colors">
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${item.active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
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
                <p className="text-white text-xs font-medium truncate">{user?.email}</p>
                <p className="text-slate-400 text-xs">Administrateur</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200">
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* CONTENU */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Documents</h2>
            <p className="text-slate-500 text-sm">
              {loading ? 'Chargement...' : `${documents.length} document(s) trouvé(s)`}
            </p>
          </div>

          <div className="flex items-center gap-3">

            {/* NOTIFICATIONS */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-20 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                      <h4 className="font-semibold text-slate-800 text-sm">Notifications</h4>
                      {notifications.length > 0 && (
                        <button
                          onClick={handleMarquerToutesLues}
                          disabled={notifLoading}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                        >
                          Tout marquer comme lu
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                          <Bell className="w-8 h-8 mb-2 opacity-40" />
                          <p className="text-sm">Aucune notification</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={async () => {
                              await marquerCommeLue(notif.id)
                              setNotifications(prev => prev.filter(n => n.id !== notif.id))
                            }}
                            className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${
                              notif.type === 'warning' ? 'border-l-4 border-l-amber-400' :
                              notif.type === 'error' ? 'border-l-4 border-l-red-400' :
                              'border-l-4 border-l-blue-400'
                            }`}
                          >
                            <p className="text-sm font-semibold text-slate-800">{notif.titre}</p>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {new Date(notif.created_at).toLocaleDateString('fr-FR', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    {notifications.length > 0 && (
                      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                        <p className="text-xs text-slate-400 text-center">
                          {notifications.length} notification{notifications.length > 1 ? 's' : ''} non lue{notifications.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* BOUTON AJOUTER */}
            <a
              href="/dashboard/documents/add"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-blue-800 transition-all"
            >
              <Plus className="w-4 h-4" />
              Ajouter
            </a>

            {/* PROFIL */}
            <button
              onClick={() => router.push('/dashboard/profile')}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold hover:shadow-lg hover:scale-105 transition-all"
              title="Mon profil"
            >
              {userInitial}
            </button>

          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">

          {/* Bannière */}
          <div className="relative bg-gradient-to-r from-indigo-600 via-blue-600 to-blue-700 rounded-2xl p-6 mb-6 overflow-hidden shadow-xl">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -top-8 -right-8 w-48 h-48 bg-white rounded-full"></div>
              <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-white rounded-full translate-y-1/2"></div>
            </div>
            <div className="relative z-10">
              <p className="text-blue-200 text-sm font-medium mb-1">Base documentaire</p>
              <h3 className="text-white text-2xl font-bold mb-1">Tous les documents</h3>
              <p className="text-blue-200 text-sm">Consultez, filtrez et téléchargez les documents archivés.</p>
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20">
              <FolderOpen className="w-24 h-24 text-white" />
            </div>
          </div>

          {/* FILTRES */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-700 text-sm">Filtres</span>
                {hasActiveFilters && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Actifs</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button onClick={resetFilters} className="text-xs text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1">
                    <X className="w-3 h-3" /> Réinitialiser
                  </button>
                )}
                <button onClick={() => setShowFilters(!showFilters)} className="text-xs text-slate-500 hover:text-slate-700 transition-colors">
                  {showFilters ? 'Masquer' : 'Afficher'}
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    placeholder="Rechercher..."
                    value={filters.search}
                    onChange={e => handleFilterChange('search', e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm text-slate-800 placeholder-slate-400 transition-all"
                  />
                </div>

                <select
                  value={filters.type}
                  onChange={e => handleFilterChange('type', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm text-slate-800 transition-all"
                >
                  <option value="">Tous les types</option>
                  {['Rapport', 'Note', 'Circulaire', 'Arrêté', 'Décision', 'Procès-verbal', 'Contrat', 'Correspondance', 'Autre'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <select
                  value={filters.direction}
                  onChange={e => handleFilterChange('direction', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm text-slate-800 transition-all"
                >
                  <option value="">Toutes les directions</option>
                  {directions.map(d => (
                    <option key={d.id} value={d.id}>{d.nom}</option>
                  ))}
                </select>

                <select
                  value={filters.confidentialite}
                  onChange={e => handleFilterChange('confidentialite', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm text-slate-800 transition-all"
                >
                  <option value="">Toutes confidentialités</option>
                  {['Normal', 'Confidentiel', 'Secret'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* TABLEAU */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 text-sm">Chargement des documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">Aucun document trouvé</p>
                <p className="text-slate-400 text-sm">Modifiez vos filtres ou ajoutez un document</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Document</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Direction</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Auteur</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Confidentialité</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="font-medium text-slate-800 max-w-xs truncate">{doc.intitule}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                            {doc.type_document}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-sm">{getDirectionNom(doc.direction_id)}</td>
                        <td className="px-6 py-4 text-slate-600 text-sm">{doc.auteur_service || '—'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getConfBadge(doc.niveau_confidentialite)}`}>
                            {getConfIcon(doc.niveau_confidentialite)}
                            {doc.niveau_confidentialite}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {doc.fichier_base64 && (
                              <button
                                onClick={() => handleVoirDoc(doc)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Voir
                              </button>
                            )}
                            {doc.fichier_base64 && (
                              <a
                                href={getPdfSrc(doc.fichier_base64)}
                                download={`${doc.intitule}.pdf`}
                                onClick={() => handleTelechargement(doc)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                PDF
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* MODAL PDF */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{selectedDoc.intitule}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getConfBadge(selectedDoc.niveau_confidentialite)}`}>
                      <Shield className="w-3 h-3" />
                      {selectedDoc.niveau_confidentialite}
                    </span>
                    <span className="text-slate-400 text-xs">{selectedDoc.type_document}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={getPdfSrc(selectedDoc.fichier_base64)}
                  download={`${selectedDoc.intitule}.pdf`}
                  onClick={() => handleTelechargement(selectedDoc)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </a>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-medium transition-colors"
                >
                  <X className="w-4 h-4" />
                  Fermer
                </button>
              </div>
            </div>
            <iframe
              src={getPdfSrc(selectedDoc.fichier_base64)}
              className="flex-1 w-full border-none"
              title={selectedDoc.intitule}
            />
          </div>
        </div>
      )}
    </div>
  )
}
