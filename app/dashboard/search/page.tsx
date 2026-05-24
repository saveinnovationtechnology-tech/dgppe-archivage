'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Building2, LayoutDashboard, FilePlus, FolderOpen,
  Search, Users, ClipboardList, LogOut, FileText,
  Download, Eye, Shield, Calendar, Filter, X,
  Menu, Bell, SlidersHorizontal, ArrowUpDown,
  FileDown, RefreshCw, ChevronRight
} from 'lucide-react'

export default function SearchPage() {
  const [user, setUser] = useState<any>(null)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [sortBy, setSortBy] = useState('date_document')
  const [directions, setDirections] = useState<{ id: string; code: string; nom: string }[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showFilters, setShowFilters] = useState(true)

  const [filters, setFilters] = useState({
    search: '',
    type_document: '',
    direction_origine: '',
    niveau_confidentialite: '',
    dateFrom: '',
    dateTo: '',
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
      const { data } = await supabase.from('directions').select('id, code, nom').eq('actif', true).order('nom')
      setDirections(data || [])
      await doSearch({ search: '', type_document: '', direction_origine: '', niveau_confidentialite: '', dateFrom: '', dateTo: '' }, 'date_document')
    }
    init()
  }, [])

  const doSearch = async (f: typeof filters, sort: string) => {
    setLoading(true)
    try {
      let query = supabase.from('documents').select('*').eq('statut', 'actif')
      if (f.search.trim()) query = query.or(`intitule.ilike.%${f.search}%,observations.ilike.%${f.search}%,auteur_service.ilike.%${f.search}%`)
      if (f.type_document) query = query.eq('type_document', f.type_document)
      if (f.direction_origine) query = query.eq('direction_origine', f.direction_origine)
      if (f.niveau_confidentialite) query = query.eq('niveau_confidentialite', f.niveau_confidentialite)
      if (f.dateFrom) query = query.gte('date_document', f.dateFrom)
      if (f.dateTo) query = query.lte('date_document', f.dateTo)
      query = query.order(sort, { ascending: sort !== 'date_document' })
      const { data, error } = await query
      if (error) throw error
      setResults(data || [])
    } catch (err: any) {
      console.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    doSearch(newFilters, sortBy)
  }

  const handleSort = (field: string) => {
    setSortBy(field)
    doSearch(filters, field)
  }

  const resetFilters = () => {
    const empty = { search: '', type_document: '', direction_origine: '', niveau_confidentialite: '', dateFrom: '', dateTo: '' }
    setFilters(empty)
    doSearch(empty, sortBy)
  }

  const exportCSV = () => {
    const csv = [
      ['Intitulé', 'Type', 'Direction', 'Confidentialité', 'Date', 'Auteur'].join(','),
      ...results.map(d => [`"${d.intitule}"`, d.type_document, d.direction_origine, d.niveau_confidentialite, d.date_document, d.auteur_service].join(','))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'documents.csv'; a.click()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length

  const getConfBadge = (niveau: string) => {
    if (niveau === 'Secret') return 'bg-red-100 text-red-700 border border-red-200'
    if (niveau === 'Confidentiel') return 'bg-amber-100 text-amber-700 border border-amber-200'
    return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  }

  const navItems = [
    { icon: LayoutDashboard, label: 'Tableau de bord', href: '/dashboard' },
    { icon: FilePlus, label: 'Ajouter document', href: '/dashboard/documents/add' },
    { icon: FolderOpen, label: 'Documents', href: '/dashboard/documents/view' },
    { icon: Search, label: 'Recherche', href: '/dashboard/search', active: true },
    { icon: Users, label: 'Utilisateurs', href: '/dashboard/users' },
    { icon: ClipboardList, label: 'Journaux', href: '/dashboard/logs' },
  ]

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
                ${item.active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </a>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700">
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
              <span className="text-slate-800 font-semibold">Recherche avancée</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Bell className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="text-sm font-medium text-slate-700 hidden md:block">{user?.email}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">

          {/* Banner */}
          <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 px-8 py-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <Search className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-white">Recherche avancée</h1>
                </div>
                <p className="text-purple-200 text-sm">
                  Recherchez parmi tous les documents de la base documentaire
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={exportCSV}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur text-white rounded-xl text-sm font-medium transition-all border border-white/30">
                  <FileDown className="w-4 h-4" />
                  Exporter CSV
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">

            {/* Filtres */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                    <SlidersHorizontal className="w-4 h-4 text-violet-600" />
                  </div>
                  <h2 className="font-semibold text-slate-800">Filtres de recherche</h2>
                  {activeFiltersCount > 0 && (
                    <span className="px-2 py-0.5 bg-violet-600 text-white text-xs font-bold rounded-full">
                      {activeFiltersCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {activeFiltersCount > 0 && (
                    <button onClick={resetFilters}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors">
                      <RefreshCw className="w-3 h-3" />
                      Réinitialiser
                    </button>
                  )}
                  <button onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-600 transition-colors">
                    <Filter className="w-3 h-3" />
                    {showFilters ? 'Masquer' : 'Afficher'}
                  </button>
                </div>
              </div>

              {showFilters && (
                <div className="p-6">
                  {/* Barre de recherche principale */}
                  <div className="relative mb-5">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Rechercher par intitulé, auteur, observations..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                    {filters.search && (
                      <button onClick={() => handleFilterChange('search', '')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full">
                        <X className="w-3 h-3 text-slate-400" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Type */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                        Type de document
                      </label>
                      <select
                        value={filters.type_document}
                        onChange={(e) => handleFilterChange('type_document', e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="">Tous les types</option>
                        {['Circulaire','Note de service','Décision','Rapport','Courrier','Arrêté','Convention','Autre'].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Direction */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                        Direction
                      </label>
                      <select
                        value={filters.direction_origine}
                        onChange={(e) => handleFilterChange('direction_origine', e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="">Toutes les directions</option>
                        {directions.map(d => (
                          <option key={d.id} value={d.code}>{d.nom}</option>
                        ))}
                      </select>
                    </div>

                    {/* Confidentialité */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                        Confidentialité
                      </label>
                      <select
                        value={filters.niveau_confidentialite}
                        onChange={(e) => handleFilterChange('niveau_confidentialite', e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="">Tous les niveaux</option>
                        <option value="Normal">Normal</option>
                        <option value="Confidentiel">Confidentiel</option>
                        <option value="Secret">Secret</option>
                      </select>
                    </div>

                    {/* Tri */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                        Trier par
                      </label>
                      <select
                        value={sortBy}
                        onChange={(e) => handleSort(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="date_document">Date (récent → ancien)</option>
                        <option value="intitule">Titre (A → Z)</option>
                      </select>
                    </div>

                    {/* Date From */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                        Date — Du
                      </label>
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>

                    {/* Date To */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                        Date — Au
                      </label>
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Résultats */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <h2 className="font-semibold text-slate-800">
                    {loading ? 'Recherche en cours...' : `${results.length} résultat${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''}`}
                  </h2>
                </div>
                {loading && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <div className="w-4 h-4 border-2 border-slate-200 border-t-violet-600 rounded-full animate-spin"></div>
                    Chargement...
                  </div>
                )}
              </div>

              {loading ? (
                <div className="py-20 flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-3 border-slate-200 border-t-violet-600 rounded-full animate-spin"></div>
                  <p className="text-slate-500 text-sm">Recherche en cours...</p>
                </div>
              ) : results.length === 0 ? (
                <div className="py-20 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <Search className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium">Aucun document trouvé</p>
                  <p className="text-slate-400 text-sm">Modifiez vos critères de recherche</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Intitulé</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Direction</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Confidentialité</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-red-500" />
                              </div>
                              <span className="font-medium text-slate-800 text-sm line-clamp-1">{doc.intitule}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                              {doc.type_document}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{doc.direction_origine}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {doc.date_document || '—'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${getConfBadge(doc.niveau_confidentialite)}`}>
                              <Shield className="w-3 h-3" />
                              {doc.niveau_confidentialite}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => setSelectedDoc(doc)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Voir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modal PDF */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
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
                {selectedDoc.fichier_base64 && (
                  <a
                    href={getPdfSrc(selectedDoc.fichier_base64)}
                    download={`${selectedDoc.intitule}.pdf`}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Télécharger
                  </a>
                )}
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-medium transition-colors"
                >
                  <X className="w-4 h-4" />
                  Fermer
                </button>
              </div>
            </div>
            {selectedDoc.fichier_base64 ? (
              <iframe
                src={getPdfSrc(selectedDoc.fichier_base64)}
                className="flex-1 w-full border-none"
                title={selectedDoc.intitule}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                <FileText className="w-12 h-12" />
                <p className="font-medium">Pas de fichier disponible</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
