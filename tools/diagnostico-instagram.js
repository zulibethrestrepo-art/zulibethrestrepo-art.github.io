// Diagnóstico temporal: prueba desde GitHub Actions distintas formas de pedirle
// a Instagram (y TikTok, de control) la cifra de seguidores, y deja el resultado
// en diagnostico-instagram.txt. Se borra cuando termine el diagnóstico.
const fs = require('fs');

const PERFIL = 'zulibethrestrepo14';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const PRUEBAS = [
  ['IG html facebookexternalhit', 'https://www.instagram.com/' + PERFIL + '/', { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' }],
  ['IG html WhatsApp',            'https://www.instagram.com/' + PERFIL + '/', { 'User-Agent': 'WhatsApp/2.23.20.0' }],
  ['IG html Twitterbot',          'https://www.instagram.com/' + PERFIL + '/', { 'User-Agent': 'Twitterbot/1.0' }],
  ['IG html Googlebot',           'https://www.instagram.com/' + PERFIL + '/', { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }],
  ['IG html Chrome',              'https://www.instagram.com/' + PERFIL + '/', { 'User-Agent': CHROME, 'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8', 'Accept': 'text/html' }],
  ['IG api web_profile_info www', 'https://www.instagram.com/api/v1/users/web_profile_info/?username=' + PERFIL, { 'User-Agent': CHROME, 'x-ig-app-id': '936619743392459', 'Accept': '*/*' }],
  ['IG api web_profile_info i.',  'https://i.instagram.com/api/v1/users/web_profile_info/?username=' + PERFIL, { 'User-Agent': CHROME, 'x-ig-app-id': '936619743392459', 'Accept': '*/*' }],
  ['IG html ?__a=1&__d=dis',      'https://www.instagram.com/' + PERFIL + '/?__a=1&__d=dis', { 'User-Agent': CHROME, 'Accept': '*/*' }],
  ['TikTok control facebookexternalhit', 'https://www.tiktok.com/@zulibethrestrepougc', { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' }],
];

async function pedir(url, headers) {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), 25000);
  try {
    const r = await fetch(url, { headers, redirect: 'follow', signal: control.signal });
    const cuerpo = await r.text();
    return { status: r.status, url: r.url, cuerpo };
  } finally { clearTimeout(t); }
}

function resumen(cuerpo) {
  const og = /<meta[^>]+og:description[^>]*content\s*=\s*"([^"]{0,140})/i.exec(cuerpo);
  const titulo = /<title>([^<]{0,80})/i.exec(cuerpo);
  const followers = /"edge_followed_by":\{"count":(\d+)/.exec(cuerpo) || /"follower_count":(\d+)/.exec(cuerpo);
  return {
    bytes: cuerpo.length,
    og: og ? og[1] : null,
    titulo: titulo ? titulo[1] : null,
    followersJson: followers ? followers[1] : null,
    inicio: cuerpo.slice(0, 160).replace(/\s+/g, ' '),
  };
}

(async () => {
  const lineas = ['Diagnóstico Instagram desde GitHub Actions — ' + new Date().toISOString()];
  try {
    const ip = await pedir('https://api.ipify.org?format=text', {});
    lineas.push('IP pública del runner: ' + ip.cuerpo.trim());
  } catch (e) { lineas.push('IP: no se pudo obtener (' + e.message + ')'); }

  for (const [nombre, url, headers] of PRUEBAS) {
    try {
      const r = await pedir(url, headers);
      const s = resumen(r.cuerpo);
      lineas.push('');
      lineas.push('## ' + nombre);
      lineas.push('HTTP ' + r.status + ' · ' + s.bytes + ' bytes · url final: ' + r.url);
      lineas.push('og:description: ' + (s.og || '(no viene)'));
      lineas.push('title: ' + (s.titulo || '(no viene)'));
      lineas.push('followers en JSON: ' + (s.followersJson || '(no viene)'));
      lineas.push('inicio: ' + s.inicio);
    } catch (e) {
      lineas.push('');
      lineas.push('## ' + nombre);
      lineas.push('ERROR: ' + e.message);
    }
  }
  fs.writeFileSync('diagnostico-instagram.txt', lineas.join('\n') + '\n');
  console.log(lineas.join('\n'));
})();
