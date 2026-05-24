'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DocumentsPage() {
  const [user, setUser] = useState<any>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [directions, setDirections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    direction: '',
    confidentialite: '',
  })
  const router = useRouter()
  const supabase = createClient()

  // Corrige le double préfixe base64
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

      await fetchDocuments({
        search: '',
        type: '',
        direction: '',
        confidentialite: '',
      })
    }
    init()
  }, [])

  const fetchDocuments = async (f: typeof filters) => {
    setLoading(true)

    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })

    if (f.search) query = query.ilike('intitule', `%${f.search}%`)
    if (f.type) query = query.eq('type_document', f.type)
    if (f.direction) query = query.eq('direction_id', f.direction)
    if (f.confidentialite) query = query.eq('niveau_confidentialite', f.confidentialite)

    const { data, error } = await query
    console.log('DOCUMENTS:', data, 'ERREUR:', error)
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

  const getDirectionNom = (direction_id: string) => {
    const dir = directions.find(d => d.id === direction_id)
    return dir ? dir.nom : '—'
  }

  const badgeColor = (niveau: string) => {
    if (niveau === 'Secret') return { background: '#ffe0e0', color: '#c00' }
    if (niveau === 'Confidentiel') return { background: '#fff3cd', color: '#856404' }
    return { background: '#e0f0e0', color: '#2d6a2d' }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Arial' }}>

      {/* SIDEBAR */}
      <aside style={{
        width: '250px', background: '#1a3c5e', color: 'white',
        padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
        position: 'sticky', top: 0, height: '100vh'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>🏛️ DGPPE</h2>
        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>{user?.email}</p>
        <hr style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <a href="/dashboard" style={navStyle}>📊 Tableau de bord</a>
          <a href="/dashboard/documents/add" style={navStyle}>➕ Ajouter un document</a>
          <a href="/dashboard/documents/view" style={{ ...navStyle, background: 'rgba(255,255,255,0.25)' }}>📁 Documents</a>
          <a href="/dashboard/search" style={navStyle}>🔍 Rechercher</a>
          <a href="/dashboard/users" style={navStyle}>👥 Utilisateurs</a>
          <a href="/dashboard/logs" style={navStyle}>📋 Logs</a>
        </nav>
        <button onClick={handleLogout} style={{
          marginTop: 'auto', background: 'rgba(255,255,255,0.1)', border: 'none',
          color: 'white', padding: '0.7rem', borderRadius: '8px', cursor: 'pointer'
        }}>🚪 Déconnexion</button>
      </aside>

      {/* CONTENU */}
      <main style={{ flex: 1, padding: '2rem', background: '#f5f7fa' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>📁 Documents</h1>
            <p style={{ color: '#666', margin: 0 }}>{documents.length} document(s) trouvé(s)</p>
          </div>
          <a href="/dashboard/documents/add" style={{
            background: '#1a3c5e', color: 'white', padding: '0.7rem 1.2rem',
            borderRadius: '8px', textDecoration: 'none', fontSize: '0.9rem'
          }}>➕ Ajouter</a>
        </div>

        {/* FILTRES */}
        <div style={{
          background: 'white', borderRadius: '12px', padding: '1.2rem',
          marginBottom: '1.5rem', display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <input
            placeholder="🔍 Rechercher un document..."
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
            style={inputStyle}
          />
          <select value={filters.type} onChange={e => handleFilterChange('type', e.target.value)} style={inputStyle}>
            <option value="">Tous les types</option>
            <option>Arrêté</option>
            <option>Décret</option>
            <option>Circulaire</option>
            <option>Note de service</option>
            <option>Rapport</option>
            <option>Courrier</option>
            <option>Convention</option>
            <option>Autre</option>
          </select>
          <select value={filters.direction} onChange={e => handleFilterChange('direction', e.target.value)} style={inputStyle}>
            <option value="">Toutes les directions</option>
            {directions.map(d => (
              <option key={d.id} value={d.id}>{d.nom}</option>
            ))}
          </select>
          <select value={filters.confidentialite} onChange={e => handleFilterChange('confidentialite', e.target.value)} style={inputStyle}>
            <option value="">Toutes confidentialités</option>
            <option>Normal</option>
            <option>Confidentiel</option>
            <option>Secret</option>
          </select>
        </div>

        {/* TABLEAU */}
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>Chargement...</p>
          ) : documents.length === 0 ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>Aucun document trouvé</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f0f4f8' }}>
                  <th style={thStyle}>Intitulé</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Direction</th>
                  <th style={thStyle}>Auteur / Service</th>
                  <th style={thStyle}>Confidentialité</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={tdStyle}><strong>{doc.intitule}</strong></td>
                    <td style={tdStyle}>{doc.type_document}</td>
                    <td style={tdStyle}>{getDirectionNom(doc.direction_id)}</td>
                    <td style={tdStyle}>{doc.auteur_service || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '0.2rem 0.7rem', borderRadius: '12px',
                        fontSize: '0.8rem', ...badgeColor(doc.niveau_confidentialite)
                      }}>
                        {doc.niveau_confidentialite}
                      </span>
                    </td>
                    <td style={tdStyle}>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {doc.fichier_base64 && (
                          <button
                            onClick={() => setSelectedDoc(doc)}
                            style={btnStyle('#1a3c5e')}
                          >👁️ Voir</button>
                        )}
                        {doc.fichier_base64 && (
                          <a
                            href={getPdfSrc(doc.fichier_base64)}
                            download={`${doc.intitule}.pdf`}
                            style={{ ...btnStyle('#2d6a2d'), textDecoration: 'none' }}
                          >⬇️ PDF</a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* MODAL VISUALISATION PDF */}
      {selectedDoc && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', width: '85vw',
            height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{
              padding: '1rem 1.5rem', borderBottom: '1px solid #eee',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <strong>{selectedDoc.intitule}</strong>
                <span style={{
                  marginLeft: '1rem', padding: '0.2rem 0.7rem',
                  borderRadius: '12px', fontSize: '0.8rem',
                  ...badgeColor(selectedDoc.niveau_confidentialite)
                }}>
                  {selectedDoc.niveau_confidentialite}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a
                  href={getPdfSrc(selectedDoc.fichier_base64)}
                  download={`${selectedDoc.intitule}.pdf`}
                  style={{ ...btnStyle('#2d6a2d'), textDecoration: 'none' }}
                >⬇️ Télécharger</a>
                <button onClick={() => setSelectedDoc(null)} style={btnStyle('#c00')}>✕ Fermer</button>
              </div>
            </div>
            <iframe
              src={getPdfSrc(selectedDoc.fichier_base64)}
              style={{ flex: 1, border: 'none' }}
              title={selectedDoc.intitule}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const navStyle: any = {
  color: 'white', textDecoration: 'none', padding: '0.6rem 1rem',
  borderRadius: '8px', background: 'rgba(255,255,255,0.1)', fontSize: '0.9rem'
}
const inputStyle: any = {
  padding: '0.6rem 0.8rem', borderRadius: '8px',
  border: '1px solid #ddd', fontSize: '0.9rem', width: '100%'
}
const thStyle: any = {
  padding: '0.8rem 1rem', fontWeight: 'bold',
  color: '#444', textAlign: 'left'
}
const tdStyle: any = { padding: '0.8rem 1rem', color: '#333' }
const btnStyle = (bg: string): any => ({
  background: bg, color: 'white', border: 'none',
  padding: '0.3rem 0.7rem', borderRadius: '6px',
  cursor: 'pointer', fontSize: '0.8rem'
})
