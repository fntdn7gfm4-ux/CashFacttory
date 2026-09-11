"use client";

import { useEffect, useRef, useState } from "react";
import { Dices, Play, RefreshCw, ShieldAlert, Square, Target, ToggleLeft, ToggleRight, TriangleAlert } from "lucide-react";
import { TradingMode } from "@/lib/types";
import { lossLimitReached, nextMartingaleLevel, targetReached } from "./ParityLab";

export type MatchContract = "match" | "differs";
export type MatchCurrency = "USD" | "EUR" | "GBP" | "AUD" | "BTC" | "ETH";
export type MatchRow = { id: number; symbol: string; label: string; contract: MatchContract; digit: number; enabled: boolean; level: number; pnl: number; trades: number; wins: number; last: string };

export const matchMarkets = [
  ["R_10", "Volatility 10 Index"], ["R_25", "Volatility 25 Index"], ["R_50", "Volatility 50 Index"],
  ["R_75", "Volatility 75 Index"], ["R_100", "Volatility 100 Index"], ["1HZ10V", "Volatility 10 (1s)"],
  ["1HZ15V", "Volatility 15 (1s)"], ["1HZ25V", "Volatility 25 (1s)"], ["1HZ30V", "Volatility 30 (1s)"],
  ["1HZ50V", "Volatility 50 (1s)"], ["1HZ75V", "Volatility 75 (1s)"], ["1HZ90V", "Volatility 90 (1s)"],
  ["1HZ100V", "Volatility 100 (1s)"], ["1HZ150V", "Volatility 150 (1s)"], ["1HZ250V", "Volatility 250 (1s)"],
] as const;

const fiat = ["USD", "EUR", "GBP", "AUD"] as const;
const currencies: MatchCurrency[] = ["USD", "EUR", "GBP", "AUD", "BTC", "ETH"];
const rules: Record<MatchCurrency, { min: number; step: number; target: number; loss: number; decimals: number }> = {
  USD: { min: 0.35, step: 0.05, target: 1, loss: 2, decimals: 2 }, EUR: { min: 0.30, step: 0.05, target: 1, loss: 2, decimals: 2 },
  GBP: { min: 0.30, step: 0.05, target: 1, loss: 2, decimals: 2 }, AUD: { min: 0.50, step: 0.05, target: 1, loss: 2, decimals: 2 },
  BTC: { min: 0.000005, step: 0.000001, target: 0.00001, loss: 0.00002, decimals: 8 }, ETH: { min: 0.00014, step: 0.00001, target: 0.00028, loss: 0.00056, decimals: 6 },
};

const money = (value: number, currency: MatchCurrency) => (fiat as readonly string[]).includes(currency)
  ? new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value)
  : `${value.toFixed(rules[currency].decimals)} ${currency}`;
export const clampDigit = (value: number) => Math.min(9, Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0)));
export const clampDuration = (value: number) => Math.min(10, Math.max(1, Math.trunc(Number.isFinite(value) ? value : 1)));
export const createMatchRows = (): MatchRow[] => matchMarkets.map(([symbol, label], index) => ({ id: index + 1, symbol, label, contract: "differs", digit: index % 10, enabled: true, level: 0, pnl: 0, trades: 0, wins: 0, last: "Aguardando" }));

