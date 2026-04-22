# Example Templates

Coleção curada de templates de exemplo que demonstram diferentes **reasoning patterns** suportados pela plataforma. São fixtures para usar no importador (`/agents/templates` → **Importar Template** → aba **JSON** → colar o conteúdo).

## Padrões demonstrados

| Arquivo                        | Reasoning                | Caso de uso                                       | Trade-off                                              |
| ------------------------------ | ------------------------ | ------------------------------------------------- | ------------------------------------------------------ |
| `cot-analyst.json`             | `cot` (Chain-of-Thought) | Decisões auditáveis onde o "porquê" importa       | +1 bloco de raciocínio no output                       |
| `reflection-reviewer.json`     | `reflection`             | Conteúdo crítico (propostas, e-mails, relatórios) | +1 chamada LLM (custo/latência 2×)                     |
| `plan-execute-researcher.json` | `plan_execute`           | Pesquisa multi-step com tools paralelas           | +overhead de planejamento; paga-se em tarefas ≥3 steps |

## Como usar

1. Abra a galeria: `/agents/templates`.
2. Clique em **Importar Template**.
3. Aba **JSON** → cole o conteúdo de um dos arquivos.
4. Preview mostra o template parseado + tools que precisam de mapeamento.
5. **Forkar agora** cria um agente novo; **Adicionar à galeria** injeta na sessão.

## Referências acadêmicas

- **CoT**: Wei et al., 2022 — [arxiv.org/abs/2201.11903](https://arxiv.org/abs/2201.11903)
- **Reflection / Reflexion**: Shinn et al., 2023 — [arxiv.org/abs/2303.11366](https://arxiv.org/abs/2303.11366)
- **Plan-and-Execute**: Wang et al., 2023 — [arxiv.org/abs/2305.04091](https://arxiv.org/abs/2305.04091)

## Outros repositórios recomendados para importar

- [`dair-ai/Prompt-Engineering-Guide`](https://github.com/dair-ai/Prompt-Engineering-Guide) — prompts academicamente validados (formato markdown; usar aba "Markdown" do importador).
- [`anthropics/anthropic-cookbook`](https://github.com/anthropics/anthropic-cookbook) — padrões canônicos de tool-use, RAG, long context.
- [`langchain-ai/langchain/cookbook/`](https://github.com/langchain-ai/langchain/tree/master/cookbook) — agentes de referência (exportar JSON LangGraph).
- [`crewAIInc/crewAI-examples`](https://github.com/crewAIInc/crewAI-examples) — agentes multi-papel (vendas, suporte).
- [Dify Marketplace](https://marketplace.dify.ai/) — milhares de apps exportáveis em JSON (usar aba "JSON" do importador; auto-detecta formato Dify).
