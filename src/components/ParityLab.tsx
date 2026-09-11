"use client";

import { useEffect, useRef, useState } from "react";
import { Dices, Play, RefreshCw, ShieldAlert, Square, Target, ToggleLeft, ToggleRight, TriangleAlert } from "lucide-react";
import { TradingMode } from "@/lib/types";

export type Parity = "even" | "odd";
export type ParityCurrency = "USD" | "EUR" | "GBP" | "AUD" | "BTC" | "ETH";
export type ParityRow = { id: number; symbol: string; label: string; parity: Parity; enabled: boolean; level: number; pnl: number; trades: number; wins: number; last: string };
export const parityMarkets = [
  ["R_10", "Volatility 10 Index"], ["R_25", "Volatility 25 Index"], ["R_50", "Volatility 50 Index"], ["R_75", "Volatility 75 Index"], ["R_100", "Volatility 100 Index"],
  ["1HZ10V", "Volatility 10 (1s)"], ["1HZ15V", "Volatility 15 (1s)"], ["1HZ25V", "Volatility 25 (1s)"], ["1HZ30V", "Volatility 30 (1s)"], ["1HZ50V", "Volatility 50 (1s)"],
  ["1HZ75V", "Volatility 75 (1s)"], ["1HZ90V", "Volatility 90 (1s)"], ["1HZ100V", "Volatility 100 (1s)"], ["1HZ150V", "Volatility 150 (1s)"], ["1HZ250V", "Volatility 250 (1s)"],
] as const;
const fiat = ["USD", "EUR", "GBP", "AUD"] as const;
const currencies: ParityCurrency[] = ["USD", "EUR", "GBP", "AUD", "BTC", "ETH"];
const rules: Record<ParityCurrency, { min: number; step: number; target: number; loss: number; decimals: number }> = {
  USD: { min: .35, step: .05, target: 1, loss: 2, decimals: 2 }, EUR: { min: .3, step: .05, target: 1, loss: 2, decimals: 2 }, GBP: { min: .3, step: .05, target: 1, loss: 2, decimals: 2 }, AUD: { min: .5, step: .05, target: 1, loss: 2, decimals: 2 },
  BTC: { min: .000005, step: .000001, target: .00001, loss: .00002, decimals: 8 }, ETH: { min: .00014, step: .00001, target: .00028, loss: .00056, decimals: 6 },
};
const money = (v: number, c: ParityCurrency) => (fiat as readonly string[]).includes(c) ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: c }).format(v) : `${v.toFixed(rules[c].decimals)} ${c}`;
export const nextMartingaleLevel = (level: number, won: boolean, max = 2) => won ? 0 : level >= max ? 0 : level + 1;
export const targetReached = (profit: number, target: number) => target > 0 && profit >= target;
export const lossLimitReached = (profit: number, limit: number) => limit > 0 && profit <= -limit;
export const clampParityDuration = (v: number) => Math.min(10, Math.max(1, Math.trunc(Number.isFinite(v) ? v : 1)));
export const createParityRows = (): ParityRow[] => parityMarkets.map(([symbol, label], i) => ({ id: i + 1, symbol, label, parity: i % 2 ? "odd" : "even", enabled: true, level: 0, pnl: 0, trades: 0, wins: 0, last: "Aguardando" }));

