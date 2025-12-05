import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Detail from './pages/Detail';

export default function App(){
  return (
    <BrowserRouter>
      <header style={{padding:12, background:'#0366d6', color:'white'}}>
        <Link to="/" style={{color:'white', textDecoration:'none'}}>
          <h2>Crypto Live</h2>
        </Link>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/token/:symbol" element={<Detail />} />
      </Routes>
    </BrowserRouter>
  );
}
