"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowLeft, Bot, Check, ChevronRight, CircleDollarSign, FlaskConical, Gauge, History, LayoutDashboard, LockKeyhole, Play, Save, Settings2, ShieldAlert, Square, Terminal, TriangleAlert, Wifi, X } from "lucide-react";
import { botMeta, defaultConfigs, defaultReadiness } from "@/lib/config";
import { initialRuntime, simulateStep } from "@/lib/simulator";
import { BacktestResult, BotConfig, BotId, BotRuntime, ConnectionReadiness, TradingMode } from "@/lib/types";
import { Sparkline } from "./Sparkline";
import { runBacktest } from "@/lib/backtest";

type View = "overview" | "connection" | "research" | BotId;
const storageKey = "cashfacttory:ctrader-configs:v2";
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(value);
const pct = (value: number) => `${value.toFixed(1)}%`;
const modeLabels: Record<TradingMode, string> = { paper: "PAPER LOCAL", demo: "cTRADER DEMO", live: "cTRADER REAL" };

function Metric({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "bad" }) {
  return <div className="metric"><span>{label}</span><strong className={tone}>{value}</strong>{note && <small>{note}</small>}</div>;
}

function StatusPill({ runtime }: { runtime: BotRuntime }) {
  const labels = { stopped: "PARADO", running: "RODANDO", cooldown: "COOLDOWN", "risk-locked": "BLOQUEADO" };
  return <span className={`status ${runtime.status}`}><i />{labels[runtime.status]}</span>;
}

function safeLoad(raw: string | null): BotConfig[] | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as BotConfig[];
    return Array.isArray(value) && value.length === 4 && value.every((item) => item.id && item.strategy?.kind) ? value : null;
  } catch { return null; }
}