export function ParityLab({ mode, trade }: { mode: TradingMode; trade: (symbol: string, parity: Parity, amount: number, currency: ParityCurrency, durationTicks: number) => Promise<number> }) {
  const [rows, setRows] = useState(createParityRows); const [currency, setCurrency] = useState<ParityCurrency>("USD");
  const [target, setTarget] = useState(1); const [lossLimit, setLossLimit] = useState(2); const [baseStake, setBaseStake] = useState(.35);
  const [maxMartingale, setMaxMartingale] = useState(2); const [durationTicks, setDurationTicks] = useState(1); const [groupParity, setGroupParity] = useState<Parity>("even");
  const [running, setRunning] = useState(false); const [notice, setNotice] = useState("Todos os 15 bots estão ligados. Configure a cesta antes de iniciar.");
  const active = useRef(false); const enabled = useRef(new Set(rows.map(r => r.id))); const loops = useRef(new Set<number>()); const generation = useRef(0);
  const total = rows.reduce((s, r) => s + r.pnl, 0); const enabledCount = rows.filter(r => r.enabled).length; const maximumExposure = enabledCount * baseStake * (2 ** (maxMartingale + 1) - 1);

  useEffect(() => () => { active.current = false; generation.current += 1; }, []);
  useEffect(() => {
    if (!running) return;
    if (targetReached(total, target)) { active.current = false; setRunning(false); setNotice(`Meta de ${money(target, currency)} alcançada. A cesta EVEN/ODD foi parada.`); return; }
    if (lossLimitReached(total, lossLimit)) { active.current = false; setRunning(false); setNotice(`Limite de perda de ${money(lossLimit, currency)} atingido. A cesta EVEN/ODD foi parada.`); }
  }, [currency, lossLimit, running, target, total]);
  const patchRow = (id: number, patch: Partial<ParityRow>) => setRows(all => all.map(r => r.id === id ? { ...r, ...patch } : r));
  const applyParity = () => { setRows(all => all.map(r => ({ ...r, parity: groupParity }))); setNotice(`${groupParity === "even" ? "PAR" : "ÍMPAR"} aplicado aos 15 bots.`); };
  const shuffle = () => { setRows(all => all.map(r => ({ ...r, parity: Math.random() < .5 ? "even" : "odd" }))); setNotice("Previsões PAR e ÍMPAR embaralhadas."); };
  const updateCurrency = (value: ParityCurrency) => { const r = rules[value]; setCurrency(value); setBaseStake(r.min); setTarget(r.target); setLossLimit(r.loss); setNotice(`Valores seguros iniciais carregados para ${value}.`); };
  async function cycle(seed: ParityRow) {
    if (loops.current.has(seed.id)) return; loops.current.add(seed.id); const session = generation.current; let current = seed;
    try {
      while (active.current && enabled.current.has(current.id)) {
        const stake = Math.min(baseStake * 2 ** current.level, baseStake * 2 ** maxMartingale); let profit: number;
        if (mode === "paper") { await new Promise(r => window.setTimeout(r, durationTicks * 1000)); const digit = Math.floor(Math.random() * 10); profit = ((digit % 2 === 0) === (current.parity === "even")) ? stake * .88 : -stake; }
        else profit = await trade(current.symbol, current.parity, stake, currency, durationTicks);
        if (session !== generation.current) return;
        const won = profit > 0; const level = nextMartingaleLevel(current.level, won, maxMartingale);
        current = { ...current, enabled: enabled.current.has(current.id), level, pnl: current.pnl + profit, trades: current.trades + 1, wins: current.wins + (won ? 1 : 0), last: `${won ? "Ganho" : "Perda"} ${money(profit, currency)} · próximo ${level}/${maxMartingale}` };
        setRows(all => all.map(r => r.id === current.id ? current : r)); await new Promise(r => window.setTimeout(r, 1000));
      }
    } catch (e) { active.current = false; setRunning(false); setNotice(e instanceof Error ? e.message : "Falha na cesta EVEN/ODD"); } finally { loops.current.delete(seed.id); }
  }
  const toggleBot = (row: ParityRow) => { const on = !row.enabled; if (on) enabled.current.add(row.id); else enabled.current.delete(row.id); patchRow(row.id, { enabled: on, last: on ? "Habilitado" : "Desligado" }); if (on && running) void cycle({ ...row, enabled: true }); };
  const stop = () => { active.current = false; generation.current += 1; setRunning(false); setNotice("Cesta EVEN/ODD interrompida. Nenhum novo contrato será comprado."); };
  const reset = () => { active.current = false; generation.current += 1; setRunning(false); const fresh = createParityRows(); enabled.current = new Set(fresh.map(r => r.id)); setRows(fresh); setNotice("Resultados zerados e todos os bots ligados."); };
  const start = () => { if (running) return; if (!enabledCount) return setNotice("Ligue ao menos um bot."); if (target <= 0 || lossLimit <= 0 || baseStake < rules[currency].min) return setNotice(`Revise meta, limite e stake mínima de ${money(rules[currency].min, currency)}.`); generation.current += 1; active.current = true; setRunning(true); setNotice(`${mode.toUpperCase()} ativo: ${enabledCount} bots, ${durationTicks} tick${durationTicks === 1 ? "" : "s"} por contrato.`); rows.filter(r => r.enabled).forEach(r => void cycle(r)); };
  return <div className="match-layout">
    <section className="match-hero"><div><span>DIGIT EVEN / ODD</span><h2>Mapa completo Par & Ímpar</h2><p>Um bot por mercado compatível, previsão fixa individual e comandos para aplicar ou embaralhar o grupo.</p></div><div className="parity-target"><Target/><span>RESULTADO / META</span><b className={total >= 0 ? "good" : "bad"}>{money(total, currency)} / {money(target, currency)}</b></div></section>
    <section className="match-controls">
      <label>Moeda<select value={currency} disabled={running} onChange={e => updateCurrency(e.target.value as ParityCurrency)}>{currencies.map(v => <option key={v}>{v}</option>)}</select></label><label>Meta de lucro<input type="number" min={rules[currency].step} step={rules[currency].step} value={target} onChange={e => setTarget(Number(e.target.value))}/></label><label>Limite de perda<input type="number" min={rules[currency].step} step={rules[currency].step} value={lossLimit} onChange={e => setLossLimit(Number(e.target.value))}/></label><label>Stake inicial<input type="number" min={rules[currency].min} step={rules[currency].step} value={baseStake} onChange={e => setBaseStake(Number(e.target.value))}/></label>
      <label>Martingale máximo<input type="number" min="0" max="5" value={maxMartingale} disabled={running} onChange={e => setMaxMartingale(Math.min(5, Math.max(0, Math.trunc(Number(e.target.value)))))}/></label><label>Duração (ticks)<input type="number" min="1" max="10" value={durationTicks} disabled={running} onChange={e => setDurationTicks(clampParityDuration(Number(e.target.value)))}/></label><label>Previsão para todos<select value={groupParity} disabled={running} onChange={e => setGroupParity(e.target.value as Parity)}><option value="even">PAR</option><option value="odd">ÍMPAR</option></select></label>
      <button className="outline" disabled={running} onClick={applyParity}><Target size={15}/>Aplicar a todos</button><button className="outline" disabled={running} onClick={shuffle}><RefreshCw size={15}/>Embaralhar</button><button className={running ? "stop" : "start"} onClick={running ? stop : start}>{running ? <><Square size={15}/>Parar cesta</> : <><Play size={15}/>Iniciar habilitados</>}</button><button className="outline" onClick={reset}><Dices size={15}/>Zerar sessão</button>
    </section>
    <div className="notice"><ShieldAlert size={15}/><span>{notice}</span></div>
    <section className="match-grid">{rows.map(row => <article className={row.enabled ? "" : "disabled"} key={row.id}><header><div><span>BOT {String(row.id).padStart(2, "0")}</span><b>{row.label}</b></div><button className={row.enabled ? "bot-toggle on" : "bot-toggle"} onClick={() => toggleBot(row)}>{row.enabled ? <ToggleRight size={24}/> : <ToggleLeft size={24}/>} {row.enabled ? "LIGADO" : "DESLIGADO"}</button></header><div className="match-fields single"><label>Previsão fixa<select disabled={running || !row.enabled} value={row.parity} onChange={e => patchRow(row.id, { parity: e.target.value as Parity })}><option value="even">PAR</option><option value="odd">ÍMPAR</option></select></label></div><div className="parity-stats"><span>P&L<b className={row.pnl >= 0 ? "good" : "bad"}>{money(row.pnl, currency)}</b></span><span>Acerto<b>{row.trades ? `${(row.wins / row.trades * 100).toFixed(1)}%` : "—"}</b></span><span>Martingale<b>{row.level}/{maxMartingale}</b></span></div><p>{row.last}</p></article>)}</section>
    <section className="risk-warning"><TriangleAlert/><p><b>Limite de risco.</b> A exposição máxima teórica do ciclo dos {enabledCount} bots ligados é <strong>{money(maximumExposure, currency)}</strong>. A meta ou o limite de perda interrompe somente esta cesta. Resultados não são garantidos.</p></section>
  </div>;
}
