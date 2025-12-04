import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Index from './pages/Index';
import Detail from './pages/Detail';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <Link to="/"><h1>Crypto Live</h1></Link>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/token/:symbol" element={<Detail />} />
        </Routes>
      </main>

      <footer className="footer">
        <small>Group project — live prices via Gateway</small>
      </footer>
    </div>
  );
}