export function TradingDashboard() {
  const [view, setView] = useState<View>("overview");
  const [configs, setConfigs] = useState<BotConfig[]>(defaultConfigs);
  const [runtimes, setRuntimes] = useState<Record<BotId, BotRuntime>>(() => Object.fromEntries(defaultConfigs.map((config) => [config.id, initialRuntime(config)])) as Record<BotId, BotRuntime>);
  const [panel, setPanel] = useState<"orders" | "logs">("orders");
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState("Configuração segura carregada. Nenhuma ordem externa será enviada.");
  const [readiness] = useState<ConnectionReadiness>(defaultReadiness);
  const busy = useRef(new Set<BotId>());

  useEffect(() => {
    const stored = safeLoad(localStorage.getItem(storageKey));
    if (stored) {
      setConfigs(stored);
      setRuntimes(Object.fromEntries(stored.map((config) => [config.id, initialRuntime(config)])) as Record<BotId, BotRuntime>);
      setNotice("Suas quatro configurações cTrader foram restauradas deste dispositivo.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      configs.forEach(async (config) => {
        if (runtimes[config.id].status !== "running" || busy.current.has(config.id)) return;
        busy.current.add(config.id);
        try {
          const next = await simulateStep(config, runtimes[config.id]);
          setRuntimes((current) => ({ ...current, [config.id]: next }));
        } finally { busy.current.delete(config.id); }
      });
    }, 1100);
    return () => window.clearInterval(timer);
  }, [configs, runtimes]);

  const totals = useMemo(() => {
    const values = Object.values(runtimes);
    const wins = values.reduce((sum, runtime) => sum + runtime.wins, 0);
    const trades = values.reduce((sum, runtime) => sum + runtime.wins + runtime.losses, 0);
    return { balance: values.reduce((sum, runtime) => sum + runtime.balance, 0), pnl: values.reduce((sum, runtime) => sum + runtime.pnl, 0), trades, winRate: trades ? wins / trades * 100 : 0, drawdown: Math.max(...values.map((runtime) => runtime.drawdown)) };
  }, [runtimes]);

  const setStatus = (id: BotId, status: BotRuntime["status"]) => setRuntimes((all) => ({ ...all, [id]: { ...all[id], status, logs: [`${new Date().toLocaleTimeString("pt-BR")} · Bot ${status === "running" ? "iniciado" : "parado"} pelo operador.`, ...all[id].logs] } }));
  const emergency = () => { setRuntimes((all) => Object.fromEntries(Object.entries(all).map(([id, runtime]) => [id, { ...runtime, status: "stopped", logs: [`${new Date().toLocaleTimeString("pt-BR")} · PARADA DE EMERGÊNCIA acionada.`, ...runtime.logs] }])) as Record<BotId, BotRuntime>); setNotice("Todos os robôs foram interrompidos."); };
  const save = () => { localStorage.setItem(storageKey, JSON.stringify(configs)); setNotice("Configurações salvas com segurança neste dispositivo."); };
  const updateConfig = (id: BotId, path: "risk" | "strategy", field: string, value: string | number) => setConfigs((items) => items.map((item) => item.id === id ? { ...item, [path]: { ...item[path], [field]: value } } : item));
  const runTest = async (config: BotConfig) => { setTesting(true); setBacktest(null); await new Promise((resolve) => window.setTimeout(resolve, 120)); setBacktest(runBacktest(config)); setTesting(false); };
  const requestMode = (mode: TradingMode) => {
    if (mode === "paper") { setNotice("Paper local já está ativo."); return; }
    setNotice(mode === "demo" ? "Demo será liberado após aprovação do app e OAuth. O painel não solicita segredos no navegador." : "Modo real permanece travado até aprovação, OAuth, validação completa em demo e desbloqueio explícito.");
    setView("connection");
  };

  const selected = configs.find((config) => config.id === view);
  const runtime = selected ? runtimes[selected.id] : null;

  return <div className="shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setView("overview")}><div className="brandmark"><Activity size={19}/></div><div><b>CashFacttory</b><span>cTRADER LAB</span></div></button>
      <nav>
        <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}><LayoutDashboard size={18}/>Visão geral</button>
        <p>ESTRATÉGIAS</p>
        {configs.map((config) => <button key={config.id} className={view === config.id ? "active" : ""} onClick={() => { setView(config.id); setBacktest(null); }}><span className="platform-dot" style={{ color: botMeta[config.id].color }}>{botMeta[config.id].number}</span>{config.shortName}<i className={runtimes[config.id].status === "running" ? "online" : ""}/></button>)}
        <p>SISTEMA</p>
        <button className={view === "connection" ? "active" : ""} onClick={() => setView("connection")}><Wifi size={18}/>Conexão cTrader</button>
        <button className={view === "research" ? "active" : ""} onClick={() => setView("research")}><FlaskConical size={18}/>Pesquisa</button>
      </nav>
      <div className="safe-card"><ShieldAlert size={18}/><div><b>Paper por padrão</b><span>Real exige 4 travas</span></div></div>
      <button className="emergency" onClick={emergency}><TriangleAlert size={17}/>Parada de emergência</button>
    </aside>

    <main>
      <header><div><div className="eyebrow">cTRADER STRATEGY CONTROL</div><h1>{selected?.name ?? (view === "connection" ? "Conexão cTrader" : view === "research" ? "Pesquisa de estratégias" : "Visão geral")}</h1><p>{selected?.description ?? (view === "connection" ? "Uma única conexão segura para os quatro robôs." : view === "research" ? "Hipóteses, limitações e fontes que orientam os testes." : "Quatro estratégias rápidas, um único provedor e um único motor de risco.")}</p></div><div className="header-actions"><div className="mode-switch">{(["paper", "demo", "live"] as TradingMode[]).map((mode) => <button key={mode} className={mode === "paper" ? "active" : "locked"} onClick={() => requestMode(mode)}>{mode !== "paper" && <LockKeyhole size={12}/>} {modeLabels[mode]}</button>)}</div></div></header>
      <div className="notice"><ShieldAlert size={15}/><span>{notice}</span><button aria-label="Fechar aviso" onClick={() => setNotice("")}><X size={14}/></button></div>

      {selected && runtime ? <BotDetail config={selected} runtime={runtime} panel={panel} setPanel={setPanel} setStatus={setStatus} save={save} update={updateConfig} runTest={runTest} backtest={backtest} testing={testing}/> : view === "connection" ? <Connection readiness={readiness}/> : view === "research" ? <Research configs={configs}/> : <Overview configs={configs} runtimes={runtimes} totals={totals} open={setView} toggle={setStatus}/>} 
    </main>
  </div>;
}

