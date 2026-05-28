// scripts/sync-embeddings.js
// Synchronisation des embeddings Groq → Supabase
// Crée des chunks de documents et génère leurs embeddings vectoriels

require('dotenv').config({ path: '.env.local' });

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_HOST = 'api.groq.com';
const GROQ_MODEL = 'nomic-embed-text-v1.5';

// Configuration de chunking
const TAILLE_CHUNK = parseInt(process.env.SYNC_CHUNK_SIZE || '500');
const CHEVAUCHEMENT = parseInt(process.env.SYNC_OVERLAP || '50');
const BATCH_SIZE = parseInt(process.env.SYNC_BATCH_SIZE || '10');
const DELAI_REQUETE = parseInt(process.env.SYNC_REQUEST_DELAY || '200');

// ============================================================
// VALIDATION DE CONFIGURATION
// ============================================================

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║     SYNCHRONISATION DES EMBEDDINGS — GROQ + SUPABASE      ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log('[CONFIG] 🔍 Vérification des variables d\'environnement...');
const configErrors = [];

if (!SUPABASE_URL) configErrors.push('NEXT_PUBLIC_SUPABASE_URL manquant');
if (!SUPABASE_KEY) configErrors.push('SUPABASE_SERVICE_ROLE_KEY manquant');
if (!GROQ_API_KEY) configErrors.push('GROQ_API_KEY manquant');

if (configErrors.length > 0) {
  console.error('\n❌ ERREURS DE CONFIGURATION:\n');
  configErrors.forEach(err => console.error(`   • ${err}`));
  console.error('\n✅ Vérifiez votre fichier .env.local\n');
  process.exit(1);
}

console.log('✅ Configuration validée:\n');
console.log(`   📍 Supabase URL: ${SUPABASE_URL.substring(0, 30)}...`);
console.log(`   🔑 Supabase Key: ${SUPABASE_KEY.substring(0, 20)}...`);
console.log(`   🚀 Groq API: api.groq.com`);
console.log(`   📦 Modèle: ${GROQ_MODEL}`);
console.log(`   📏 Taille chunk: ${TAILLE_CHUNK} caractères`);
console.log(`   ↔️  Chevauchement: ${CHEVAUCHEMENT} caractères`);
console.log(`   📊 Batch size: ${BATCH_SIZE} chunks`);
console.log(`   ⏱️  Délai requête: ${DELAI_REQUETE}ms\n`);

// ============================================================
// STATISTIQUES GLOBALES
// ============================================================

let stats = {
  documentsTraites: 0,
  documentsEchoues: 0,
  chunksCrees: 0,
  embeddingsGeneres: 0,
  embeddingsEchoues: 0,
  tempsDebut: Date.now(),
  tempsFin: null
};

// ============================================================
// UTILITAIRES HTTP
// ============================================================

/**
 * Effectue une requête HTTP/HTTPS
 */
function makeRequest(method, urlStr, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'User-Agent': 'ARIA-SyncEmbeddings/1.0',
        ...headers
      }
    };

    if (body) {
      if (typeof body === 'object') {
        body = JSON.stringify(body);
      }
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    let timeoutId = setTimeout(() => {
      req.abort();
      reject(new Error(`Timeout après 30s — ${urlStr}`));
    }, 30000);

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        clearTimeout(timeoutId);
        
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }

        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// ============================================================
// GÉNÉRER EMBEDDING AVEC GROQ
// ============================================================

/**
 * Génère un embedding vectoriel pour un texte via l'API Groq
 */
