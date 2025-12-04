import React from 'react';
import { Link } from 'react-router-dom';

export default function TokenRow({ token, price }) {
  const priceStr = price ? Number(price).toFixed(6) : '—';
  return (
    <tr>
      <td><Link to={`/token/${token}`}>{token}</Link></td>
      <td style={{ textAlign: 'right' }}>{priceStr}</td>
    </tr>
  );
}
