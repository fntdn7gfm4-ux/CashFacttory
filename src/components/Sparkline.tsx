export function Sparkline({ values, positive = true }: { values: number[]; positive?: boolean }) {
  if (values.length < 2) return <div className="chart-empty">Aguardando ticks…</div>;
  const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${46 - ((value - min) / span) * 40}`).join(" ");
  const color = positive ? "#31d0aa" : "#ff6871";
  return <svg className="sparkline" viewBox="0 0 100 50" preserveAspectRatio="none" aria-label="Evolução de preço"><defs><linearGradient id={`fill-${positive}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".28"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs><polygon points={`0,50 ${points} 100,50`} fill={`url(#fill-${positive})`}/><polyline points={points} fill="none" stroke={color} strokeWidth="1.3" vectorEffect="non-scaling-stroke"/></svg>;
}
