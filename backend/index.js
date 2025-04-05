const express = require('express');
const socketIO = require('socket.io');
const http = require('http');
const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddressSync } = require('@solana/spl-token');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 4000;
const solanaConnection = new Connection(process.env.RPC_ENDPOINT);

app.use(express.json());

io.on('connection', (socket) => {
    console.log(`User: ${socket.id} connected`);
    pools();
    initialConnection();

    socket.on('disconnect', () => {
        console.log(`User: ${socket.id} disconnected`);
    });

    socket.on('autoSell', (autoSell) => {
        updateConfig('autoSell', autoSell);
    });

    socket.on('method', (method) => {
        updateConfig('onceBuy', method);
    });

    socket.on('jitoMode', (jitoMode) => {
        updateConfig('jitoMode', jitoMode);
    });

    socket.on('sell_option', (option) => {
        updateConfig('sellOptions', option);
    });

    socket.on('filter', (option) => {
        updateConfig('filterOptions', option);
    });

    socket.on('buy_option', (option) => {
        updateConfig('buyOptions', option);
    });

    socket.on('jitoFee', (jitoFee) => {
        updateConfig('jitoFee', jitoFee);
    });

    socket.on('running', (running) => {
        updateConfig('running', running);
    });

    socket.on('autobuy', (autobuy) => {
        updateConfig('autoBuy', autobuy);
    });

    socket.on('arbitrage', (arbitrage) => {
        updateConfig('arbitrage', arbitrage);
    });

    socket.on('arbitrage_option', (option) => {
        updateConfig('arbitrageOptions', option);
    });

    socket.on('mintOption', (option) => {
        const mintingData = JSON.parse(fs.readFileSync("minting.json", "utf8"));
        mintingData.wallets[option.num] = option.walletInfo;
        fs.writeFileSync('minting.json', JSON.stringify(mintingData, null, 4));
    });
});

const updateConfig = (key, value) => {
    const data = JSON.parse(fs.readFileSync("data.json", "utf8"));
    data[key] = value;
    fs.writeFileSync('data.json', JSON.stringify(data, null, 4));
    broadCast(data);
};

const broadCast = async (data) => {
    const balance = (await solanaConnection.getBalance(new PublicKey(data.pubKey))) / LAMPORTS_PER_SOL;
    const wsolAddr = getAssociatedTokenAddressSync(NATIVE_MINT, new PublicKey(data.pubKey));
    const wsolBalance = (await solanaConnection.getBalance(wsolAddr)) / LAMPORTS_PER_SOL;
    const arbitBalance = (await solanaConnection.getBalance(new PublicKey(data.arbitPubKey))) / LAMPORTS_PER_SOL;
    const arbitWsolAddr = getAssociatedTokenAddressSync(NATIVE_MINT, new PublicKey(data.arbitPubKey));
    const arbitWsolBalance = (await solanaConnection.getBalance(arbitWsolAddr)) / LAMPORTS_PER_SOL;

    io.emit('process', { ...data, balance, wsolBalance, arbitBalance, arbitWsolBalance });
    tokens(data.pubKey);
};

const initialConnection = async () => {
    const data = JSON.parse(fs.readFileSync("data.json", "utf8"));
    broadCast(data);
};

const pools = async () => {
    const pools = await returnPools();
    const addrInfo = JSON.parse(fs.readFileSync("data.json", "utf8"));
    const balance = (await solanaConnection.getBalance(new PublicKey(addrInfo.pubKey))) / LAMPORTS_PER_SOL;
    const wsolAddr = getAssociatedTokenAddressSync(NATIVE_MINT, new PublicKey(addrInfo.pubKey));
    const wsolBalance = (await solanaConnection.getBalance(wsolAddr)) / LAMPORTS_PER_SOL;

    io.emit("pools", { pools, balance, wsolBalance });
};

const tokens = async (pubKey) => {
    const list = await walletTokenList(pubKey);
    io.emit("tokens", list);
};

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));