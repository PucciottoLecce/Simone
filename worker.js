/**
 * Cloudflare Worker — Proxy sicuro per Turso DB
 * Preventivi Pro
 *
 * Variabili d'ambiente da impostare su Cloudflare Dashboard:
 *   TURSO_URL   = https://preventivi-pro-joonior.aws-eu-west-1.turso.io
 *   TURSO_TOKEN = <il tuo JWT Turso>
 *   APP_SECRET  = <stringa segreta per autenticare l'app, es. uuid4>
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',        // restringe al tuo dominio in produzione
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
};

export default {
  async fetch(request, env) {
    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Solo POST
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // Autenticazione tramite header segreto
    const secret = request.headers.get('X-App-Secret');
    if (!secret || secret !== env.APP_SECRET) {
      return json({ error: 'Unauthorized' }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const { sql, args } = body;
    if (!sql || typeof sql !== 'string') {
      return json({ error: 'Missing or invalid sql field' }, 400);
    }

    // Chiamata a Turso
    try {
      const tursoRes = await fetch(`${env.TURSO_URL}/v2/pipeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.TURSO_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              type: 'execute',
              stmt: {
                sql,
                args: (args || []).map(v => {
                  if (v === null || v === undefined) return { type: 'null' };
                  if (typeof v === 'number')         return { type: 'float', value: v };
                  return { type: 'text', value: String(v) };
                }),
              },
            },
            { type: 'close' },
          ],
        }),
      });

      if (!tursoRes.ok) {
        const text = await tursoRes.text();
        return json({ error: `Turso HTTP ${tursoRes.status}: ${text}` }, 502);
      }

      const data = await tursoRes.json();
      const result = data.results[0];

      if (result.type === 'error') {
        return json({ error: result.error.message }, 400);
      }

      // Restituisce righe già deserializzate in oggetti chiave-valore
      const raw = result.response.result;
      const cols = raw.cols.map(c => c.name);
      const rows = raw.rows.map(row => {
        const obj = {};
        cols.forEach((c, i) => { obj[c] = row[i]?.value ?? null; });
        return obj;
      });

      return json({ rows, cols, rowsAffected: raw.rows_affected ?? 0 });

    } catch (err) {
      return json({ error: err.message }, 500);
    }
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
