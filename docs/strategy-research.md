# Estratégias rápidas para cTrader

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

Esse desenho evita usar apenas “tocou a máxima”, o que tende a reagir a ruído. Ainda assim, rompimentos são vulneráveis a falsos sinais e slippage. No modo integrado, ordens de mercado podem sofrer execução diferente do preço observado; a própria documentação do cTrader destaca liquidez, latência e preenchimento parcial como riscos de execução.

## 4. Trend Pullback

O Trend Pullback compara médias exponenciais rápidas e lentas, mede a eficiência da trajetória e exige pelo menos dois movimentos contrários à tendência antes de um novo tick retomar a direção principal. O objetivo é evitar entrar no ponto mais esticado do movimento.

O filtro não transforma uma retração em vantagem garantida. Ele apenas formaliza uma condição reproduzível para paper trading. Quando o mercado perde eficiência, o sinal desaparece.

## Arquitetura cTrader

O cTrader Open API permite receber dados em tempo real, enviar operações e consultar ordens, posições e deals. A documentação recomenda conta demo para desenvolvimento. Ticks históricos são limitados a intervalos de até uma semana por solicitação; bid e ask são campos opcionais em eventos spot, e trendbars ao vivo exigem primeiro uma assinatura de spots. Esses detalhes influenciam a reconciliação e os filtros do executor.

O volume mínimo e o incremento dependem do símbolo e do broker. O executor deverá consultar `minVolume`, `maxVolume` e `stepVolume` em vez de assumir que uma posição “de centavos” está disponível. O painel trabalha com orçamento de risco em dólares; a conversão para volume válido acontecerá no servidor após a aprovação.

## Resultado do laboratório sintético

Cada estratégia foi executada em 20 amostras independentes de 1.200 ticks do regime artificial para o qual foi desenhada. O cálculo descontou spread variável, slippage e custo fixo. O Microflow teve P&L médio de US$ 12,35 e 76,66% de acerto; Range Scout, US$ 0,57 e 59,87%; Squeeze Breakout, US$ 2,51 e 84,97%; Trend Pullback, US$ 0,11 e 74,07%. A quarta estratégia foi reconstruída depois de a primeira configuração apresentar resultado médio negativo.

Esses números medem coerência do algoritmo sob cenários controlados. Eles não são evidência de rentabilidade em dados reais, não incluem as condições específicas do broker e não devem orientar liberação do modo real.

## Critérios antes do modo real

- aprovação do aplicativo;
- OAuth concluído sem expor Client Secret;
- autenticação de aplicativo e conta demo;
- consulta de propriedades do símbolo e margem esperada;
- reconciliação de ordens, posições e deals;
- tratamento de rejeição, fill parcial, desconexão e heartbeat;
- stop loss e take profit validados no servidor;
- parada de emergência validada com posições abertas;
- amostra demo prolongada com resultados líquidos, não brutos;
- desbloqueio real explícito e independente.

## Fontes

1. Spotware. [cTrader Open API — Getting started](https://help.ctrader.com/open-api/). Acesso em setembro de 2026.
2. Spotware. [App and account authentication](https://help.ctrader.com/open-api/account-authentication/). Acesso em setembro de 2026.
3. Spotware. [Attain symbol data](https://help.ctrader.com/open-api/symbol-data/). Acesso em setembro de 2026.
4. Spotware. [Orders](https://help.ctrader.com/trading-with-ctrader/orders/). Acesso em setembro de 2026.
5. Tim Leung e Xin Li. [Optimal Mean Reversion Trading with Transaction Costs and Stop-Loss Exit](https://arxiv.org/abs/1411.5062). 2015.
6. Christopher J. Neely e Paul A. Weller. [Intraday Technical Trading in the Foreign Exchange Market](https://fraser.stlouisfed.org/docs/publications/frbsl_wp/1999-016.pdf). Federal Reserve Bank of St. Louis.
7. Financial Conduct Authority. [Contract for differences](https://www.fca.org.uk/firms/contract-for-differences). Atualizado em junho de 2025.
