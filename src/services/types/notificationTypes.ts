/**
 * Notification Engine — Type Definitions
 */

export type NotificationChannel =
  | 'email'
  | 'whatsapp'
  | 'slack'
  | 'push'
  | 'sms'
  | 'in_app'
  | 'webhook';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled';

export interface NotificationPayload {
  id: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  status: NotificationStatus;
  recipient_id: string | null;
  recipient_address: string;
  subject: string;
  body: string;
  body_html: string | null;
  template_id: string | null;
  template_vars: Record<string, unknown>;
  metadata: Record<string, unknown>;
  scheduled_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  error: string | null;
  retry_count: number;
  max_retries: number;
  source_type: 'workflow' | 'agent' | 'system' | 'user';
  source_id: string | null;
  created_at: string;
}

export interface SendNotificationInput {
  channel: NotificationChannel;
  priority?: NotificationPriority;
  recipient_id?: string;
  recipient_address: string;
  subject: string;
  body: string;
  body_html?: string;
  template_id?: string;
  template_vars?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  scheduled_at?: string;
  source_type?: NotificationPayload['source_type'];
  source_id?: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject_template: string;
  body_template: string;
  body_html_template: string | null;
  variables: string[];
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface NotificationPreference {
  user_id: string;
  channel: NotificationChannel;
  enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  frequency_limit: number | null;
}

export interface NotificationStats {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_read: number;
  delivery_rate: number;
  read_rate: number;
  by_channel: Record<NotificationChannel, { sent: number; delivered: number; failed: number }>;
  by_priority: Record<NotificationPriority, number>;
  avg_delivery_time_ms: number;
}

export interface NotificationSenderInvokeInput {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  message?: string;
  template_id?: string;
  template_vars?: Record<string, string | number | boolean>;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
}

export interface NotificationSenderInvokeResult {
  ok: boolean;
  notification_id?: string;
  channel?: string;
  status?: string;
  error?: string;
}
