#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { MarineTrafficApiClient } from './api-client.js';
import { getVesselPositionTool, getVesselPositionToolSchema } from './tools/vessel-position.js';
import { getVesselDetailsTool, getVesselDetailsToolSchema } from './tools/vessel-details.js';
import { searchVesselsTool, searchVesselsToolSchema } from './tools/vessel-search.js';
import { getVesselsInAreaTool, getVesselsInAreaToolSchema } from './tools/vessels-in-area.js';
import { getVesselResource, vesselResourceTemplate } from './resources/vessel.js';
import { getVesselsAreaResource, vesselsAreaResourceTemplate } from './resources/vessels-area.js';

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
        throw new McpError(
          ErrorCode.InvalidRequest,
          'MARINETRAFFIC_API_KEY environment variable is required'
        );
      }
      this.apiClient = new MarineTrafficApiClient(apiKey);
    }
    return this.apiClient;
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        getVesselPositionToolSchema,
        getVesselDetailsToolSchema,
        searchVesselsToolSchema,
        getVesselsInAreaToolSchema,
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });

    // List resource templates
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: [
        vesselResourceTemplate,
        vesselsAreaResourceTemplate,
      ],
    }));

    // List static resources (none in this implementation)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [],
    }));

    // Handle resource requests
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const apiClient = this.getApiClient();
      const uri = request.params.uri;

      let content: string;

      if (uri.startsWith('vessel://')) {
        content = await getVesselResource(apiClient, uri);
      } else if (uri.startsWith('vessels://area/')) {
        content = await getVesselsAreaResource(apiClient, uri);
      } else {
        throw new McpError(
          ErrorCode.InvalidRequest,
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
