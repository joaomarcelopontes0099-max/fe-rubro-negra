// Vercel Serverless Function
// Recebe as notificacoes de status (deposit.pending / deposit.paid /
// deposit.cancelled) enviadas pela Simplify. Hoje so confirma o
// recebimento (200 OK) para a Simplify nao ficar reenviando; a
// confirmacao do pedido no checkout e feita pela consulta em
// /api/consulta-pix. Fica pronto para, no futuro, disparar e-mail,
// notificacao no WhatsApp etc. quando o pagamento cair.

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
          res.status(405).json({ error: 'method_not_allowed' });
          return;
    }
  
    try {
          const payload = req.body || {};
          // Log simples para auditoria (aparece nos Logs da Vercel).
          console.log('[webhook-simplify]', JSON.stringify({
                  event: payload.event,
                  internal_id: payload.internal_id,
                  external_id: payload.external_id,
                  status: payload.status,
                  amount: payload.amount
          }));
    } catch (e) {
          // nao falha o webhook por erro de log
    }
  
    res.status(200).json({ received: true });
};
 
