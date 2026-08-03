export const config = { runtime: 'edge' };

import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createAlertsServiceRoutes } from '../../../src/generated/server/worldmonitor/alerts/v1/service_server';
import { alertsHandler } from '../../../server/worldmonitor/alerts/v1/handler';

export default createDomainGateway(
  createAlertsServiceRoutes(alertsHandler, serverOptions),
);
