// Vercel Serverless Function
// Consulta na Simplify o status atual de um deposito Pix (aprovado ou nao),
// usado pelo checkout para saber quando liberar a confirmacao do pedido.

const SIMPLIFY_BASE_URL = 'https://simplifybr.com/api/v1';

async function tryFetch(url, headers) {
    try {
          const r = await fetch(url, { method: 'GET', headers });
          if (!r.ok) return null;
          const data = await r.json().catch(() => null);
          return data;
    } catch (e) {
          return null;
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
          res.status(200).end();
          return;
    }

    if (req.method !== 'GET') {
          res.status(405).json({ error: 'method_not_allowed' });
          return;
    }

    const clientId = process.env.SIMPLIFY_CLIENT_ID;
    const clientSecret = process.env.SIMPLIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
          res.status(500).json({ error: 'gateway_not_configured' });
          return;
    }

    const internalId = (req.query && req.query.internal_id) || '';
    if (!internalId) {
          res.status(422).json({ error: 'internal_id_obrigatorio' });
          return;
    }

    const headers = {
          'Client-id': clientId,
          'Client-secret': clientSecret,
          'Content-Type': 'application/json'
    };

    // A Simplify nao documenta publicamente a URL exata de consulta,
    // entao tentamos os padroes REST mais provaveis, nessa ordem.
    const candidates = [
          `${SIMPLIFY_BASE_URL}/pix/deposit/${internalId}`,
          `${SIMPLIFY_BASE_URL}/pix/deposit?internal_id=${encodeURIComponent(internalId)}`
        ];

    let data = null;
    for (const url of candidates) {
          data = await tryFetch(url, headers);
          if (data) break;
    }

    if (!data) {
          res.status(200).json({ status: 'unknown' });
          return;
    }

    const rawStatus = (data.status || '').toString().toLowerCase();
    const paid = rawStatus === 'paid' || rawStatus === 'approved' || rawStatus === 'aprovado';

    res.status(200).json({
          status: paid ? 'paid' : (rawStatus || 'pending'),
          amount: data.amount
    });
};
