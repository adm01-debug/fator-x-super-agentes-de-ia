import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
  maxHeight?: string;
}

export function CodeBlock({ code, language, className, maxHeight = '300px' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('relative rounded-lg border bg-muted/30 overflow-hidden group', className)}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/20">
        <span className="text-[11px] font-mono text-muted-foreground uppercase">{language ?? 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Copiar código"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <pre className="p-3 overflow-auto text-xs font-mono leading-relaxed text-foreground/90" style={{ maxHeight }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
