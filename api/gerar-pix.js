// Vercel Serverless Function
// Recebe os dados do pedido vindos do checkout e cria uma cobranca Pix
// na Simplify, usando as credenciais guardadas em variaveis de ambiente
// (SIMPLIFY_CLIENT_ID / SIMPLIFY_CLIENT_SECRET). O front-end nunca ve
// essas credenciais.

const QRCode = require('qrcode');

const SIMPLIFY_BASE_URL = 'https://simplifybr.com/api/v1';

function onlyDigits(str) {
    return (str || '').toString().replace(/\D/g, '');
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
          res.status(200).end();
          return;
    }

    if (req.method !== 'POST') {
          res.status(405).json({ error: 'method_not_allowed' });
          return;
    }

    const clientId = process.env.SIMPLIFY_CLIENT_ID;
    const clientSecret = process.env.SIMPLIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
          res.status(500).json({ error: 'gateway_not_configured', message: 'Credenciais da Simplify nao configuradas no servidor.' });
          return;
    }

    try {
          const body = req.body || {};
          const amount = Number(body.amount);
          const name = (body.name || '').toString().trim();
          const email = (body.email || '').toString().trim();
          const document = onlyDigits(body.document);
          const phone = onlyDigits(body.phone);
          const externalId = (body.external_id || ('FRN' + Math.floor(100000 + Math.random() * 900000))).toString();

      if (!amount || amount <= 0 || !name || !email || !document || !phone) {
              res.status(422).json({ error: 'dados_invalidos', message: 'Preencha nome, e-mail, telefone e CPF corretamente.' });
              return;
      }

      const protocol = req.headers['x-forwarded-proto'] || 'https';
          const host = req.headers['x-forwarded-host'] || req.headers.host;
          const webhookURL = `${protocol}://${host}/api/webhook-simplify`;

      const simplifyRes = await fetch(`${SIMPLIFY_BASE_URL}/pix/deposit`, {
              method: 'POST',
              headers: {
                        'Client-id': clientId,
                        'Client-secret': clientSecret,
                        'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                        amount,
                        payer: { name, email, document, phone },
                        external_id: externalId,
                        webhookURL
              })
      });

      const data = await simplifyRes.json().catch(() => null);

      if (!simplifyRes.ok || !data) {
              res.status(simplifyRes.status || 502).json({
                        error: 'simplify_error',
                        message: (data && (data.message || data.error)) || 'Nao foi possivel gerar o Pix agora.'
              });
              return;
      }

      let qrcodeImage = null;
          if (data.qrcode) {
                  try {
                            qrcodeImage = await QRCode.toDataURL(data.qrcode, { margin: 1, width: 280 });
                  } catch (e) {
                            qrcodeImage = null;
                  }
          }

      res.status(200).json({
              internal_id: data.internal_id,
              external_id: data.external_id || externalId,
              status: data.status || 'pending',
              pix_copia_cola: data.qrcode || null,
              qrcode_image: qrcodeImage,
              amount: data.amount || amount
      });
    } catch (err) {
          res.status(500).json({ error: 'server_error', message: 'Erro interno ao gerar o Pix.' });
    }
};
