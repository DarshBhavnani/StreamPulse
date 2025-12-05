import React from 'react';
import { Link } from 'react-router-dom';

export default function TokenRow({ token, price }) {
  const priceStr = price ? Number(price).toFixed(6) : '—';
  return (
    <tr className="hover:bg-[rgba(255,255,255,0.02)] border-b border-[#1f2a37] last:border-0">
      <td className="px-[18px] py-[14px]"><Link to={`/token/${token}`}>{token}</Link></td>
      <td className="px-[18px] py-[14px]">{priceStr}</td>
    </tr>
  );
}
