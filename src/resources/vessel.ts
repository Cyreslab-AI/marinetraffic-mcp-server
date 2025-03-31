import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MarineTrafficApiClient } from '../api-client.js';

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

export const vesselResourceTemplate = {
  uriTemplate: 'vessel://{identifier}',
  name: 'Vessel Information',
  description: 'Information about a vessel by MMSI or IMO number',
  mimeType: 'application/json',
};

export async function getVesselResource(
  apiClient: MarineTrafficApiClient,
  uri: string
): Promise<string> {
  try {
    // Extract the vessel identifier from the URI
    const match = uri.match(/^vessel:\/\/([^/]+)$/);
    if (!match) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid vessel resource URI: ${uri}`
      );
    }

    const identifier = decodeURIComponent(match[1]);

    // Validate identifier format
    if (!/^\d{9}$/.test(identifier) && !/^IMO\d{7}$/.test(identifier) && !/^\d{7}$/.test(identifier)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Invalid vessel identifier. Must be a 9-digit MMSI number or IMO number (optionally prefixed with "IMO")'
      );
    }

    // Clean IMO format if needed
    const cleanIdentifier = identifier.startsWith('IMO')
      ? identifier.substring(3)
      : identifier;

    // Get both position and details
    const [position, details] = await Promise.all([
      apiClient.getVesselPosition(cleanIdentifier).catch(error => {
        console.error('Error fetching vessel position:', error);
        return null;
      }),
      apiClient.getVesselDetails(cleanIdentifier).catch(error => {
        console.error('Error fetching vessel details:', error);
        return null;
      }),
    ]);

    if (!position && !details) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `No data found for vessel with identifier: ${identifier}`
      );
    }

    // Combine the data
    const vesselData = {
      mmsi: position?.mmsi || details?.mmsi || identifier,
      imo: position?.imo || details?.imo || 'N/A',
      name: position?.ship_name || details?.name || 'Unknown',
      vessel_type: details ? {
        code: details.ship_type,
        name: details.type_name ||
              SHIP_TYPE_MAPPING[details.ship_type] ||
              'Unknown',
      } : (position?.ship_type ? {
        code: position.ship_type,
        name: SHIP_TYPE_MAPPING[position.ship_type] || 'Unknown',
      } : undefined),
      position: position ? {
        latitude: position.latitude,
        longitude: position.longitude,
        speed: `${position.speed} knots`,
        course: position.course ? `${position.course}°` : 'N/A',
        heading: position.heading ? `${position.heading}°` : 'N/A',
        status: position.status || 'Unknown',
        last_update: new Date(position.timestamp).toISOString(),
      } : undefined,
      details: details ? {
        callsign: details.callsign || 'N/A',
        flag: details.flag || 'N/A',
        dimensions: {
          length_overall: details.length_overall
            ? `${details.length_overall} m`
            : 'N/A',
          breadth_extreme: details.breadth_extreme
            ? `${details.breadth_extreme} m`
            : 'N/A',
        },
        tonnage: {
          gross: details.gross_tonnage
            ? `${details.gross_tonnage} GT`
            : 'N/A',
          summer_dwt: details.summer_dwt
            ? `${details.summer_dwt} t`
            : 'N/A',
        },
        year_built: details.year_built || 'N/A',
        home_port: details.home_port || 'N/A',
      } : undefined,
      voyage: position ? {
        destination: position.destination || 'Unknown',
        eta: position.eta || 'Unknown',
      } : undefined,
    };

    return JSON.stringify(vesselData, null, 2);
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Error retrieving vessel resource: ${(error as Error).message}`
    );
  }
}
