import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
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
  outputSchema: {
    type: 'object',
    properties: {
      mmsi: {
        type: 'string',
        description: 'MMSI number of the vessel',
      },
      imo: {
        type: 'string',
        description: 'IMO number of the vessel, or "N/A" if unavailable',
      },
      name: {
        type: 'string',
        description: 'Name of the vessel, or "Unknown" if unavailable',
      },
      position: {
        type: 'object',
        properties: {
          latitude: {
            type: 'number',
            description: 'Latitude of the vessel position',
          },
          longitude: {
            type: 'number',
            description: 'Longitude of the vessel position',
          },
        },
        required: ['latitude', 'longitude'],
      },
      speed: {
        type: 'string',
        description: 'Speed over ground with unit (e.g. "12 knots")',
      },
      course: {
        type: 'string',
        description: 'Course over ground in degrees, or "N/A"',
      },
      heading: {
        type: 'string',
        description: 'True heading in degrees, or "N/A"',
      },
      status: {
        type: 'string',
        description: 'Navigational status, or "Unknown"',
      },
      last_update: {
        type: 'string',
        description: 'ISO 8601 timestamp of the last position update',
      },
      destination: {
        type: 'string',
        description: 'Reported destination, or "Unknown"',
      },
      eta: {
        type: 'string',
        description: 'Reported estimated time of arrival, or "Unknown"',
      },
    },
    required: ['mmsi', 'imo', 'name', 'position', 'speed', 'course', 'heading', 'status', 'last_update', 'destination', 'eta'],
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
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
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
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
      structuredContent: formattedResponse,
    };
  } catch (error) {
    if (error instanceof ProtocolError) {
      throw error;
    }

    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      `Error retrieving vessel position: ${(error as Error).message}`
    );
  }
}
