Próxima da fila: **#7** (a definir após Marketplace Monetizado).

✅ #6 Marketplace Monetizado entregue:
- Migration: `skill_marketplace_meta`, `skill_purchases`, `skill_reviews`, `creator_payouts` + RPC `purchase_skill` / `get_creator_earnings` + trigger `recalc_skill_rating` (split 70/30)
- Service `marketplaceService.ts`: listSkills, getSkill, purchaseSkill, listReviews, submitReview, getMyPurchases, getCreatorEarnings, getCreatorSales, formatPrice
- `MarketplaceMonetizedPage.tsx` reescrita: filtros (categoria/preço/rating/ordenação), grid com badge verificado, modal de detalhe com compra mock + avaliação, abas "Minhas compras" e "Modo Creator"
