# Plano de Recuperacao de Desastres

> Procedimentos para backup, recuperacao e continuidade da plataforma Fator X Super Agentes de IA.

---

## Objetivos de Recuperacao

| Metrica | Alvo | Descricao |
|---------|------|-----------|
| **RTO** (Recovery Time Objective) | 1 hora | Tempo maximo para restaurar o servico |
| **RPO** (Recovery Point Objective) | 24 horas | Perda maxima aceitavel de dados |

> Para planos pagos do Supabase com PITR habilitado, o RPO pode ser reduzido para minutos.

---

## Estrategia de Backup do Supabase

### Backups Automaticos (Plano Gratuito)

- Frequencia: **diario**, executado automaticamente pelo Supabase
- Retencao: **7 dias**
- Escopo: banco de dados completo (schema + dados)
- Limitacao: restauracao somente via dashboard do Supabase (ponto completo, sem granularidade)

### PITR - Point-in-Time Recovery (Planos Pro/Enterprise)

- Frequencia: **continuo** (WAL shipping)
- Granularidade: restauracao para qualquer ponto no tempo
- Retencao: **7 dias** (Pro) ou **28 dias** (Enterprise)
- Ativacao: Dashboard do Supabase > Database > Backups > Enable PITR

### Backup Manual (Recomendado Semanalmente)

```bash
# Exportar schema e dados via Supabase CLI
supabase db dump --linked -f backup_$(date +%Y%m%d_%H%M%S).sql

# Exportar apenas o schema (para versionamento)
supabase db dump --linked --schema-only -f schema_$(date +%Y%m%d).sql

# Exportar apenas os dados
supabase db dump --linked --data-only -f data_$(date +%Y%m%d).sql
```

### Backup via pg_dump (Conexao Direta)

```bash
# Obter a connection string no dashboard do Supabase
# Database > Connection String > URI

pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  --format=custom \
  --no-owner \
  --no-privileges \
  -f backup_$(date +%Y%m%d_%H%M%S).dump

# Comprimir o backup
gzip backup_*.dump
```

### Armazenamento dos Backups

- Backups manuais devem ser armazenados em local separado do Supabase
- Opcoes recomendadas: Cloudflare R2, AWS S3 ou Google Cloud Storage
- Manter pelo menos 30 dias de historico
- Criptografar backups em repouso (AES-256)

---

## Procedimentos de Recuperacao

### Cenario 1: Corrupcao de Banco de Dados

**Sintomas:** Queries retornando dados inconsistentes, erros de integridade referencial, tabelas inacessiveis.

**Procedimento:**

1. **Avaliar o dano:**
   ```sql
   -- Verificar tabelas corrompidas (executar no SQL Editor do Supabase)
   SELECT schemaname, tablename
   FROM pg_tables
   WHERE schemaname = 'public';
   ```

2. **Se PITR disponivel (plano pago):**
   - Dashboard do Supabase > Database > Backups > Point-in-Time Recovery
   - Selecionar um timestamp anterior a corrupcao
   - Confirmar a restauracao (o banco sera substituido)

3. **Se apenas backup diario disponivel:**
   - Dashboard do Supabase > Database > Backups
   - Selecionar o backup mais recente anterior a corrupcao
   - Restaurar (operacao destrutiva, substitui o banco atual)

4. **Se usando backup manual:**
   ```bash
   # Restaurar de um dump custom
   pg_restore --clean --no-owner --no-privileges \
     -d "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
     backup_YYYYMMDD.dump
   ```

5. **Pos-restauracao:**
   - Verificar integridade dos dados
   - Rodar `supabase db diff` para comparar schema com as migracoes locais
   - Testar fluxos criticos da aplicacao

---

### Cenario 2: Delecao Acidental de Dados

**Sintomas:** Dados sumiram apos operacao de DELETE/DROP, usuario reporta perda de informacoes.

**Procedimento:**

1. **Acao imediata:** Desabilitar acesso de escrita se possivel (RLS policies)

2. **Se a delecao foi recente (< 1h) e PITR disponivel:**
   - Usar PITR para restaurar para o momento anterior a delecao

3. **Se PITR nao esta disponivel:**
   - Restaurar o backup diario mais recente em um projeto temporario do Supabase
   - Exportar apenas as tabelas/dados afetados:
     ```bash
     pg_dump "CONNECTION_STRING_BACKUP" \
       --table=public.tabela_afetada \
       --data-only \
       -f dados_recuperados.sql
     ```
   - Importar os dados no projeto principal:
     ```bash
     psql "CONNECTION_STRING_PRODUCAO" -f dados_recuperados.sql
     ```

4. **Prevencao futura:**
   - Implementar soft-delete (coluna `deleted_at`) em tabelas criticas
   - Adicionar RLS policies que bloqueiem DELETE para roles nao-admin
   - Habilitar PITR se ainda nao estiver ativo

---

### Cenario 3: Indisponibilidade do Supabase

**Sintomas:** Aplicacao retorna erros de conexao ao banco, dashboard do Supabase inacessivel.

