

## Botão "Replay" inline na lista de execuções

A boa notícia: o `ReplayDialog` já existe e implementa **tudo** que foi pedido — play/pause, step anterior/próximo, slider de progresso, seletor de velocidade (0.5x/1x/2x/4x), reset, painéis de Input, Output e Metadata do passo atual, mais acumulados de tempo/tokens/custo. Hoje ele é aberto por um único botão "Replay" no header da timeline depois que o usuário seleciona uma execução.

A única coisa que falta para atender o pedido é **disparar o replay direto de cada item da lista**, sem o passo intermediário de selecionar e depois clicar em outro botão.

### O que muda

**1. `src/components/agents/traces/ExecutionList.tsx`** — adicionar prop opcional `onReplay?: (e: ExecutionGroup) => void`:
- Cada `<li>` ganha um botão "▶ Replay" pequeno (h-6, ghost com tint primário) posicionado absoluto no canto superior direito.
- Aparece em hover (`opacity-0 group-hover:opacity-100`) e também com foco via teclado (`focus:opacity-100`) — não polui a lista, mas fica acessível.
- Ao clicar: `stopPropagation` para não disparar o `onSelect` duplicado, depois chama `onSelect(e)` (para alinhar a timeline ao item) e `onReplay(e)` (para abrir o modal).
- O timestamp à direita ganha um `mr-12` para não colidir com o botão.
- `aria-label` descritivo + `title` explicando a ação.

**2. `src/pages/AgentTracesPage.tsx`** — passar `onReplay` para a `ExecutionList`:
```tsx
onReplay={(e) => { setSelectedId(e.session_id); setReplayOpen(true); }}
```
Reutiliza o `replayOpen` e o `<ReplayDialog>` que já estão montados no final da página. Zero código novo de modal.

### O que não muda

- O `ReplayDialog` em si — já tem todos os controles pedidos (play, pause, step ←/→, velocidade, reiniciar, slider) e renderiza Input/Output/Metadata + acumulados.
- O botão "Replay" no header da timeline continua existindo, para quem já está olhando os detalhes.
- Nenhuma mudança de serviço, store ou schema.

### Arquivos

- **Editar**: `src/components/agents/traces/ExecutionList.tsx` — prop `onReplay`, botão inline com revelação em hover/focus.
- **Editar**: `src/pages/AgentTracesPage.tsx` — passar handler que seta a sessão e abre o dialog existente.

### Impacto

- 1 clique para reproduzir qualquer execução da lista, em vez de 2 (selecionar → clicar Replay no header).
- Zero regressão: o caminho antigo continua funcionando; quem não passar `onReplay` (caso o componente seja usado em outro lugar) simplesmente não vê o botão.
- Acessível por teclado e leitores de tela.

