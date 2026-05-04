export default async function handler(req, res) {
    const { target } = req.query;
  
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    try {
      const response = await fetch(`https://api.paymongo.com/v1/${target}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`
        },
        body: JSON.stringify(req.body)
      });
  
      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }