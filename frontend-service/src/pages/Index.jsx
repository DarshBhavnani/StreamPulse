import React, { useEffect, useState, useRef } from 'react';
import { fetchTokens } from '../services/api';
import { connectSocket } from '../services/socket';
import TokenRow from '../components/TokenRow';

export default function Index(){
  const [tokens, setTokens] = useState([]);
  const [prices, setPrices] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    fetchTokens()
      .then(list => { if (mounted) setTokens(list); })
      .catch(err => console.error('fetchTokens', err));

    const s = connectSocket();
    socketRef.current = s;

    // join all tokens room so server can send updates (the gateway uses socket rooms by symbol)
    s.on('connect', () => {
      console.log('socket connected', s.id);
      // don't spam joins — join when tokens are available
      if (tokens.length > 0) {
        tokens.forEach(sym => s.emit('join-symbol', sym));
      }
    });

    s.on('price-tick', (data) => {
      if (!data || !data.symbol) return;
      // example payload expected: { symbol: 'BTCUSDT', price: <number>, timestamp: ... }
      setPrices(prev => ({ ...prev, [data.symbol]: data.price ?? data.lastPrice ?? data.p }));
    });

    return () => {
      mounted = false;
      s.off('price-tick');
      // leaving handled automatically on disconnect; but we won't disconnect here so other pages still receive updates
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [/* empty on mount */]);

  // join rooms whenever tokens list updates
  useEffect(() => {
    const s = socketRef.current;
    if (s && tokens.length > 0) {
      tokens.forEach(sym => s.emit('join-symbol', sym));
    }
  }, [tokens]);

  return (
    <>
      <div className="bg-[#0f171f] border border-[#1f2a37] rounded-xl shadow-[0_6px_20px_rgba(0,0,0,0.4)] overflow-hidden">
      
        {/* Heading: text-center */}
        <h2 className="text-center text-xl font-bold py-4 text-white">
          All Tokens
        </h2>
        
        {/* Table: w-full, border-collapse */}
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {/* TH Styles: bg-[#111c27], text-[#b8c7d6], spacing, borders */}
              <th className="bg-[#111c27] text-[#b8c7d6] text-[0.85rem] uppercase tracking-[0.6px] px-[18px] py-[14px] border-b border-[#1f2a37] text-left">
                Token
              </th>
              <th className="bg-[#111c27] text-[#b8c7d6] text-[0.85rem] uppercase tracking-[0.6px] px-[18px] py-[14px] border-b border-[#1f2a37] text-left">
                Price
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Note: Row styles must be applied inside the TokenRow component */}
            {tokens.map(t => <TokenRow key={t} token={t} price={prices[t]} />)}
          </tbody>
        </table>
      </div>
    </>
  );
}