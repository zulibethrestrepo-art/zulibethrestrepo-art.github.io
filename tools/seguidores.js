// Lee las cifras públicas de TikTok e Instagram y las guarda en seguidores.json
// (la página de links, el portafolio y el media kit las leen de ahí).
//
// Cómo funciona: las dos redes muestran seguidores, seguidos y publicaciones
// en la "vista previa" del perfil (la que ven WhatsApp o Facebook al pegar el
// enlace). Este script pide esa vista previa y saca los números de ahí. No
// necesita iniciar sesión, y por eso mismo NO puede leer visualizaciones,
// alcance ni audiencia: esas cifras son privadas de cada cuenta.
//
// Se ejecuta solo todos los días desde GitHub (ver .github/workflows/seguidores.yml).
// También se puede correr a mano:  node tools/seguidores.js

const fs = require('fs');
const path = require('path');

const ARCHIVO = path.join(__dirname, '..', 'seguidores.json');
const HISTORIAL = path.join(__dirname, '..', 'historial.json');
const DIAS_HISTORIAL = 400; // poco más de un año de datos diarios

// ✏️ Si cambias de usuario en alguna red, actualiza aquí el enlace.
const REDES = {
  tiktok:    'https://www.tiktok.com/@zulibethrestrepougc',
  instagram: 'https://www.instagram.com/zulibethrestrepo14/',
};

// Se prueban en orden hasta que alguno devuelva las cifras.
const AGENTES = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'WhatsApp/2.23.20.0',
  'Twitterbot/1.0',
];

// "1,397" → 1397 · "1476" → 1476 · "20.4k" → 20400 · "1.2M" → 1200000
function aNumero(texto, sufijo) {
  const s = (sufijo || '').toLowerCase();
  if (s === 'k' || s === 'm') {
    const n = parseFloat(texto.replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * (s === 'k' ? 1e3 : 1e6)) : null;
  }
  const n = parseInt(texto.replace(/[.,\s]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

// Busca "<número> <palabra>" en un texto, p. ej. "1,397 Followers" o "20.4k Likes".
function cifra(texto, palabras) {
  const re = new RegExp('(\\d[\\d.,]*)\\s*([kKmM])?\\s*(' + palabras + ')\\b', 'i');
  const m = re.exec(texto);
  return m ? aNumero(m[1], m[2]) : null;
}

// Devuelve el texto de la descripción og: del HTML, o null si no está.
function descripcion(html) {
  const meta = /<meta[^>]+og:description[^>]*>/i.exec(html);
  if (!meta) return null;
  const contenido = /content\s*=\s*"([^"]*)"/i.exec(meta[0]);
  return contenido ? contenido[1] : null;
}

// Lo que se puede leer de cada red. "seguidores" es obligatorio; el resto, si aparece.
function extraer(red, html) {
  const d = descripcion(html);
  if (!d) return null;
  const seguidores = cifra(d, 'followers|seguidores');
  if (seguidores === null) return null;
  const datos = { seguidores, siguiendo: cifra(d, 'following|siguiendo|seguidos') };
  if (red === 'tiktok') datos.likes = cifra(d, 'likes|me gusta');
  if (red === 'instagram') datos.publicaciones = cifra(d, 'posts|publicaciones');
  return datos;
}

async function descargar(url, agente) {
  const control = new AbortController();
  const tiempo = setTimeout(() => control.abort(), 20000);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': agente, 'Accept': 'text/html,*/*' },
      redirect: 'follow',
      signal: control.signal,
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally {
    clearTimeout(tiempo);
  }
}

async function leerRed(red, url) {
  for (const agente of AGENTES) {
    try {
      const html = await descargar(url, agente);
      const datos = extraer(red, html);
      if (datos) {
        console.log(`✔ ${red}: ${JSON.stringify(datos)}`);
        return datos;
      }
      console.log(`  ${red}: la respuesta no trae la cifra (agente "${agente.split('/')[0]}")`);
    } catch (e) {
      console.log(`  ${red}: falló con "${agente.split('/')[0]}" → ${e.message}`);
    }
  }
  return null;
}

function leerJson(archivo, porDefecto) {
  try { return JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch (e) { return porDefecto; }
}

function guardarHistorial(nuevo) {
  const hoy = nuevo.actualizado.slice(0, 10); // AAAA-MM-DD
  const entrada = { fecha: hoy, tiktok: nuevo.tiktok, instagram: nuevo.instagram };
  let lista = leerJson(HISTORIAL, []);
  if (!Array.isArray(lista)) lista = [];
  lista = lista.filter((e) => e && e.fecha !== hoy); // una sola entrada por día
  lista.push(entrada);
  lista.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  if (lista.length > DIAS_HISTORIAL) lista = lista.slice(lista.length - DIAS_HISTORIAL);
  fs.writeFileSync(HISTORIAL, JSON.stringify(lista) + '\n');
  console.log(`Historial: ${lista.length} día(s) guardado(s) en historial.json`);
}

async function principal() {
  const anterior = leerJson(ARCHIVO, {});
  const nuevo = { ...anterior };
  let logrados = 0;

  for (const [red, url] of Object.entries(REDES)) {
    const datos = await leerRed(red, url);
    if (!datos) {
      console.log(`✘ ${red}: no se pudo leer hoy; se conserva el valor anterior (${anterior[red] ?? 'ninguno'})`);
      continue;
    }
    nuevo[red] = datos.seguidores;
    if (datos.siguiendo !== null) nuevo[red + '_siguiendo'] = datos.siguiendo;
    if (datos.likes != null) nuevo[red + '_likes'] = datos.likes;
    if (datos.publicaciones != null) nuevo[red + '_publicaciones'] = datos.publicaciones;
    logrados++;
  }

  if (logrados === 0) {
    console.error('No se pudo leer ninguna red. Los archivos quedan como estaban.');
    process.exit(1);
  }

  nuevo.actualizado = new Date().toISOString();

  const sinCambios = Object.keys(REDES).every((red) => anterior[red] === nuevo[red]);
  if (sinCambios && anterior.actualizado) {
    console.log('Los seguidores no cambiaron desde la última vez (igual se guarda la fecha).');
  }

  fs.writeFileSync(ARCHIVO, JSON.stringify(nuevo, null, 2) + '\n');
  console.log('Guardado en seguidores.json →', JSON.stringify(nuevo));

  if (typeof nuevo.tiktok === 'number' && typeof nuevo.instagram === 'number') guardarHistorial(nuevo);
}

principal().catch((e) => { console.error(e); process.exit(1); });
