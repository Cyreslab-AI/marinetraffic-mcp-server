import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { MarineTrafficApiClient } from '../api-client.js';
import { formatPortCall } from '../tools/port-calls.js';

export const portResourceTemplate = {
  uriTemplate: 'port://{port_id}',
  name: 'Port Activity',
  description: 'Recent arrival/departure port calls for a port, by MarineTraffic port ID or UN/LOCODE',
  mimeType: 'application/json',
};

export async function getPortResource(
  apiClient: MarineTrafficApiClient,
  uri: string
): Promise<string> {
  try {
    // Extract the port identifier from the URI
    const match = uri.match(/^port:\/\/([^/]+)$/);
    if (!match) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidRequest,
        `Invalid port resource URI: ${uri}`
      );
    }

    const portId = decodeURIComponent(match[1]);
    if (!portId) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidRequest,
        'Invalid port identifier. Must be a MarineTraffic port ID or UN/LOCODE'
      );
    }

    // This reuses the same underlying Port Calls service as the
    // get_port_calls tool — the API distinguishes a vessel-scoped call from
    // a port-scoped one purely by which identifier parameter is supplied.
    const portCalls = await apiClient.getPortCalls({ portid: portId });
    const formattedCalls = portCalls.map((call) => formatPortCall(call, false));

    const response = {
      port_id: portId,
      timestamp: new Date().toISOString(),
      count: formattedCalls.length,
      port_calls: formattedCalls,
    };

    return JSON.stringify(response, null, 2);
  } catch (error) {
    if (error instanceof ProtocolError) {
      throw error;
    }

    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      `Error retrieving port resource: ${(error as Error).message}`
    );
  }
}
