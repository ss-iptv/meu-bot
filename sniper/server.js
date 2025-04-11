require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');
const { Keypair, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const bs58 = require('bs58');
const bodyParser = require('body-parser');
const axios = require('axios');
const { WebSocket } = require('ws');

// Configurações
const PORT = process.env.PORT || 3000;
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const WSS_URL = process.env.WSS_URL || 'wss://api.mainnet-beta.solana.com';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Classe principal do bot
class SolanaTradingBot {
  constructor() {
    this.connection = new Connection(RPC_URL, 'confirmed');
    this.walletFile = 'wallet.json';
    this.keypair = null;
    this.tokenList = [];
    this.orders = [];
    this.sniperBots = {};
    this.tokenHunter = new TokenHunter(this);
    
    this.loadDefaultTokens();
    this.loadWallet();
  }

  // Métodos da Carteira
  createWallet() {
    try {
      this.keypair = Keypair.generate();
      this.saveWallet();
      return { 
        success: true, 
        publicKey: this.keypair.publicKey.toString(),
        privateKey: bs58.encode(this.keypair.secretKey)
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  importWallet(privateKey) {
    try {
      const decoded = bs58.decode(privateKey);
      this.keypair = Keypair.fromSecretKey(decoded);
      this.saveWallet();
      return { success: true };
    } catch (error) {
      return { success: false, message: 'Chave privada inválida' };
    }
  }

  saveWallet() {
    if (!this.keypair) return;
    const data = {
      publicKey: this.keypair.publicKey.toString(),
      privateKey: Array.from(this.keypair.secretKey)
    };
    fs.writeFileSync(this.walletFile, JSON.stringify(data, null, 2));
  }

  loadWallet() {
    if (!fs.existsSync(this.walletFile)) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.walletFile));
      this.keypair = Keypair.fromSecretKey(new Uint8Array(data.privateKey));
    } catch (error) {
      this.log(`Erro ao carregar carteira: ${error.message}`);
    }
  }

  async getBalance() {
    if (!this.keypair) return 0;
    try {
      const balance = await this.connection.getBalance(this.keypair.publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      this.log(`Erro ao obter saldo: ${error.message}`);
      return 0;
    }
  }

  async sendSol(toAddress, amount) {
    if (!this.keypair) {
      return { success: false, message: 'Carteira não carregada' };
    }

    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.keypair.publicKey,
          toPubkey: new PublicKey(toAddress),
          lamports: amount * LAMPORTS_PER_SOL
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.keypair]
      );

      return { success: true, txId: signature };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Métodos de Trading
  async executeTrade(action, tokenAddress, amount, orderType = 'market', price = null) {
    if (!this.keypair) {
      return { success: false, message: 'Carteira não carregada' };
    }

    try {
      // Simulação de trade - implementação real vai aqui
      const order = {
        id: `order_${Date.now()}`,
        action,
        tokenAddress,
        amount,
        orderType,
        price,
        status: 'filled',
        timestamp: new Date().toISOString()
      };

      this.orders.push(order);
      io.emit('order_update', order);

      return { success: true, order };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Métodos do Sniper
  startSniper(tokenAddress, amount, params = {}) {
    const sniperId = `sniper_${tokenAddress}_${Date.now()}`;
    
    this.sniperBots[sniperId] = {
      tokenAddress,
      amount,
      params,
      active: true,
      createdAt: new Date().toISOString()
    };

    // Simulação - implementação real monitoraria o token
    this.log(`Sniper iniciado para token ${tokenAddress}`);
    
    return { success: true, sniperId };
  }

  stopSniper(sniperId) {
    if (this.sniperBots[sniperId]) {
      this.sniperBots[sniperId].active = false;
      this.log(`Sniper ${sniperId} parado`);
      return { success: true };
    }
    return { success: false, message: 'Sniper não encontrado' };
  }

  // Token Hunter
  startTokenHunter(config = {}) {
    return this.tokenHunter.start(config);
  }

  stopTokenHunter() {
    return this.tokenHunter.stop();
  }

  // Utilitários
  loadDefaultTokens() {
    this.tokenList = [
      { symbol: 'SOL', address: 'So11111111111111111111111111111111111111112' },
      { symbol: 'USDC', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
      { symbol: 'USDT', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' }
    ];
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    io.emit('log', logMessage);
  }
}

// Classe Token Hunter
class TokenHunter {
  constructor(bot) {
    this.bot = bot;
    this.active = false;
    this.activeTrades = {};
    this.config = {
      liquidityThreshold: 500,
      scanInterval: 120000,
      maxQuickFlipTokens: 3,
      maxLockedLiquidityTokens: 2
    };
  }

  async start(config = {}) {
    this.config = { ...this.config, ...config };
    this.active = true;
    
    this.scanInterval = setInterval(() => {
      this.scanNewTokens();
    }, this.config.scanInterval);

    this.bot.log('Token Hunter iniciado');
    this.updateStatus();
    return { success: true };
  }

  stop() {
    clearInterval(this.scanInterval);
    this.active = false;
    this.bot.log('Token Hunter parado');
    this.updateStatus();
    return { success: true };
  }

  async scanNewTokens() {
    if (!this.active) return;

    try {
      // Simulação - buscar novos tokens de uma API real
      const newTokens = await this.fetchNewTokens();
      
      for (const token of newTokens) {
        if (this.shouldProcessToken(token)) {
          this.processNewToken(token);
        }
      }
    } catch (error) {
      this.bot.log(`Erro no scan: ${error.message}`);
    }
  }

  async fetchNewTokens() {
    // Implementação real buscaria de uma API como Birdeye ou DexScreener
    return [
      {
        address: 'NEW_TOKEN_' + Date.now(),
        symbol: 'NEW',
        price: 0.0001 + Math.random() * 0.0001,
        liquidity: 500 + Math.random() * 1000,
        lockedLiquidity: Math.random() > 0.5,
        creationTime: Date.now() - (Math.random() * 86400000) // 0-24 horas atrás
      }
    ];
  }

  shouldProcessToken(token) {
    return (
      !this.activeTrades[token.address] &&
      token.liquidity >= this.config.liquidityThreshold &&
      (Date.now() - token.creationTime) < 86400000 // Menos de 24 horas
    );
  }

  processNewToken(token) {
    if (token.lockedLiquidity) {
      if (this.countActiveTrades('locked-liquidity') < this.config.maxLockedLiquidityTokens) {
        this.monitorLockedLiquidityToken(token);
      }
    } else {
      if (this.countActiveTrades('quick-flip') < this.config.maxQuickFlipTokens) {
        this.executeQuickFlip(token);
      }
    }
  }

  countActiveTrades(type) {
    return Object.values(this.activeTrades).filter(t => t.type === type).length;
  }

  async executeQuickFlip(token) {
    const balance = await this.bot.getBalance();
    const amount = balance * 0.1; // 10% do saldo
    
    const trade = {
      id: `trade_${Date.now()}`,
      type: 'quick-flip',
      token: token.symbol,
      address: token.address,
      buyPrice: token.price,
      targetPrice: token.price * 1.1, // 10% de lucro
      amount,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    this.activeTrades[token.address] = trade;
    this.bot.log(`Quick flip iniciado para ${token.symbol} (${token.address})`);
    this.updateStatus();

    // Monitorar preço para venda
    this.monitorQuickFlip(trade);
  }

  async monitorQuickFlip(trade) {
    const checkInterval = setInterval(async () => {
      if (!this.activeTrades[trade.address]) {
        clearInterval(checkInterval);
        return;
      }

      try {
        const currentPrice = await this.getTokenPrice(trade.address);
        
        if (currentPrice >= trade.targetPrice) {
          // Vender quando atingir o target
          const result = await this.bot.executeTrade(
            'sell',
            trade.address,
            trade.amount,
            'market'
          );

          if (result.success) {
            this.bot.log(`Vendido ${trade.token} com ${((currentPrice - trade.buyPrice) / trade.buyPrice * 100).toFixed(2)}% de lucro`);
            delete this.activeTrades[trade.address];
            this.updateStatus();
          }
        }
      } catch (error) {
        this.bot.log(`Erro no monitoramento: ${error.message}`);
      }
    }, 30000); // Verificar a cada 30 segundos
  }

  async monitorLockedLiquidityToken(token) {
    const tradeId = `locked_${token.address}`;
    let investedAmount = 0;
    let investmentPercent = 0.25; // Começa com 25%
    
    this.activeTrades[tradeId] = {
      id: tradeId,
      type: 'locked-liquidity',
      token: token.symbol,
      address: token.address,
      buyPrice: token.price,
      positions: [],
      status: 'monitoring',
      createdAt: new Date().toISOString()
    };
    
    this.updateStatus();

    const checkInterval = setInterval(async () => {
      if (!this.activeTrades[tradeId]) {
        clearInterval(checkInterval);
        return;
      }

      try {
        const currentPrice = await this.getTokenPrice(token.address);
        const percentageChange = ((currentPrice - token.price) / token.price) * 100;
        const balance = await this.bot.getBalance();

        // Estratégia de entrada escalonada
        if (percentageChange >= 100 && investedAmount === 0) {
          const amount = balance * investmentPercent;
          const result = await this.bot.executeTrade('buy', token.address, amount, 'market');
          
          if (result.success) {
            investedAmount += amount;
            this.activeTrades[tradeId].positions.push({
              amount,
              entryPrice: currentPrice,
              entryTime: new Date().toISOString()
            });
            this.updateStatus();
          }
        }
        else if (percentageChange >= 150 && investmentPercent < 0.61) {
          const additionalAmount = balance * 0.12;
          const result = await this.bot.executeTrade('buy', token.address, additionalAmount, 'market');
          
          if (result.success) {
            investmentPercent += 0.12;
            investedAmount += additionalAmount;
            this.activeTrades[tradeId].positions.push({
              amount: additionalAmount,
              entryPrice: currentPrice,
              entryTime: new Date().toISOString()
            });
            this.updateStatus();
          }
        }

        // Saída estratégica
        if (percentageChange >= 300 || percentageChange <= -30) {
          clearInterval(checkInterval);
          
          if (investedAmount > 0) {
            const result = await this.bot.executeTrade('sell', token.address, investedAmount, 'market');
            if (result.success) {
              this.bot.log(`Trade encerrado para ${token.symbol} com ${percentageChange.toFixed(2)}%`);
              delete this.activeTrades[tradeId];
              this.updateStatus();
            }
          }
        }
      } catch (error) {
        this.bot.log(`Erro no monitoramento: ${error.message}`);
      }
    }, 60000); // Verificar a cada minuto
  }

  async getTokenPrice(tokenAddress) {
    // Simulação - implementação real usaria API de preços
    return 0.0001 + Math.random() * 0.0002;
  }

  updateStatus() {
    io.emit('hunter_status', {
      active: this.active,
      config: this.config,
      activeTrades: Object.values(this.activeTrades)
    });
  }
}

// Inicialização do bot
const bot = new SolanaTradingBot();

// Rotas da API

// Carteira
app.post('/api/wallet/create', (req, res) => {
  const result = bot.createWallet();
  res.json(result);
});

app.post('/api/wallet/import', (req, res) => {
  const result = bot.importWallet(req.body.privateKey);
  res.json(result);
});

app.get('/api/wallet/balance', async (req, res) => {
  const balance = await bot.getBalance();
  res.json({ success: true, balance });
});

app.post('/api/wallet/send', async (req, res) => {
  const { toAddress, amount } = req.body;
  const result = await bot.sendSol(toAddress, amount);
  res.json(result);
});

// Trading
app.post('/api/trade/execute', async (req, res) => {
  const { action, tokenAddress, amount, orderType, price } = req.body;
  const result = await bot.executeTrade(action, tokenAddress, amount, orderType, price);
  res.json(result);
});

app.get('/api/trade/orders', (req, res) => {
  res.json({ success: true, orders: bot.orders });
});

// Sniper
app.post('/api/sniper/start', (req, res) => {
  const { tokenAddress, amount, params } = req.body;
  const result = bot.startSniper(tokenAddress, amount, params);
  res.json(result);
});

app.post('/api/sniper/stop', (req, res) => {
  const { sniperId } = req.body;
  const result = bot.stopSniper(sniperId);
  res.json(result);
});

app.get('/api/sniper/active', (req, res) => {
  res.json({ success: true, snipers: bot.sniperBots });
});

// Token Hunter
app.post('/api/hunter/start', (req, res) => {
  const result = bot.startTokenHunter(req.body.config);
  res.json(result);
});

app.post('/api/hunter/stop', (req, res) => {
  const result = bot.stopTokenHunter();
  res.json(result);
});

app.post('/api/hunter/config', (req, res) => {
  Object.assign(bot.tokenHunter.config, req.body);
  bot.tokenHunter.updateStatus();
  res.json({ success: true });
});

app.get('/api/hunter/status', (req, res) => {
  res.json({
    success: true,
    active: bot.tokenHunter.active,
    config: bot.tokenHunter.config,
    activeTrades: Object.values(bot.tokenHunter.activeTrades)
  });
});

// Configurações
app.post('/api/settings/rpc', (req, res) => {
  bot.connection = new Connection(req.body.rpcUrl, 'confirmed');
  res.json({ success: true });
});

// WebSocket
io.on('connection', (socket) => {
  console.log('Novo cliente conectado');
  
  socket.emit('init', {
    wallet: bot.keypair ? { publicKey: bot.keypair.publicKey.toString() } : null,
    balance: bot.walletBalance,
    hunterStatus: {
      active: bot.tokenHunter.active,
      config: bot.tokenHunter.config,
      activeTrades: Object.values(bot.tokenHunter.activeTrades)
    }
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

// Iniciar servidor
http.listen(PORT, () => {
  console.log(`
  ███████╗ ██████╗ ██╗      █████╗ ███╗   ██╗ █████╗ 
  ██╔════╝██╔═══██╗██║     ██╔══██╗████╗  ██║██╔══██╗
  ███████╗██║   ██║██║     ███████║██╔██╗ ██║███████║
  ╚════██║██║   ██║██║     ██╔══██║██║╚██╗██║██╔══██║
  ███████║╚██████╔╝███████╗██║  ██║██║ ╚████║██║  ██║
  ╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝
  
  Solana Trading Bot rodando na porta ${PORT}
  `);

  // Atualizar saldo periodicamente
  setInterval(async () => {
    const balance = await bot.getBalance();
    io.emit('balance_update', { balance });
  }, 30000);
});
