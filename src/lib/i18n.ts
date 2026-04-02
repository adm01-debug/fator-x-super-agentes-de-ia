/**
 * Internationalization (i18n) — Lightweight translation system
 * Supports: pt-BR (default), en-US, es-ES
 * No external dependencies — pure TypeScript.
 */

// ═══ TYPES ═══

export type Locale = 'pt-BR' | 'en-US' | 'es-ES';

export interface TranslationDict {
  [key: string]: string | TranslationDict;
}

// ═══ TRANSLATIONS ═══

const translations: Record<Locale, TranslationDict> = {
  'pt-BR': {
    common: {
      save: 'Salvar', cancel: 'Cancelar', delete: 'Excluir', edit: 'Editar',
      create: 'Criar', search: 'Buscar', filter: 'Filtrar', export: 'Exportar',
      import: 'Importar', loading: 'Carregando...', error: 'Erro', success: 'Sucesso',
      confirm: 'Confirmar', back: 'Voltar', next: 'Próximo', close: 'Fechar',
      yes: 'Sim', no: 'Não', all: 'Todos', none: 'Nenhum',
    },
    nav: {
      dashboard: 'Dashboard', agents: 'Agentes', knowledge: 'Conhecimento',
      memory: 'Memória', tools: 'Ferramentas', prompts: 'Prompts',
      workflows: 'Workflows', evaluations: 'Avaliações', deployments: 'Deploys',
      monitoring: 'Monitoramento', security: 'Segurança', team: 'Equipe',
      billing: 'Faturamento', settings: 'Configurações', marketplace: 'Marketplace',
    },
    agent: {
      create: 'Criar Agente', edit: 'Editar Agente', delete: 'Excluir Agente',
      name: 'Nome do agente', mission: 'Missão', model: 'Modelo',
      status: 'Status', draft: 'Rascunho', production: 'Produção', testing: 'Teste',
      readiness: 'Prontidão', playground: 'Playground',
    },
    auth: {
      login: 'Entrar', signup: 'Cadastrar', logout: 'Sair',
      email: 'Email', password: 'Senha', forgotPassword: 'Esqueceu a senha?',
    },
  },
  'en-US': {
    common: {
      save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit',
      create: 'Create', search: 'Search', filter: 'Filter', export: 'Export',
      import: 'Import', loading: 'Loading...', error: 'Error', success: 'Success',
      confirm: 'Confirm', back: 'Back', next: 'Next', close: 'Close',
      yes: 'Yes', no: 'No', all: 'All', none: 'None',
    },
    nav: {
      dashboard: 'Dashboard', agents: 'Agents', knowledge: 'Knowledge',
      memory: 'Memory', tools: 'Tools', prompts: 'Prompts',
      workflows: 'Workflows', evaluations: 'Evaluations', deployments: 'Deployments',
      monitoring: 'Monitoring', security: 'Security', team: 'Team',
      billing: 'Billing', settings: 'Settings', marketplace: 'Marketplace',
    },
    agent: {
      create: 'Create Agent', edit: 'Edit Agent', delete: 'Delete Agent',
      name: 'Agent name', mission: 'Mission', model: 'Model',
      status: 'Status', draft: 'Draft', production: 'Production', testing: 'Testing',
      readiness: 'Readiness', playground: 'Playground',
    },
    auth: {
      login: 'Sign In', signup: 'Sign Up', logout: 'Sign Out',
      email: 'Email', password: 'Password', forgotPassword: 'Forgot password?',
    },
  },
  'es-ES': {
    common: {
      save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar',
      create: 'Crear', search: 'Buscar', filter: 'Filtrar', export: 'Exportar',
      import: 'Importar', loading: 'Cargando...', error: 'Error', success: 'Éxito',
      confirm: 'Confirmar', back: 'Volver', next: 'Siguiente', close: 'Cerrar',
      yes: 'Sí', no: 'No', all: 'Todos', none: 'Ninguno',
    },
    nav: {
      dashboard: 'Panel', agents: 'Agentes', knowledge: 'Conocimiento',
      memory: 'Memoria', tools: 'Herramientas', prompts: 'Prompts',
      workflows: 'Flujos', evaluations: 'Evaluaciones', deployments: 'Despliegues',
      monitoring: 'Monitoreo', security: 'Seguridad', team: 'Equipo',
      billing: 'Facturación', settings: 'Configuración', marketplace: 'Marketplace',
    },
    agent: {
      create: 'Crear Agente', edit: 'Editar Agente', delete: 'Eliminar Agente',
      name: 'Nombre del agente', mission: 'Misión', model: 'Modelo',
      status: 'Estado', draft: 'Borrador', production: 'Producción', testing: 'Prueba',
      readiness: 'Preparación', playground: 'Playground',
    },
    auth: {
      login: 'Iniciar sesión', signup: 'Registrarse', logout: 'Cerrar sesión',
      email: 'Correo', password: 'Contraseña', forgotPassword: '¿Olvidó su contraseña?',
    },
  },
};

// ═══ STATE ═══

const STORAGE_KEY = 'nexus_locale';

let currentLocale: Locale = (() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale;
    if (stored && translations[stored]) return stored;
  } catch { /* ignore */ }
  return 'pt-BR';
})();

// ═══ API ═══

/** Get current locale. */
export function getLocale(): Locale { return currentLocale; }

/** Set locale and persist. */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* quota */ }
}

/** Get available locales. */
export function getLocales(): { code: Locale; name: string }[] {
  return [
    { code: 'pt-BR', name: 'Português (Brasil)' },
    { code: 'en-US', name: 'English (US)' },
    { code: 'es-ES', name: 'Español' },
  ];
}

/** Translate a key path (e.g., 'common.save' → 'Salvar'). */
export function t(keyPath: string, locale?: Locale): string {
  const lang = locale ?? currentLocale;
  const dict = translations[lang] ?? translations['pt-BR'];
  const keys = keyPath.split('.');

  let current: TranslationDict | string = dict;
  for (const key of keys) {
    if (typeof current === 'string') return keyPath; // Key not found
    current = current[key] as TranslationDict | string;
    if (current === undefined) return keyPath; // Key not found
  }

  return typeof current === 'string' ? current : keyPath;
}

/** React hook for translations (returns t function bound to current locale). */
export function useTranslation() {
  return { t, locale: currentLocale, setLocale, getLocales };
}