async function genererEmbeddingGroq(texte) {
  try {
    if (!texte || texte.trim().length === 0) {
      console.warn('[GROQ] ⚠️  Texte vide');
      return null;
    }

    const response = await makeRequest(
      'POST',
      `https://${GROQ_HOST}/openai/v1/embeddings`,
      {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      {
        model: GROQ_MODEL,
        input: texte.substring(0, 8192) // Limite Groq
      }
    );

    if (response.data && response.data.length > 0 && response.data[0].embedding) {
      stats.embeddingsGeneres++;
      return response.data[0].embedding;
    }

    console.error('[GROQ] ❌ Réponse invalide:', JSON.stringify(response).substring(0, 100));
    stats.embeddingsEchoues++;
    return null;

  } catch (error) {
    console.error(`[GROQ] ❌ Erreur: ${error.message}`);
    stats.embeddingsEchoues++;
    return null;
  }
}

// ============================================================
// DÉCOUPER EN CHUNKS AVEC CHEVAUCHEMENT
// ============================================================

/**
 * Divise un texte en chunks de taille fixe avec chevauchement
 */
function decoupeEnChunks(texte, tailleChunk = TAILLE_CHUNK, chevauchement = CHEVAUCHEMENT) {
  if (!texte || texte.length === 0) {
    return [];
  }

  const chunks = [];
  let debut = 0;

  while (debut < texte.length) {
    let fin = Math.min(debut + tailleChunk, texte.length);
    
    // Ne pas couper au milieu d'une phrase si possible
    if (fin < texte.length && texte[fin] !== ' ' && texte[fin] !== '\n') {
      const dernierEspace = texte.lastIndexOf(' ', fin);
      if (dernierEspace > debut) {
        fin = dernierEspace;
      }
    }

    const chunk = texte.substring(debut, fin).trim();
    
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Avancer avec chevauchement
    debut = fin - chevauchement;
  }

  return chunks;
}

// ============================================================
// OBTENIR LES DOCUMENTS DE SUPABASE
// ============================================================

/**
 * Récupère tous les documents de la table documents
 */
async function obtenirDocuments() {
  try {
    console.log('\n[SUPABASE] 📥 Récupération des documents...');

    const response = await makeRequest(
      'GET',
      `${SUPABASE_URL}/rest/v1/documents?select=id,intitule,fichier_base64,observations,type_document,direction_origine,niveau_confidentialite,created_at&order=created_at.desc`,
      {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    );

    const documents = Array.isArray(response) ? response : [];
    console.log(`[SUPABASE] ✅ ${documents.length} document(s) trouvé(s)\n`);

    return documents;

  } catch (error) {
    console.error(`[SUPABASE] ❌ Erreur: ${error.message}`);
    return [];
  }
}

// ============================================================
// VÉRIFIER LES EMBEDDINGS EXISTANTS
// ============================================================

/**
 * Récupère les documents déjà indexés
 */
async function obtenirDocumentsIndexes() {
  try {
    const response = await makeRequest(
      'GET',
      `${SUPABASE_URL}/rest/v1/document_embeddings?select=document_id&order=created_at.desc`,
      {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    );

    const idsIndexes = new Set((Array.isArray(response) ? response : []).map(d => d.document_id));
    return idsIndexes;

  } catch (error) {
    console.error(`[SUPABASE] ❌ Erreur lecture docs indexés: ${error.message}`);
    return new Set();
  }
}

// ============================================================
// INSÉRER LES EMBEDDINGS
// ============================================================

/**
 * Insère les chunks et embeddings dans Supabase
 */
async function insererEmbeddings(embeddings) {
  if (embeddings.length === 0) {
    console.warn('\n[SUPABASE] ⚠️  Aucun embedding à insérer');
    return 0;
  }

  try {
    console.log(`\n[SUPABASE] 💾 Insertion de ${embeddings.length} embeddings...\n`);

    let total = 0;

    // Insérer par batch
    for (let i = 0; i < embeddings.length; i += BATCH_SIZE) {
      const batch = embeddings.slice(i, Math.min(i + BATCH_SIZE, embeddings.length));
      
      const donnees = batch.map(e => ({
        document_id: e.document_id,
        contenu: e.contenu,
        embedding: e.embedding,
        ordre_chunk: e.ordre_chunk,
        type_document: e.type_document,
        direction_origine: e.direction_origine,
        niveau_confidentialite: e.niveau_confidentialite
      }));

      try {
        await makeRequest(
          'POST',
          `${SUPABASE_URL}/rest/v1/document_embeddings`,
          {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          donnees
        );

        total += batch.length;
        const pourcentage = Math.round((total / embeddings.length) * 100);
        console.log(`   ✅ ${total}/${embeddings.length} (${pourcentage}%)`);

        // Petit délai entre les batches
        if (i + BATCH_SIZE < embeddings.length) {
          await new Promise(r => setTimeout(r, DELAI_REQUETE / 2));
        }

      } catch (batchError) {
        console.error(`   ❌ Erreur batch ${Math.ceil((i + BATCH_SIZE) / BATCH_SIZE)}: ${batchError.message}`);
        // Continue avec le batch suivant
      }
    }

    console.log(`\n[SUPABASE] ✨ ${total} embeddings insérés avec succès\n`);
    return total;

  } catch (error) {
    console.error(`[SUPABASE] ❌ Erreur insertion: ${error.message}`);
    return 0;
  }
}

// ============================================================
// TRAITER UN DOCUMENT
// ============================================================

/**
 * Traite un document : crée chunks et génère embeddings
 */
async function traiterDocument(doc, indexActuel, totalDocuments, docsIndexees) {
  try {
    const indent = '   ';
    
    // Vérifier si déjà indexé
    if (docsIndexees.has(doc.id)) {
      console.log(`\n${indent}⏭️  Déjà indexé, skip`);
      return [];
    }

    console.log(`\n[DOC ${indexActuel}/${totalDocuments}] 📄 ${doc.intitule || 'Sans titre'}`);
    console.log(`${indent}ID: ${doc.id}`);
    console.log(`${indent}Type: ${doc.type_document || 'N.A.'}`);
    console.log(`${indent}Direction: ${doc.direction_origine || 'N.A.'}`);

    // Assembler le contenu
    const contenuBrut = [
      doc.intitule,
      doc.type_document,
      doc.direction_origine,
      doc.observations
    ]
      .filter(Boolean)
      .join('\n\n');

    if (contenuBrut.length === 0) {
      console.log(`${indent}⚠️  Contenu vide`);
      return [];
    }

    console.log(`${indent}📝 ${contenuBrut.length} caractères de contenu\n`);

    // Découper en chunks
    const chunks = decoupeEnChunks(contenuBrut);
    console.log(`${indent}📚 ${chunks.length} chunks créés\n`);

    stats.chunksCrees += chunks.length;

    // Générer embeddings
    const embeddings = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const texte = chunk.substring(0, 8192); // Limite Groq

      // Afficher progression
      const progression = Math.round(((i + 1) / chunks.length) * 100);
      process.stdout.write(
        `${indent}🔄 Embedding ${i + 1}/${chunks.length} (${progression}%)...\r`
      );

      const embedding = await genererEmbeddingGroq(texte);

      if (embedding) {
        embeddings.push({
          document_id: doc.id,
          contenu: chunk,
          embedding: embedding,
          ordre_chunk: i + 1,
          type_document: doc.type_document,
          direction_origine: doc.direction_origine,
          niveau_confidentialite: doc.niveau_confidentialite || 'Normal'
        });
      }

      // Respecter le rate limit
      await new Promise(r => setTimeout(r, DELAI_REQUETE));
    }

    console.log(`${indent}✅ ${embeddings.length}/${chunks.length} embeddings générés\n`);

    if (embeddings.length === 0) {
      stats.documentsEchoues++;
    } else {
      stats.documentsTraites++;
    }

    return embeddings;

  } catch (error) {
    console.error(`${indent}❌ Erreur: ${error.message}`);
    stats.documentsEchoues++;
    return [];
  }
}

// ============================================================
// SYNCHRONISATION PRINCIPALE
// ============================================================

async function synchroniser() {
  try {
    console.log('═'.repeat(61) + '\n');

    // Récupérer les documents
    const documents = await obtenirDocuments();

    if (documents.length === 0) {
      console.warn('[SYNC] ⚠️  Aucun document trouvé');
      return;
    }

    // Récupérer les docs déjà indexés
    const docsIndexees = await obtenirDocumentsIndexes();
    const nonIndexes = documents.filter(d => !docsIndexees.has(d.id));

    console.log(`[SYNC] 📊 Statistiques:`);
    console.log(`   • Total documents: ${documents.length}`);
    console.log(`   • Déjà indexés: ${docsIndexees.size}`);
    console.log(`   • À traiter: ${nonIndexes.length}\n`);
    console.log('═'.repeat(61) + '\n');

    if (nonIndexes.length === 0) {
      console.log('[SYNC] ✨ Tous les documents sont déjà indexés!\n');
      return;
    }

    // Traiter les documents
    let tousLesEmbeddings = [];

    for (let i = 0; i < nonIndexes.length; i++) {
      const embeddings = await traiterDocument(
        nonIndexes[i],
        i + 1,
        nonIndexes.length,
        docsIndexees
      );

      tousLesEmbeddings = tousLesEmbeddings.concat(embeddings);
    }

    // Insérer tous les embeddings
    const inserted = await insererEmbeddings(tousLesEmbeddings);

    // Afficher les statistiques finales
    stats.tempsFin = Date.now();
    const duree = Math.round((stats.tempsFin - stats.tempsDebut) / 1000);

    console.log('\n' + '═'.repeat(61));
    console.log('📊 RÉSUMÉ DE SYNCHRONISATION');
    console.log('═'.repeat(61) + '\n');
    console.log(`✅ Documents traités: ${stats.documentsTraites}`);
    console.log(`❌ Documents échoués: ${stats.documentsEchoues}`);
    console.log(`📝 Chunks créés: ${stats.chunksCrees}`);
    console.log(`🚀 Embeddings générés: ${stats.embeddingsGeneres}`);
    console.log(`❌ Embeddings échoués: ${stats.embeddingsEchoues}`);
    console.log(`💾 Embeddings insérés: ${inserted}`);
    console.log(`⏱️  Durée totale: ${duree}s`);
    console.log('\n' + '═'.repeat(61) + '\n');

    if (stats.documentsEchoues > 0) {
      console.warn(`⚠️  ${stats.documentsEchoues} document(s) ont rencontré des erreurs`);
    }

    console.log('✨ Synchronisation terminée!\n');

  } catch (error) {
    console.error(`\n[SYNC] 💥 Erreur critique: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// ============================================================
// DÉMARRAGE
// ============================================================

console.log('[SYNC] 🚀 Démarrage de la synchronisation...\n');

synchroniser()
  .catch(error => {
    console.error(`\n[SYNC] 💥 Erreur non gérée: ${error.message}`);
    process.exit(1);
  })
  .finally(() => {
    console.log('[SYNC] ✅ Processus terminé\n');
  });
