import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { MarineTrafficApiClient, VoyageForecastParams, VoyageForecastRecord } from '../api-client.js';

export const getVoyageForecastToolSchema = {
  name: 'get_voyage_forecast',
  description: 'Get the machine-learning voyage forecast for a vessel by MMSI or IMO number: predicted next port and ETA, combining live AIS position with historical routing.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'MMSI (9 digits) or IMO number of the vessel',
      },
      extended: {
        type: 'boolean',
        description: 'Include extended voyage data (distance travelled/to-go, calculated speed, draught, load status, route) in addition to the destination/ETA prediction',
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
      mmsi: { type: 'string', description: 'MMSI number of the vessel' },
      imo: { type: 'string', description: 'IMO number of the vessel, or "N/A" if unavailable' },
      name: { type: 'string', description: 'Name of the vessel, or "Unknown" if unavailable' },
      destination: { type: 'string', description: 'AIS-reported destination, or "Unknown"' },
      last_port: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          unlocode: { type: 'string' },
          departure_time: { type: 'string' },
        },
      },
      next_port: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          unlocode: { type: 'string' },
        },
      },
      eta: { type: 'string', description: 'AIS-broadcast ETA, or "Unknown"' },
      eta_calc: { type: 'string', description: 'MarineTraffic machine-learning-predicted ETA, or "Unknown"' },
      extended: {
        type: 'object',
        description: 'Present only when `extended` was requested',
        properties: {
          distance_travelled_nm: { type: 'string' },
          distance_to_go_nm: { type: 'string' },
          speed_calc_kn: { type: 'string' },
          draught: { type: 'string' },
          draught_max: { type: 'string' },
          load_status: { type: 'string' },
          route: { type: 'string' },
        },
      },
    },
    required: ['identifier', 'mmsi', 'imo', 'name', 'destination', 'eta', 'eta_calc'],
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
};

export async function getVoyageForecastTool(
  apiClient: MarineTrafficApiClient,
  args: { identifier: string; extended?: boolean }
) {
  try {
    const { identifier, extended } = args;

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

    const params: VoyageForecastParams = {
      msgtype: extended ? 'extended' : 'simple',
    };

    if (isMMSI) {
      params.mmsi = cleanIdentifier;
    } else {
      params.imo = cleanIdentifier;
    }

    const forecasts = await apiClient.getVoyageForecast(params);
    const forecast = forecasts[0];

    if (!forecast) {
      throw new ProtocolError(
        ProtocolErrorCode.InternalError,
        `No voyage forecast available for vessel with identifier: ${identifier}`
      );
    }

    const result = formatVoyageForecast(identifier, forecast, Boolean(extended));

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
      `Error retrieving voyage forecast: ${(error as Error).message}`
    );
  }
}

function formatVoyageForecast(identifier: string, forecast: VoyageForecastRecord, extended: boolean) {
  const result: Record<string, unknown> = {
    identifier,
    mmsi: forecast.MMSI !== undefined ? String(forecast.MMSI) : 'N/A',
    imo: forecast.IMO !== undefined ? String(forecast.IMO) : 'N/A',
    name: forecast.SHIPNAME || 'Unknown',
    destination: forecast.DESTINATION || 'Unknown',
    last_port: {
      id: forecast.LAST_PORT_ID !== undefined ? String(forecast.LAST_PORT_ID) : 'N/A',
      name: forecast.LAST_PORT || 'Unknown',
      unlocode: forecast.LAST_PORT_UNLOCODE || 'N/A',
      departure_time: forecast.LAST_PORT_TIME || 'N/A',
    },
    next_port: {
      id: forecast.NEXT_PORT_ID !== undefined ? String(forecast.NEXT_PORT_ID) : 'N/A',
      name: forecast.NEXT_PORT_NAME || 'Unknown',
      unlocode: forecast.NEXT_PORT_UNLOCODE || 'N/A',
    },
    eta: forecast.ETA || 'Unknown',
    eta_calc: forecast.ETA_CALC || 'Unknown',
  };

  if (extended) {
    result.extended = {
      distance_travelled_nm: forecast.DISTANCE_TRAVELLED !== undefined ? String(forecast.DISTANCE_TRAVELLED) : 'N/A',
      distance_to_go_nm: forecast.DISTANCE_TO_GO !== undefined ? String(forecast.DISTANCE_TO_GO) : 'N/A',
      speed_calc_kn: forecast.SPEED_CALC !== undefined ? String(forecast.SPEED_CALC) : 'N/A',
      draught: forecast.DRAUGHT !== undefined ? String(forecast.DRAUGHT) : 'N/A',
      draught_max: forecast.DRAUGHT_MAX !== undefined ? String(forecast.DRAUGHT_MAX) : 'N/A',
      load_status: forecast.LOAD_STATUS_NAME || 'N/A',
      route: forecast.ROUTE || 'N/A',
    };
  }

  return result;
}
