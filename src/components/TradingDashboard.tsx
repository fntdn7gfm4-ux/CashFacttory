"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bot, ChevronRight, CircleDollarSign, Gauge, History, LayoutDashboard, Play, Save, Settings2, ShieldAlert, Square, Terminal, TriangleAlert, Wifi } from "lucide-react";
import { defaultConfigs, platformMeta } from "@/lib/config";
import { initialRuntime, simulateStep } from "@/lib/simulator";
import { BacktestResult, BotConfig, BotRuntime, Platform } from "@/lib/types";
import { Sparkline } from "./Sparkline";
import { runBacktest } from "@/lib/backtest";

type View = "overview" | Platform;
const storageKey = "cashfacttory:configs:v1";

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(value);
const pct = (value: number) => `${value.toFixed(1)}%`;

function Metric({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "bad" }) {
  return <div className="metric"><span>{label}</span><strong className={tone}>{value}</strong>{note && <small>{note}</small>}</div>;
}

function StatusPill({ runtime }: { runtime: BotRuntime }) {
  const labels = { stopped: "PARADO", running: "RODANDO", cooldown: "COOLDOWN", "risk-locked": "BLOQUEADO" };
  return <span className={`status ${runtime.status}`}><i />{labels[runtime.status]}</span>;
}

export function TradingDashboard() {
  const [view, setView] = useState<View>("overview");
  const [configs, setConfigs] = useState<BotConfig[]>(defaultConfigs);
  const [runtimes, setRuntimes] = useState<Record<Platform, BotRuntime>>(() => Object.fromEntries(defaultConfigs.map((c) => [c.platform, initialRuntime(c)])) as Record<Platform, BotRuntime>);
  const [panel, setPanel] = useState<"orders" | "logs">("orders");
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const busy = useRef(new Set<Platform>());

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) try { setConfigs(JSON.parse(saved)); } catch { localStorage.removeItem(storageKey); }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      configs.forEach(async (config) => {
        if (runtimes[config.platform].status !== "running" || busy.current.has(config.platform)) return;
        busy.current.add(config.platform);
        try {
          const next = await simulateStep(config, runtimes[config.platform]);
          setRuntimes((current) => ({ ...current, [config.platform]: next }));
        } finally { busy.current.delete(config.platform); }
      });
    }, 1100);
    return () => window.clearInterval(timer);
  }, [configs, runtimes]);

  const totals = useMemo(() => {
    const values = Object.values(runtimes);
    const wins = values.reduce((n, r) => n + r.wins, 0), trades = values.reduce((n, r) => n + r.wins + r.losses, 0);
    return { balance: values.reduce((n, r) => n + r.balance, 0), pnl: values.reduce((n, r) => n + r.pnl, 0), trades, winRate: trades ? wins / trades * 100 : 0, drawdown: Math.max(...values.map((r) => r.drawdown)) };
  }, [runtimes]);

  const setStatus = (platform: Platform, status: BotRuntime["status"]) => setRuntimes((all) => ({ ...all, [platform]: { ...all[platform], status, logs: [`${new Date().toLocaleTimeString("pt-BR")} · Bot ${status === "running" ? "iniciado" : "parado"} pelo operador.`, ...all[platform].logs] } }));
  const emergency = () => setRuntimes((all) => Object.fromEntries(Object.entries(all).map(([key, runtime]) => [key, { ...runtime, status: "stopped", logs: [`${new Date().toLocaleTimeString("pt-BR")} · PARADA DE EMERGÊNCIA acionada.`, ...runtime.logs] }])) as Record<Platform, BotRuntime>);
  const save = () => { localStorage.setItem(storageKey, JSON.stringify(configs)); };
  const updateConfig = (platform: Platform, path: "risk" | "strategy", field: string, value: string | number) => setConfigs((items) => items.map((item) => item.platform === platform ? { ...item, [path]: { ...item[path], [field]: value } } : item));
  const runTest = async (config: BotConfig) => {
    setTesting(true);
    setBacktest(null);
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    setBacktest(runBacktest(config));
    setTesting(false);
  };

  const selected = view === "overview" ? null : configs.find((c) => c.platform === view)!;
  const runtime = selected ? runtimes[selected.platform] : null;

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brandmark"><Activity size={19}/></div><div><b>CashFacttory</b><span>TRADING LAB</span></div></div>
      <nav><button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}><LayoutDashboard size={18}/>Visão geral</button><p>ROBÔS</p>{configs.map((config) => <button key={config.platform} className={view === config.platform ? "active" : ""} onClick={() => setView(config.platform)}><span className="platform-dot" style={{ background: platformMeta[config.platform].color }}>{platformMeta[config.platform].short}</span>{config.name}<i className={runtimes[config.platform].status === "running" ? "online" : ""}/></button>)}</nav>
      <div className="safe-card"><ShieldAlert size={18}/><div><b>Ambiente protegido</b><span>PAPER MODE obrigatório</span></div></div>
      <button className="emergency" onClick={emergency}><TriangleAlert size={17}/>Parada de emergência</button>
    </aside>

    <main>
      <header><div><div className="eyebrow">PAPER TRADING CONTROL CENTER</div><h1>{selected ? selected.name : "Visão geral"}</h1><p>{selected ? selected.description : "Monitore risco, performance e atividade dos quatro robôs."}</p></div><div className="header-actions"><span className="mode"><i/>PAPER MODE</span><span className="clock">{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span></div></header>

      {selected && runtime ? <BotDetail config={selected} runtime={runtime} panel={panel} setPanel={setPanel} setStatus={setStatus} save={save} update={updateConfig} runTest={runTest} backtest={backtest} testing={testing}/> : <Overview configs={configs} runtimes={runtimes} totals={totals} open={setView} toggle={setStatus}/>} 
    </main>
  </div>;
}

