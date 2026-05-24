'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  'connexion',
  'deconnexion',
  'creation_document',
  'modification_document',
  'suppression_document',
  'consultation_document',
  'telechargement_document',
  'creation_utilisateur',
  'modification_utilisateur',
  'suppression_utilisateur'
]

export default function LogsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [stats, setStats] = useState<Stats>({
    totalLogs: 0,
    connexions: 0,
    consultations: 0,
    modifications: 0,
    suppressions: 0
  })

  const [filters, setFilters] = useState({
    search: '',
    utilisateur_id: '',
    action: '',
    dateFrom: '',
    dateTo: ''
  })

  // INITIALISATION
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          router.push('/login')
          return
        }

        setUser(authUser)

        // Vérifier les permissions admin/superviseur
        const { data: profil } = await supabase
          .from('profils')
          .select('role')
          .eq('id', authUser.id)
          .single()

        if (!['administrateur', 'superviseur'].includes(profil?.role)) {
          router.push('/dashboard')
          return
        }

        await loadUsers()
        await loadLogs()
      } catch (error) {
        console.error('Erreur initialisation:', error)
      }
    }

    init()
  }, [])

  // CHARGER LES UTILISATEURS
  const loadUsers = async () => {
    try {
      const { data } = await supabase
        .from('profils')
        .select('id, email, nom, prenom')
        .eq('actif', true)
        .order('nom')

      setUsers(data || [])
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error)
    }
  }

  // CHARGER LES LOGS
  const loadLogs = async (f: typeof filters = filters) => {
    setLoading(true)
    try {
      let query = supabase
        .from('logs_activite')
        .select(`
          id,
          utilisateur_id,
          action,
          document_id,
          details,
          ip_address,
          created_at,
          profils(id, email, nom, prenom),
          documents(id, intitule)
        `)

      // Filtres
      if (f.search) {
        query = query.or(
          `details.ilike.%${f.search}%,profils.email.ilike.%${f.search}%`
        )
      }

      if (f.utilisateur_id) {
        query = query.eq('utilisateur_id', f.utilisateur_id)
      }

      if (f.action) {
        query = query.eq('action', f.action)
      }

      if (f.dateFrom) {
        query = query.gte('created_at', f.dateFrom)
      }

      if (f.dateTo) {
        const endDate = new Date(f.dateTo)
        endDate.setHours(23, 59, 59, 999)
        query = query.lte('created_at', endDate.toISOString())
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error

      // Transformer les données
      const transformedLogs: LogEntry[] = (data || []).map((log: any) => ({
        id: log.id,
        utilisateur_id: log.utilisateur_id,
        action: log.action,
        document_id: log.document_id,
        details: log.details,
        ip_address: log.ip_address,
        created_at: log.created_at,
        profils: Array.isArray(log.profils) ? log.profils[0] || null : log.profils,
        documents: Array.isArray(log.documents) ? log.documents[0] || null : log.documents
      }))

      setLogs(transformedLogs)

      // Calculer les stats
      setStats({
        totalLogs: transformedLogs.length,
        connexions: transformedLogs.filter(l => l.action === 'connexion').length,
        consultations: transformedLogs.filter(l => l.action === 'consultation_document').length,
        modifications: transformedLogs.filter(l => l.action.includes('modification')).length,
        suppressions: transformedLogs.filter(l => l.action.includes('suppression')).length
      })
    } catch (error) {
      console.error('Erreur chargement logs:', error)
    } finally {
      setLoading(false)
    }
  }

  // METTRE À JOUR LES FILTRES
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    loadLogs(newFilters)
  }

  // RÉINITIALISER LES FILTRES
  const resetFilters = () => {
    const newFilters = {
      search: '',
      utilisateur_id: '',
      action: '',
      dateFrom: '',
      dateTo: ''
    }
    setFilters(newFilters)
    loadLogs(newFilters)
  }

  // ICÔNE ACTION
  const getActionIcon = (action: string): string => {
    const icons: { [key: string]: string } = {
      'connexion': '🔓',
      'deconnexion': '🔐',
      'creation_document': '📝',
      'modification_document': '✏️',
      'suppression_document': '🗑️',
      'consultation_document': '👁️',
      'telechargement_document': '⬇️',
      'creation_utilisateur': '👤',
      'modification_utilisateur': '👥',
      'suppression_utilisateur': '❌'
    }
    return icons[action] || '📋'
  }

  // COULEUR ACTION
  const getActionColor = (action: string): string => {
    const colors: { [key: string]: string } = {
      'connexion': '#28a745',
      'deconnexion': '#6c757d',
      'creation_document': '#007bff',
      'modification_document': '#ffc107',
      'suppression_document': '#dc3545',
      'consultation_document': '#17a2b8',
      'telechargement_document': '#6610f2',
      'creation_utilisateur': '#20c997',
      'modification_utilisateur': '#fd7e14',
      'suppression_utilisateur': '#e83e8c'
    }
    return colors[action] || '#6c757d'
  }

  if (!user) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Vérification des droits...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      {/* HEADER */}
      <header style={{
        background: 'linear-gradient(135deg, #1a3c5e 0%, #2d5a7b 100%)',
        color: 'white',
        padding: '1.5rem 2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem' }}>📊 Logs d'Activité</h1>
              <p style={{ margin: 0, opacity: 0.9 }}>Suivi complet des actions des utilisateurs</p>
            </div>
            <Link href="/dashboard" style={navStyle as any}>
              ← Retour au Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        {/* STATISTIQUES */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <StatCard title="Total des logs" value={stats.totalLogs} icon="📋" />
          <StatCard title="Connexions" value={stats.connexions} icon="🔓" />
          <StatCard title="Consultations" value={stats.consultations} icon="👁️" />
          <StatCard title="Modifications" value={stats.modifications} icon="✏️" />
          <StatCard title="Suppressions" value={stats.suppressions} icon="🗑️" />
        </div>

        {/* FILTRES */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          marginBottom: '2rem'
        }}>
          <h2 style={{ margin: '0 0 1.5rem', color: '#1a3c5e', fontSize: '1.3rem' }}>
            🔍 Filtres
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div>
              <label style={labelStyle}>Recherche</label>
              <input
                type="text"
                placeholder="Détails, email..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                style={inputStyle as any}
              />
            </div>

            <div>
              <label style={labelStyle}>Utilisateur</label>
              <select
                value={filters.utilisateur_id}
                onChange={(e) => handleFilterChange('utilisateur_id', e.target.value)}
                style={inputStyle as any}
              >
                <option value="">Tous les utilisateurs</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.prenom} {u.nom}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Action</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                style={inputStyle as any}
              >
                <option value="">Toutes les actions</option>
                {ACTIONS.map(action => (
                  <option key={action} value={action}>
                    {getActionIcon(action)} {action.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Du</label>
              <input
                type="datetime-local"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                style={inputStyle as any}
              />
            </div>

            <div>
              <label style={labelStyle}>Au</label>
              <input
                type="datetime-local"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                style={inputStyle as any}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={resetFilters}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  width: '100%',
                  fontWeight: 'bold'
                }}
              >
                ↺ Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* TABLEAU LOGS */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e9ecef' }}>
            <h2 style={{ margin: 0, color: '#1a3c5e' }}>
              📈 Historique ({logs.length} entrées)
            </h2>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
              ⏳ Chargement en cours...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
              Aucun log trouvé pour ces critères
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8f9fa' }}>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Utilisateur</th>
                    <th style={thStyle}>Action</th>
                    <th style={thStyle}>Détails</th>
                    <th style={thStyle}>Document</th>
                    <th style={thStyle}>IP</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #e9ecef' }}>
                      <td style={tdStyle}>
                        {new Date(log.created_at).toLocaleString('fr-FR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td style={tdStyle}>
                        {log.profils 
                          ? `${log.profils.prenom} ${log.profils.nom}`
                          : '❓ Inconnu'}
                      </td>
                      <td style={{
                        ...tdStyle,
                        color: getActionColor(log.action),
                        fontWeight: 'bold'
                      }}>
                        {getActionIcon(log.action)} {log.action.replace(/_/g, ' ')}
                      </td>
                      <td style={tdStyle}>
                        {log.details ? (
                          <span title={log.details}>
                            {log.details.length > 30 
                              ? log.details.substring(0, 30) + '...' 
                              : log.details}
                          </span>
                        ) : (
                          <span style={{ color: '#999' }}>-</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {log.documents ? (
                          <Link 
                            href={`/documents/${log.document_id}`}
                            style={{ color: '#007bff', textDecoration: 'none' }}
                          >
                            {log.documents.intitule.substring(0, 20)}...
                          </Link>
                        ) : (
                          <span style={{ color: '#999' }}>-</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {log.ip_address || <span style={{ color: '#999' }}>-</span>}
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => setSelectedLog(log)}
                          style={{
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 'bold'
                          }}
                        >
                          Détails
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* MODAL DÉTAILS */}
      {selectedLog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '550px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ margin: '0 0 1.5rem', color: '#1a3c5e', fontSize: '1.5rem' }}>
              📋 Détails du log
            </h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>📅 Date et heure</label>
              <p style={detailStyle}>
                {new Date(selectedLog.created_at).toLocaleString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>👤 Utilisateur</label>
              <p style={detailStyle}>
                {selectedLog.profils 
                  ? (
                    <>
                      <strong>{selectedLog.profils.prenom} {selectedLog.profils.nom}</strong>
                      <br />
                      <span style={{ color: '#666' }}>{selectedLog.profils.email}</span>
                    </>
                  )
                  : '❓ Inconnu'}
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>🔔 Action</label>
              <p style={{
                ...detailStyle,
                color: getActionColor(selectedLog.action),
                fontWeight: 'bold',
                fontSize: '1.1rem'
              }}>
                {getActionIcon(selectedLog.action)} {selectedLog.action.replace(/_/g, ' ')}
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>📝 Détails</label>
              <p style={{
                ...detailStyle,
                background: '#f8f9fa',
                padding: '0.8rem',
                borderRadius: '6px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {selectedLog.details || '—'}
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>🌐 Adresse IP</label>
              <p style={{
                ...detailStyle,
                background: '#f8f9fa',
                padding: '0.8rem',
                borderRadius: '6px',
                fontFamily: 'monospace'
              }}>
                {selectedLog.ip_address || '—'}
              </p>
            </div>

            {selectedLog.documents && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>📄 Document associé</label>
                <p style={{
                  ...detailStyle,
                  background: '#f8f9fa',
                  padding: '0.8rem',
                  borderRadius: '6px'
                }}>
                  <Link 
                    href={`/documents/${selectedLog.document_id}`}
                    style={{ color: '#007bff', textDecoration: 'none', fontWeight: 'bold' }}
                  >
                    {selectedLog.documents.intitule}
                  </Link>
                </p>
              </div>
            )}

            <button
              onClick={() => setSelectedLog(null)}
              style={{
                background: '#1a3c5e',
                color: 'white',
                border: 'none',
                padding: '0.8rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              ✕ Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// COMPOSANT STATISTIQUE
function StatCard({ title, value, icon }: { title: string; value: number; icon: string }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      border: '1px solid #e9ecef'
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{
        fontSize: '2rem',
        fontWeight: 'bold',
        color: '#1a3c5e',
        marginBottom: '0.5rem'
      }}>
        {value}
      </div>
      <div style={{ color: '#666', fontSize: '0.95rem', fontWeight: '500' }}>
        {title}
      </div>
    </div>
  )
}

// STYLES
const navStyle: any = {
  color: 'white',
  textDecoration: 'none',
  padding: '0.7rem 1.5rem',
  borderRadius: '8px',
  background: 'rgba(255,255,255,0.15)',
  fontSize: '0.95rem',
  cursor: 'pointer',
  border: 'none',
  textAlign: 'center',
  fontWeight: '500',
  transition: 'background 0.3s'
}

const labelStyle: any = {
  fontSize: '0.9rem',
  fontWeight: 'bold',
  color: '#1a3c5e',
  marginBottom: '0.5rem',
  display: 'block'
}

const inputStyle: any = {
  padding: '0.7rem 1rem',
  borderRadius: '8px',
  border: '1px solid #ddd',
  fontSize: '0.95rem',
  width: '100%',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  transition: 'border-color 0.3s'
}

const thStyle: any = {
  padding: '1rem',
  fontWeight: 'bold',
  color: '#1a3c5e',
  textAlign: 'left',
  fontSize: '0.95rem'
}

const tdStyle: any = {
  padding: '1rem',
  color: '#333',
  fontSize: '0.9rem'
}

const detailStyle: any = {
  margin: '0.5rem 0 0',
  color: '#333',
  lineHeight: '1.6',
  fontSize: '0.95rem'
}
