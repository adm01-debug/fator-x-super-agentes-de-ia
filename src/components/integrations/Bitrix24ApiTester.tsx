import { useState } from 'react';
import { invokeBitrix24Api } from '@/services/llmGatewayService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Loader2, Database } from 'lucide-react';
import { toast } from 'sonner';

const API_METHODS = [
  { value: 'crm.deal.list', label: 'Listar Negocios', cat: 'CRM' },
  { value: 'crm.contact.list', label: 'Listar Contatos', cat: 'CRM' },
  { value: 'crm.company.list', label: 'Listar Empresas', cat: 'CRM' },
  { value: 'crm.lead.list', label: 'Listar Leads', cat: 'CRM' },
  { value: 'crm.product.list', label: 'Listar Produtos', cat: 'CRM' },
  { value: 'user.current', label: 'Usuario Atual', cat: 'Sistema' },
];

export function Bitrix24ApiTester() {
  const [method, setMethod] = useState('crm.deal.list');
  const [params, setParams] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  const handleTest = async () => {
    setTesting(true); setResult(null);
    try {
      const data = await invokeBitrix24Api({ method, params: params.trim() ? JSON.parse(params) : {} });
      setResult(data);
      toast.success('Chamada Bitrix24 executada');
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro ao chamar Bitrix24'); }
    finally { setTesting(false); }
  };

  return (
    <div className="nexus-card">
      <div className="flex items-center gap-2 mb-3">
        <Database className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-heading font-semibold text-foreground">Bitrix24 API Tester</h3>
        <Badge variant="outline" className="text-[10px]">bitrix24-api</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-3">Teste chamadas a API REST do Bitrix24 via proxy seguro.</p>
      <div className="grid md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="text-[11px] text-muted-foreground">Metodo</label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="bg-secondary/50 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {API_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <label className="text-[11px] text-muted-foreground">Parametros (JSON)</label>
          <Input value={params} onChange={e => setParams(e.target.value)} placeholder='{"filter": {"STATUS_ID": "NEW"}}' className="bg-secondary/50 text-xs font-mono" />
        </div>
      </div>
      <Button size="sm" onClick={handleTest} disabled={testing} className="gap-1.5">
        {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Executar
      </Button>
      {result !== null && (
        <div className="mt-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
          <pre className="text-[11px] text-muted-foreground overflow-auto max-h-[200px] font-mono">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
