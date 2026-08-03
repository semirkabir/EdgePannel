import type { AlertsServiceHandler } from '../../../../src/generated/server/worldmonitor/alerts/v1/service_server';

import { deliverAlertEmail } from './deliver-alert-email';
import { deliverAlertWebhook } from './deliver-alert-webhook';

export const alertsHandler: AlertsServiceHandler = {
  deliverAlertEmail,
  deliverAlertWebhook,
};
