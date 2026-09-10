# Estratégias rápidas na API direta da Deriv

## Conclusão executiva

As quatro estratégias devem ser tratadas como hipóteses testáveis, não como fontes comprovadas de lucro. Em operações com duração de segundos ou minutos, custos de execução deixam de ser um detalhe e passam a ser o principal filtro econômico. Por isso, o painel exige spread máximo, inclui slippage e custo fixo no backtest, mantém risco nominal pequeno e interrompe a execução após stop diário ou drawdown.

O desenho usa quatro regimes diferentes para reduzir a dependência de uma única hipótese: continuação direcional, reversão em faixa, rompimento após compressão e retomada após retração. Não há martingale, aumento de posição depois de perda, média contra uma tendência ou promessa de taxa de acerto.

## 1. Microflow Momentum

A configuração já existente foi preservada: EURUSD, janela de 16 ticks, limiar direcional de 0,66 e saída em 5 ticks. O sinal só aparece quando a proporção de movimentos na mesma direção supera o limiar e a eficiência de trajetória é alta. Eficiência mede deslocamento líquido dividido pelo caminho total; assim, sequências que sobem e descem muito, mas terminam pouco distantes do início, são rejeitadas.

O racional é continuação de curto prazo, mas a evidência intradiária não é universal nem constante. Estudos de negociação técnica em câmbio encontram alternância entre momentum e reversão em horizontes curtos, com forte dependência da construção dos dados e do horário. A consequência prática é operar pouco e recusar sinais quando a trajetória está ruidosa.

## 2. Range Scout

O Range Scout calcula a média e o desvio-padrão da janela. Uma entrada contrária ao deslocamento só é considerada quando o último preço está pelo menos 1,55 desvio-padrão distante da média, a eficiência direcional é baixa e a autocorrelação não indica persistência positiva.

A pesquisa de timing ótimo em processos de reversão à média mostra que custos e stop loss mudam os limiares de entrada e saída: quanto maior o custo, maior precisa ser a oportunidade antes da entrada. Isso justifica o z-score mínimo, o filtro de spread e um stop separado. O modelo acadêmico não prova que EURUSD reverte em cada janela; ele orienta a disciplina de só entrar quando a distância estimada supera custos e risco.

## 3. Squeeze Breakout

O robô divide a janela em base e gatilho. Ele procura uma fase inicial de menor variabilidade, seguida por expansão da volatilidade, predominância direcional e preço além do máximo ou mínimo da base. A entrada acompanha o rompimento; a saída usa horizonte curto, stop e take profit.

Esse desenho evita usar apenas “tocou a máxima”, o que tende a reagir a ruído. Ainda assim, rompimentos são vulneráveis a falsos sinais e slippage. No modo integrado, a compra usa uma proposta de contrato e pode ocorrer em condições diferentes do tick que gerou o sinal; por isso, proposta, preço máximo e disponibilidade precisam ser reconfirmados imediatamente antes da compra.

## 4. Trend Pullback

O Trend Pullback compara médias exponenciais rápidas e lentas, mede a eficiência da trajetória e exige pelo menos dois movimentos contrários à tendência antes de um novo tick retomar a direção principal. O objetivo é evitar entrar no ponto mais esticado do movimento.

O filtro não transforma uma retração em vantagem garantida. Ele apenas formaliza uma condição reproduzível para paper trading. Quando o mercado perde eficiência, o sinal desaparece.

## Arquitetura Deriv direta

O WebSocket público da Deriv permite consultar símbolos, contratos, ticks e histórico sem autenticação. O PAPER usa esse canal apenas como fonte de preços. A execução DEMO ou REAL exige uma conta de opções, token OAuth/PAT e um URL WebSocket autenticado por OTP; o próprio URL retornado determina se o ambiente é demo ou real.

O stake mínimo, os contratos disponíveis e o payout dependem do símbolo e da conta. O executor deverá consultar `contracts_for` e obter uma `proposal` válida em vez de assumir que uma operação “de centavos” está disponível. Tokens e URLs OTP não entram no navegador nem nos logs.

## Resultado do laboratório sintético

Cada estratégia foi executada em 20 amostras independentes de 1.200 ticks do regime artificial para o qual foi desenhada. O cálculo descontou spread variável, slippage e custo fixo. O Microflow teve P&L médio de US$ 12,35 e 76,66% de acerto; Range Scout, US$ 0,57 e 59,87%; Squeeze Breakout, US$ 2,51 e 84,97%; Trend Pullback, US$ 0,11 e 74,07%. A quarta estratégia foi reconstruída depois de a primeira configuração apresentar resultado médio negativo.

Esses números medem coerência do algoritmo sob cenários controlados. Eles não são evidência de rentabilidade em dados reais, não incluem as condições específicas do broker e não devem orientar liberação do modo real.

## Critérios antes do modo real

- OAuth ou PAT com escopo mínimo, armazenado apenas no servidor;
- conta demo de opções identificada;
- URL WebSocket demo emitido por OTP e usado dentro do prazo;
- consulta de `contracts_for` e `proposal` antes da compra;
- reconciliação da compra e do contrato aberto;
- tratamento de rejeição, fill parcial, desconexão e heartbeat;
- stop loss e take profit validados no servidor;
- parada de emergência validada com posições abertas;
- amostra demo prolongada com resultados líquidos, não brutos;
- desbloqueio real explícito e independente.

## Fontes

1. Deriv. [API overview](https://developers.deriv.com/docs/intro/api-overview/). Acesso em setembro de 2026.
2. Deriv. [Authentication](https://developers.deriv.com/docs/intro/authentication/). Acesso em setembro de 2026.
3. Deriv. [Public WebSocket](https://developers.deriv.com/docs/options/ws-public/). Acesso em setembro de 2026.
4. Deriv. [Authenticated WebSocket via OTP](https://developers.deriv.com/docs/options/websocket/). Acesso em setembro de 2026.
5. Tim Leung e Xin Li. [Optimal Mean Reversion Trading with Transaction Costs and Stop-Loss Exit](https://arxiv.org/abs/1411.5062). 2015.
6. Christopher J. Neely e Paul A. Weller. [Intraday Technical Trading in the Foreign Exchange Market](https://fraser.stlouisfed.org/docs/publications/frbsl_wp/1999-016.pdf). Federal Reserve Bank of St. Louis.
7. Financial Conduct Authority. [Contract for differences](https://www.fca.org.uk/firms/contract-for-differences). Atualizado em junho de 2025.
