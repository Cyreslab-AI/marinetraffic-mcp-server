import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MarineTrafficApiClient } from '../api-client.js';

export const getVesselPositionToolSchema = {
  name: 'get_vessel_position',
  description: 'Get real-time position of a vessel by MMSI or IMO number',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'MMSI (9 digits) or IMO number of the vessel',
      },
    },
    required: ['identifier'],
  },
};

export async function getVesselPositionTool(
  apiClient: MarineTrafficApiClient,
  args: { identifier: string }
) {
  try {
    const { identifier } = args;

    // Validate identifier format
    if (!/^\d{9}$/.test(identifier) && !/^IMO\d{7}$/.test(identifier)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid vessel identifier. Must be a 9-digit MMSI number or IMO number (format: IMO1234567)'
      );
    }

    // Clean IMO format if needed
    const cleanIdentifier = identifier.startsWith('IMO')
      ? identifier.substring(3)
      : identifier;

    const vesselPosition = await apiClient.getVesselPosition(cleanIdentifier);

    // Format the response
    const formattedResponse = {
      mmsi: vesselPosition.mmsi,
      imo: vesselPosition.imo || 'N/A',
      name: vesselPosition.ship_name || 'Unknown',
      position: {
        latitude: vesselPosition.latitude,
        longitude: vesselPosition.longitude,
      },
      speed: `${vesselPosition.speed} knots`,
      course: vesselPosition.course ? `${vesselPosition.course}°` : 'N/A',
      heading: vesselPosition.heading ? `${vesselPosition.heading}°` : 'N/A',
      status: vesselPosition.status || 'Unknown',
      last_update: new Date(vesselPosition.timestamp).toISOString(),
      destination: vesselPosition.destination || 'Unknown',
      eta: vesselPosition.eta || 'Unknown',
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formattedResponse, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Error retrieving vessel position: ${(error as Error).message}`
    );
  }
}
