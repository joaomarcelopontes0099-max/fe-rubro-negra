// Vercel Serverless Function
// Envia o pedido para a API de vendas da UTMify (dashboard "Fe Rubro-Negra"),
// usando os dados do cliente e do pedido que o checkout ja tem em memoria
// no momento em que gera o Pix (waiting_payment) e quando o pagamento
// e confirmado via polling em /api/consulta-pix (paid).
// Documentacao: POST https://api.utmify.com.br/api-credentials/orders

function nowUtmifyFormat(date) {
  const d = date || new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const apiToken = process.env.UTMIFY_API_TOKEN;
  if (!apiToken) {
    // Nao derruba o checkout se a UTMify ainda nao estiver configurada.
    res.status(200).json({ skipped: true, reason: 'utmify_not_configured' });
    return;
  }

  try {
    const body = req.body || {};
    const {
      orderId,
      status, // 'waiting_payment' | 'paid'
      amount, // em reais
      customer = {},
      trackingParameters = {}
    } = body;

    if (!orderId || !status || !amount) {
      res.status(422).json({ error: 'campos_obrigatorios_faltando' });
      return;
    }

    const priceInCents = Math.round(Number(amount) * 100);
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '';
    const now = nowUtmifyFormat();
    const isPaid = status === 'paid';

    const payload = {
      orderId: String(orderId),
      platform: 'Fe Rubro-Negra',
      paymentMethod: 'pix',
      status: isPaid ? 'paid' : 'waiting_payment',
      createdAt: now,
      approvedDate: isPaid ? now : null,
      refundedAt: null,
      customer: {
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || null,
        document: customer.document || null,
        country: 'BR',
        ip: ip
      },
      products: [
        {
          id: 'camisa-flamengo-jesus-rei',
          name: 'Camisa Flamengo Jesus Rei',
          planId: null,
          planName: null,
          quantity: 1,
          priceInCents: priceInCents
        }
      ],
      trackingParameters: {
        src: trackingParameters.src || null,
        sck: trackingParameters.sck || null,
        utm_source: trackingParameters.utm_source || null,
        utm_campaign: trackingParameters.utm_campaign || null,
        utm_medium: trackingParameters.utm_medium || null,
        utm_content: trackingParameters.utm_content || null,
        utm_term: trackingParameters.utm_term || null
      },
      commission: {
        totalPriceInCents: priceInCents,
        gatewayFeeInCents: 0,
        userCommissionInCents: priceInCents,
        currency: 'BRL'
      },
      isTest: false
    };

    const r = await fetch('https://api.utmify.com.br/api-credentials/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': apiToken
      },
      body: JSON.stringify(payload)
    });

    const respData = await r.json().catch(() => null);

    if (!r.ok) {
      console.error('[utmify-order] erro', r.status, JSON.stringify(respData));
      res.status(200).json({ sent: false, status: r.status, error: respData });
      return;
    }

    res.status(200).json({ sent: true });
  } catch (e) {
    console.error('[utmify-order] excecao', e && e.message);
    res.status(200).json({ sent: false, error: 'internal_error' });
  }
};
