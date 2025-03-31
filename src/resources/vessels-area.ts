import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { AreaParams, MarineTrafficApiClient, VesselPosition } from '../api-client.js';

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

export const vesselsAreaResourceTemplate = {
  uriTemplate: 'vessels://area/{lat}/{lon}/{radius}',
  name: 'Vessels in Area',
  description: 'List of vessels in a specified geographic area',
  mimeType: 'application/json',
};

export async function getVesselsAreaResource(
  apiClient: MarineTrafficApiClient,
  uri: string
): Promise<string> {
  try {
    // Extract the area parameters from the URI
    const match = uri.match(/^vessels:\/\/area\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (!match) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid vessels area resource URI: ${uri}`
      );
    }

    const latitude = parseFloat(decodeURIComponent(match[1]));
    const longitude = parseFloat(decodeURIComponent(match[2]));
    const radius = parseFloat(decodeURIComponent(match[3]));

    // Validate coordinates
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Invalid latitude. Must be a number between -90 and 90'
      );
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Invalid longitude. Must be a number between -180 and 180'
      );
    }

    // Validate radius
    if (isNaN(radius) || radius < 1 || radius > 100) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Invalid radius. Must be a number between 1 and 100 nautical miles'
      );
    }

    const areaParams: AreaParams = {
      center_lat: latitude,
      center_lon: longitude,
      radius,
    };

    const vessels = await apiClient.getVesselsInArea(areaParams);

    // Format the response
    const formattedVessels = vessels.map(vessel => formatVesselData(vessel));

    const response = {
      area: {
        center: {
          latitude,
          longitude,
        },
        radius: `${radius} nautical miles`,
      },
      timestamp: new Date().toISOString(),
      count: formattedVessels.length,
      vessels: formattedVessels,
    };

    return JSON.stringify(response, null, 2);
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
