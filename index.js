const express = require('express')
const fetch = globalThis.fetch || require('node-fetch')
const app = express()
app.use(express.json())

const API_KEY = process.env.CINETPAY_API_KEY
const API_PASSWORD = process.env.CINETPAY_ACCOUNT_PASSWORD
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://idc-maize-shop.vercel.app'

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-proxy-secret')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// Protection : clé secrète partagée entre Vercel et ce proxy
app.use((req, res, next) => {
  if (req.path === '/health') return next()
  const secret = req.headers['x-proxy-secret']
  if (!secret || secret !== process.env.PROXY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.post('/payment', async (req, res) => {
  try {
    // Étape 1 : Login CinetPay
    const loginRes = await fetch('https://api.cinetpay.net/v1/oauth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: API_KEY, api_password: API_PASSWORD }),
    })
    const loginData = await loginRes.json()
    const token = loginData.token || loginData.access_token || loginData.data?.token
    if (!token) {
      return res.status(500).json({ error: 'Auth CinetPay échouée', detail: loginData })
    }

    // Étape 2 : Initiation du paiement
    const payRes = await fetch('https://api.cinetpay.net/v1/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(req.body),
    })
    const payData = await payRes.json()
    res.json(payData)
  } catch (err) {
    res.status(500).json({ error: 'Erreur proxy', detail: String(err) })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`CinetPay proxy running on port ${PORT}`))
