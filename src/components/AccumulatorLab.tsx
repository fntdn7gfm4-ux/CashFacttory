"use client";

import { useEffect, useRef, useState } from "react";
import { Dices, Play, RefreshCw, ShieldAlert, Square, Target, ToggleLeft, ToggleRight, TriangleAlert } from "lucide-react";
import { TradingMode } from "@/lib/types";
import { lossLimitReached, nextMartingaleLevel, targetReached } from "./ParityLab";

export type AccumulatorCurrency = "USD" | "EUR" | "GBP" | "AUD" | "BTC" | "ETH";
export type GrowthRate = 0.01 | 0.02 | 0.03 | 0.04 | 0.05;
export type AccumulatorRow = { id: number; symbol: string; label: string; growthRate: GrowthRate; enabled: boolean; level: number; pnl: number; trades: number; wins: number; last: string };
export const growthRates: GrowthRate[] = [.01, .02, .03, .04, .05];
export const accumulatorMarkets = [
  ["R_10", "Volatility 10 Index"], ["R_25", "Volatility 25 Index"], ["R_50", "Volatility 50 Index"], ["R_75", "Volatility 75 Index"], ["R_100", "Volatility 100 Index"],
  ["1HZ10V", "Volatility 10 (1s)"], ["1HZ15V", "Volatility 15 (1s)"], ["1HZ25V", "Volatility 25 (1s)"], ["1HZ30V", "Volatility 30 (1s)"], ["1HZ50V", "Volatility 50 (1s)"], ["1HZ75V", "Volatility 75 (1s)"], ["1HZ90V", "Volatility 90 (1s)"], ["1HZ100V", "Volatility 100 (1s)"],
  ["BOOM50", "Boom 50 Index"], ["BOOM150N", "Boom 150 Index"], ["BOOM300N", "Boom 300 Index"], ["BOOM500", "Boom 500 Index"], ["BOOM600", "Boom 600 Index"], ["BOOM900", "Boom 900 Index"], ["BOOM1000", "Boom 1000 Index"],
  ["CRASH50", "Crash 50 Index"], ["CRASH150N", "Crash 150 Index"], ["CRASH300N", "Crash 300 Index"], ["CRASH500", "Crash 500 Index"], ["CRASH600", "Crash 600 Index"], ["CRASH900", "Crash 900 Index"], ["CRASH1000", "Crash 1000 Index"],
] as const;
const fiat = ["USD", "EUR", "GBP", "AUD"] as const;
const currencies: AccumulatorCurrency[] = ["USD", "EUR", "GBP", "AUD", "BTC", "ETH"];
const rules: Record<AccumulatorCurrency, { min: number; step: number; target: number; loss: number; decimals: number }> = {
  USD: { min: 1, step: .1, target: 2, loss: 5, decimals: 2 }, EUR: { min: 1, step: .1, target: 2, loss: 5, decimals: 2 }, GBP: { min: 1, step: .1, target: 2, loss: 5, decimals: 2 }, AUD: { min: 2, step: .1, target: 4, loss: 10, decimals: 2 },
  BTC: { min: .00002, step: .000001, target: .00004, loss: .0001, decimals: 8 }, ETH: { min: .0005, step: .00001, target: .001, loss: .0025, decimals: 6 },
};
const money = (v: number, c: AccumulatorCurrency) => (fiat as readonly string[]).includes(c) ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: c }).format(v) : `${v.toFixed(rules[c].decimals)} ${c}`;
export const clampAccumulatorTicks = (v: number) => Math.min(250, Math.max(1, Math.trunc(Number.isFinite(v) ? v : 20)));
export const createAccumulatorRows = (): AccumulatorRow[] => accumulatorMarkets.map(([symbol, label], i) => ({ id: i + 1, symbol, label, growthRate: growthRates[i % growthRates.length], enabled: true, level: 0, pnl: 0, trades: 0, wins: 0, last: "Aguardando" }));

