/**
 * Embeddable Chat Widget Service
 * Generates embed code (script tag + iframe) for deploying agents on external websites.
 * Supports customization: position, theme, colors, initial message, agent selection.
 */

export interface WidgetConfig {
  agentId: string;
  agentName: string;
  position: 'bottom-right' | 'bottom-left';
  theme: 'dark' | 'light' | 'auto';
  primaryColor: string;
  welcomeMessage: string;
  placeholder: string;
  width: number;
  height: number;
  borderRadius: number;
  showBranding: boolean;
  autoOpen: boolean;
  autoOpenDelay: number;
}

const DEFAULT_CONFIG: WidgetConfig = {
  agentId: '',
  agentName: 'Assistente',
  position: 'bottom-right',
  theme: 'dark',
  primaryColor: '#4D96FF',
  welcomeMessage: 'Olá! Como posso ajudar?',
  placeholder: 'Digite sua mensagem...',
  width: 380,
  height: 520,
  borderRadius: 16,
  showBranding: true,
  autoOpen: false,
  autoOpenDelay: 5000,
};

/**
 * Generate the embed HTML/JS code for a chat widget.
 */
export function generateEmbedCode(config: Partial<WidgetConfig> & { agentId: string }): string {
  const c = { ...DEFAULT_CONFIG, ...config };
  const baseUrl = window.location.origin;

  return `<!-- Nexus Agents Studio — Chat Widget -->
<script>
(function() {
  var cfg = ${JSON.stringify({
    agentId: c.agentId,
    agentName: c.agentName,
    position: c.position,
    theme: c.theme,
    primaryColor: c.primaryColor,
    welcomeMessage: c.welcomeMessage,
    placeholder: c.placeholder,
    width: c.width,
    height: c.height,
    borderRadius: c.borderRadius,
    showBranding: c.showBranding,
    autoOpen: c.autoOpen,
    autoOpenDelay: c.autoOpenDelay,
    baseUrl: baseUrl,
  }, null, 2)};

  var style = document.createElement('style');
  style.textContent = \`
    #nexus-chat-widget-btn {
      position: fixed;
      \${cfg.position === 'bottom-right' ? 'right: 20px' : 'left: 20px'};
      bottom: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: \${cfg.primaryColor};
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    #nexus-chat-widget-btn:hover { transform: scale(1.1); }
    #nexus-chat-widget-btn svg { width: 24px; height: 24px; fill: white; }
    #nexus-chat-widget-frame {
      position: fixed;
      \${cfg.position === 'bottom-right' ? 'right: 20px' : 'left: 20px'};
      bottom: 88px;
      width: \${cfg.width}px;
      height: \${cfg.height}px;
      border: none;
      border-radius: \${cfg.borderRadius}px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      z-index: 99999;
      display: none;
      overflow: hidden;
    }
    #nexus-chat-widget-frame.open { display: block; }
    @media (max-width: 480px) {
      #nexus-chat-widget-frame {
        width: calc(100vw - 16px);
        height: calc(100vh - 120px);
        right: 8px;
        left: 8px;
        bottom: 80px;
      }
    }
  \`;
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.id = 'nexus-chat-widget-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
  btn.title = cfg.agentName;
  document.body.appendChild(btn);

  var frame = document.createElement('iframe');
  frame.id = 'nexus-chat-widget-frame';
  frame.src = cfg.baseUrl + '/widget?agent=' + cfg.agentId + '&theme=' + cfg.theme;
  frame.allow = 'microphone';
  document.body.appendChild(frame);

  var open = false;
  btn.addEventListener('click', function() {
    open = !open;
    frame.className = open ? 'open' : '';
    btn.innerHTML = open
      ? '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
  });

  if (cfg.autoOpen) {
    setTimeout(function() { btn.click(); }, cfg.autoOpenDelay);
  }
})();
</script>`;
}

/**
 * Generate a preview HTML page for testing the widget.
 */
export function generatePreviewHTML(config: Partial<WidgetConfig> & { agentId: string }): string {
  const embedCode = generateEmbedCode(config);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Widget Preview — ${config.agentName ?? 'Assistente'}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 40px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #888; font-size: 14px; }
    .demo-content { max-width: 600px; margin: 0 auto; }
    .card { background: #16213e; border-radius: 12px; padding: 24px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="demo-content">
    <h1>Preview do Widget</h1>
    <p>Esta é uma página de demonstração. O widget aparece no canto inferior.</p>
    <div class="card">
      <h3>Agente: ${config.agentName ?? 'Assistente'}</h3>
      <p>ID: ${config.agentId}</p>
      <p>Clique no botão azul para abrir o chat.</p>
    </div>
  </div>
  ${embedCode}
</body>
</html>`;
}
