import React, { useEffect, useState } from 'react';
import { fetchTokens } from '../services/api';
import { Link } from 'react-router-dom';

export default function Home(){
  const [tokens, setTokens] = useState([]);
  useEffect(() => {
    fetchTokens().then(setTokens).catch(err => console.error(err));
  }, []);
  return (
    <div className="container">
      <h1>Tokens</h1>
      {tokens.length === 0 ? <p>No tokens yet</p> : (
        <ul>
          {tokens.map(t => (
            <li key={t}><Link to={`/token/${encodeURIComponent(t)}`}>{t}</Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
