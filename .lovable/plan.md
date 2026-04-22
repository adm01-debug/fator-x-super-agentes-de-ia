

## Modo "Exemplo real" no editor — payload consolidado pronto para envio

Hoje o último step já tem três peças separadas:

1. `CompiledPromptPreview` → mostra o **system prompt** final (com header de identidade, variáveis interpoladas, meta).
2. `QuickAgentTestPanel` → executa de fato no LLM, mas só mostra a **resposta**, não o **payload**.
3. Os mocks de `QUICK_AGENT_MOCK_INPUTS` ficam escondidos num `Select`.

Falta a peça que o usuário pediu: **um cartão único que materialize a chamada inteira** (system + user + parâmetros) **exatamente como o gateway vai receber**, e permita "rodar este exemplo" antes de avançar.

### O que muda na visão do usuário

Novo cartão **"Exemplo real de envio"** entre o `CompiledPromptPreview` e o `QuickAgentTestPanel`, com:

1. **Seletor de cenário em chips** (em vez do select escondido): renderiza os `QUICK_AGENT_MOCK_INPUTS[type]` como botões — clique troca o `user_message` mostrado abaixo. Inclui chip "Customizado" que libera edição livre.
2. **Bloco "Como o agente vai receber"** com 3 abas:
   - **Conversa** (default): renderiza system + user como bolhas estilo chat — visualização "humana" de como o LLM lê.
   - **Payload JSON**: bloco `<pre>` com o objeto exato `{ system_prompt, user_message, model, max_tokens: 800 }` que vai pro edge function, com syntax highlight básico e botão **Copiar JSON**.
   - **cURL**: comando `curl` pronto pra colar no terminal, apontando pro endpoint `quick-agent-test` com headers e body — útil pra debug fora da UI.
3. **Barra de estimativa** acima do botão: tokens estimados (input/output projetados), custo BRL/USD, modelo — reaproveita `useCostEstimate` que já existe.
4. **Botão "Simular envio real"** no rodapé do cartão: dispara a mesma `supabaseExternal.functions.invoke('quick-agent-test', …)` que o `QuickAgentTestPanel` já usa, mas o resultado aparece **dentro do mesmo cartão**, abaixo do payload, em layout request → response (split horizontal em telas largas, empilhado no mobile).
5. **Indicador "Pronto para avançar"**: quando a simulação roda com sucesso (latência < 10s, sem erro), aparece um check verde com texto "Exemplo validado — prompt está respondendo conforme esperado". Fica persistente durante a sessão e some se o prompt for editado depois (invalidação por hash do `compiled.text`).

### Comportamento e estados

| Cenário | Comportamento |
|---|---|
| Abro o step do prompt pela primeira vez | Cartão começa **expandido** com aba "Conversa" + primeiro mock pré-selecionado. |
| Troco a variação (Conciso → Detalhado) | System prompt no payload atualiza em tempo real; check "validado" se desfaz; aviso amber: "Prompt mudou — re-rode o exemplo". |
| Edito user_message e clico "Simular envio real" | Loading spinner → resposta aparece em painel lateral; latência/custo atualizam; check "validado" aparece. |
| Erro 4xx/5xx do gateway | Painel resposta vira vermelho com mensagem; check não aparece; payload continua visível para debug. |
| Aba "Payload JSON" + clico Copiar | Toast "Payload copiado"; JSON formatado com 2 espaços. |
| Prompt está incompleto (faltam seções) | Botão "Simular" desabilitado com tooltip "Complete as 4 seções obrigatórias antes de simular". |

### Como funciona (técnico)

**Novo arquivo** `src/components/agents/wizard/quickSteps/RealExamplePreview.tsx`:

- Props: `{ form: QuickAgentForm; activeVariantLabel: string | null; lastChangeKind: 'variant' | 'manual' | null }`.
- Estado interno:
  - `selectedMockLabel: string | 'custom'`
  - `userMessage: string`
  - `tab: 'conversation' | 'json' | 'curl'`
  - `result: TestResult | null` + `loading` + `error`
  - `validatedHash: string | null` (hash simples do `compiled.text` no momento do último sucesso).
- Reaproveita:
  - `compilePrompt(form)` para o `system_prompt` final.
  - `QUICK_AGENT_MOCK_INPUTS[type]` para chips de cenário.
  - `useCostEstimate({ model, systemPrompt: compiled.text, userInput: userMessage, maxTokens: 800 })`.
  - `supabaseExternal.functions.invoke('quick-agent-test', …)` — **mesma função** já usada pelo `QuickAgentTestPanel`, sem mudanças no edge.
  - `getModelPrice` + `USD_TO_BRL` para custo real.
- `validatedHash` invalida via `useEffect([compiled.text])` → `setValidatedHash(null)` quando `compiled.text` muda após validação.
- Aba JSON usa `JSON.stringify(payload, null, 2)` — sem dependência nova.
- Aba cURL gera string com `${VITE_SUPABASE_URL}/functions/v1/quick-agent-test` (já disponível no env do projeto) e header `Authorization: Bearer <ANON_KEY>` (publishable key).

**Editar** `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx`:

- Importar `RealExamplePreview` e renderizar **entre** `CompiledPromptPreview` e `QuickAgentTestPanel` (linha ~349).
- Passar `form`, `activeVariantLabel`, `lastChangeKind` (já calculados no componente).

**Decisão sobre `QuickAgentTestPanel`**: mantém-se como está. O novo cartão é uma versão "primeira intenção" focada em payload + validação rápida; o `QuickAgentTestPanel` continua útil para múltiplas execuções com métricas comparativas. Sem duplicação confusa porque os papéis ficam distintos: novo cartão = "**veja e valide o envio**", painel antigo = "**rode vários testes e compare**". Posso renomear o cabeçalho do painel antigo para "Bateria de testes" no mesmo PR para reforçar a diferença.

### Arquivos tocados

- **Criar** `src/components/agents/wizard/quickSteps/RealExamplePreview.tsx` (~280 linhas).
- **Editar** `src/components/agents/wizard/quickSteps/StepQuickPrompt.tsx` — importar e renderizar o novo cartão; ~3 linhas.
- **Editar** `src/components/agents/wizard/quickSteps/QuickAgentTestPanel.tsx` — só ajustar título para "Bateria de testes" (1 linha).

### Impacto

- Zero schema/backend — usa edge `quick-agent-test` que já existe.
- Zero quebra: novo componente isolado; os existentes seguem renderizando como hoje.
- Resolve o ponto solicitado: o usuário vê **exatamente** o que vai ser enviado (não só o system, mas o pacote completo system+user+params em formato real) e pode validar antes de avançar para "Salvar".