function Overview({ configs, runtimes, totals, open, toggle }: { configs: BotConfig[]; runtimes: Record<BotId, BotRuntime>; totals: { balance: number; pnl: number; trades: number; winRate: number; drawdown: number }; open: (view: View) => void; toggle: (id: BotId, status: BotRuntime["status"]) => void }) {
  return <>
    <section className="metrics-grid"><Metric label="CAPITAL PAPER TOTAL" value={money(totals.balance)} note="4 carteiras simuladas"/><Metric label="P&L LÍQUIDO" value={`${totals.pnl >= 0 ? "+" : ""}${money(totals.pnl)}`} tone={totals.pnl >= 0 ? "good" : "bad"} note="Custos simulados incluídos"/><Metric label="WIN RATE" value={pct(totals.winRate)} note={`${totals.trades} operações fechadas`}/><Metric label="DRAWDOWN MÁX." value={pct(totals.drawdown)} tone={totals.drawdown > 3 ? "bad" : undefined} note="Maior entre os robôs"/></section>
    <div className="section-title"><div><h2>Estratégias cTrader</h2><p>Entradas de segundos a poucos minutos; nenhuma promessa de rentabilidade.</p></div><span><Wifi size={15}/>Feed paper local</span></div>
    <section className="bots-grid">{configs.map((config) => { const runtime = runtimes[config.id]; const trades = runtime.wins + runtime.losses; return <article className="bot-card" key={config.id} style={{ "--accent": botMeta[config.id].color } as React.CSSProperties}><div className="bot-top"><div className="bot-icon">{botMeta[config.id].number}</div><div><h3>{config.name}</h3><StatusPill runtime={runtime}/></div><button className="icon-button" onClick={() => open(config.id)} aria-label={`Abrir ${config.name}`}><ChevronRight size={18}/></button></div><p>{config.description}</p><Sparkline values={runtime.prices.map((tick) => tick.price)} positive={runtime.pnl >= 0}/><div className="mini-metrics"><div><span>P&L líquido</span><b className={runtime.pnl >= 0 ? "good" : "bad"}>{runtime.pnl >= 0 ? "+" : ""}{money(runtime.pnl)}</b></div><div><span>Win rate</span><b>{trades ? pct(runtime.wins / trades * 100) : "—"}</b></div><div><span>Risco/trade</span><b>{money(config.risk.riskPerTrade)}</b></div></div><div className="card-actions"><button className={runtime.status === "running" ? "stop" : "start"} onClick={() => toggle(config.id, runtime.status === "running" ? "stopped" : "running")}>{runtime.status === "running" ? <><Square size={14}/>Parar</> : <><Play size={14}/>Iniciar paper</>}</button><button onClick={() => open(config.id)}><Settings2 size={14}/>Configurar</button></div></article>; })}</section>
    <section className="guardrail-strip"><div><ShieldAlert/><b>Princípio central</b><span>Uma estratégia só opera se o sinal esperado superar spread, slippage e limites de risco.</span></div><div><span>PROVEDOR</span><b>cTrader Open API</b></div><div><span>LIVE</span><b className="bad">TRAVADO</b></div></section>
  </>;
}

