# ATP Challenge — Simulador de Análise de Disponibilidade

Micro-learning gamificado para treinamento da equipe operacional da **Kluber Lubrification** no fluxo de **análise de ATP (Available to Promise)** do sistema **TOTVS Call Center**.

## Estrutura

```
atp-simulator/
├── index.html          # Estrutura da interface (telas, painéis, modais)
├── css/
│   └── style.css       # Visual (tema escuro, grades TOTVS, cards, feedback)
└── js/
    └── game.js         # Motor: geração procedural, cálculo, fila, validação
```

## Publicar no GitHub Pages

1. Crie um repositório (ex.: `atp-simulator`) e faça upload dos arquivos.
2. No GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
3. Acesse `https://<usuario>.github.io/atp-simulator/`.

Nenhum build ou dependência: HTML + CSS + JS puro.

## Mecânicas implementadas

| Regra de negócio | Implementação |
|---|---|
| Estoque físico A = A1 (Rudlog) + A2 (Kluber) | `generateScene()` |
| Acomodação B — 2 dias úteis p/ virar física | modal `#modal-accom`, `addBusinessDays()` |
| E-mail p/ Julio Cesar (vendedor + Vivian em CC) | botão "Enviar e-mail" no modal de acomodação |
| Empenhos C = C1 + C2 descontados | `calcAvailable()` → **A + B − C** |
| Pegadinha do Saldo Líquido (A+B) | coluna destacada em âmbar; −25 pts se usada |
| Fila de prioridade (cima → baixo) | aba "Entradas e Saídas", saldo deduzido linha a linha |
| Antecipação de saldo de pedidos acima | "Registrar Pedidos Impactados" (−12 pts se errar) |
| Árvore de decisões (4 condutas) | etapa 3, validada contra `scene.conduta` |
| Autorização p/ faturamento parcial | mini-game de e-mail (pedido, qtd., saldo restante) |
| Liberação KL = sem OS automática | feedback explícito na etapa de liberação |
| Liberação Externo = gera OS | idem |
| Proibido dividir KL + Externo no mesmo pedido | botão "Liberar metade em cada" bloqueado com erro |
| Registro final obrigatório (Boss) | formulário Mad Libs validando VKE, quantidades por armazém, empenhos, fila, data e ação |

## Fluxo de uma missão

1. **Verificação Inicial** — confirmar produto, VKE, quantidade, pedido e OF (distratores inclusos).
2. **Cálculo** — inserir `A+B−C` e a disponibilidade real na fila; registrar pedidos impactados.
3. **Árvore de Decisões** — total / parcial / entrada prevista / escalonar.
4. **Liberação** — escolher armazém validando localização física (A1/A2).
5. **Registro (Boss)** — preencher o modelo de rastreabilidade com todas as lacunas corretas.

Cada turno tem 5 missões; pontuação e qualidade são acumuladas e o jogador recebe uma classificação final (Sênior / Pleno / Júnior / Re-treinamento).
