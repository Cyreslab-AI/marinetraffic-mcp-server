import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { AreaParams, MarineTrafficApiClient, VesselPosition } from '../api-client.js';

export const getVesselsInAreaToolSchema = {
  name: 'get_vessels_in_area',
  description: 'Get vessels in a specified geographic area',
  inputSchema: {
    type: 'object',
    properties: {
      latitude: {
        type: 'number',
        description: 'Center latitude of the area (-90 to 90)',
        minimum: -90,
        maximum: 90,
      },
      longitude: {
        type: 'number',
        description: 'Center longitude of the area (-180 to 180)',
        minimum: -180,
        maximum: 180,
      },
      radius: {
        type: 'number',
        description: 'Radius of the area in nautical miles (1 to 100)',
        minimum: 1,
        maximum: 100,
      },
      min_ship_type: {
        type: 'number',
        description: 'Minimum ship type code to include',
      },
      max_ship_type: {
        type: 'number',
        description: 'Maximum ship type code to include',
      },
    },
    required: ['latitude', 'longitude', 'radius'],
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

export async function getVesselsInAreaTool(
  apiClient: MarineTrafficApiClient,
  args: {
    latitude: number;
    longitude: number;
    radius: number;
    min_ship_type?: number;
    max_ship_type?: number;
  }
) {
  try {
    const { latitude, longitude, radius, min_ship_type, max_ship_type } = args;

    // Validate coordinates
    if (latitude < -90 || latitude > 90) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid latitude. Must be between -90 and 90'
      );
    }

    if (longitude < -180 || longitude > 180) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid longitude. Must be between -180 and 180'
      );
    }

    // Validate radius
    if (radius < 1 || radius > 100) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid radius. Must be between 1 and 100 nautical miles'
      );
    }

    const areaParams: AreaParams = {
      center_lat: latitude,
      center_lon: longitude,
      radius,
    };

    if (min_ship_type !== undefined) {
      areaParams.min_ship_type = min_ship_type;
    }

    if (max_ship_type !== undefined) {
      areaParams.max_ship_type = max_ship_type;
    }

    const vessels = await apiClient.getVesselsInArea(areaParams);

    // Format the response
    const formattedVessels = vessels.map(vessel => formatVesselData(vessel));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            area: {
              center: {
                latitude,
                longitude,
              },
              radius: `${radius} nautical miles`,
            },
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
      `Error retrieving vessels in area: ${(error as Error).message}`
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
