
Próximo da fila: **#6 Marketplace Monetizado (Revenue Share)**.

Estado atual: `skill_registry` com `install_count` mas sem preços, sem checkout, sem revenue share, sem reviews.

## Plano

**Backend (migration):**
1. Adicionar colunas em `skill_registry`: `price_cents` (int), `pricing_model` (enum: free/one_time/subscription), `creator_id` (uuid → auth.users), `creator_payout_pct` (default 70), `verified` (bool), `avg_rating` (numeric), `review_count` (int).
2. Nova tabela `skill_purchases`: id, skill_id, buyer_id, amount_cents, creator_payout_cents, platform_fee_cents, status (pending/completed/refunded), payment_provider, payment_ref, created_at. RLS: buyer vê próprias; creator vê do seu skill.
3. Nova tabela `skill_reviews`: id, skill_id, reviewer_id, rating (1-5), comment, created_at. RLS: público leitura, dono escreve. Trigger atualiza `avg_rating`/`review_count`.
4. Nova tabela `creator_payouts`: id, creator_id, period_start/end, total_cents, status, created_at.
5. RPC `purchase_skill(skill_id)`: registra compra mock (sem provider real ainda), incrementa install_count.

**Service:**
6. `marketplaceService.ts`: listSkills(filters), getSkill(id), purchase(id), submitReview(skill_id, rating, comment), getMyPurchases(), getCreatorEarnings().

**Frontend — reescrever `MarketplacePage.tsx`:**
7. Grid de skills com badge "Verificado", preço (Free/R$X), rating ⭐, install_count.
8. Filtros: categoria, preço (free/paid), rating min, ordenação (popular/novo/melhor avaliado).
9. Modal de skill: descrição, screenshots, reviews, botão "Instalar grátis" ou "Comprar R$X".
10. Aba "Minhas compras" + aba "Modo Creator" (se user tem skills publicadas: ganhos, payouts, analytics).
11. Banner: "70% para creators, 30% plataforma".

**Validação:**
- `tsc` clean + linter Supabase
- Mock purchase funciona end-to-end
- Reviews atualizam rating médio

**Arquivos:**
- migration (3 tabelas + alter + trigger + RPC)
- `src/services/marketplaceService.ts` (novo)
- `src/pages/MarketplacePage.tsx` (reescrita ou criar se não existir)
- Componentes: `SkillCard.tsx`, `SkillDetailDialog.tsx`, `CreatorDashboard.tsx`

**Nota:** Stripe Connect real fica para próxima iteração — esta entrega é a fundação completa (DB + UI + fluxo) com pagamento mock; trocar por Stripe é só plugar provider no RPC.
