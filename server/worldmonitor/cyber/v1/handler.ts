import type { CyberServiceHandler } from '../../../../src/generated/server/worldmonitor/cyber/v1/service_server';

import { listCyberThreats } from './list-cyber-threats';
import { listKnownExploitedVulns } from './list-known-exploited-vulns';

export const cyberHandler: CyberServiceHandler = {
  listCyberThreats,
  listKnownExploitedVulns,
};
