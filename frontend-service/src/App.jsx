import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Index from './pages/Index';
import Detail from './pages/Detail';

export default function App() {
  return (
    <>
      <div className="min-h-screen bg-[#0b0f14] text-[#e6eef6] font-sans antialiased">
        <header className="bg-[#0055ff] text-white py-4 text-center shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
          <Link to="/">
            <h1 className="text-[1.75rem] font-extrabold tracking-[0.5px]">
              Crypto Live
            </h1>
          </Link>
        </header>
        <main className="max-w-[1100px] mx-auto my-6 px-4">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/token/:symbol" element={<Detail />} />
          </Routes>
        </main>
      </div>
    </>
  );
}
