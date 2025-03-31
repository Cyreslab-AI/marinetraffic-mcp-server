import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MarineTrafficApiClient } from '../api-client.js';

export const getVesselDetailsToolSchema = {
  name: 'get_vessel_details',
  description: 'Get detailed information about a vessel by MMSI or IMO number',
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

// Ship type mapping for human-readable vessel types
const SHIP_TYPE_MAPPING: Record<number, string> = {
  0: 'Not available',
  1: 'Reserved',
  2: 'Wing In Ground',
  3: 'Special Category',
  4: 'High-Speed Craft',
  5: 'Special Category',
  6: 'Passenger',
  7: 'Cargo',
  8: 'Tanker',
  9: 'Other',
  10: 'Reserved',
  11: 'Reserved',
  12: 'Reserved',
  13: 'Reserved',
  14: 'Reserved',
  15: 'Reserved',
  16: 'Reserved',
  17: 'Reserved',
  18: 'Reserved',
  19: 'Reserved',
  20: 'Wing In Ground (WIG)',
  21: 'Wing In Ground (WIG)',
  22: 'Wing In Ground (WIG)',
  23: 'Wing In Ground (WIG)',
  24: 'Wing In Ground (WIG)',
  25: 'Wing In Ground (WIG)',
  26: 'Wing In Ground (WIG)',
  27: 'Wing In Ground (WIG)',
  28: 'Wing In Ground (WIG)',
  29: 'Wing In Ground (WIG)',
  30: 'Fishing',
  31: 'Towing',
  32: 'Towing',
  33: 'Dredging',
  34: 'Diving',
  35: 'Military',
  36: 'Sailing',
  37: 'Pleasure Craft',
  38: 'Reserved',
  39: 'Reserved',
  40: 'High-Speed Craft',
  41: 'High-Speed Craft',
  42: 'High-Speed Craft',
  43: 'High-Speed Craft',
  44: 'High-Speed Craft',
  45: 'High-Speed Craft',
  46: 'High-Speed Craft',
  47: 'High-Speed Craft',
  48: 'High-Speed Craft',
  49: 'High-Speed Craft',
  50: 'Pilot Vessel',
  51: 'Search and Rescue',
  52: 'Tug',
  53: 'Port Tender',
  54: 'Anti-Pollution',
  55: 'Law Enforcement',
  56: 'Local Vessel',
  57: 'Local Vessel',
  58: 'Medical Transport',
  59: 'Special Craft',
  60: 'Passenger',
  61: 'Passenger',
  62: 'Passenger',
  63: 'Passenger',
  64: 'Passenger',
  65: 'Passenger',
  66: 'Passenger',
  67: 'Passenger',
  68: 'Passenger',
  69: 'Passenger',
  70: 'Cargo',
  71: 'Cargo',
  72: 'Cargo',
  73: 'Cargo',
  74: 'Cargo',
  75: 'Cargo',
  76: 'Cargo',
  77: 'Cargo',
  78: 'Cargo',
  79: 'Cargo',
  80: 'Tanker',
  81: 'Tanker',
  82: 'Tanker',
  83: 'Tanker',
  84: 'Tanker',
  85: 'Tanker',
  86: 'Tanker',
  87: 'Tanker',
  88: 'Tanker',
  89: 'Tanker',
  90: 'Other',
  91: 'Other',
  92: 'Other',
  93: 'Other',
  94: 'Other',
  95: 'Other',
  96: 'Other',
  97: 'Other',
  98: 'Other',
  99: 'Other',
};

export async function getVesselDetailsTool(
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

    const vesselDetails = await apiClient.getVesselDetails(cleanIdentifier);

    // Format the response
    const formattedResponse = {
      mmsi: vesselDetails.mmsi,
      imo: vesselDetails.imo || 'N/A',
      name: vesselDetails.name,
      vessel_type: {
        code: vesselDetails.ship_type,
        name: vesselDetails.type_name ||
              SHIP_TYPE_MAPPING[vesselDetails.ship_type] ||
              'Unknown',
      },
      callsign: vesselDetails.callsign || 'N/A',
      flag: vesselDetails.flag || 'N/A',
      dimensions: {
        length_overall: vesselDetails.length_overall
          ? `${vesselDetails.length_overall} m`
          : 'N/A',
        breadth_extreme: vesselDetails.breadth_extreme
          ? `${vesselDetails.breadth_extreme} m`
          : 'N/A',
      },
      tonnage: {
        gross: vesselDetails.gross_tonnage
          ? `${vesselDetails.gross_tonnage} GT`
          : 'N/A',
        summer_dwt: vesselDetails.summer_dwt
          ? `${vesselDetails.summer_dwt} t`
          : 'N/A',
      },
      year_built: vesselDetails.year_built || 'N/A',
      home_port: vesselDetails.home_port || 'N/A',
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
      `Error retrieving vessel details: ${(error as Error).message}`
    );
  }
}