function BotDetail({ config, runtime, panel, setPanel, setStatus, save, update, runTest, backtest, testing }: { config: BotConfig; runtime: BotRuntime; panel: "orders" | "logs"; setPanel: (panel: "orders" | "logs") => void; setStatus: (id: BotId, status: BotRuntime["status"]) => void; save: () => void; update: (id: BotId, path: "risk" | "strategy", field: string, value: string | number) => void; runTest: (config: BotConfig) => void; backtest: BacktestResult | null; testing: boolean }) {
  const trades = runtime.wins + runtime.losses;
  return <>
    <div className="detail-bar"><button className="back-link" onClick={() => history.back()}><ArrowLeft size={15}/>Voltar</button><div className="connection"><Wifi size={17}/><div><b>cTrader · simulação local</b><span>Sem acesso à conta ou credenciais</span></div></div><StatusPill runtime={runtime}/><button className={runtime.status === "running" ? "stop main-action" : "start main-action"} onClick={() => setStatus(config.id, runtime.status === "running" ? "stopped" : "running")}>{runtime.status === "running" ? <><Square size={15}/>Parar bot</> : <><Play size={15}/>Iniciar paper</>}</button></div>
    <section className="metrics-grid detail"><Metric label="SALDO PAPER" value={money(runtime.balance)}/><Metric label="P&L LÍQUIDO" value={`${runtime.pnl >= 0 ? "+" : ""}${money(runtime.pnl)}`} tone={runtime.pnl >= 0 ? "good" : "bad"}/><Metric label="WIN RATE" value={trades ? pct(runtime.wins / trades * 100) : "—"}/><Metric label="DRAWDOWN" value={pct(runtime.drawdown)}/></section>
    <div className="detail-grid">
      <section className="chart-card"><div className="card-heading"><div><span>cTRADER · {config.strategy.symbol}</span><h2>Feed de ticks paper</h2></div><b>{runtime.prices.at(-1)?.price.toFixed(5)}</b></div><Sparkline values={runtime.prices.map((price) => price.price)} positive={runtime.pnl >= 0}/><div className="chart-footer"><span><i className="green-dot"/>Últimos {runtime.prices.length} ticks</span><span>Saída alvo: {config.strategy.holdTicks} ticks</span></div><div className="hypothesis"><b>Regra do robô</b><span>{config.hypothesis}</span></div></section>
      <section className="config-card"><div className="card-heading"><div><span>CONTROLES</span><h2>Estratégia e risco</h2></div><Gauge size={20}/></div><div className="form-grid"><label>Ativo<input value={config.strategy.symbol} onChange={(event) => update(config.id, "strategy", "symbol", event.target.value)}/></label><label>Janela de ticks<input type="number" min="8" value={config.strategy.tickWindow} onChange={(event) => update(config.id, "strategy", "tickWindow", Number(event.target.value))}/></label><label>Limiar do sinal<input type="number" step="0.01" value={config.strategy.threshold} onChange={(event) => update(config.id, "strategy", "threshold", Number(event.target.value))}/></label><label>Duração máxima (ticks)<input type="number" min="1" value={config.strategy.holdTicks} onChange={(event) => update(config.id, "strategy", "holdTicks", Number(event.target.value))}/></label><label>Spread máximo (pips)<input type="number" step="0.1" value={config.strategy.maxSpreadPips} onChange={(event) => update(config.id, "strategy", "maxSpreadPips", Number(event.target.value))}/></label><label>Volatilidade mínima<input type="number" step="0.1" value={config.strategy.minimumVolatilityPips} onChange={(event) => update(config.id, "strategy", "minimumVolatilityPips", Number(event.target.value))}/></label><label>Stop loss (pips)<input type="number" step="0.1" value={config.strategy.stopLossPips} onChange={(event) => update(config.id, "strategy", "stopLossPips", Number(event.target.value))}/></label><label>Take profit (pips)<input type="number" step="0.1" value={config.strategy.takeProfitPips} onChange={(event) => update(config.id, "strategy", "takeProfitPips", Number(event.target.value))}/></label><label>Risco por operação ($)<input type="number" step="0.1" value={config.risk.riskPerTrade} onChange={(event) => update(config.id, "risk", "riskPerTrade", Number(event.target.value))}/></label><label>Risco máximo ($)<input type="number" step="0.1" value={config.risk.maxRiskPerTrade} onChange={(event) => update(config.id, "risk", "maxRiskPerTrade", Number(event.target.value))}/></label><label>Stop diário ($)<input type="number" value={config.risk.dailyStop} onChange={(event) => update(config.id, "risk", "dailyStop", Number(event.target.value))}/></label><label>Drawdown máx. (%)<input type="number" step="0.1" value={config.risk.maxDrawdown} onChange={(event) => update(config.id, "risk", "maxDrawdown", Number(event.target.value))}/></label><label>Máx. simultâneas<input type="number" min="1" value={config.risk.maxConcurrent} onChange={(event) => update(config.id, "risk", "maxConcurrent", Number(event.target.value))}/></label><label>Cooldown (s)<input type="number" value={config.risk.cooldownSeconds} onChange={(event) => update(config.id, "risk", "cooldownSeconds", Number(event.target.value))}/></label></div><div className="config-actions"><button onClick={save}><Save size={14}/>Salvar neste dispositivo</button><button className="outline" onClick={() => runTest(config)} disabled={testing}><Activity size={14}/>{testing ? "Simulando…" : "Executar backtest"}</button></div>{backtest && <div className="backtest"><b>Backtest com custos concluído</b><span>{backtest.trades} trades · {pct(backtest.winRate)} acerto · <i className={backtest.pnl >= 0 ? "good" : "bad"}>{money(backtest.pnl)}</i> líquido · custos {money(backtest.costs)} · DD {pct(backtest.maxDrawdown)}</span></div>}</section>
    </div>
    <OrderPanel runtime={runtime} panel={panel} setPanel={setPanel}/>
  </>;
}