export function AccumulatorLab({ mode, trade }: { mode: TradingMode; trade: (symbol: string, growthRate: GrowthRate, amount: number, currency: AccumulatorCurrency, maxTicks: number) => Promise<number> }) {
  const [rows, setRows] = useState(createAccumulatorRows); const [currency, setCurrency] = useState<AccumulatorCurrency>("USD");
  const [target, setTarget] = useState(2); const [lossLimit, setLossLimit] = useState(5); const [baseStake, setBaseStake] = useState(1);
  const [maxMartingale, setMaxMartingale] = useState(2); const [maxTicks, setMaxTicks] = useState(20); const [groupGrowth, setGroupGrowth] = useState<GrowthRate>(.01);
  const [running, setRunning] = useState(false); const [notice, setNotice] = useState("Os 27 bots ACCU estão ligados. A saída máxima protege cada contrato.");
  const active = useRef(false); const enabled = useRef(new Set(rows.map(r => r.id))); const loops = useRef(new Set<number>()); const generation = useRef(0);
  const total = rows.reduce((s, r) => s + r.pnl, 0); const enabledCount = rows.filter(r => r.enabled).length; const maximumExposure = enabledCount * baseStake * (2 ** (maxMartingale + 1) - 1);
  useEffect(() => () => { active.current = false; generation.current += 1; }, []);
  useEffect(() => { if (!running) return; if (targetReached(total, target)) { active.current = false; setRunning(false); setNotice(`Meta de ${money(target, currency)} alcançada. Todos os ACCU foram parados.`); return; } if (lossLimitReached(total, lossLimit)) { active.current = false; setRunning(false); setNotice(`Limite de perda de ${money(lossLimit, currency)} atingido. Todos os ACCU foram parados.`); } }, [currency, lossLimit, running, target, total]);
  const patchRow = (id: number, patch: Partial<AccumulatorRow>) => setRows(all => all.map(r => r.id === id ? { ...r, ...patch } : r));
  const applyGrowth = () => { setRows(all => all.map(r => ({ ...r, growthRate: groupGrowth }))); setNotice(`Crescimento de ${groupGrowth * 100}% aplicado aos 27 bots.`); };
  const shuffle = () => { setRows(all => all.map(r => ({ ...r, growthRate: growthRates[Math.floor(Math.random() * growthRates.length)] }))); setNotice("Taxas oficiais de 1% a 5% embaralhadas."); };
  const updateCurrency = (value: AccumulatorCurrency) => { const r = rules[value]; setCurrency(value); setBaseStake(r.min); setTarget(r.target); setLossLimit(r.loss); setNotice(`Valores iniciais carregados para ${value}; a proposal confirmará o mínimo da conta.`); };
  async function cycle(seed: AccumulatorRow) {
    if (loops.current.has(seed.id)) return; loops.current.add(seed.id); const session = generation.current; let current = seed;
    try {
      while (active.current && enabled.current.has(current.id)) {
        const stake = Math.min(baseStake * 2 ** current.level, baseStake * 2 ** maxMartingale); let profit: number;
        if (mode === "paper") {
          let survived = 0; const survivalChance = .995 - current.growthRate * 2.5;
          for (; survived < maxTicks && Math.random() < survivalChance; survived += 1) await new Promise(r => window.setTimeout(r, 35));
          profit = survived >= maxTicks ? stake * ((1 + current.growthRate) ** maxTicks - 1) : -stake;
        } else profit = await trade(current.symbol, current.growthRate, stake, currency, maxTicks);
        if (session !== generation.current) return;
        const won = profit > 0; const level = nextMartingaleLevel(current.level, won, maxMartingale);
        current = { ...current, enabled: enabled.current.has(current.id), level, pnl: current.pnl + profit, trades: current.trades + 1, wins: current.wins + (won ? 1 : 0), last: `${won ? "Saída positiva" : "Barreira atingida"} · ${money(profit, currency)} · próximo ${level}/${maxMartingale}` };
        setRows(all => all.map(r => r.id === current.id ? current : r)); await new Promise(r => window.setTimeout(r, 1000));
      }
    } catch (e) { active.current = false; setRunning(false); setNotice(e instanceof Error ? e.message : "Falha na cesta ACCUMULATORS"); } finally { loops.current.delete(seed.id); }
  }
  const toggleBot = (row: AccumulatorRow) => { const on = !row.enabled; if (on) enabled.current.add(row.id); else enabled.current.delete(row.id); patchRow(row.id, { enabled: on, last: on ? "Habilitado" : "Desligado" }); if (on && running) void cycle({ ...row, enabled: true }); };
  const stop = () => { active.current = false; generation.current += 1; setRunning(false); setNotice("Cesta ACCUMULATORS interrompida. Contratos em curso são encerrados pela trava de saída."); };
  const reset = () => { active.current = false; generation.current += 1; setRunning(false); const fresh = createAccumulatorRows(); enabled.current = new Set(fresh.map(r => r.id)); setRows(fresh); setNotice("Resultados zerados e todos os ACCU ligados."); };
  const start = () => { if (running) return; if (!enabledCount) return setNotice("Ligue ao menos um bot."); if (target <= 0 || lossLimit <= 0 || baseStake < rules[currency].min) return setNotice(`Revise meta, limite e stake mínima de ${money(rules[currency].min, currency)}.`); generation.current += 1; active.current = true; setRunning(true); setNotice(`${mode.toUpperCase()} ativo: ${enabledCount} ACCU, saída em até ${maxTicks} ticks.`); rows.filter(r => r.enabled).forEach(r => void cycle(r)); };
  return <div className="match-layout">
    <section className="match-hero accu-hero"><div><span>ACCUMULATORS</span><h2>Cesta completa de acumuladores</h2><p>Um bot por mercado confirmado pela API. A stake cresce a cada tick dentro das barreiras e sai no limite configurado.</p></div><div className="parity-target"><Target/><span>RESULTADO / META</span><b className={total >= 0 ? "good" : "bad"}>{money(total, currency)} / {money(target, currency)}</b></div></section>
    <section className="match-controls">
      <label>Moeda<select value={currency} disabled={running} onChange={e => updateCurrency(e.target.value as AccumulatorCurrency)}>{currencies.map(v => <option key={v}>{v}</option>)}</select></label><label>Meta de lucro<input type="number" min={rules[currency].step} step={rules[currency].step} value={target} onChange={e => setTarget(Number(e.target.value))}/></label><label>Limite de perda<input type="number" min={rules[currency].step} step={rules[currency].step} value={lossLimit} onChange={e => setLossLimit(Number(e.target.value))}/></label><label>Stake inicial<input type="number" min={rules[currency].min} step={rules[currency].step} value={baseStake} onChange={e => setBaseStake(Number(e.target.value))}/></label>
      <label>Martingale máximo<input type="number" min="0" max="5" value={maxMartingale} disabled={running} onChange={e => setMaxMartingale(Math.min(5, Math.max(0, Math.trunc(Number(e.target.value)))))}/></label><label>Saída máxima (ticks)<input type="number" min="1" max="250" value={maxTicks} disabled={running} onChange={e => setMaxTicks(clampAccumulatorTicks(Number(e.target.value)))}/></label><label>Crescimento para todos<select value={groupGrowth} disabled={running} onChange={e => setGroupGrowth(Number(e.target.value) as GrowthRate)}>{growthRates.map(v => <option value={v} key={v}>{v * 100}%</option>)}</select></label>
      <button className="outline" disabled={running} onClick={applyGrowth}><Target size={15}/>Aplicar a todos</button><button className="outline" disabled={running} onClick={shuffle}><RefreshCw size={15}/>Embaralhar</button><button className={running ? "stop" : "start"} onClick={running ? stop : start}>{running ? <><Square size={15}/>Parar cesta</> : <><Play size={15}/>Iniciar habilitados</>}</button><button className="outline" onClick={reset}><Dices size={15}/>Zerar sessão</button>
    </section>
    <div className="notice"><ShieldAlert size={15}/><span>{notice}</span></div>
    <section className="match-grid accu-grid">{rows.map(row => <article className={row.enabled ? "" : "disabled"} key={row.id}><header><div><span>ACCU {String(row.id).padStart(2, "0")}</span><b>{row.label}</b></div><button className={row.enabled ? "bot-toggle on" : "bot-toggle"} onClick={() => toggleBot(row)}>{row.enabled ? <ToggleRight size={24}/> : <ToggleLeft size={24}/>} {row.enabled ? "LIGADO" : "DESLIGADO"}</button></header><div className="match-fields single"><label>Crescimento por tick<select disabled={running || !row.enabled} value={row.growthRate} onChange={e => patchRow(row.id, { growthRate: Number(e.target.value) as GrowthRate })}>{growthRates.map(v => <option value={v} key={v}>{v * 100}%</option>)}</select></label></div><div className="parity-stats"><span>P&L<b className={row.pnl >= 0 ? "good" : "bad"}>{money(row.pnl, currency)}</b></span><span>Saídas +<b>{row.trades ? `${(row.wins / row.trades * 100).toFixed(1)}%` : "—"}</b></span><span>Martingale<b>{row.level}/{maxMartingale}</b></span></div><p>{row.last}</p></article>)}</section>
    <section className="risk-warning"><TriangleAlert/><p><b>Risco específico de ACCU.</b> Quanto maior o crescimento, mais estreitas as barreiras e maior a chance de perder a stake. A exposição máxima teórica dos {enabledCount} bots é <strong>{money(maximumExposure, currency)}</strong>. A simulação PAPER é ilustrativa; a proposal oficial prevalece.</p></section>
  </div>;
}
