// Lee la cantidad pública de seguidores de TikTok e Instagram y la guarda en
// seguidores.json (la página la muestra en las pastillas oscuras).
//
// Cómo funciona: las dos redes muestran los seguidores en la "vista previa"
// del perfil (la que ven WhatsApp o Facebook al pegar el enlace). Este script
// pide esa vista previa y saca el número de ahí. No necesita iniciar sesión.
//
// Se ejecuta solo todos los días desde GitHub (ver .github/workflows/seguidores.yml).
// También se puede correr a mano:  node tools/seguidores.js

const fs = require('fs');
const path = require('path');

const ARCHIVO = path.join(__dirname, '..', 'seguidores.json');

// ✏️ Si cambias de usuario en alguna red, actualiza aquí el enlace.
const REDES = {
  tiktok:    'https://www.tiktok.com/@zulibethrestrepougc',
  instagram: 'https://www.instagram.com/zulibethrestrepo14/',
};

// Se prueban en orden hasta que alguno devuelva la cifra.
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

// Busca "<número> Followers" (o "seguidores") en la descripción og: del HTML.
function extraerSeguidores(html) {
  const meta = /<meta[^>]+og:description[^>]*>/i.exec(html);
  if (!meta) return null;
  const contenido = /content\s*=\s*"([^"]*)"/i.exec(meta[0]);
  if (!contenido) return null;
  const m = /(\d[\d.,]*)\s*([kKmM])?\s*(followers|seguidores)/i.exec(contenido[1]);
  return m ? aNumero(m[1], m[2]) : null;
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

async function seguidoresDe(red, url) {
  for (const agente of AGENTES) {
    try {
      const html = await descargar(url, agente);
      const n = extraerSeguidores(html);
      if (n !== null && n >= 0) {
        console.log(`✔ ${red}: ${n} seguidores`);
        return n;
      }
      console.log(`  ${red}: la respuesta no trae la cifra (agente "${agente.split('/')[0]}")`);
    } catch (e) {
      console.log(`  ${red}: falló con "${agente.split('/')[0]}" → ${e.message}`);
    }
  }
  return null;
}

async function principal() {
  let anterior = {};
  try { anterior = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')); } catch (e) { /* primera vez */ }

  const nuevo = { ...anterior };
  let logrados = 0;

  for (const [red, url] of Object.entries(REDES)) {
    const n = await seguidoresDe(red, url);
    if (n === null) {
      console.log(`✘ ${red}: no se pudo leer hoy; se conserva el valor anterior (${anterior[red] ?? 'ninguno'})`);
      continue;
    }
    nuevo[red] = n;
    logrados++;
  }

  if (logrados === 0) {
    console.error('No se pudo leer ninguna red. El archivo queda como estaba.');
    process.exit(1);
  }

  nuevo.actualizado = new Date().toISOString();

  const sinCambios = Object.keys(REDES).every((red) => anterior[red] === nuevo[red]);
  if (sinCambios && anterior.actualizado) {
    console.log('Las cifras no cambiaron desde la última vez.');
    // Igual se guarda la fecha para saber que el robot sí corrió.
  }

  fs.writeFileSync(ARCHIVO, JSON.stringify(nuevo, null, 2) + '\n');
  console.log('Guardado en seguidores.json →', JSON.stringify(nuevo));
}

principal().catch((e) => { console.error(e); process.exit(1); });