export function MatchDiffersLab({ mode, trade }: { mode: TradingMode; trade: (symbol: string, contract: MatchContract, digit: number, amount: number, currency: MatchCurrency, durationTicks: number) => Promise<number> }) {
  const [rows, setRows] = useState<MatchRow[]>(createMatchRows);
  const [currency, setCurrency] = useState<MatchCurrency>("USD");
  const [target, setTarget] = useState(1);
  const [lossLimit, setLossLimit] = useState(2);
  const [baseStake, setBaseStake] = useState(0.35);
  const [maxMartingale, setMaxMartingale] = useState(2);
  const [durationTicks, setDurationTicks] = useState(1);
  const [groupDigit, setGroupDigit] = useState(5);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("Todos os 15 bots estão habilitados. Configure a cesta antes de iniciar.");
  const active = useRef(false);
  const enabled = useRef(new Set(rows.map((row) => row.id)));
  const loops = useRef(new Set<number>());
  const generation = useRef(0);
  const total = rows.reduce((sum, row) => sum + row.pnl, 0);
  const enabledCount = rows.filter((row) => row.enabled).length;
  const maximumExposure = enabledCount * baseStake * ((2 ** (maxMartingale + 1)) - 1);

  useEffect(() => () => { active.current = false; generation.current += 1; }, []);
  useEffect(() => {
    if (!running) return;
    if (targetReached(total, target)) { active.current = false; setRunning(false); setNotice(`Meta de ${money(target, currency)} alcançada. A cesta MATCH/DIFFERS foi parada.`); return; }
    if (lossLimitReached(total, lossLimit)) { active.current = false; setRunning(false); setNotice(`Limite de perda de ${money(lossLimit, currency)} atingido. A cesta MATCH/DIFFERS foi parada.`); }
  }, [currency, lossLimit, running, target, total]);

  const patchRow = (id: number, patch: Partial<MatchRow>) => setRows((all) => all.map((row) => row.id === id ? { ...row, ...patch } : row));
  const applyDigit = () => { const digit = clampDigit(groupDigit); setGroupDigit(digit); setRows((all) => all.map((row) => ({ ...row, digit }))); setNotice(`Dígito ${digit} aplicado aos 15 bots.`); };
  const shuffle = () => { setRows((all) => all.map((row) => ({ ...row, digit: Math.floor(Math.random() * 10) }))); setNotice("Previsões embaralhadas entre 0 e 9."); };
  const updateCurrency = (value: MatchCurrency) => { const next = rules[value]; setCurrency(value); setBaseStake(next.min); setTarget(next.target); setLossLimit(next.loss); setNotice(`Valores seguros iniciais carregados para ${value}.`); };

  async function cycle(seed: MatchRow) {
    if (loops.current.has(seed.id)) return;
    loops.current.add(seed.id);
    const session = generation.current;
    let current = seed;
    try {
      while (active.current && enabled.current.has(current.id)) {
        const stake = Math.min(baseStake * (2 ** current.level), baseStake * (2 ** maxMartingale));
        let profit: number;
        if (mode === "paper") {
          await new Promise((resolve) => window.setTimeout(resolve, durationTicks * 1000));
          const finalDigit = Math.floor(Math.random() * 10);
          const won = current.contract === "match" ? finalDigit === current.digit : finalDigit !== current.digit;
          profit = won ? stake * (current.contract === "match" ? 8 : 0.08) : -stake;
        } else {
          profit = await trade(current.symbol, current.contract, current.digit, stake, currency, durationTicks);
        }
        if (session !== generation.current) return;
        const won = profit > 0;
        const nextLevel = nextMartingaleLevel(current.level, won, maxMartingale);
        current = { ...current, enabled: enabled.current.has(current.id), level: nextLevel, pnl: current.pnl + profit, trades: current.trades + 1, wins: current.wins + (won ? 1 : 0), last: `${won ? "Ganho" : "Perda"} ${money(profit, currency)} · próximo ${nextLevel}/${maxMartingale}` };
        setRows((all) => all.map((row) => row.id === current.id ? current : row));
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
    } catch (error) {
      active.current = false; setRunning(false); setNotice(error instanceof Error ? error.message : "Falha na cesta MATCH/DIFFERS");
    } finally { loops.current.delete(seed.id); }
  }

  const toggleBot = (row: MatchRow) => {
    const turnOn = !row.enabled;
    if (turnOn) enabled.current.add(row.id); else enabled.current.delete(row.id);
    patchRow(row.id, { enabled: turnOn, last: turnOn ? "Habilitado" : "Desligado" });
    if (turnOn && running) void cycle({ ...row, enabled: true });
  };
  const stop = () => { active.current = false; generation.current += 1; setRunning(false); setNotice("Cesta MATCH/DIFFERS interrompida. Nenhum novo contrato será comprado."); };
  const reset = () => { active.current = false; generation.current += 1; setRunning(false); const fresh = createMatchRows(); enabled.current = new Set(fresh.map((row) => row.id)); setRows(fresh); setNotice("Resultados zerados e todos os bots habilitados."); };
  const start = () => {
    if (running) return;
    if (!enabledCount) { setNotice("Habilite ao menos um bot."); return; }
    if (target <= 0 || lossLimit <= 0 || baseStake < rules[currency].min) { setNotice(`Revise meta, limite e stake mínima de ${money(rules[currency].min, currency)}.`); return; }
    generation.current += 1; active.current = true; setRunning(true); setNotice(`${mode.toUpperCase()} ativo: ${enabledCount} bots, ${durationTicks} tick${durationTicks === 1 ? "" : "s"} por contrato.`);
    rows.filter((row) => row.enabled).forEach((row) => void cycle(row));
  };

  return <div className="match-layout">
    <section className="match-hero"><div><span>DIGIT MATCH / DIFFERS</span><h2>Mapa completo de dígitos</h2><p>Um bot por mercado compatível. Cada previsão fica fixa até você alterar, aplicar a todos ou embaralhar.</p></div><div className="parity-target"><Target/><span>RESULTADO / META</span><b className={total >= 0 ? "good" : "bad"}>{money(total, currency)} / {money(target, currency)}</b></div></section>
    <section className="match-controls">
      <label>Moeda<select value={currency} disabled={running} onChange={(event) => updateCurrency(event.target.value as MatchCurrency)}>{currencies.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Meta de lucro<input type="number" min={rules[currency].step} step={rules[currency].step} value={target} onChange={(event) => setTarget(Number(event.target.value))}/></label>
      <label>Limite de perda<input type="number" min={rules[currency].step} step={rules[currency].step} value={lossLimit} onChange={(event) => setLossLimit(Number(event.target.value))}/></label>
      <label>Stake inicial<input type="number" min={rules[currency].min} step={rules[currency].step} value={baseStake} onChange={(event) => setBaseStake(Number(event.target.value))}/></label>
      <label>Martingale máximo<input type="number" min="0" max="5" step="1" value={maxMartingale} disabled={running} onChange={(event) => setMaxMartingale(Math.min(5, Math.max(0, Math.trunc(Number(event.target.value)))))}/></label>
      <label>Duração (ticks)<input type="number" min="1" max="10" step="1" value={durationTicks} disabled={running} onChange={(event) => setDurationTicks(clampDuration(Number(event.target.value)))}/></label>
      <label>Dígito para todos<input type="number" min="0" max="9" step="1" value={groupDigit} disabled={running} onChange={(event) => setGroupDigit(clampDigit(Number(event.target.value)))}/></label>
      <button className="outline" disabled={running} onClick={applyDigit}><Target size={15}/>Apostar em todos</button>
      <button className="outline" disabled={running} onClick={shuffle}><RefreshCw size={15}/>Embaralhar</button>
      <button className={running ? "stop" : "start"} onClick={running ? stop : start}>{running ? <><Square size={15}/>Parar cesta</> : <><Play size={15}/>Iniciar habilitados</>}</button>
      <button className="outline" onClick={reset}><Dices size={15}/>Zerar sessão</button>
    </section>
    <div className="notice"><ShieldAlert size={15}/><span>{notice}</span></div>
    <section className="match-grid">{rows.map((row) => <article className={row.enabled ? "" : "disabled"} key={row.id}>
      <header><div><span>BOT {String(row.id).padStart(2, "0")}</span><b>{row.label}</b></div><button className={row.enabled ? "bot-toggle on" : "bot-toggle"} onClick={() => toggleBot(row)} aria-label={`${row.enabled ? "Desligar" : "Ligar"} ${row.label}`}>{row.enabled ? <ToggleRight size={24}/> : <ToggleLeft size={24}/>} {row.enabled ? "LIGADO" : "DESLIGADO"}</button></header>
      <div className="match-fields"><label>Contrato<select disabled={running || !row.enabled} value={row.contract} onChange={(event) => patchRow(row.id, { contract: event.target.value as MatchContract })}><option value="differs">DIFFERS</option><option value="match">MATCH</option></select></label><label>Último dígito<input disabled={running || !row.enabled} type="number" min="0" max="9" step="1" value={row.digit} onChange={(event) => patchRow(row.id, { digit: clampDigit(Number(event.target.value)) })}/></label></div>
      <div className="parity-stats"><span>P&L<b className={row.pnl >= 0 ? "good" : "bad"}>{money(row.pnl, currency)}</b></span><span>Acerto<b>{row.trades ? `${(row.wins / row.trades * 100).toFixed(1)}%` : "—"}</b></span><span>Martingale<b>{row.level}/{maxMartingale}</b></span></div><p>{row.last}</p>
    </article>)}</section>
    <section className="risk-warning"><TriangleAlert/><p><b>Limite de risco.</b> Duração válida: 1 a 10 ticks. A exposição máxima teórica do ciclo dos {enabledCount} bots habilitados é <strong>{money(maximumExposure, currency)}</strong>. MATCH tem menor frequência e payout potencial maior; DIFFERS tem maior frequência e payout menor. Nenhum resultado é garantido.</p></section>
  </div>;
}
