# CashFacttory · Deriv Strategy Lab

Painel com quatro robôs independentes para uma única plataforma: **Deriv**. Enquanto a integração cTrader aguarda aprovação, o aplicativo usa diretamente a **Deriv Options API**. O PAPER recebe ticks públicos reais da Deriv e simula a execução localmente. DEMO e REAL permanecem separados e bloqueados até autenticação e validação.

## Quatro estratégias

1. **Microflow Momentum** — configuração preservada no símbolo Deriv `frxEURUSD`: janela de 16 ticks, limiar 0,66 e saída em 5 ticks.
2. **Range Scout** — retorno à média por z-score, somente com baixa eficiência direcional e spread aceitável.
3. **Squeeze Breakout** — rompimento de faixa depois de compressão e expansão mensurável da volatilidade.
4. **Trend Pullback** — retomada de tendência curta depois de uma retração confirmada.

Todos os robôs incluem spread máximo, volatilidade mínima, stop loss, take profit, limite de risco por operação, stop diário, drawdown máximo, cooldown e limite de simultaneidade. O backtest desconta spread, slippage e custo fixo simulado.

O PAPER usa o risco por operação como stake simulado. No modo autenticado, o executor sempre solicita uma `proposal` antes da compra para confirmar stake mínimo, preço, payout, tipo de contrato e disponibilidade na conta escolhida.

## Segurança de execução

- PAPER é o padrão: usa `wss://api.derivws.com/trading/v1/options/ws/public` e não requer credenciais.
- DEMO exige OAuth ou PAT com escopo `trade`, conta demo e URL WebSocket de uso único emitido pelo endpoint OTP.
- REAL usa outro WebSocket OTP, exige validação completa em demo e desbloqueio explícito separado.
- Client Secret e tokens não entram no navegador, no GitHub, em logs ou em variáveis `NEXT_PUBLIC_*`.
- Os quatro robôs usam uma única fronteira de integração em `src/lib/adapters/`.
- A parada de emergência interrompe todos os loops locais imediatamente.

O painel não finge conexão externa: login em um site da Deriv não entrega automaticamente um token à aplicação. Enquanto o executor protegido não tiver OAuth/PAT e OTP válidos, DEMO e REAL apenas mostram as etapas pendentes.

## Executar

Requer Node.js 20.9 ou superior.

```bash
npm install
npm run dev
```

Validação:

```bash
npm test
npm run build
```

## Integração direta Deriv

1. O PAPER conecta diretamente ao WebSocket público e assina ticks de `frxEURUSD`.
2. Para DEMO, autorizar apenas o escopo necessário (`trade`) por OAuth 2.0 com PKCE ou configurar um PAT no servidor.
3. Listar as contas de opções e solicitar ao endpoint OTP o URL WebSocket da conta demo.
4. Consultar `contracts_for` e `proposal` antes de cada compra.
5. Validar compra, acompanhamento do contrato, reconciliação, desconexão e parada de emergência na demo.
6. Solicitar outro OTP para a conta real somente depois da validação e de um desbloqueio explícito.

Documentação oficial:

- [Visão geral da Deriv API](https://developers.deriv.com/docs/intro/api-overview/)
- [Autenticação OAuth/PAT](https://developers.deriv.com/docs/intro/authentication/)
- [WebSocket público](https://developers.deriv.com/docs/options/ws-public/)
- [WebSocket autenticado por OTP](https://developers.deriv.com/docs/options/websocket/)

## Limitação importante

O objetivo de obter resultados pequenos e rápidos aumenta a sensibilidade a preço do contrato, payout, slippage e latência. Nenhum resultado simulado representa promessa ou previsão de rentabilidade. Opções e produtos alavancados podem gerar perdas rápidas.

Veja a análise completa em [`docs/strategy-research.md`](docs/strategy-research.md).
