const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');

const app = express();
app.use(bodyParser.json());

const dbPath = './db.json';
let db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

const connection = new Connection(clusterApiUrl('mainnet-beta'));

// Connect Wallet Endpoint
app.post('/connect-wallet', (req, res) => {
  const { publicKey } = req.body;
  if (!publicKey) return res.status(400).json({ error: 'Public key is required' });

  const user = { publicKey, transactions: [] };
  db.users.push(user);
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

  res.json({ message: 'Wallet connected', user });
});

// List Tokens Endpoint
app.get('/list-tokens', async (req, res) => {
  // Implement logic to list tokens
  res.json({ tokens: [] });
});

// Trade Token Endpoint
app.post('/trade-token', async (req, res) => {
  const { publicKey, token, amount } = req.body;
  // Implement logic to trade token
  res.json({ message: 'Trade executed' });
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});