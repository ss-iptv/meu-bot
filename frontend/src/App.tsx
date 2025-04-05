import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io(process.env.REACT_APP_SERVER_URL);

const App = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    socket.on('process', (data) => {
      setData(data);
    });
  }, []);

  const handleAutoSellChange = () => {
    const newAutoSell = !data.autoSell;
    setData({ ...data, autoSell: newAutoSell });
    socket.emit('autoSell', newAutoSell);
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