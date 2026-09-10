# CashFacttory · cTrader Strategy Lab

Painel com quatro robôs independentes, todos preparados para o **cTrader Open API**. O modo executável atual é PAPER local. Demo e real aparecem no fluxo, mas permanecem tecnicamente bloqueados enquanto a aplicação estiver aguardando aprovação e até a integração OAuth passar pelos testes de segurança.

## Quatro estratégias

1. **Microflow Momentum** — configuração do antigo cTrader Microflow preservada: EURUSD, janela de 16 ticks, limiar 0,66 e saída em 5 ticks.
2. **Range Scout** — retorno à média por z-score, somente com baixa eficiência direcional e spread aceitável.
3. **Squeeze Breakout** — rompimento de faixa depois de compressão e expansão mensurável da volatilidade.
4. **Trend Pullback** — retomada de tendência curta depois de uma retração confirmada.

Todos os robôs incluem spread máximo, volatilidade mínima, stop loss, take profit, limite de risco por operação, stop diário, drawdown máximo, cooldown e limite de simultaneidade. O backtest desconta spread, slippage e custo fixo simulado.

## Segurança de execução

- PAPER local é o padrão e não requer credenciais.
- Demo exige aplicativo aprovado, OAuth e conta demo do próprio usuário.
- Real exige, além disso, validação completa em demo e desbloqueio explícito separado.
- Client Secret e tokens não entram no navegador, no GitHub, em logs ou em variáveis `NEXT_PUBLIC_*`.
- Os quatro robôs usam uma única fronteira de integração em `src/lib/adapters/`.
- A parada de emergência interrompe todos os loops locais imediatamente.

O painel não finge conexão externa: enquanto o executor seguro não estiver configurado, os botões cTrader Demo e cTrader Real apenas mostram as etapas pendentes.

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

## Integração cTrader depois da aprovação

1. Autorizar a conta demo pelo fluxo OAuth 2.0 oficial.
2. Trocar o código de autorização, que expira rapidamente, por access/refresh tokens no servidor.
3. Autenticar a aplicação e a conta no endpoint demo.
4. Consultar o símbolo no broker para respeitar `minVolume`, `maxVolume`, `stepVolume`, comissão e horários.
5. Validar feed bid/ask, ordens, fills parciais, reconciliação, SL/TP, heartbeat e parada de emergência.
6. Executar testes prolongados em demo. O modo real só é liberado por uma ação explícita posterior.

Documentação oficial:

- [cTrader Open API](https://help.ctrader.com/open-api/)
- [Autenticação de aplicativo e conta](https://help.ctrader.com/open-api/account-authentication/)
- [Dados de símbolos, ticks, bid/ask e trendbars](https://help.ctrader.com/open-api/symbol-data/)
- [Proxies e endpoints demo/live](https://help.ctrader.com/open-api/proxies-endpoints/)

## Limitação importante

O objetivo de obter resultados pequenos e rápidos aumenta a sensibilidade a spread, slippage, comissão e latência. Nenhum resultado simulado representa promessa ou previsão de rentabilidade. Forex alavancado e CFDs são produtos de alto risco.

Veja a análise completa em [`docs/strategy-research.md`](docs/strategy-research.md).
