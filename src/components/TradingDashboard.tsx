"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowLeft, Check, ChevronRight, CircleDollarSign, Dices, FlaskConical, Gauge, Hash, History, LayoutDashboard, LockKeyhole, Play, Save, Settings2, ShieldAlert, Square, Terminal, TriangleAlert, Wifi, X } from "lucide-react";
import { botMeta, defaultConfigs, defaultReadiness } from "@/lib/config";
import { initialRuntime, simulateStep } from "@/lib/simulator";
import { BacktestResult, BotConfig, BotId, BotRuntime, ConnectionReadiness, TradingMode } from "@/lib/types";
import { Sparkline } from "./Sparkline";
import { runBacktest } from "@/lib/backtest";
import { positionSize } from "@/lib/risk";
import { ParityCurrency, ParityLab } from "./ParityLab";
import { MatchContract, MatchCurrency, MatchDiffersLab } from "./MatchDiffersLab";
import { AccumulatorCurrency, AccumulatorLab, GrowthRate } from "./AccumulatorLab";

type View = "overview" | "connection" | "research" | "parity" | "match-differs" | "accumulators" | BotId;
const storageKey = "cashfacttory:deriv-direct-configs:v6";
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(value);
const pct = (value: number) => `${value.toFixed(1)}%`;
const modeLabels: Record<TradingMode, string> = { paper: "PAPER LOCAL", demo: "DERIV DEMO", live: "DERIV REAL" };

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
  const [selectedMode, setSelectedMode] = useState<TradingMode>("paper");
  const [haltEpoch, setHaltEpoch] = useState(0);
  const [readiness, setReadiness] = useState<ConnectionReadiness>(defaultReadiness);
  const [accountSummary, setAccountSummary] = useState<Array<{ type: string; currency: string; balance: number; status: string }>>([]);
  const busy = useRef(new Set<BotId>());
  const executionSocket = useRef<WebSocket | null>(null);
  const executionMode = useRef<TradingMode>("paper");

  useEffect(() => {
    const stored = safeLoad(localStorage.getItem(storageKey));
    if (stored) {
      setConfigs(stored);
      setRuntimes(Object.fromEntries(stored.map((config) => [config.id, initialRuntime(config)])) as Record<BotId, BotRuntime>);
      setNotice("Suas quatro configurações Deriv foram restauradas deste dispositivo.");
    }
  }, []);

  useEffect(() => {
    fetch("/api/deriv/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setReadiness({ publicFeed: true, oauth: Boolean(data.authenticated), demoValidated: Boolean(data.demoValidated), liveUnlocked: Boolean(data.liveUnlocked) });
        setAccountSummary(Array.isArray(data.accounts) ? data.accounts : []);
      })
      .catch(() => setReadiness(defaultReadiness));
    return () => executionSocket.current?.close();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      configs.forEach(async (config) => {
        if (runtimes[config.id].status !== "running" || busy.current.has(config.id)) return;
        busy.current.add(config.id);
        try {
          const previous = runtimes[config.id];
          const next = await simulateStep(config, previous);
          if (next.orders.length > previous.orders.length && executionMode.current !== "paper") {
            const latest = next.orders[0];
            const result = await executeOrder(config, latest.side);
            const actualPnl = Number(result.profit);
            const simulatedPnl = latest.pnl;
            next.orders[0] = { ...latest, pnl: actualPnl, costs: 0 };
            next.pnl += actualPnl - simulatedPnl;
            next.balance += actualPnl - simulatedPnl;
            next.wins = previous.wins + (actualPnl > 0 ? 1 : 0);
            next.losses = previous.losses + (actualPnl <= 0 ? 1 : 0);
            next.logs = [`${new Date().toLocaleTimeString("pt-BR")} · Ordem ${executionMode.current.toUpperCase()} liquidada pela Deriv · ${money(actualPnl)}.`, ...next.logs].slice(0, 40);
          }
          setRuntimes((current) => ({ ...current, [config.id]: next }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha no feed Deriv";
          setRuntimes((current) => ({ ...current, [config.id]: { ...current[config.id], status: "stopped", connected: false, logs: [`${new Date().toLocaleTimeString("pt-BR")} · ${message}`, ...current[config.id].logs].slice(0, 40) } }));
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
  const emergency = () => { executionSocket.current?.close(); executionSocket.current = null; executionMode.current = "paper"; setSelectedMode("paper"); setHaltEpoch((value) => value + 1); setRuntimes((all) => Object.fromEntries(Object.entries(all).map(([id, runtime]) => [id, { ...runtime, status: "stopped", logs: [`${new Date().toLocaleTimeString("pt-BR")} · PARADA DE EMERGÊNCIA acionada.`, ...runtime.logs] }])) as Record<BotId, BotRuntime>); setNotice("Todos os robôs foram interrompidos e a sessão autenticada foi encerrada."); };
  const save = () => { localStorage.setItem(storageKey, JSON.stringify(configs)); setNotice("Configurações salvas com segurança neste dispositivo."); };
  const updateConfig = (id: BotId, path: "risk" | "strategy", field: string, value: string | number) => setConfigs((items) => items.map((item) => item.id === id ? { ...item, [path]: { ...item[path], [field]: value } } : item));
  const runTest = async (config: BotConfig) => { setTesting(true); setBacktest(null); await new Promise((resolve) => window.setTimeout(resolve, 120)); setBacktest(runBacktest(config)); setTesting(false); };
  const requestMode = async (mode: TradingMode) => {
    if (mode === "paper") { executionSocket.current?.close(); executionSocket.current = null; executionMode.current = "paper"; setSelectedMode("paper"); setNotice("PAPER selecionado: cotações públicas diretas da Deriv e execução simulada."); return; }
    if (!readiness.oauth) { setNotice("A credencial protegida ainda não foi validada pelo servidor."); return; }
    let confirmation: string | undefined;
    if (mode === "live") {
      if (!readiness.demoValidated || !readiness.liveUnlocked) { setNotice("REAL permanece travado até a validação completa em demo e a liberação do servidor."); return; }
      confirmation = window.prompt("Operações neste modo usam dinheiro real. Digite ATIVAR REAL para abrir a sessão:") ?? undefined;
      if (confirmation !== "ATIVAR REAL") { setNotice("Ativação real cancelada. Nenhuma ordem foi enviada."); return; }
    }
    setNotice(`Solicitando sessão ${mode.toUpperCase()} de uso único…`);
    try {
      const response = await fetch("/api/deriv/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, confirmation }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sessão recusada");
      const socket = new WebSocket(data.url);
      await new Promise<void>((resolve, reject) => { const timer = window.setTimeout(() => reject(new Error("Tempo limite da conexão")), 8000); socket.onopen = () => { window.clearTimeout(timer); resolve(); }; socket.onerror = () => { window.clearTimeout(timer); reject(new Error("Falha no WebSocket autenticado")); }; });
      executionSocket.current?.close(); executionSocket.current = socket; executionMode.current = mode; setSelectedMode(mode);
      setNotice(`${mode === "demo" ? "DEMO" : "REAL"} conectado à Deriv. Os robôs usarão proposal antes de cada compra.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível abrir a sessão Deriv"); }
  };

  const executeOrder = async (config: BotConfig, side: "buy" | "sell") => {
    const socket = executionSocket.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("Sessão autenticada indisponível");
    const request = (payload: Record<string, unknown>, expected: string) => new Promise<any>((resolve, reject) => {
      const reqId = Math.floor(Math.random() * 1_000_000_000);
      const timer = window.setTimeout(() => { socket.removeEventListener("message", handler); reject(new Error("Deriv não respondeu à ordem")); }, 8000);
      const handler = (event: MessageEvent) => { const data = JSON.parse(String(event.data)); if (data.req_id !== reqId) return; window.clearTimeout(timer); socket.removeEventListener("message", handler); if (data.error) reject(new Error(data.error.message || "Ordem recusada")); else if (data.msg_type === expected) resolve(data); };
      socket.addEventListener("message", handler);
      socket.send(JSON.stringify({ ...payload, req_id: reqId }));
    });
    const amount = Math.max(0.35, Math.min(config.risk.riskPerTrade, config.risk.maxRiskPerTrade));
    const proposal = await request({ proposal: 1, amount, basis: "stake", contract_type: side === "buy" ? "CALL" : "PUT", currency: "USD", duration: Math.max(1, config.strategy.holdTicks), duration_unit: "t", underlying_symbol: config.strategy.symbol }, "proposal");
    const ask = Number(proposal.proposal?.ask_price);
    if (!proposal.proposal?.id || !Number.isFinite(ask) || ask > config.risk.maxRiskPerTrade) throw new Error("Proposta fora do limite de risco");
    const purchase = await request({ buy: proposal.proposal.id, price: ask }, "buy");
    const contractId = purchase.buy?.contract_id;
    if (!contractId) throw new Error("A Deriv não retornou o contrato comprado");
    return new Promise<{ profit: number }>((resolve, reject) => {
      const reqId = Math.floor(Math.random() * 1_000_000_000);
      const timer = window.setTimeout(() => { socket.removeEventListener("message", handler); reject(new Error("Contrato não liquidado dentro do limite")); }, 45000);
      const handler = (event: MessageEvent) => {
        const data = JSON.parse(String(event.data));
        if (data.error && data.req_id === reqId) { window.clearTimeout(timer); socket.removeEventListener("message", handler); reject(new Error(data.error.message || "Falha ao acompanhar contrato")); return; }
        if (data.msg_type !== "proposal_open_contract" || String(data.proposal_open_contract?.contract_id) !== String(contractId)) return;
        if (!data.proposal_open_contract?.is_sold) return;
        window.clearTimeout(timer); socket.removeEventListener("message", handler);
        resolve({ profit: Number(data.proposal_open_contract.profit || 0) });
      };
      socket.addEventListener("message", handler);
      socket.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1, req_id: reqId }));
    });
  };

  const executeParityTrade = async (symbol: string, parity: "even" | "odd", amount: number, currency: ParityCurrency, durationTicks: number) => {
    const socket = executionSocket.current;
    if (selectedMode === "paper") {
      await new Promise((resolve) => window.setTimeout(resolve, durationTicks * 1000));
      const digit = Math.floor(Math.random() * 10);
      return ((digit % 2 === 0) === (parity === "even")) ? amount * 0.88 : -amount;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error(`Conecte o modo ${selectedMode.toUpperCase()} na aba Conexão Deriv antes de iniciar.`);
    const request = (payload: Record<string, unknown>, expected: string) => new Promise<any>((resolve, reject) => {
      const reqId = Math.floor(Math.random() * 1_000_000_000);
      const timer = window.setTimeout(() => { socket.removeEventListener("message", handler); reject(new Error("Deriv não respondeu ao contrato de dígito")); }, 10000);
      const handler = (event: MessageEvent) => { const data = JSON.parse(String(event.data)); if (data.req_id !== reqId) return; window.clearTimeout(timer); socket.removeEventListener("message", handler); if (data.error) reject(new Error(data.error.message || "Contrato recusado")); else if (data.msg_type === expected) resolve(data); };
      socket.addEventListener("message", handler); socket.send(JSON.stringify({ ...payload, req_id: reqId }));
    });
    const proposal = await request({ proposal: 1, amount, basis: "stake", contract_type: parity === "even" ? "DIGITEVEN" : "DIGITODD", currency, duration: durationTicks, duration_unit: "t", underlying_symbol: symbol }, "proposal");
    const ask = Number(proposal.proposal?.ask_price);
    if (!proposal.proposal?.id || !Number.isFinite(ask) || ask > amount * 1.02) throw new Error("Proposta Par/Ímpar fora do limite de stake");
    const purchase = await request({ buy: proposal.proposal.id, price: ask }, "buy");
    const contractId = purchase.buy?.contract_id;
    if (!contractId) throw new Error("Contrato Par/Ímpar não retornado pela Deriv");
    return new Promise<number>((resolve, reject) => {
      const reqId = Math.floor(Math.random() * 1_000_000_000);
      const timer = window.setTimeout(() => { socket.removeEventListener("message", handler); reject(new Error("Contrato Par/Ímpar não liquidado")); }, 20000);
      const handler = (event: MessageEvent) => { const data = JSON.parse(String(event.data)); if (data.error && data.req_id === reqId) { window.clearTimeout(timer); socket.removeEventListener("message", handler); reject(new Error(data.error.message || "Falha na liquidação")); return; } if (data.msg_type !== "proposal_open_contract" || String(data.proposal_open_contract?.contract_id) !== String(contractId) || !data.proposal_open_contract?.is_sold) return; window.clearTimeout(timer); socket.removeEventListener("message", handler); resolve(Number(data.proposal_open_contract.profit || 0)); };
      socket.addEventListener("message", handler); socket.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1, req_id: reqId }));
    });
  };

  const executeMatchTrade = async (symbol: string, contract: MatchContract, digit: number, amount: number, currency: MatchCurrency, durationTicks: number) => {
    const socket = executionSocket.current;
    if (selectedMode === "paper") {
      await new Promise((resolve) => window.setTimeout(resolve, durationTicks * 1000));
      const finalDigit = Math.floor(Math.random() * 10);
      const won = contract === "match" ? finalDigit === digit : finalDigit !== digit;
      return won ? amount * (contract === "match" ? 8 : 0.08) : -amount;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error(`Conecte o modo ${selectedMode.toUpperCase()} na aba Conexão Deriv antes de iniciar.`);
    const request = (payload: Record<string, unknown>, expected: string) => new Promise<any>((resolve, reject) => {
      const reqId = Math.floor(Math.random() * 1_000_000_000);
      const timer = window.setTimeout(() => { socket.removeEventListener("message", handler); reject(new Error("Deriv não respondeu ao contrato MATCH/DIFFERS")); }, 10000);
      const handler = (event: MessageEvent) => { const data = JSON.parse(String(event.data)); if (data.req_id !== reqId) return; window.clearTimeout(timer); socket.removeEventListener("message", handler); if (data.error) reject(new Error(data.error.message || "Contrato recusado")); else if (data.msg_type === expected) resolve(data); };
      socket.addEventListener("message", handler); socket.send(JSON.stringify({ ...payload, req_id: reqId }));
    });
    const proposal = await request({ proposal: 1, amount, basis: "stake", contract_type: contract === "match" ? "DIGITMATCH" : "DIGITDIFF", barrier: String(digit), currency, duration: durationTicks, duration_unit: "t", underlying_symbol: symbol }, "proposal");
    const ask = Number(proposal.proposal?.ask_price);
    if (!proposal.proposal?.id || !Number.isFinite(ask) || ask > amount * 1.02) throw new Error("Proposta MATCH/DIFFERS fora do limite de stake");
    const purchase = await request({ buy: proposal.proposal.id, price: ask }, "buy");
    const contractId = purchase.buy?.contract_id;
    if (!contractId) throw new Error("Contrato MATCH/DIFFERS não retornado pela Deriv");
    return new Promise<number>((resolve, reject) => {
      const reqId = Math.floor(Math.random() * 1_000_000_000);
      const timer = window.setTimeout(() => { socket.removeEventListener("message", handler); reject(new Error("Contrato MATCH/DIFFERS não liquidado")); }, 45000);
      const handler = (event: MessageEvent) => { const data = JSON.parse(String(event.data)); if (data.error && data.req_id === reqId) { window.clearTimeout(timer); socket.removeEventListener("message", handler); reject(new Error(data.error.message || "Falha na liquidação")); return; } if (data.msg_type !== "proposal_open_contract" || String(data.proposal_open_contract?.contract_id) !== String(contractId) || !data.proposal_open_contract?.is_sold) return; window.clearTimeout(timer); socket.removeEventListener("message", handler); resolve(Number(data.proposal_open_contract.profit || 0)); };
      socket.addEventListener("message", handler); socket.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1, req_id: reqId }));
    });
  };

  const executeAccumulatorTrade = async (symbol: string, growthRate: GrowthRate, amount: number, currency: AccumulatorCurrency, maxTicks: number) => {
    const socket = executionSocket.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error(`Conecte o modo ${selectedMode.toUpperCase()} na aba Conexão Deriv antes de iniciar.`);
    const request = (payload: Record<string, unknown>, expected: string) => new Promise<any>((resolve, reject) => {
      const reqId = Math.floor(Math.random() * 1_000_000_000);
      const timer = window.setTimeout(() => { socket.removeEventListener("message", handler); reject(new Error("Deriv não respondeu ao ACCU")); }, 10000);
      const handler = (event: MessageEvent) => { const data = JSON.parse(String(event.data)); if (data.req_id !== reqId) return; window.clearTimeout(timer); socket.removeEventListener("message", handler); if (data.error) reject(new Error(data.error.message || "ACCU recusado")); else if (data.msg_type === expected) resolve(data); };
      socket.addEventListener("message", handler); socket.send(JSON.stringify({ ...payload, req_id: reqId }));
    });
    const proposal = await request({ proposal: 1, amount, basis: "stake", contract_type: "ACCU", currency, growth_rate: growthRate, underlying_symbol: symbol }, "proposal");
    const ask = Number(proposal.proposal?.ask_price); const minimum = Number(proposal.proposal?.validation_params?.stake?.min ?? 0);
    if (!proposal.proposal?.id || !Number.isFinite(ask) || ask > amount * 1.02 || amount < minimum) throw new Error(`Stake ACCU inválida; mínimo informado pela Deriv: ${minimum} ${currency}.`);
    const purchase = await request({ buy: proposal.proposal.id, price: ask }, "buy"); const contractId = purchase.buy?.contract_id;
    if (!contractId) throw new Error("Contrato ACCU não retornado pela Deriv");
    return new Promise<number>((resolve, reject) => {
      const reqId = Math.floor(Math.random() * 1_000_000_000); const seen = new Set<number>(); let selling = false;
      const finish = (value: number) => { window.clearTimeout(timer); socket.removeEventListener("message", handler); resolve(value); };
      const timer = window.setTimeout(() => { socket.removeEventListener("message", handler); reject(new Error("ACCU excedeu a trava de acompanhamento")); }, Math.min(320000, maxTicks * 1500 + 15000));
      const handler = (event: MessageEvent) => {
        const data = JSON.parse(String(event.data));
        if (data.error && data.req_id === reqId) { window.clearTimeout(timer); socket.removeEventListener("message", handler); reject(new Error(data.error.message || "Falha ao acompanhar ACCU")); return; }
        const open = data.proposal_open_contract; if (data.msg_type !== "proposal_open_contract" || String(open?.contract_id) !== String(contractId)) return;
        if (open.is_sold) { finish(Number(open.profit || 0)); return; }
        const tickTime = Number(open.current_spot_time); if (Number.isFinite(tickTime)) seen.add(tickTime);
        if (seen.size >= maxTicks && !selling) { selling = true; void request({ sell: contractId, price: 0 }, "sell").then((sold) => finish(Number(sold.sell?.sold_for || 0) - ask)).catch((error) => { window.clearTimeout(timer); socket.removeEventListener("message", handler); reject(error); }); }
      };
      socket.addEventListener("message", handler); socket.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1, req_id: reqId }));
    });
  };

  const selected = configs.find((config) => config.id === view);
  const runtime = selected ? runtimes[selected.id] : null;

  return <div className="shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setView("overview")}><div className="brandmark"><Activity size={19}/></div><div><b>CashFacttory</b><span>DERIV LAB</span></div></button>
      <nav>
        <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}><LayoutDashboard size={18}/>Visão geral</button>
        <p>ESTRATÉGIAS</p>
        {configs.map((config) => <button key={config.id} className={view === config.id ? "active" : ""} onClick={() => { setView(config.id); setBacktest(null); }}><span className="platform-dot" style={{ color: botMeta[config.id].color }}>{botMeta[config.id].number}</span>{config.shortName}<i className={runtimes[config.id].status === "running" ? "online" : ""}/></button>)}
        <button className={view === "parity" ? "active" : ""} onClick={() => setView("parity")}><Dices size={18}/>Par & Ímpar</button>
        <button className={view === "match-differs" ? "active" : ""} onClick={() => setView("match-differs")}><Hash size={18}/>Match / Differs</button>
        <button className={view === "accumulators" ? "active" : ""} onClick={() => setView("accumulators")}><Activity size={18}/>Accumulators</button>
        <p>SISTEMA</p>
        <button className={view === "connection" ? "active" : ""} onClick={() => setView("connection")}><Wifi size={18}/>Conexão Deriv</button>
        <button className={view === "research" ? "active" : ""} onClick={() => setView("research")}><FlaskConical size={18}/>Pesquisa</button>
      </nav>
      <div className="safe-card"><ShieldAlert size={18}/><div><b>Paper por padrão</b><span>Real exige 4 travas</span></div></div>
      <button className="emergency" onClick={emergency}><TriangleAlert size={17}/>Parada de emergência</button>
    </aside>

    <main>
      <header><div><div className="eyebrow">DERIV STRATEGY CONTROL</div><h1>{selected?.name ?? (view === "connection" ? "Conexão Deriv" : view === "research" ? "Pesquisa de estratégias" : view === "parity" ? "Par & Ímpar" : view === "match-differs" ? "Match / Differs" : view === "accumulators" ? "Accumulators" : "Visão geral")}</h1><p>{selected?.description ?? (view === "connection" ? "Uma única conexão segura para todos os robôs." : view === "research" ? "Hipóteses, limitações e fontes que orientam os testes." : view === "parity" ? "Um bot por mercado EVEN/ODD, com previsões individuais e controles em grupo." : view === "match-differs" ? "Um bot habilitado por mercado de dígitos, com previsão individual e controles em grupo." : view === "accumulators" ? "Um bot por mercado ACCU confirmado, com crescimento individual e saída máxima." : "Quatro estratégias rápidas, uma única plataforma e um único motor de risco.")}</p></div><div className="header-actions"><button className="platform-button" onClick={() => setView("connection")}><Wifi size={14}/><span>PLATAFORMA</span><b>Deriv</b></button></div></header>
      <div className="notice"><ShieldAlert size={15}/><span>{notice}</span><button aria-label="Fechar aviso" onClick={() => setNotice("")}><X size={14}/></button></div>

      {selected && runtime ? (
        <BotDetail config={selected} runtime={runtime} panel={panel} setPanel={setPanel} setStatus={setStatus} save={save} update={updateConfig} runTest={runTest} backtest={backtest} testing={testing} onBack={() => setView("overview")}/>
      ) : view === "parity" ? (
        <ParityLab key={`parity-${selectedMode}-${haltEpoch}`} mode={selectedMode} trade={executeParityTrade}/>
      ) : view === "match-differs" ? (
        <MatchDiffersLab key={`match-${selectedMode}-${haltEpoch}`} mode={selectedMode} trade={executeMatchTrade}/>
      ) : view === "accumulators" ? (
        <AccumulatorLab key={`accu-${selectedMode}-${haltEpoch}`} mode={selectedMode} trade={executeAccumulatorTrade}/>
      ) : view === "connection" ? (
        <Connection readiness={readiness} accounts={accountSummary} mode={selectedMode} requestMode={requestMode}/>
      ) : view === "research" ? (
        <Research configs={configs}/>
      ) : (
        <Overview configs={configs} runtimes={runtimes} totals={totals} open={setView} toggle={setStatus}/>
      )}
    </main>
  </div>;
}

function Overview({ configs, runtimes, totals, open, toggle }: { configs: BotConfig[]; runtimes: Record<BotId, BotRuntime>; totals: { balance: number; pnl: number; trades: number; winRate: number; drawdown: number }; open: (view: View) => void; toggle: (id: BotId, status: BotRuntime["status"]) => void }) {
  return <>
    <section className="metrics-grid"><Metric label="CAPITAL PAPER TOTAL" value={money(totals.balance)} note="4 carteiras simuladas"/><Metric label="P&L LÍQUIDO" value={`${totals.pnl >= 0 ? "+" : ""}${money(totals.pnl)}`} tone={totals.pnl >= 0 ? "good" : "bad"} note="Custos simulados incluídos"/><Metric label="WIN RATE" value={pct(totals.winRate)} note={`${totals.trades} operações fechadas`}/><Metric label="DRAWDOWN MÁX." value={pct(totals.drawdown)} tone={totals.drawdown > 3 ? "bad" : undefined} note="Maior entre os robôs"/></section>
    <div className="section-title"><div><h2>Estratégias Deriv</h2><p>Quatro bots na API direta da Deriv, com entradas de segundos a poucos minutos.</p></div><span><Wifi size={15}/>Feed público direto</span></div>
    <section className="bots-grid">{configs.map((config) => { const runtime = runtimes[config.id]; const trades = runtime.wins + runtime.losses; return <article className="bot-card" key={config.id} style={{ "--accent": botMeta[config.id].color } as React.CSSProperties}><div className="bot-top"><div className="bot-icon">{botMeta[config.id].number}</div><div><h3>{config.name}</h3><StatusPill runtime={runtime}/></div><button className="icon-button" onClick={() => open(config.id)} aria-label={`Abrir ${config.name}`}><ChevronRight size={18}/></button></div><p>{config.description}</p><Sparkline values={runtime.prices.map((tick) => tick.price)} positive={runtime.pnl >= 0}/><div className="mini-metrics"><div><span>P&L líquido</span><b className={runtime.pnl >= 0 ? "good" : "bad"}>{runtime.pnl >= 0 ? "+" : ""}{money(runtime.pnl)}</b></div><div><span>Win rate</span><b>{trades ? pct(runtime.wins / trades * 100) : "—"}</b></div><div><span>Risco/trade</span><b>{money(config.risk.riskPerTrade)}</b></div></div><div className="card-actions"><button className={runtime.status === "running" ? "stop" : "start"} onClick={() => toggle(config.id, runtime.status === "running" ? "stopped" : "running")}>{runtime.status === "running" ? <><Square size={14}/>Parar</> : <><Play size={14}/>Iniciar paper</>}</button><button onClick={() => open(config.id)}><Settings2 size={14}/>Configurar</button></div></article>; })}</section>
    <section className="guardrail-strip"><div><ShieldAlert/><b>Princípio central</b><span>Uma estratégia só opera se o sinal esperado superar spread, slippage e limites de risco.</span></div><div><span>PLATAFORMA</span><b>Deriv</b></div><div><span>REAL</span><b className="bad">TRAVADO</b></div></section>
  </>;
}

function BotDetail({ config, runtime, panel, setPanel, setStatus, save, update, runTest, backtest, testing, onBack }: { config: BotConfig; runtime: BotRuntime; panel: "orders" | "logs"; setPanel: (panel: "orders" | "logs") => void; setStatus: (id: BotId, status: BotRuntime["status"]) => void; save: () => void; update: (id: BotId, path: "risk" | "strategy", field: string, value: string | number) => void; runTest: (config: BotConfig) => void; backtest: BacktestResult | null; testing: boolean; onBack: () => void }) {
  const trades = runtime.wins + runtime.losses;
  const directFeed = runtime.prices.at(-1)?.source === "deriv-public";
  return <>
    <div className="detail-bar"><button className="back-link" onClick={onBack}><ArrowLeft size={15}/>Voltar</button><div className="connection"><Wifi size={17}/><div><b>{directFeed ? "Deriv API · feed direto" : "Deriv API · preparando feed"}</b><span>{directFeed ? "Ticks públicos reais; execução simulada" : "Fallback sintético até chegar o primeiro tick"}</span></div></div><StatusPill runtime={runtime}/><button className={runtime.status === "running" ? "stop main-action" : "start main-action"} onClick={() => setStatus(config.id, runtime.status === "running" ? "stopped" : "running")}>{runtime.status === "running" ? <><Square size={15}/>Parar bot</> : <><Play size={15}/>Iniciar paper</>}</button></div>
    <section className="metrics-grid detail"><Metric label="SALDO PAPER" value={money(runtime.balance)}/><Metric label="P&L LÍQUIDO" value={`${runtime.pnl >= 0 ? "+" : ""}${money(runtime.pnl)}`} tone={runtime.pnl >= 0 ? "good" : "bad"}/><Metric label="WIN RATE" value={trades ? pct(runtime.wins / trades * 100) : "—"}/><Metric label="DRAWDOWN" value={pct(runtime.drawdown)}/></section>
    <div className="detail-grid">
      <section className="chart-card"><div className="card-heading"><div><span>DERIV · {config.strategy.symbol}</span><h2>Feed de ticks paper</h2></div><b>{runtime.prices.at(-1)?.price.toFixed(5)}</b></div><Sparkline values={runtime.prices.map((price) => price.price)} positive={runtime.pnl >= 0}/><div className="chart-footer"><span><i className="green-dot"/>Últimos {runtime.prices.length} ticks</span><span>Saída alvo: {config.strategy.holdTicks} ticks</span></div><div className="hypothesis"><b>Regra do robô</b><span>{config.hypothesis}</span></div></section>
      <section className="config-card"><div className="card-heading"><div><span>CONTROLES</span><h2>Estratégia e risco</h2></div><Gauge size={20}/></div><div className="form-grid"><label>Ativo<input value={config.strategy.symbol} onChange={(event) => update(config.id, "strategy", "symbol", event.target.value)}/></label><label>Janela de ticks<input type="number" min="8" value={config.strategy.tickWindow} onChange={(event) => update(config.id, "strategy", "tickWindow", Number(event.target.value))}/></label><label>Limiar do sinal<input type="number" step="0.01" value={config.strategy.threshold} onChange={(event) => update(config.id, "strategy", "threshold", Number(event.target.value))}/></label><label>Duração máxima (ticks)<input type="number" min="1" value={config.strategy.holdTicks} onChange={(event) => update(config.id, "strategy", "holdTicks", Number(event.target.value))}/></label><label>Spread máximo (pips)<input type="number" step="0.1" value={config.strategy.maxSpreadPips} onChange={(event) => update(config.id, "strategy", "maxSpreadPips", Number(event.target.value))}/></label><label>Volatilidade mínima<input type="number" step="0.1" value={config.strategy.minimumVolatilityPips} onChange={(event) => update(config.id, "strategy", "minimumVolatilityPips", Number(event.target.value))}/></label><label>Stop loss (pips)<input type="number" step="0.1" value={config.strategy.stopLossPips} onChange={(event) => update(config.id, "strategy", "stopLossPips", Number(event.target.value))}/></label><label>Take profit (pips)<input type="number" step="0.1" value={config.strategy.takeProfitPips} onChange={(event) => update(config.id, "strategy", "takeProfitPips", Number(event.target.value))}/></label><label>Risco por operação ($)<input type="number" step="0.1" value={config.risk.riskPerTrade} onChange={(event) => update(config.id, "risk", "riskPerTrade", Number(event.target.value))}/></label><label>Risco máximo ($)<input type="number" step="0.1" value={config.risk.maxRiskPerTrade} onChange={(event) => update(config.id, "risk", "maxRiskPerTrade", Number(event.target.value))}/></label><label>Stop diário ($)<input type="number" value={config.risk.dailyStop} onChange={(event) => update(config.id, "risk", "dailyStop", Number(event.target.value))}/></label><label>Drawdown máx. (%)<input type="number" step="0.1" value={config.risk.maxDrawdown} onChange={(event) => update(config.id, "risk", "maxDrawdown", Number(event.target.value))}/></label><label>Máx. simultâneas<input type="number" min="1" value={config.risk.maxConcurrent} onChange={(event) => update(config.id, "risk", "maxConcurrent", Number(event.target.value))}/></label><label>Cooldown (s)<input type="number" value={config.risk.cooldownSeconds} onChange={(event) => update(config.id, "risk", "cooldownSeconds", Number(event.target.value))}/></label></div><div className="execution-note"><b>Stake PAPER: {money(positionSize(config, runtime.balance))}</b><span>Na integração autenticada, o contrato será consultado por proposal antes da compra para confirmar valor mínimo, payout e disponibilidade.</span></div><div className="config-actions"><button onClick={save}><Save size={14}/>Salvar neste dispositivo</button><button className="outline" onClick={() => runTest(config)} disabled={testing}><Activity size={14}/>{testing ? "Simulando…" : "Executar backtest"}</button></div>{backtest && <div className="backtest"><b>Backtest com custos concluído</b><span>{backtest.trades} trades · {pct(backtest.winRate)} acerto · <i className={backtest.pnl >= 0 ? "good" : "bad"}>{money(backtest.pnl)}</i> líquido · custos {money(backtest.costs)} · DD {pct(backtest.maxDrawdown)}</span></div>}</section>
    </div>
    <OrderPanel runtime={runtime} panel={panel} setPanel={setPanel}/>
  </>;
}

function OrderPanel({ runtime, panel, setPanel }: { runtime: BotRuntime; panel: "orders" | "logs"; setPanel: (panel: "orders" | "logs") => void }) {
  return <section className="table-card"><div className="tabs"><button className={panel === "orders" ? "active" : ""} onClick={() => setPanel("orders")}><History size={15}/>Ordens <span>{runtime.orders.length}</span></button><button className={panel === "logs" ? "active" : ""} onClick={() => setPanel("logs")}><Terminal size={15}/>Logs</button></div>{panel === "orders" ? <div className="table-wrap"><table><thead><tr><th>Horário</th><th>Ativo</th><th>Lado</th><th>Tamanho</th><th>Entrada</th><th>Saída</th><th>Custos</th><th>Resultado</th><th>Modo</th></tr></thead><tbody>{runtime.orders.length ? runtime.orders.map((order) => <tr key={order.id}><td>{new Date(order.closedAt).toLocaleTimeString("pt-BR")}</td><td>{order.symbol}</td><td><span className={`side ${order.side}`}>{order.side.toUpperCase()}</span></td><td>{order.size.toFixed(3)}</td><td>{order.entry.toFixed(5)}</td><td>{order.exit.toFixed(5)}</td><td>{money(order.costs)}</td><td className={order.pnl >= 0 ? "good" : "bad"}>{order.pnl >= 0 ? "+" : ""}{money(order.pnl)}</td><td><span className="paper-tag">PAPER</span></td></tr>) : <tr><td colSpan={9} className="empty"><CircleDollarSign/>Nenhuma ordem. Inicie o robô para testar.</td></tr>}</tbody></table></div> : <div className="logs">{runtime.logs.map((log, index) => <p key={`${log}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span>{log}</p>)}</div>}</section>;
}

function Connection({ readiness, accounts, mode, requestMode }: { readiness: ConnectionReadiness; accounts: Array<{ type: string; currency: string; balance: number; status: string }>; mode: TradingMode; requestMode: (mode: TradingMode) => void }) {
  const steps = [
    ["Feed público direto", readiness.publicFeed, "Cotações Deriv disponíveis sem token; execução permanece PAPER."],
    ["OAuth ou PAT configurado", readiness.oauth, "Token somente no servidor; depois é emitido um WebSocket OTP."],
    ["Validação em demo concluída", readiness.demoValidated, "Proposal, compra, reconciliação e emergência precisam passar."],
    ["Modo real desbloqueado", readiness.liveUnlocked, "Exige uma ação separada e explícita depois dos testes em demo."]
  ] as const;
  return <div className="connection-layout"><section className="connection-hero"><div className="connection-symbol"><Wifi size={28}/></div><div><span>PLATAFORMA ÚNICA</span><h2>Deriv API direta</h2><p>Os quatro robôs recebem ticks públicos diretamente da Deriv. DEMO e REAL usam PAT protegido, OTP e WebSockets separados.</p></div><div className="submitted ready-badge">{readiness.oauth ? "AUTENTICADO" : "FEED ATIVO"}</div></section><section className="mode-card"><div className="card-heading"><div><span>AMBIENTE DE EXECUÇÃO</span><h2>Escolha onde operar</h2></div><ShieldAlert/></div><div className="mode-options">{(["paper", "demo", "live"] as TradingMode[]).map((item) => <button key={item} className={mode === item ? "selected" : ""} onClick={() => requestMode(item)}><span>{item !== "paper" && <LockKeyhole size={13}/>} {modeLabels[item]}</span><small>{item === "paper" ? "Ticks públicos reais, execução simulada." : item === "demo" ? "Dinheiro virtual, sessão autenticada por OTP." : "Dinheiro real; exige frase de confirmação a cada sessão."}</small></button>)}</div>{accounts.length > 0 && <div className="execution-note"><b>Contas disponíveis</b><span>{accounts.map((account) => `${account.type.toUpperCase()} · ${money(account.balance)} ${account.currency}`).join("  |  ")}</span></div>}</section><section className="readiness-card"><div className="card-heading"><div><span>TRAVAS DE SEGURANÇA</span><h2>Caminho até o modo real</h2></div><LockKeyhole/></div><div className="steps">{steps.map(([label, ready, note], index) => <div className={ready ? "ready" : "pending"} key={label}><span>{ready ? <Check size={15}/> : index + 1}</span><div><b>{label}</b><small>{note}</small></div></div>)}</div></section><section className="security-copy"><ShieldAlert/><div><b>Autenticação isolada da interface</b><p>O token nunca fica no navegador. Cada sessão recebe um endereço WebSocket de uso único por OTP; toda compra passa por proposal e pelo limite de risco configurado.</p></div></section></div>;
}

function Research({ configs }: { configs: BotConfig[] }) {
  const lab = [
    ["Microflow Momentum", "+US$ 12,35", "76,66%", "62,5", "20/20"],
    ["Range Scout", "+US$ 0,57", "59,87%", "30,1", "14/20"],
    ["Squeeze Breakout", "+US$ 2,51", "84,97%", "7,7", "20/20"],
    ["Trend Pullback", "+US$ 0,11", "74,07%", "1,4", "15/20"]
  ];
  const evidence = [
    { title: "Custos primeiro", text: "Microtrades têm alvo pequeno; spread, comissão e slippage podem consumir toda a vantagem. O simulador desconta custos antes de mostrar P&L.", href: "https://arxiv.org/abs/1411.5062", source: "Leung & Li — mean reversion com custos e stop" },
    { title: "Horizonte realmente curto", text: "Evidência de momentum e reversão pode aparecer em horizontes intradiários, mas depende do dado, do regime e da execução. Não é garantia de lucro.", href: "https://fraser.stlouisfed.org/docs/publications/frbsl_wp/1999-016.pdf", source: "Federal Reserve Bank of St. Louis" },
    { title: "Ticks públicos diretos", text: "A Deriv oferece um WebSocket público para símbolos, histórico e ticks sem autenticação. É a fonte atual do PAPER; as compras continuam simuladas.", href: "https://developers.deriv.com/docs/options/ws-public/", source: "Deriv API — Public WebSocket" },
    { title: "Demo e real separados", text: "A API emite por OTP um WebSocket autenticado específico para a conta demo ou real. O painel preserva essa separação como trava técnica.", href: "https://developers.deriv.com/docs/options/websocket/", source: "Deriv API — OTP WebSocket" }
  ];
  return <div className="research-layout"><section className="research-intro"><FlaskConical/><div><h2>Quatro hipóteses, nenhuma promessa</h2><p>As configurações são pontos de partida para paper trading e teste fora da amostra. “Garimpar centavos” só faz sentido quando o ganho esperado permanece positivo depois de todos os custos.</p></div></section><section className="strategy-matrix"><div className="matrix-row matrix-head"><span>Estratégia</span><span>Regime procurado</span><span>Entrada</span><span>Saída rápida</span></div>{configs.map((config) => <div className="matrix-row" key={config.id}><b style={{ color: botMeta[config.id].color }}>{config.name}</b><span>{config.strategy.kind === "momentum" ? "Tendência limpa" : config.strategy.kind === "mean-reversion" ? "Faixa lateral" : config.strategy.kind === "breakout" ? "Compressão → expansão" : "Tendência + retração"}</span><span>{config.hypothesis}</span><span>{config.strategy.holdTicks} ticks · SL {config.strategy.stopLossPips} · TP {config.strategy.takeProfitPips} pips</span></div>)}</section><section className="lab-card"><div className="card-heading"><div><span>20 AMOSTRAS × 1.200 TICKS</span><h2>Laboratório sintético com custos</h2></div><FlaskConical size={20}/></div><div className="table-wrap"><table><thead><tr><th>Estratégia</th><th>P&L médio</th><th>Win rate</th><th>Trades/amostra</th><th>Amostras positivas</th></tr></thead><tbody>{lab.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td className={index === 1 ? "good" : ""} key={cell}>{cell}</td>)}</tr>)}</tbody></table></div><p>São cenários artificiais compatíveis com cada hipótese, não dados reais nem previsão. Spread, slippage e custo fixo foram descontados.</p></section><section className="evidence-grid">{evidence.map((item) => <a href={item.href} target="_blank" rel="noreferrer" key={item.title}><span>FONTE</span><h3>{item.title}</h3><p>{item.text}</p><b>{item.source}<ChevronRight size={14}/></b></a>)}</section><section className="risk-warning"><TriangleAlert/><p><b>Risco elevado.</b> Forex alavancado e CFDs podem gerar perdas rápidas. Resultados de simulação, inclusive positivos, não predizem desempenho real. Comece com demo e use apenas capital que possa perder.</p></section></div>;
}
