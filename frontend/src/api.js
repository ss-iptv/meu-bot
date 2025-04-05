const API_URL = 'http://localhost:3000';

// Connect Wallet Function
async function connectWallet(publicKey) {
  const response = await fetch(`${API_URL}/connect-wallet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ publicKey }),
  });
  return response.json();
}

// List Tokens Function
async function listTokens() {
  const response = await fetch(`${API_URL}/list-tokens`);
  return response.json();
}

// Trade Token Function
async function tradeToken(publicKey, token, amount) {
  const response = await fetch(`${API_URL}/trade-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ publicKey, token, amount }),
  });
  return response.json();
}