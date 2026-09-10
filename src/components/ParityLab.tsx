"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Save, ShieldAlert, Square, Target, TriangleAlert } from "lucide-react";
import { TradingMode } from "@/lib/types";

type Parity = "even" | "odd";
type Currency = "USD" | "EUR" | "GBP" | "AUD" | "BTC" | "ETH" | "USDT";
type Row = { id: number; symbol: string; parity: Parity; level: number; pnl: number; trades: number; wins: number; last: string };

// Confirmado no endpoint público ticks_history da Deriv: contratos de dígitos (DIGITEVEN/DIGITODD)
// só existem na família Volatility Index. Boom/Crash, Step e Jump não aceitam esse modelo.
const markets = [
  ["R_10", "Volatility 10 Index"],
  ["R_25", "Volatility 25 Index"],
  ["R_50", "Volatility 50 Index"],
  ["R_75", "Volatility 75 Index"],
  ["R_100", "Volatility 100 Index"],
  ["1HZ10V", "Volatility 10 (1s)"],
  ["1HZ15V", "Volatility 15 (1s)"],
  ["1HZ25V", "Volatility 25 (1s)"],
  ["1HZ30V", "Volatility 30 (1s)"],
  ["1HZ50V", "Volatility 50 (1s)"],
  ["1HZ75V", "Volatility 75 (1s)"],
  ["1HZ90V", "Volatility 90 (1s)"],
  ["1HZ100V", "Volatility 100 (1s)"],
  ["1HZ150V", "Volatility 150 (1s)"],
  ["1HZ250V", "Volatility 250 (1s)"],
] as const;
const defaultMarkets = markets.slice(0, 5);
const defaultMaxMartingale = 2;

const fiatCurrencies = ["USD", "EUR", "GBP", "AUD"] as const;
const cryptoDecimals: Record<string, number> = { BTC: 8, ETH: 6, USDT: 2 };
const currencies = [...fiatCurrencies, "BTC", "ETH", "USDT"] as const;

const initialRows = (): Row[] => defaultMarkets.map(([symbol], index) => ({ id: index + 1, symbol, parity: index % 2 ? "odd" : "even", level: 0, pnl: 0, trades: 0, wins: 0, last: "Aguardando" }));
const money = (value: number, currency: Currency) => (fiatCurrencies as readonly string[]).includes(currency)
  ? new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value)
  : `${value.toFixed(cryptoDecimals[currency] ?? 6)} ${currency}`;
export const nextMartingaleLevel = (level: number, won: boolean, maxLevel: number = defaultMaxMartingale) => won ? 0 : level >= maxLevel ? 0 : level + 1;
export const targetReached = (profit: number, target: number) => target > 0 && profit >= target;
export const lossLimitReached = (profit: number, limit: number) => limit > 0 && profit <= -limit;