function Overview({ configs, runtimes, totals, open, toggle }: { configs: BotConfig[]; runtimes: Record<Platform, BotRuntime>; totals: { balance: number; pnl: number; trades: number; winRate: number; drawdown: number }; open: (v: View) => void; toggle: (p: Platform, s: BotRuntime["status"]) => void }) {
  return <>
    <section className="metrics-grid"><Metric label="SALDO DEMO TOTAL" value={money(totals.balance)} note="4 contas simuladas"/><Metric label="P&L DO DIA" value={`${totals.pnl >= 0 ? "+" : ""}${money(totals.pnl)}`} tone={totals.pnl >= 0 ? "good" : "bad"} note={`${totals.trades} operações fechadas`}/><Metric label="WIN RATE" value={pct(totals.winRate)} note="Todas as estratégias"/><Metric label="DRAWDOWN MÁX." value={pct(totals.drawdown)} tone={totals.drawdown > 8 ? "bad" : undefined} note="Limite global monitorado"/></section>
    <div className="section-title"><div><h2>Robôs e estratégias</h2><p>Ambientes independentes, um único motor de risco.</p></div><span><Wifi size={15}/>Simulação local ativa</span></div>
    <section className="bots-grid">{configs.map((config) => { const r = runtimes[config.platform]; const trades = r.wins + r.losses; return <article className="bot-card" key={config.platform} style={{ "--accent": platformMeta[config.platform].color } as React.CSSProperties}><div className="bot-top"><div className="bot-icon">{platformMeta[config.platform].short}</div><div><h3>{config.name}</h3><StatusPill runtime={r}/></div><button className="icon-button" onClick={() => open(config.platform)} aria-label="Abrir"><ChevronRight size={18}/></button></div><p>{config.description}</p><Sparkline values={r.prices.map((v) => v.price)} positive={r.pnl >= 0}/><div className="mini-metrics"><div><span>P&L</span><b className={r.pnl >= 0 ? "good" : "bad"}>{r.pnl >= 0 ? "+" : ""}{money(r.pnl)}</b></div><div><span>Win rate</span><b>{trades ? pct(r.wins / trades * 100) : "—"}</b></div><div><span>Ordens</span><b>{trades}</b></div></div><div className="card-actions"><button className={r.status === "running" ? "stop" : "start"} onClick={() => toggle(config.platform, r.status === "running" ? "stopped" : "running")}>{r.status === "running" ? <><Square size={14}/>Parar</> : <><Play size={14}/>Iniciar paper</>}</button><button onClick={() => open(config.platform)}><Settings2 size={14}/>Configurar</button></div></article>; })}</section>
    <section className="activity-banner"><div className="pulse"><Activity/></div><div><b>Guardrails sempre ativos</b><p>Stop diário, drawdown, cooldown e stake máximo são verificados antes de cada microtrade.</p></div><div className="guard-list"><span>LIVE TRADING <b>DESATIVADO</b></span><span>CREDENCIAIS <b>NÃO CONFIGURADAS</b></span></div></section>
  </>;
}

