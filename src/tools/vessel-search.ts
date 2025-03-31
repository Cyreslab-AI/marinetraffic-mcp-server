import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MarineTrafficApiClient, SearchParams, VesselPosition } from '../api-client.js';

export const searchVesselsToolSchema = {
  name: 'search_vessels',
  description: 'Search for vessels by name, MMSI, IMO, or vessel type',
  inputSchema: {
    type: 'object',
    properties: {
      vessel_name: {
        type: 'string',
        description: 'Name of the vessel to search for',
      },
      mmsi: {
        type: 'string',
        description: 'MMSI number of the vessel',
      },
      imo: {
        type: 'string',
        description: 'IMO number of the vessel',
      },
      ship_type: {
        type: 'number',
        description: 'Type of vessel (e.g., 7 for cargo, 8 for tanker)',
      },
    },
    oneOf: [
      { required: ['vessel_name'] },
      { required: ['mmsi'] },
      { required: ['imo'] },
      { required: ['ship_type'] },
    ],
  },
};

// Ship type mapping for human-readable vessel types (simplified version)
const SHIP_TYPE_MAPPING: Record<number, string> = {
  0: 'Not available',
  1: 'Reserved',
  2: 'Wing In Ground',
  4: 'High-Speed Craft',
  6: 'Passenger',
  7: 'Cargo',
  8: 'Tanker',
  9: 'Other',
  30: 'Fishing',
  31: 'Towing',
  32: 'Towing',
  33: 'Dredging',
  34: 'Diving',
  35: 'Military',
  36: 'Sailing',
  37: 'Pleasure Craft',
  50: 'Pilot Vessel',
  51: 'Search and Rescue',
  52: 'Tug',
  53: 'Port Tender',
  54: 'Anti-Pollution',
  55: 'Law Enforcement',
};

export async function searchVesselsTool(
  apiClient: MarineTrafficApiClient,
  args: SearchParams
) {
  try {
    // Validate at least one search parameter is provided
    if (!args.vessel_name && !args.mmsi && !args.imo && !args.ship_type) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'At least one search parameter (vessel_name, mmsi, imo, or ship_type) must be provided'
      );
    }

    // Validate MMSI format if provided
    if (args.mmsi && !/^\d{9}$/.test(args.mmsi)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid MMSI number. Must be a 9-digit number'
      );
    }

    // Validate IMO format if provided
    if (args.imo && !/^IMO\d{7}$/.test(args.imo) && !/^\d{7}$/.test(args.imo)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid IMO number. Must be a 7-digit number, optionally prefixed with "IMO"'
      );
    }

    // Clean IMO format if needed
    if (args.imo && args.imo.startsWith('IMO')) {
      args.imo = args.imo.substring(3);
    }

    const vessels = await apiClient.searchVessels(args);

    // Format the response
    const formattedVessels = vessels.map(vessel => formatVesselData(vessel));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            count: formattedVessels.length,
            vessels: formattedVessels,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Error searching for vessels: ${(error as Error).message}`
    );
  }
}

function formatVesselData(vessel: VesselPosition) {
  return {
    mmsi: vessel.mmsi,
    imo: vessel.imo || 'N/A',
    name: vessel.ship_name || 'Unknown',
    position: {
      latitude: vessel.latitude,
      longitude: vessel.longitude,
    },
    speed: `${vessel.speed} knots`,
    course: vessel.course ? `${vessel.course}°` : 'N/A',
    status: vessel.status || 'Unknown',
    type: vessel.ship_type
      ? `${vessel.ship_type} (${SHIP_TYPE_MAPPING[vessel.ship_type] || 'Unknown'})`
      : 'Unknown',
    destination: vessel.destination || 'Unknown',
    eta: vessel.eta || 'Unknown',
    last_update: new Date(vessel.timestamp).toISOString(),
  };
}
