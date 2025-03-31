# MarineTraffic MCP Server

A Model Context Protocol (MCP) server that provides access to MarineTraffic vessel tracking data.

## Features

This MCP server provides the following capabilities:

### Tools

- **get_vessel_position**: Get real-time position of a vessel by MMSI or IMO number
- **get_vessel_details**: Get detailed information about a vessel by MMSI or IMO number
- **search_vessels**: Search for vessels by name, MMSI, IMO, or vessel type
- **get_vessels_in_area**: Get vessels in a specified geographic area

### Resources

- **vessel://{identifier}**: Information about a vessel by MMSI or IMO number
- **vessels://area/{lat}/{lon}/{radius}**: List of vessels in a specified geographic area

## Installation

### Prerequisites

- Node.js 18 or higher
- A MarineTraffic API key (available from [MarineTraffic API Services](https://www.marinetraffic.com/en/ais-api-services))

### Setup

1. Clone this repository or download the source code
2. Install dependencies:

```bash
cd marinetraffic-server
npm install
```

3. Build the server:

```bash
npm run build
```

## Configuration

The server requires a MarineTraffic API key to function. You can provide this through the environment variable `MARINETRAFFIC_API_KEY`.

### MCP Settings Configuration

To use this server with Claude, add it to your MCP settings configuration file:

#### For Claude Desktop App (macOS)

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "marinetraffic": {
      "command": "node",
      "args": ["/path/to/marinetraffic-server/build/index.js"],
      "env": {
        "MARINETRAFFIC_API_KEY": "your-api-key-here"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

#### For Claude VSCode Extension

Edit `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "marinetraffic": {
      "command": "node",
      "args": ["/path/to/marinetraffic-server/build/index.js"],
      "env": {
        "MARINETRAFFIC_API_KEY": "your-api-key-here"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Usage Examples

Once the server is configured and running, you can use it with Claude to access vessel tracking data:

### Get Vessel Position

```
<use_mcp_tool>
<server_name>marinetraffic</server_name>
<tool_name>get_vessel_position</tool_name>
<arguments>
{
  "identifier": "123456789"
}
</arguments>
</use_mcp_tool>
```

### Search for Vessels

```
<use_mcp_tool>
<server_name>marinetraffic</server_name>
<tool_name>search_vessels</tool_name>
<arguments>
{
  "vessel_name": "MAERSK"
}
</arguments>
</use_mcp_tool>
```

### Get Vessels in Area

```
<use_mcp_tool>
<server_name>marinetraffic</server_name>
<tool_name>get_vessels_in_area</tool_name>
<arguments>
{
  "latitude": 37.8199,
  "longitude": -122.4783,
  "radius": 10
}
</arguments>
</use_mcp_tool>
```

### Access Vessel Resource

```
<access_mcp_resource>
<server_name>marinetraffic</server_name>
<uri>vessel://123456789</uri>
</access_mcp_resource>
```

## Screenshots

![MarineTraffic Vessel Tracking](https://i.imgur.com/JGqLhZW.png)

_Example of vessel tracking visualization from MarineTraffic platform_

![Vessel Details](https://i.imgur.com/8XYZ1Aa.png)

_Example of detailed vessel information available through the API_

## API Key Limitations

The MarineTraffic API has usage limits based on your subscription plan. Be aware of these limits when using the server to avoid exceeding your quota.

## Troubleshooting

- **API Key Errors**: Ensure your MarineTraffic API key is valid and correctly set in the environment variables.
- **Rate Limiting**: If you encounter rate limiting errors, the server will automatically retry with exponential backoff, but you may need to wait before making additional requests.
- **No Data Found**: Some vessels may not have real-time tracking data available, especially smaller vessels or those in areas with limited AIS coverage.

## License

This project is licensed under the ISC License.
