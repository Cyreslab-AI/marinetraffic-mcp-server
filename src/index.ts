#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { Server, ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { MarineTrafficApiClient } from './api-client.js';
import { getVesselPositionTool, getVesselPositionToolSchema } from './tools/vessel-position.js';
import { getVesselDetailsTool, getVesselDetailsToolSchema } from './tools/vessel-details.js';
import { searchVesselsTool, searchVesselsToolSchema } from './tools/vessel-search.js';
import { getVesselsInAreaTool, getVesselsInAreaToolSchema } from './tools/vessels-in-area.js';
import { getPortCallsTool, getPortCallsToolSchema } from './tools/port-calls.js';
import { getVoyageForecastTool, getVoyageForecastToolSchema } from './tools/voyage-forecast.js';
import { getVesselResource, vesselResourceTemplate } from './resources/vessel.js';
import { getVesselsAreaResource, vesselsAreaResourceTemplate } from './resources/vessels-area.js';
import { getPortResource, portResourceTemplate } from './resources/port.js';

class MarineTrafficServer {
  private server: Server;
  private apiClient: MarineTrafficApiClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'marinetraffic-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });

    this.setupHandlers();
  }

  private getApiClient(): MarineTrafficApiClient {
    if (!this.apiClient) {
      const apiKey = process.env.MARINETRAFFIC_API_KEY;
      if (!apiKey) {
        throw new ProtocolError(
          ProtocolErrorCode.InvalidRequest,
          'MARINETRAFFIC_API_KEY environment variable is required'
        );
      }
      this.apiClient = new MarineTrafficApiClient(apiKey);
    }
    return this.apiClient;
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler('tools/list', async (): Promise<any> => ({
      tools: [
        getVesselPositionToolSchema,
        getVesselDetailsToolSchema,
        searchVesselsToolSchema,
        getVesselsInAreaToolSchema,
        getPortCallsToolSchema,
        getVoyageForecastToolSchema,
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler('tools/call', async (request): Promise<any> => {
      const apiClient = this.getApiClient();

      switch (request.params.name) {
        case 'get_vessel_position':
          return getVesselPositionTool(apiClient, request.params.arguments as { identifier: string });

        case 'get_vessel_details':
          return getVesselDetailsTool(apiClient, request.params.arguments as { identifier: string });

        case 'search_vessels':
          return searchVesselsTool(apiClient, request.params.arguments as any);

        case 'get_vessels_in_area':
          return getVesselsInAreaTool(apiClient, request.params.arguments as {
            latitude: number;
            longitude: number;
            radius: number;
            min_ship_type?: number;
            max_ship_type?: number;
          });

        case 'get_port_calls':
          return getPortCallsTool(apiClient, request.params.arguments as {
            identifier: string;
            timespan?: number;
            movetype?: 'arrival' | 'departure';
            exclude_intransit?: boolean;
            fromdate?: string;
            todate?: string;
            extended?: boolean;
          });

        case 'get_voyage_forecast':
          return getVoyageForecastTool(apiClient, request.params.arguments as {
            identifier: string;
            extended?: boolean;
          });

        default:
          throw new ProtocolError(
            ProtocolErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });

    // List resource templates
    this.server.setRequestHandler('resources/templates/list', async () => ({
      resourceTemplates: [
        vesselResourceTemplate,
        vesselsAreaResourceTemplate,
        portResourceTemplate,
      ],
    }));

    // List static resources (none in this implementation)
    this.server.setRequestHandler('resources/list', async () => ({
      resources: [],
    }));

    // Handle resource requests
    this.server.setRequestHandler('resources/read', async (request) => {
      const apiClient = this.getApiClient();
      const uri = request.params.uri;

      let content: string;

      if (uri.startsWith('vessel://')) {
        content = await getVesselResource(apiClient, uri);
      } else if (uri.startsWith('vessels://area/')) {
        content = await getVesselsAreaResource(apiClient, uri);
      } else if (uri.startsWith('port://')) {
        content = await getPortResource(apiClient, uri);
      } else {
        throw new ProtocolError(
          ProtocolErrorCode.InvalidRequest,
          `Unsupported resource URI: ${uri}`
        );
      }

      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: content,
          },
        ],
      };
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MarineTraffic MCP server running on stdio');
  }
}

const server = new MarineTrafficServer();
server.run().catch(console.error);
