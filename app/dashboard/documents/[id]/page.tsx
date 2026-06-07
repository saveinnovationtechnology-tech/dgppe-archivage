//app/dashboard/documents/[id]/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'


import {
  Eye,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Shield,
  Calendar,
  ArrowLeft,
  Building2
} from 'lucide-react'

export default function DocumentDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
const getPdfSrc = (base64?: string) => {
  if (!base64) return ''

  return base64.startsWith('data:')
    ? base64
    : `data:application/pdf;base64,${base64}`
}
  const [loading, setLoading] = useState(true)
  const [document, setDocument] = useState<any>(null)

  useEffect(() => {
    loadDocument()
  }, [])

  const loadDocument = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) {
        console.error(error)
        return
      }

      setDocument(data)
    } finally {
      setLoading(false)
    }
  }

  const getConfidentialityColor = (niveau?: string) => {
    switch (niveau?.toLowerCase()) {
      case 'secret':
        return 'bg-red-100 text-red-700 border-red-200'

      case 'confidentiel':
        return 'bg-orange-100 text-orange-700 border-orange-200'

      case 'interne':
        return 'bg-blue-100 text-blue-700 border-blue-200'

      default:
        return 'bg-green-100 text-green-700 border-green-200'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="animate-pulse text-slate-500">
          Chargement du document...
        </div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">
            Document introuvable
          </h2>
        </div>
      </div>
    )
  }

  return (
 <div className="max-w-[1800px] mx-auto p-6">

  {/* HERO DOCUMENT */}
  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-6">

    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-8 text-white">

      <div className="flex items-start justify-between gap-6">

        <div>

          <div className="flex items-center gap-3 mb-4">

            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <FileText className="w-7 h-7" />
            </div>

            <div>
              <p className="text-blue-100 text-sm">
                Document archivé
              </p>

              <h1 className="text-3xl font-bold leading-tight">
                {document.intitule}
              </h1>
            </div>

          </div>

          <div className="flex flex-wrap gap-3">

            <span className="px-3 py-1 rounded-full bg-white/15 text-sm backdrop-blur">
              {document.type_document || 'Document'}
            </span>

            <span
              className={`px-3 py-1 rounded-full text-sm font-medium border ${getConfidentialityColor(
                document.niveau_confidentialite
              )}`}
            >
              {document.niveau_confidentialite}
            </span>

            <span className="px-3 py-1 rounded-full bg-white/15 text-sm backdrop-blur">
              {new Date(document.created_at).toLocaleDateString('fr-FR')}
            </span>

          </div>

        </div>

      </div>

    </div>

    {/* ACTIONS */}
    <div className="p-5 flex flex-wrap gap-3 border-t bg-slate-50">

      {document.fichier_base64 && (
        <>
          

          <a
            href={getPdfSrc(document.fichier_base64)}
            download={`${document.intitule}.pdf`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-all"
          >
            <Download className="w-4 h-4" />
            Télécharger
          </a>
        </>
      )}

      <div className="ml-auto flex items-center gap-6 text-sm text-slate-500">

        <div>
          <span className="font-semibold text-slate-700">
            Auteur :
          </span>{' '}
          {document.auteur_service || '—'}
        </div>

        <div>
          <span className="font-semibold text-slate-700">
            Direction :
          </span>{' '}
          {document.direction_origine || '—'}
        </div>

      </div>

    </div>

  </div>

  {/* PDF VIEWER */}
  <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">

    <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">

      <div className="flex items-center gap-3">

        <Eye className="w-5 h-5 text-blue-600" />

        <div>
          <h2 className="font-semibold text-slate-800">
            Lecteur documentaire
          </h2>

          <p className="text-xs text-slate-500">
            Consultation sécurisée du document archivé
          </p>
        </div>

      </div>

    </div>

    <div className="bg-slate-300">

      {document.fichier_base64 ? (

        <iframe
          src={getPdfSrc(document.fichier_base64)}
          title={document.intitule}
          className="w-full h-[88vh] bg-white"
        />

      ) : (

        <div className="h-[88vh] flex flex-col items-center justify-center text-slate-500">

          <FolderOpen className="w-20 h-20 opacity-30 mb-4" />

          <p className="text-lg font-semibold">
            Aucun PDF disponible
          </p>

          <p className="text-sm mt-2">
            Ce document ne contient aucun fichier consultable.
          </p>

        </div>

      )}

    </div>

  </div>

</div>
 )
}