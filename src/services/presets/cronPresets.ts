export const CRON_PRESETS: Record<string, { label: string; expression: string; description: string }> = {
  every_minute: { label: 'A cada minuto', expression: '* * * * *', description: 'Executa a cada 60 segundos' },
  every_5_min: { label: 'A cada 5 minutos', expression: '*/5 * * * *', description: 'Ideal para monitoramento' },
  every_15_min: { label: 'A cada 15 minutos', expression: '*/15 * * * *', description: 'Sincronização frequente' },
  every_hour: { label: 'A cada hora', expression: '0 * * * *', description: 'Relatórios horários' },
  business_hours: { label: 'Horário comercial (9h-18h)', expression: '0 9-18 * * 1-5', description: 'Seg-Sex, das 9h às 18h' },
  daily_morning: { label: 'Diário às 9h', expression: '0 9 * * *', description: 'Relatório matinal' },
  daily_evening: { label: 'Diário às 18h', expression: '0 18 * * *', description: 'Fechamento diário' },
  weekly_monday: { label: 'Semanal (Segunda)', expression: '0 9 * * 1', description: 'Reunião semanal' },
  monthly_first: { label: 'Mensal (dia 1)', expression: '0 0 1 * *', description: 'Fechamento mensal' },
  monthly_last_workday: { label: 'Último dia útil', expression: '0 18 25-31 * 1-5', description: 'Último dia útil do mês' },
};
