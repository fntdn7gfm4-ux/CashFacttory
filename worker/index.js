const API_BASE = "https://api.derivws.com";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  },
});

function headers(env) {
  return {
    Authorization: `Bearer ${env.DERIV_ACCESS_TOKEN}`,
    "Deriv-App-ID": env.DERIV_APP_ID,
    Accept: "application/json",
  };
}

async function accounts(env) {
  if (!env.DERIV_ACCESS_TOKEN || !env.DERIV_APP_ID) {
    throw new Error("Credencial Deriv não configurada no servidor");
  }
  const response = await fetch(`${API_BASE}/trading/v1/options/accounts`, { headers: headers(env) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.errors?.[0]?.message || `Deriv respondeu ${response.status}`);
  const rows = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
  return rows;
}

function safeAccount(account) {
  return {
    type: account.account_type,
    currency: account.currency,
    balance: Number(account.balance || 0),
    status: account.status,
  };
}

async function status(env) {
  try {
    const rows = await accounts(env);
    return json({
      authenticated: true,
      demoValidated: env.DERIV_DEMO_VALIDATED === "true",
      liveUnlocked: env.DERIV_LIVE_UNLOCKED === "true",
      accounts: rows.map(safeAccount),
    });
  } catch (error) {
    return json({ authenticated: false, demoValidated: false, liveUnlocked: false, accounts: [], error: error.message }, 502);
  }
}

async function session(request, env) {
  const body = await request.json().catch(() => ({}));
  const mode = body.mode;
  if (mode !== "demo" && mode !== "live") return json({ error: "Modo inválido" }, 400);
  if (mode === "live") {
    if (env.DERIV_DEMO_VALIDATED !== "true" || env.DERIV_LIVE_UNLOCKED !== "true") {
      return json({ error: "Modo real bloqueado até a validação em demo e liberação do servidor" }, 423);
    }
    if (body.confirmation !== "ATIVAR REAL") return json({ error: "Confirmação explícita obrigatória" }, 409);
  }

  try {
    const rows = await accounts(env);
    const targetType = mode === "live" ? "real" : "demo";
    const account = rows.find((row) => String(row.account_type).toLowerCase() === targetType);
    if (!account) return json({ error: `Conta ${mode} não encontrada` }, 404);
    const response = await fetch(`${API_BASE}/trading/v1/options/accounts/${encodeURIComponent(account.account_id)}/otp`, {
      method: "POST",
      headers: headers(env),
    });
    const payload = await response.json();
    if (!response.ok || !payload?.data?.url) {
      return json({ error: payload?.errors?.[0]?.message || "A Deriv não emitiu a sessão" }, response.status || 502);
    }
    const expected = mode === "demo" ? "/ws/demo?otp=" : "/ws/real?otp=";
    if (!String(payload.data.url).includes(expected)) return json({ error: "Ambiente retornado pela Deriv não corresponde ao solicitado" }, 502);
    return json({ mode, url: payload.data.url, account: safeAccount(account), expiresInSeconds: 120 });
  } catch (error) {
    return json({ error: error.message }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/deriv/status" && request.method === "GET") return status(env);
    if (url.pathname === "/api/deriv/session" && request.method === "POST") return session(request, env);
    return env.ASSETS.fetch(request);
  },
};
