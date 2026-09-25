// Endpoint que recebe os webhooks do Simplify (Depósito Gerado / Depósito Aprovado).
// Por enquanto apenas registra o evento nos logs da Vercel.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const event = req.body;
    console.log('[Simplify Webhook] Evento recebido:', JSON.stringify(event));
  } catch (err) {
    console.error('[Simplify Webhook] Erro ao processar evento:', err);
  }

  res.status(200).json({ received: true });
}
