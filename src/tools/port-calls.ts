import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { MarineTrafficApiClient, PortCallRecord, PortCallsParams } from '../api-client.js';

export const getPortCallsToolSchema = {
  name: 'get_port_calls',
  description: 'Get arrival/departure port call history for a vessel by MMSI or IMO number. Confirms the "Single Vessel Port Calls" service data is available for dates after 2015-01-16.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'MMSI (9 digits) or IMO number of the vessel',
      },
      timespan: {
        type: 'number',
        description: 'Maximum age, in minutes, of the returned port calls (max 2880)',
        minimum: 1,
        maximum: 2880,
      },
      movetype: {
        type: 'string',
        description: 'Filter to only arrivals or only departures. Omit to get both.',
        enum: ['arrival', 'departure'],
      },
      exclude_intransit: {
        type: 'boolean',
        description: 'Exclude vessels currently in transit',
      },
      fromdate: {
        type: 'string',
        description: 'Start of date range, format "YYYY-MM-DD HH:MM" (max 190-day range with todate)',
      },
      todate: {
        type: 'string',
        description: 'End of date range, format "YYYY-MM-DD HH:MM" (max 190-day range with fromdate)',
      },
      extended: {
        type: 'boolean',
        description: 'Include extended voyage data (draught, distance travelled, average/max speed, idle time) since the previous port call',
      },
    },
    required: ['identifier'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'The vessel identifier that was queried',
      },
      count: {
        type: 'number',
        description: 'Number of port calls returned',
      },
      port_calls: {
        type: 'array',
        description: 'Arrival/departure records for the vessel, most information first as returned by the API',
        items: {
          type: 'object',
          properties: {
            ship_id: { type: 'string', description: 'MarineTraffic-assigned ship ID' },
            mmsi: { type: 'string', description: 'MMSI number of the vessel' },
            imo: { type: 'string', description: 'IMO number of the vessel, or "N/A" if unavailable' },
            name: { type: 'string', description: 'Name of the vessel, or "Unknown" if unavailable' },
            move_type: {
              type: 'string',
              description: 'Whether this record is an arrival or a departure',
              enum: ['arrival', 'departure', 'Unknown'],
            },
            ship_type_name: { type: 'string', description: 'Human-readable ship type, or "Unknown"' },
            port: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'MarineTraffic port ID' },
                name: { type: 'string', description: 'Port name, or "Unknown"' },
                country_code: { type: 'string', description: 'ISO-2 port country code, or "N/A"' },
                unlocode: { type: 'string', description: 'UN/LOCODE of the port, or "N/A"' },
              },
              required: ['name'],
            },
            market: { type: 'string', description: 'Commercial market segment, or "N/A"' },
            timestamp_utc: { type: 'string', description: 'UTC timestamp of the port call event' },
            timestamp_local: { type: 'string', description: 'Local timestamp of the port call event' },
            extended: {
              type: 'object',
              description: 'Present only when `extended` was requested',
              properties: {
                draught: { type: 'string' },
                in_transit: { type: 'string' },
                distance_travelled_nm: { type: 'string' },
                voyage_speed_avg_kn: { type: 'string' },
                voyage_speed_max_kn: { type: 'string' },
                voyage_idle_time_minutes: { type: 'string' },
                elapsed_since_last_port_minutes: { type: 'string' },
              },
            },
          },
          required: ['name', 'move_type', 'port'],
        },
      },
    },
    required: ['identifier', 'count', 'port_calls'],
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
};

export async function getPortCallsTool(
  apiClient: MarineTrafficApiClient,
  args: {
    identifier: string;
    timespan?: number;
    movetype?: 'arrival' | 'departure';
    exclude_intransit?: boolean;
    fromdate?: string;
    todate?: string;
    extended?: boolean;
  }
) {
  try {
    const { identifier, timespan, movetype, exclude_intransit, fromdate, todate, extended } = args;

    // Validate identifier format (same convention as the other vessel tools)
    if (!/^\d{9}$/.test(identifier) && !/^IMO\d{7}$/.test(identifier)) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'Invalid vessel identifier. Must be a 9-digit MMSI number or IMO number (format: IMO1234567)'
      );
    }

    const isMMSI = /^\d{9}$/.test(identifier);
    const cleanIdentifier = identifier.startsWith('IMO')
      ? identifier.substring(3)
      : identifier;

    const params: PortCallsParams = {
      msgtype: extended ? 'extended' : 'simple',
    };

    if (isMMSI) {
      params.mmsi = cleanIdentifier;
    } else {
      params.imo = cleanIdentifier;
    }

    if (timespan !== undefined) params.timespan = timespan;
    if (movetype) params.movetype = movetype === 'departure' ? 1 : 0;
    if (exclude_intransit) params.exclude_intransit = 1;
    if (fromdate) params.fromdate = fromdate;
    if (todate) params.todate = todate;

    const portCalls = await apiClient.getPortCalls(params);
    const formattedCalls = portCalls.map((call) => formatPortCall(call, Boolean(extended)));

    const result = {
      identifier,
      count: formattedCalls.length,
      port_calls: formattedCalls,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      structuredContent: result,
    };
  } catch (error) {
    if (error instanceof ProtocolError) {
      throw error;
    }

    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      `Error retrieving port calls: ${(error as Error).message}`
    );
  }
}

export function formatPortCall(call: PortCallRecord, extended: boolean) {
  const moveType = String(call.MOVE_TYPE);
  const formatted: Record<string, unknown> = {
    ship_id: call.SHIP_ID !== undefined ? String(call.SHIP_ID) : 'N/A',
    mmsi: call.MMSI !== undefined ? String(call.MMSI) : 'N/A',
    imo: call.IMO !== undefined ? String(call.IMO) : 'N/A',
    name: call.SHIPNAME || 'Unknown',
    move_type: moveType === '1' ? 'departure' : moveType === '0' ? 'arrival' : 'Unknown',
    ship_type_name: call.TYPE_NAME || 'Unknown',
    port: {
      id: call.PORT_ID !== undefined ? String(call.PORT_ID) : 'N/A',
      name: call.PORT_NAME || 'Unknown',
      country_code: call.PORT_COUNTRY_CODE || 'N/A',
      unlocode: call.PORT_UNLOCODE || 'N/A',
    },
    market: call.MARKET || 'N/A',
    timestamp_utc: call.TIMESTAMP_UTC || 'N/A',
    timestamp_local: call.TIMESTAMP_LT || 'N/A',
  };

  if (extended) {
    formatted.extended = {
      draught: call.DRAUGHT !== undefined ? String(call.DRAUGHT) : 'N/A',
      in_transit: call.INTRANSIT !== undefined ? String(call.INTRANSIT) : 'N/A',
      distance_travelled_nm: call.DISTANCE_TRAVELLED !== undefined ? String(call.DISTANCE_TRAVELLED) : 'N/A',
      voyage_speed_avg_kn: call.VOYAGE_SPEED_AVG !== undefined ? String(call.VOYAGE_SPEED_AVG) : 'N/A',
      voyage_speed_max_kn: call.VOYAGE_SPEED_MAX !== undefined ? String(call.VOYAGE_SPEED_MAX) : 'N/A',
      voyage_idle_time_minutes: call.VOYAGE_IDLE_TIME_MINS !== undefined ? String(call.VOYAGE_IDLE_TIME_MINS) : 'N/A',
      elapsed_since_last_port_minutes: call.ELAPSED_NOANCH !== undefined ? String(call.ELAPSED_NOANCH) : 'N/A',
    };
  }

  return formatted;
}
