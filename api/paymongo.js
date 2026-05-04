export default async function handler(req, res) {
  const rawTarget = req.query.target;
  const target = Array.isArray(rawTarget) ? rawTarget[0] : rawTarget;

  if (!target || typeof target !== 'string') {
    return res.status(400).json({
      errors: [{ detail: 'Missing or invalid target query parameter' }],
    });
  }

  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) {
    return res.status(500).json({
      errors: [{ detail: 'PAYMONGO_SECRET_KEY is not configured' }],
    });
  }

  const url = `https://api.paymongo.com/v1/${target}`;
  const auth = `Basic ${Buffer.from(`${key}:`).toString('base64')}`;

  try {
    if (req.method === 'GET') {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: auth,
        },
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    if (req.method === 'POST') {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: auth,
        },
        body: JSON.stringify(req.body ?? {}),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