**Procedimento:**

1. **Confirmar a indisponibilidade:**
   - Verificar https://status.supabase.com
   - Testar conexao direta ao banco via `psql`
   - Verificar se o problema e regional (tentar de outra rede)

2. **Comunicacao:**
   - Postar no canal #incidentes: "Supabase indisponivel. Monitorando status."
   - Ativar pagina de manutencao na aplicacao (se houver)

3. **Mitigacao:**
   - A aplicacao deve exibir mensagens amigaveis quando o Supabase esta fora
   - Funcionalidades que nao dependem do banco devem continuar operando
   - Considerar cache local (localStorage) para dados criticos do usuario

4. **Apos restauracao do Supabase:**
   - Verificar integridade dos dados
   - Monitorar logs por 30 minutos
   - Verificar se filas de eventos pendentes foram processadas

---

### Cenario 4: Falha de DNS

**Sintomas:** Dominio nao resolve, ERR_NAME_NOT_RESOLVED, site inacessivel mas infraestrutura OK.

**Procedimento:**

1. **Diagnosticar:**
   ```bash
   # Verificar resolucao DNS
   dig dominio.com.br
   nslookup dominio.com.br

   # Verificar propagacao global
   # Usar https://dnschecker.org
   ```

2. **Se o DNS esta gerenciado no Cloudflare:**
   - Acessar dashboard do Cloudflare
   - Verificar se os registros A/CNAME estao corretos
   - Verificar se o dominio nao foi pausado ou expirou

3. **Se o registro de dominio expirou:**
   - Renovar imediatamente no registrador
   - Propagacao pode levar ate 48h (geralmente minutos)

4. **Workaround temporario:**
   - Compartilhar URL alternativa (subdominio do provedor de deploy) com a equipe
   - Ex: `projeto.vercel.app` ou `projeto.pages.dev`

---

## Exportacao de Dados

### Exportacao Completa (para migracao ou auditoria)

```bash
# Schema completo + dados + funcoes + triggers
supabase db dump --linked -f full_export.sql

# Storage (arquivos enviados pelos usuarios)
# Listar buckets
supabase storage ls --linked

# Baixar arquivos de um bucket
supabase storage cp --linked -r sb://bucket-name ./backup-storage/
```

### Exportacao Seletiva

```bash
# Exportar tabelas especificas
pg_dump "CONNECTION_STRING" \
  --table=public.profiles \
  --table=public.agents \
  --table=public.conversations \
  -f tabelas_selecionadas.sql

# Exportar em formato CSV (util para analise)
psql "CONNECTION_STRING" -c "\copy public.profiles TO 'profiles.csv' WITH CSV HEADER"
```

### Exportacao das Migracoes

As migracoes SQL estao versionadas no repositorio em `supabase/migrations/`. Para reconstruir o banco do zero:

```bash
# Aplicar todas as migracoes em um banco limpo
supabase db reset --linked
```

---

## Cronograma de Testes

| Teste | Frequencia | Responsavel | Procedimento |
|-------|------------|-------------|--------------|
| Restauracao de backup diario | Trimestral | Tech Lead | Restaurar em projeto temp, validar dados |
| Restauracao PITR | Trimestral | Tech Lead | Restaurar para ponto especifico, validar |
| Rebuild do zero via migracoes | Mensal | Dev de plantao | `supabase db reset` em ambiente local |
| Teste de failover de DNS | Semestral | Tech Lead | Simular falha, verificar workaround |
| Validacao dos backups manuais | Mensal | Dev de plantao | Verificar integridade dos arquivos `.dump` |

### Registro de Testes

Cada teste deve ser documentado com:

- Data de execucao
- Quem executou
- Resultado (sucesso/falha)
- Tempo de recuperacao medido
- Problemas encontrados
- Acoes corretivas

---

## Contatos dos Provedores

| Provedor | Servico | Suporte | Status Page |
|----------|---------|---------|-------------|
| **Supabase** | Banco de dados, Auth, Storage | support@supabase.io | https://status.supabase.com |
| **Vercel** | Hospedagem, Deploy | https://vercel.com/help | https://www.vercel-status.com |
| **Cloudflare** | DNS, CDN, Workers | https://support.cloudflare.com | https://www.cloudflarestatus.com |
| **Registrador de Dominio** | Registro DNS | [Verificar contrato] | [Verificar painel] |

### Contatos Internos

| Papel | Nome | Contato |
|-------|------|---------|
| CTO | [Preencher] | [Slack/Telefone] |
| Tech Lead | [Preencher] | [Slack/Telefone] |
| Dev Plantao (Semana atual) | [Preencher] | [Slack/Telefone] |

---

## Revisao deste Documento

- **Ultima revisao:** [Data]
- **Proxima revisao agendada:** [Data + 3 meses]
- **Responsavel pela revisao:** Tech Lead

> Este documento deve ser revisado a cada trimestre ou apos qualquer incidente P0/P1 que revele lacunas no plano.