function OrderPanel({ runtime, panel, setPanel }: { runtime: BotRuntime; panel: "orders" | "logs"; setPanel: (panel: "orders" | "logs") => void }) {
  return <section className="table-card"><div className="tabs"><button className={panel === "orders" ? "active" : ""} onClick={() => setPanel("orders")}><History size={15}/>Ordens <span>{runtime.orders.length}</span></button><button className={panel === "logs" ? "active" : ""} onClick={() => setPanel("logs")}><Terminal size={15}/>Logs</button></div>{panel === "orders" ? <div className="table-wrap"><table><thead><tr><th>Horário</th><th>Ativo</th><th>Lado</th><th>Tamanho</th><th>Entrada</th><th>Saída</th><th>Custos</th><th>Resultado</th><th>Modo</th></tr></thead><tbody>{runtime.orders.length ? runtime.orders.map((order) => <tr key={order.id}><td>{new Date(order.closedAt).toLocaleTimeString("pt-BR")}</td><td>{order.symbol}</td><td><span className={`side ${order.side}`}>{order.side.toUpperCase()}</span></td><td>{order.size.toFixed(3)}</td><td>{order.entry.toFixed(5)}</td><td>{order.exit.toFixed(5)}</td><td>{money(order.costs)}</td><td className={order.pnl >= 0 ? "good" : "bad"}>{order.pnl >= 0 ? "+" : ""}{money(order.pnl)}</td><td><span className="paper-tag">PAPER</span></td></tr>) : <tr><td colSpan={9} className="empty"><CircleDollarSign/>Nenhuma ordem. Inicie o robô para testar.</td></tr>}</tbody></table></div> : <div className="logs">{runtime.logs.map((log, index) => <p key={`${log}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span>{log}</p>)}</div>}</section>;
}

function Connection({ readiness }: { readiness: ConnectionReadiness }) {
  const steps = [
    ["Aplicativo aprovado pela Spotware", readiness.approval, "Solicitação enviada; status atual: Submitted."],
    ["OAuth e conta demo autorizados", readiness.oauth, "Será feito sem armazenar segredo no navegador."],
    ["Validação em demo concluída", readiness.demoValidated, "Ordens, reconciliação, SL/TP e emergência precisam passar."],
    ["Modo real desbloqueado", readiness.liveUnlocked, "Exige uma ação separada e explícita depois dos testes."]
  ] as const;
  return <div className="connection-layout"><section className="connection-hero"><div className="connection-symbol"><Wifi size={28}/></div><div><span>PROVEDOR ÚNICO</span><h2>cTrader Open API</h2><p>Os quatro robôs compartilham autenticação, dados, ordens, reconciliação e limites. As estratégias permanecem isoladas.</p></div><div className="submitted">SUBMITTED</div></section><section className="readiness-card"><div className="card-heading"><div><span>TRAVAS DE SEGURANÇA</span><h2>Caminho até o modo real</h2></div><LockKeyhole/></div><div className="steps">{steps.map(([label, ready, note], index) => <div className={ready ? "ready" : "pending"} key={label}><span>{ready ? <Check size={15}/> : index + 1}</span><div><b>{label}</b><small>{note}</small></div></div>)}</div></section><section className="security-copy"><ShieldAlert/><div><b>Segredos ficam fora da interface</b><p>Client Secret e tokens nunca devem entrar no GitHub, no armazenamento do navegador ou nos logs. O conector de execução será ativado apenas em ambiente protegido.</p></div></section></div>;
}

function Research({ configs }: { configs: BotConfig[] }) {
  const evidence = [
    { title: "Custos primeiro", text: "Microtrades têm alvo pequeno; spread, comissão e slippage podem consumir toda a vantagem. O simulador desconta custos antes de mostrar P&L.", href: "https://arxiv.org/abs/1411.5062", source: "Leung & Li — mean reversion com custos e stop" },
    { title: "Horizonte realmente curto", text: "Evidência de momentum e reversão pode aparecer em horizontes intradiários, mas depende do dado, do regime e da execução. Não é garantia de lucro.", href: "https://fraser.stlouisfed.org/docs/publications/frbsl_wp/1999-016.pdf", source: "Federal Reserve Bank of St. Louis" },
    { title: "Dados e execução compatíveis", text: "O cTrader fornece bid/ask, ticks, trendbars e profundidade. Cada robô filtra spread e usa o mesmo ciclo de autenticação e ordens.", href: "https://help.ctrader.com/open-api/symbol-data/", source: "cTrader Open API — Symbol data" },
    { title: "Demo antes de real", text: "A documentação recomenda desenvolver e validar com conta demo antes de migrar para live. O painel transforma essa recomendação em trava técnica.", href: "https://help.ctrader.com/open-api/", source: "cTrader Open API — Getting started" }
  ];
  return <div className="research-layout"><section className="research-intro"><FlaskConical/><div><h2>Quatro hipóteses, nenhuma promessa</h2><p>As configurações são pontos de partida para paper trading e teste fora da amostra. “Garimpar centavos” só faz sentido quando o ganho esperado permanece positivo depois de todos os custos.</p></div></section><section className="strategy-matrix"><div className="matrix-row matrix-head"><span>Estratégia</span><span>Regime procurado</span><span>Entrada</span><span>Saída rápida</span></div>{configs.map((config) => <div className="matrix-row" key={config.id}><b style={{ color: botMeta[config.id].color }}>{config.name}</b><span>{config.strategy.kind === "momentum" ? "Tendência limpa" : config.strategy.kind === "mean-reversion" ? "Faixa lateral" : config.strategy.kind === "breakout" ? "Compressão → expansão" : "Tendência + retração"}</span><span>{config.hypothesis}</span><span>{config.strategy.holdTicks} ticks · SL {config.strategy.stopLossPips} · TP {config.strategy.takeProfitPips} pips</span></div>)}</section><section className="evidence-grid">{evidence.map((item) => <a href={item.href} target="_blank" rel="noreferrer" key={item.title}><span>FONTE</span><h3>{item.title}</h3><p>{item.text}</p><b>{item.source}<ChevronRight size={14}/></b></a>)}</section><section className="risk-warning"><TriangleAlert/><p><b>Risco elevado.</b> Forex alavancado e CFDs podem gerar perdas rápidas. Resultados de simulação, inclusive positivos, não predizem desempenho real. Comece com demo e use apenas capital que possa perder.</p></section></div>;
}