function BotDetail({ config, runtime, panel, setPanel, setStatus, save, update, runTest, backtest, testing }: { config: BotConfig; runtime: BotRuntime; panel: "orders" | "logs"; setPanel: (p: "orders" | "logs") => void; setStatus: (p: Platform, s: BotRuntime["status"]) => void; save: () => void; update: (p: Platform, path: "risk" | "strategy", field: string, value: string | number) => void; runTest: (c: BotConfig) => void; backtest: BacktestResult | null; testing: boolean }) {
  const trades = runtime.wins + runtime.losses;
  return <>
    <div className="detail-bar"><div className="connection"><Wifi size={17}/><div><b>Conexão simulada</b><span>Feed local · latência ~12ms</span></div></div><StatusPill runtime={runtime}/><button className={runtime.status === "running" ? "stop main-action" : "start main-action"} onClick={() => setStatus(config.platform, runtime.status === "running" ? "stopped" : "running")}>{runtime.status === "running" ? <><Square size={15}/>Parar bot</> : <><Play size={15}/>Iniciar bot</>}</button></div>
    <section className="metrics-grid detail"><Metric label="SALDO DEMO" value={money(runtime.balance)}/><Metric label="P&L DO BOT" value={`${runtime.pnl >= 0 ? "+" : ""}${money(runtime.pnl)}`} tone={runtime.pnl >= 0 ? "good" : "bad"}/><Metric label="WIN RATE" value={trades ? pct(runtime.wins / trades * 100) : "—"}/><Metric label="DRAWDOWN" value={pct(runtime.drawdown)}/></section>
    <div className="detail-grid">
      <section className="chart-card"><div className="card-heading"><div><span>PREÇO · {config.strategy.symbol}</span><h2>Feed de ticks simulado</h2></div><b>{runtime.prices.at(-1)?.price.toFixed(config.platform === "deriv" ? 2 : 5)}</b></div><Sparkline values={runtime.prices.map((p) => p.price)} positive={runtime.pnl >= 0}/><div className="chart-footer"><span><i className="green-dot"/>Últimos {runtime.prices.length} ticks</span><span>Execução: PAPER</span></div></section>
      <section className="config-card"><div className="card-heading"><div><span>CONTROLES</span><h2>Estratégia e risco</h2></div><Gauge size={20}/></div><div className="form-grid"><label>Ativo<input value={config.strategy.symbol} onChange={(e) => update(config.platform, "strategy", "symbol", e.target.value)}/></label><label>Janela de ticks<input type="number" value={config.strategy.tickWindow} onChange={(e) => update(config.platform, "strategy", "tickWindow", Number(e.target.value))}/></label><label>Confiança mínima<input type="number" step="0.01" min="0.5" max="0.99" value={config.strategy.threshold} onChange={(e) => update(config.platform, "strategy", "threshold", Number(e.target.value))}/></label><label>Duração (ticks)<input type="number" value={config.strategy.holdTicks} onChange={(e) => update(config.platform, "strategy", "holdTicks", Number(e.target.value))}/></label><label>Stake / tamanho ($)<input type="number" value={config.risk.stake} onChange={(e) => update(config.platform, "risk", "stake", Number(e.target.value))}/></label><label>Stake máximo ($)<input type="number" value={config.risk.maxStake} onChange={(e) => update(config.platform, "risk", "maxStake", Number(e.target.value))}/></label><label>Stop diário ($)<input type="number" value={config.risk.dailyStop} onChange={(e) => update(config.platform, "risk", "dailyStop", Number(e.target.value))}/></label><label>Drawdown máx. (%)<input type="number" value={config.risk.maxDrawdown} onChange={(e) => update(config.platform, "risk", "maxDrawdown", Number(e.target.value))}/></label><label>Máx. simultâneas<input type="number" value={config.risk.maxConcurrent} onChange={(e) => update(config.platform, "risk", "maxConcurrent", Number(e.target.value))}/></label><label>Cooldown (s)<input type="number" value={config.risk.cooldownSeconds} onChange={(e) => update(config.platform, "risk", "cooldownSeconds", Number(e.target.value))}/></label>{config.platform === "deriv" && <label>Paridade<select value={config.strategy.parity} onChange={(e) => update(config.platform, "strategy", "parity", e.target.value)}><option value="even">Par</option><option value="odd">Ímpar</option></select></label>}</div><div className="config-actions"><button onClick={save}><Save size={14}/>Salvar localmente</button><button className="outline" onClick={() => runTest(config)} disabled={testing}><Activity size={14}/>{testing ? "Simulando…" : "Executar backtest"}</button></div>{backtest && <div className="backtest"><b>Backtest local concluído</b><span>{backtest.trades} trades · {pct(backtest.winRate)} win rate · <i className={backtest.pnl >= 0 ? "good" : "bad"}>{money(backtest.pnl)}</i> · DD {pct(backtest.maxDrawdown)}</span></div>}</section>
    </div>
    <section className="table-card"><div className="tabs"><button className={panel === "orders" ? "active" : ""} onClick={() => setPanel("orders")}><History size={15}/>Histórico de ordens <span>{runtime.orders.length}</span></button><button className={panel === "logs" ? "active" : ""} onClick={() => setPanel("logs")}><Terminal size={15}/>Logs</button></div>{panel === "orders" ? <div className="table-wrap"><table><thead><tr><th>Horário</th><th>Ativo</th><th>Lado</th><th>Tamanho</th><th>Entrada</th><th>Saída</th><th>Resultado</th><th>Modo</th></tr></thead><tbody>{runtime.orders.length ? runtime.orders.map((order) => <tr key={order.id}><td>{new Date(order.closedAt).toLocaleTimeString("pt-BR")}</td><td>{order.symbol}</td><td><span className={`side ${order.side}`}>{order.side.toUpperCase()}</span></td><td>${order.size.toFixed(2)}</td><td>{order.entry.toFixed(5)}</td><td>{order.exit.toFixed(5)}</td><td className={order.pnl >= 0 ? "good" : "bad"}>{order.pnl >= 0 ? "+" : ""}{money(order.pnl)}</td><td><span className="paper-tag">PAPER</span></td></tr>) : <tr><td colSpan={8} className="empty"><CircleDollarSign/>Nenhuma ordem ainda. Inicie o bot para simular microtrades.</td></tr>}</tbody></table></div> : <div className="logs">{runtime.logs.map((log, i) => <p key={`${log}-${i}`}><span>{String(i + 1).padStart(2, "0")}</span>{log}</p>)}</div>}</section>
  </>;
}
