import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

interface Data {
  pubKey?: string;
  balance?: number;
  wsolBalance?: number;
  autoSell?: boolean;
  pools?: { name: string }[];
}

const socket = io(process.env.REACT_APP_SERVER_URL as string);

const App: React.FC = () => {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    socket.on('process', (data: Data) => {
      setData(data);
    });
  }, []);

  const handleAutoSellChange = () => {
    if (data) {
      const newAutoSell = !data.autoSell;
      setData({ ...data, autoSell: newAutoSell });
      socket.emit('autoSell', newAutoSell);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Solana Sniper Bot</h1>
        <div>Public Key: {data?.pubKey}</div>
        <div>Balance: {data?.balance} SOL</div>
        <div>WSOL Balance: {data?.wsolBalance} SOL</div>
      </header>
      <main>
        <section>
          <h2>Recent Pools</h2>
          <ul>
            {data?.pools?.map((pool, index) => (
              <li key={index}>{pool.name}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Configuration</h2>
          <label>
            Auto Sell:
            <input type="checkbox" checked={data?.autoSell} onChange={handleAutoSellChange} />
          </label>
        </section>
      </main>
    </div>
  );
};

export default App;