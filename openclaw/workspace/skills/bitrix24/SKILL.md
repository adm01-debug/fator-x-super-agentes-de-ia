---
name: bitrix24
description: Integracao Bitrix24 CRM Promo Brindes. Deals, leads, contatos, tarefas via REST API.
---
# Bitrix24 CRM - Promo Brindes

## Operacoes
- crm.deal.list|get|add|update
- crm.lead.list|get|add
- crm.contact.list (filtro por PHONE ou EMAIL)
- crm.company.list|get
- tasks.task.list|add|complete
- im.message.add

## Regras
- LEITURA: executar direto
- ESCRITA: pedir confirmacao
- DELETE: nunca sem aprovacao explicita de Pink ou Cerebro