export function ParityLab({ mode, trade }: { mode: TradingMode; trade: (symbol: string, parity: Parity, amount: number, currency: Currency) => Promise<number> }) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [target, setTarget] = useState(1);
  const [lossLimit, setLossLimit] = useState(2);
  const [baseStake, setBaseStake] = useState(0.35);
  const [maxMartingale, setMaxMartingale] = useState(defaultMaxMartingale);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("Configure a meta, o limite de perda e inicie os cinco robôs.");
  const active = useRef(false);
  const total = rows.reduce((sum, row) => sum + row.pnl, 0);

  useEffect(() => { active.current = running; }, [running]);
  useEffect(() => {
    if (!running) return;
    if (targetReached(total, target)) { active.current = false; setRunning(false); setNotice(`Meta de ${money(target, currency)} alcançada. Os cinco robôs foram parados.`); return; }
    if (lossLimitReached(total, lossLimit)) { active.current = false; setRunning(false); setNotice(`Limite de perda de ${money(lossLimit, currency)} atingido. Os cinco robôs foram parados.`); return; }
  }, [running, target, lossLimit, total, currency]);

  const update = (id: number, field: "symbol" | "parity", value: string) => setRows((all) => all.map((row) => row.id === id ? { ...row, [field]: value } as Row : row));
  const stop = () => { active.current = false; setRunning(false); setNotice("Grupo Par/Ímpar interrompido. Nenhum novo contrato será comprado."); };
  const reset = () => { stop(); setRows(initialRows()); setNotice("Resultados desta aba zerados."); };

  const cycle = async (seed: Row) => {
    let current = seed;
    while (active.current) {
      const stake = Math.min(baseStake * (2 ** current.level), baseStake * (2 ** maxMartingale));
      try {
        let profit: number;
        if (mode === "paper") {
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
          const digit = Math.floor(Math.random() * 10);
          const won = (digit % 2 === 0) === (current.parity === "even");
          profit = won ? stake * 0.88 : -stake;
        } else {
          profit = await trade(current.symbol, current.parity, stake, currency);
        }
        const won = profit > 0;
        const nextLevel = nextMartingaleLevel(current.level, won, maxMartingale);
        current = { ...current, level: nextLevel, pnl: current.pnl + profit, trades: current.trades + 1, wins: current.wins + (won ? 1 : 0), last: `${won ? "Ganho" : "Perda"} ${money(profit, currency)} · próximo ${nextLevel}/${maxMartingale}` };
        setRows((all) => all.map((row) => row.id === current.id ? current : row));
      } catch (error) {
        active.current = false; setRunning(false); setNotice(error instanceof Error ? error.message : "Falha na negociação Par/Ímpar"); return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
  };

  const start = () => {
    if (running) return;
    if (target <= 0 || baseStake <= 0) { setNotice("A meta e a stake devem ser maiores que zero."); return; }
    if (lossLimit <= 0) { setNotice("O limite de perda deve ser maior que zero."); return; }
    if (maxMartingale < 0 || !Number.isInteger(maxMartingale)) { setNotice("O martingale máximo deve ser um número inteiro maior ou igual a zero."); return; }
    active.current = true; setRunning(true); setNotice(`${mode.toUpperCase()} ativo: cinco ciclos independentes, intervalo de 1 segundo e martingale máximo ${maxMartingale}.`);
    rows.forEach((row) => void cycle(row));
  };

  return <div className="parity-layout">
    <section className="parity-hero"><div><span>DIGIT EVEN / ODD</span><h2>Cesta Par & Ímpar</h2><p>Cinco robôs operam com a previsão fixa configurada em cada um. A meta de lucro ou o limite de perda encerram somente esta cesta.</p></div><div className="parity-target"><Target/><span>RESULTADO / META</span><b className={total >= 0 ? "good" : "bad"}>{money(total, currency)} / {money(target, currency)}</b></div></section>
    <section className="parity-controls"><label>Moeda<select value={currency} disabled={running} onChange={(event) => setCurrency(event.target.value as Currency)}>{currencies.map((value) => <option value={value} key={value}>{value}</option>)}</select></label><label>Meta de lucro<input type="number" min="0.01" step="0.25" value={target} onChange={(event) => setTarget(Number(event.target.value))}/></label><label>Limite de perda<input type="number" min="0.01" step="0.25" value={lossLimit} onChange={(event) => setLossLimit(Number(event.target.value))}/></label><label>Stake inicial<input type="number" min="0.35" step="0.05" value={baseStake} onChange={(event) => setBaseStake(Number(event.target.value))}/></label><label>Martingale máximo<input type="number" min="0" step="1" value={maxMartingale} disabled={running} onChange={(event) => setMaxMartingale(Number(event.target.value))}/></label><div><span>AMBIENTE</span><b>{mode.toUpperCase()}</b></div><button className={running ? "stop" : "start"} onClick={running ? stop : start}>{running ? <><Square size={15}/>Parar cesta</> : <><Play size={15}/>Iniciar 5 robôs</>}</button><button className="outline" onClick={reset}><Save size={15}/>Zerar sessão</button></section>
    <div className="notice"><ShieldAlert size={15}/><span>{notice}</span></div>
    <section className="parity-grid">{rows.map((row) => <article key={row.id} style={{ "--accent": ["#39d6b4", "#55a7ff", "#f5b85a", "#b98cff", "#ff7d8f"][row.id - 1] } as React.CSSProperties}><header><span>BOT {String(row.id).padStart(2, "0")}</span><b className={running ? "good" : ""}>{running ? "RODANDO" : "PARADO"}</b></header><label>Mercado<select value={row.symbol} onChange={(event) => update(row.id, "symbol", event.target.value)} disabled={running}>{markets.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Previsão fixa<select value={row.parity} onChange={(event) => update(row.id, "parity", event.target.value)} disabled={running}><option value="even">PAR</option><option value="odd">ÍMPAR</option></select></label><div className="parity-stats"><span>P&L<b className={row.pnl >= 0 ? "good" : "bad"}>{money(row.pnl, currency)}</b></span><span>Acerto<b>{row.trades ? `${(row.wins / row.trades * 100).toFixed(1)}%` : "—"}</b></span><span>Martingale<b>{row.level}/{maxMartingale}</b></span></div><p>{row.last}</p></article>)}</section>
    <section className="risk-warning"><TriangleAlert/><p><b>Limite rígido.</b> A progressão usa no máximo {maxMartingale} recuperaç{maxMartingale === 1 ? "ão" : "ões"} (stake base{maxMartingale > 0 ? ` até ${2 ** maxMartingale}× em ${maxMartingale} ${maxMartingale === 1 ? "passo" : "passos"}` : ""}). Depois disso volta à stake inicial. A meta positiva ou o limite de perda atingido para o conjunto impedem imediatamente novas compras desta aba.</p></section>
  </div>;
}
