# CashFacttory

Painel multi-plataforma para experimentar estratégias de micronegociação com **PAPER MODE obrigatório por padrão**. O projeto não cria contas, não aceita termos por você e não envia ordens com dinheiro real.

## O que está pronto

- Dashboard geral e áreas independentes para Deriv, Capital.com, cTrader e OANDA.
- Simulação contínua no navegador com saldo, P&L, win rate, drawdown, ordens, logs e gráfico de ticks.
- Estratégia Deriv de par/ímpar baseada no último dígito, com filtro conservador que evita operar sem viés estatístico forte.
- Equivalentes tecnicamente honestos para os outros mercados:
  - Capital.com: reversão curta após desequilíbrio direcional.
  - cTrader: momentum de microestrutura confirmado por ticks.
  - OANDA: retorno à média após deslocamento curto normalizado.
- Motor de risco compartilhado: stop diário, drawdown máximo, cooldown, stake e limite de operações simultâneas.
- Parada de emergência para todos os robôs.
- Backtest determinístico sobre ticks sintéticos e configurações persistidas em `localStorage`.
- Adapters separados com fronteira pronta para integrações demo oficiais.

## Executar

Requer Node.js 20.9 ou superior.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

Validação completa:

```bash
npm test
npm run build
```

## Arquitetura

```text
app/                 interface exportável como site estático
src/
  components/        dashboard e visualizações
  lib/adapters/      contrato comum + adapters paper por plataforma
  lib/strategy.ts    gerador de sinais por mercado
  lib/risk.ts        guardrails anteriores a cada ordem
  lib/backtest.ts    simulador determinístico
tests/               estratégia, risco, adapters e backtest
```

## Integrações demo oficiais

Copie `.env.example` para `.env.local` somente quando você próprio tiver criado as credenciais. Tokens devem existir apenas no servidor; nunca use variáveis `NEXT_PUBLIC_*` para segredos.

### Deriv

Use uma conta virtual e um App ID. A API WebSocket oficial expõe ticks, propostas e compra de contratos. A paridade `DIGITEVEN`/`DIGITODD` é um produto real da Deriv, portanto a estratégia mantém esse significado no adapter dedicado.

- [Documentação da API Deriv](https://developers.deriv.com/)
- Endpoint preparado: `wss://ws.derivws.com/websockets/v3`

### Capital.com

Crie uma API key dentro de uma conta demo já pertencente a você. A sessão usa credenciais e retorna tokens `CST`/`X-SECURITY-TOKEN`; preços em streaming usam o canal documentado pela plataforma.

- [Capital.com Open API](https://open-api.capital.com/)
- Endpoint preparado: `https://demo-api-capital.backend-capital.com`

### cTrader

O Open API exige um cTrader ID, registro/aprovação de aplicativo e OAuth 2.0. Demo e live usam endpoints separados. O projeto aponta apenas ao endpoint demo JSON/WebSocket.

- [cTrader Open API](https://help.ctrader.com/open-api/)
- Endpoint preparado: `wss://demo.ctraderapi.com:5036`

### OANDA

Use uma conta v20 de prática e gere um personal access token no perfil. O token funciona como senha e nunca deve ser versionado.

- [OANDA v20 API](https://developer.oanda.com/rest-live-v20/introduction/)
- Endpoint preparado: `https://api-fxpractice.oanda.com`

## Política de segurança

1. `TRADING_MODE=paper` é o único modo implementado.
2. Não há endpoint live nem caminho de UI para habilitá-lo.
3. Credenciais não são necessárias para executar todos os recursos atuais.
4. Cada ordem passa pelo motor de risco antes da simulação.
5. A parada de emergência interrompe todos os loops de execução.

Resultados simulados e backtests não representam performance futura. CFDs, forex e derivativos alavancados envolvem risco elevado.

## Validação de estratégia

O laboratório automatizado executa 20 amostras independentes de 1.200 ticks por regime e desconta custo simulado de execução. Os filtros atuais foram reconstruídos após a primeira rodada revelar perdas fora do regime adequado.

| Robô | Regime compatível | P&L médio por amostra | Win rate agregado | Trades médios |
| --- | --- | ---: | ---: | ---: |
| Deriv | Dígitos aleatórios | -$0,13 | 40,00% | 0,3 |
| Capital | Retorno à média | +$46,64 | 57,57% | 33,4 |
| cTrader | Tendência | +$112,17 | 77,13% | 25,8 |
| OANDA | Retorno à média | +$40,86 | 58,03% | 37,6 |

A Deriv fica praticamente sem operar quando os dígitos são aleatórios: isso é intencional, pois o filtro não presume uma vantagem inexistente. Em regimes incompatíveis, Capital e os filtros revisados tiveram baixa atividade; cTrader e OANDA ainda podem registrar pequenas perdas residuais, portanto continuam exclusivamente em paper trading.
