'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SearchPage() {
  const [user, setUser] = useState<any>(null)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [sortBy, setSortBy] = useState('date_document')
  const [directions, setDirections] = useState<{ id: string; code: string; nom: string }[]>([])

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

  // Charger les directions
  const loadDirections = async () => {
    try {
      const { data, error } = await supabase
        .from('directions')
        .select('id, code, nom')
        .eq('actif', true)
        .order('nom')

      if (error) throw error
      setDirections(data || [])
    } catch (err: any) {
      console.error('Erreur chargement directions:', err.message)
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      // Charge les directions et documents au chargement
      await loadDirections()
      await search({
        search: '',
        type_document: '',
        direction_origine: '',
        niveau_confidentialite: '',
        dateFrom: '',
        dateTo: '',
      })
    }
    init()
  }, [])

  const search = async (f: typeof filters) => {
    setLoading(true)

    try {
      let query = supabase
        .from('documents')
        .select('*')
        .eq('statut', 'actif')

      // Recherche full-text
      if (f.search.trim()) {
        query = query.or(
          `intitule.ilike.%${f.search}%,observations.ilike.%${f.search}%,auteur_service.ilike.%${f.search}%`
        )
      }

      // Filtres
      if (f.type_document) query = query.eq('type_document', f.type_document)
      if (f.direction_origine) query = query.eq('direction_origine', f.direction_origine)
      if (f.niveau_confidentialite) query = query.eq('niveau_confidentialite', f.niveau_confidentialite)

      if (f.dateFrom) query = query.gte('date_document', f.dateFrom)
      if (f.dateTo) query = query.lte('date_document', f.dateTo)

      // Tri
      query = query.order(sortBy, { ascending: sortBy !== 'date_document' })

      const { data, error } = await query

      if (error) throw error
      setResults(data || [])
    } catch (err: any) {
      alert('❌ Erreur : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    search(newFilters)
  }

  const handleSort = (field: string) => {
    setSortBy(field)
    search(filters)
  }

  const exportCSV = () => {
    const csv = [
      ['Intitulé', 'Type', 'Direction', 'Confidentialité', 'Date', 'Auteur'].join(','),
      ...results.map(d => [
        `"${d.intitule}"`,
        d.type_document,
        d.direction_origine,
        d.niveau_confidentialite,
        d.date_document,
        d.auteur_service
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'documents.csv'
    a.click()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Navigation Header */}
      <nav style={{
        background: '#1a3a52',
        color: 'white',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <h1 style={{ margin: 0, fontSize: '1.3rem' }}>📚 Gestion Documentaire</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard" style={navLinkStyle}>
            🏠 Accueil
          </Link>
          <Link href="/dashboard/documents/add" style={navLinkStyle}>
            📤 Uploader
          </Link>
          <button onClick={handleLogout} style={{ ...navLinkStyle, cursor: 'pointer' }}>
            🚪 Déconnexion
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h2>🔍 Recherche Avancée</h2>
          {user && <p style={{ color: '#666', marginTop: '0.5rem' }}>Bienvenue, {user.email}</p>}
        </div>

        {/* Filtres */}
        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>🔎 Recherche</label>
              <input
                type="text"
                placeholder="Intitulé, auteur, observations..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>📄 Type</label>
              <select
                value={filters.type_document}
                onChange={(e) => handleFilterChange('type_document', e.target.value)}
                style={inputStyle}
              >
                <option value="">Tous les types</option>
                <option value="Circulaire">Circulaire</option>
                <option value="Note de service">Note de service</option>
                <option value="Décision">Décision</option>
                <option value="Rapport">Rapport</option>
                <option value="Courrier">Courrier</option>
                <option value="Arrêté">Arrêté</option>
                <option value="Convention">Convention</option>
                <option value="Autre">Autre</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>🏢 Direction</label>
              <select
                value={filters.direction_origine}
                onChange={(e) => handleFilterChange('direction_origine', e.target.value)}
                style={inputStyle}
              >
                <option value="">Toutes les directions</option>
                {directions.map(d => (
                  <option key={d.id} value={d.code}>{d.nom}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>🔐 Confidentialité</label>
              <select
                value={filters.niveau_confidentialite}
                onChange={(e) => handleFilterChange('niveau_confidentialite', e.target.value)}
                style={inputStyle}
              >
                <option value="">Tous les niveaux</option>
                <option value="Normal">Normal</option>
                <option value="Confidentiel">Confidentiel</option>
                <option value="Secret">Secret</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>📅 Du</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>📅 Au</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setFilters({ search: '', type_document: '', direction_origine: '', niveau_confidentialite: '', dateFrom: '', dateTo: '' })
                search({ search: '', type_document: '', direction_origine: '', niveau_confidentialite: '', dateFrom: '', dateTo: '' })
              }}
              style={btnStyle('#666')}
            >
              🔄 Réinitialiser
            </button>
            <button onClick={exportCSV} style={btnStyle('#2d6a2d')}>
              📥 Exporter CSV
            </button>
          </div>
        </div>

        {/* Résultats */}
        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ margin: 0 }}>{loading ? '⏳ Recherche...' : `📊 ${results.length} résultat(s)`}</h2>
            <select value={sortBy} onChange={(e) => handleSort(e.target.value)} style={inputStyle}>
              <option value="date_document">Tri : Date (récent)</option>
              <option value="intitule">Tri : Titre (A-Z)</option>
            </select>
          </div>

          {results.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>
              Aucun document trouvé
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f0f0f0' }}>
                  <th style={thStyle}>Intitulé</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Direction</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Confid.</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={tdStyle}>{doc.intitule}</td>
                    <td style={tdStyle}>{doc.type_document}</td>
                    <td style={tdStyle}>{doc.direction_origine}</td>
                    <td style={tdStyle}>{doc.date_document}</td>
                    <td style={tdStyle}>
                      <span style={{
                        background: doc.niveau_confidentialite === 'Normal' ? '#e8f5e9' : '#fff3e0',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.85rem'
                      }}>
                        {doc.niveau_confidentialite}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => setSelectedDoc(doc)}
                        style={btnStyle('#1a3a52')}
                      >
                        👁️ Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal PDF */}
      {selectedDoc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '90vw',
            height: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3>{selectedDoc.intitule}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {selectedDoc.fichier_base64 && (
                  <a
                    href={getPdfSrc(selectedDoc.fichier_base64)}
                    download={`${selectedDoc.intitule}.pdf`}
                    style={{ ...btnStyle('#2d6a2d'), textDecoration: 'none' }}
                  >⬇️ Télécharger</a>
                )}
                <button onClick={() => setSelectedDoc(null)} style={btnStyle('#c00')}>✕ Fermer</button>
              </div>
            </div>
            {selectedDoc.fichier_base64 ? (
              <iframe
                src={getPdfSrc(selectedDoc.fichier_base64)}
                style={{ flex: 1, border: 'none' }}
                title={selectedDoc.intitule}
              />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                📄 Pas de fichier disponible
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const navLinkStyle: any = {
  color: 'white',
  textDecoration: 'none',
  padding: '0.6rem 1rem',
  borderRadius: '6px',
  transition: 'background 0.3s',
  fontWeight: '500',
  background: 'transparent',
  border: 'none',
  fontSize: '0.95rem',
  cursor: 'pointer'
}

const inputStyle: any = {
  padding: '0.6rem 0.8rem',
  borderRadius: '8px',
  border: '1px solid #ddd',
  fontSize: '0.9rem',
  width: '100%',
  fontFamily: 'inherit'
}

const thStyle: any = {
  padding: '0.8rem 1rem',
  fontWeight: 'bold',
  color: '#1a3a52',
  textAlign: 'left'
}

const tdStyle: any = {
  padding: '0.8rem 1rem',
  color: '#333'
}

const btnStyle = (bg: string): any => ({
  background: bg,
  color: 'white',
  border: 'none',
  padding: '0.6rem 1rem',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: 'bold'
})
