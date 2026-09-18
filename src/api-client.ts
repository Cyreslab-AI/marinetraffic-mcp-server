import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";

// MarineTraffic API endpoints
export const ENDPOINTS = {
  VESSEL_POSITION: '/exportvessel/v:5/position',
  VESSEL_DETAILS: '/exportvessel/v:4/vesseldetails',
  VESSEL_SEARCH: '/exportvessel/v:5/ps01',
  VESSELS_IN_AREA: '/exportvessel/v:5/ps02',
  // Confirmed against the live "AIS Data API Reference" OpenAPI spec served
  // by https://servicedocs.marinetraffic.com/ (fetched 2026-09-19). Unlike
  // the legacy endpoints above, these take the API key as a URL PATH
  // segment (`/portcalls/{api_key}`), not a query parameter — the version
  // (`v`) and identifiers (mmsi/imo/shipid/portid) are query parameters.
  // The base path is appended with `/{apiKey}` when the request is built.
  PORT_CALLS: '/portcalls',
  VOYAGE_FORECAST: '/voyageforecast',
};

// Error messages
const ERROR_MESSAGES = {
  MISSING_API_KEY: 'MarineTraffic API key is required',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded for MarineTraffic API',
  INVALID_API_KEY: 'Invalid MarineTraffic API key',
  API_ERROR: 'MarineTraffic API error',
  NETWORK_ERROR: 'Network error while connecting to MarineTraffic API',
};

// Interface for vessel position data
export interface VesselPosition {
  mmsi: string;
  imo?: string;
  ship_name?: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading?: number;
  course?: number;
  status?: string;
  timestamp: string;
  ship_type?: number;
  destination?: string;
  eta?: string;
}

// Interface for vessel details
export interface VesselDetails {
  mmsi: string;
  imo?: string;
  name: string;
  ship_type: number;
  type_name?: string;
  callsign?: string;
  flag?: string;
  gross_tonnage?: number;
  summer_dwt?: number;
  length_overall?: number;
  breadth_extreme?: number;
  year_built?: number;
  home_port?: string;
}

// Interface for search parameters
export interface SearchParams {
  vessel_name?: string;
  mmsi?: string;
  imo?: string;
  ship_type?: number;
}

// Interface for area parameters
export interface AreaParams {
  center_lat: number;
  center_lon: number;
  radius: number;
  min_ship_type?: number;
  max_ship_type?: number;
}

// Raw port call record, field names as documented for the "Single Vessel
// Port Calls" / "Port Calls" service (EV01), JSON (`protocol=jsono`) shape.
// All fields are optional/loosely typed since MarineTraffic's JSON encoding
// of numeric-looking fields is not formally specified (the published
// examples are all XML attribute strings).
export interface PortCallRecord {
  SHIP_ID?: string | number;
  MMSI?: string | number;
  IMO?: string | number;
  SHIPNAME?: string;
  MOVE_TYPE?: string | number; // 0 = Arrival, 1 = Departure
  TYPE_NAME?: string;
  PORT_ID?: string | number;
  PORT_NAME?: string;
  PORT_COUNTRY_CODE?: string;
  PORT_UNLOCODE?: string;
  PORT_LAT?: string | number;
  PORT_LON?: string | number;
  MARKET?: string;
  TIMESTAMP_LT?: string;
  TIMESTAMP_UTC?: string;
  // Present only when msgtype=extended
  DRAUGHT?: string | number;
  INTRANSIT?: string | number;
  DISTANCE_TRAVELLED?: string | number;
  VOYAGE_SPEED_AVG?: string | number;
  VOYAGE_SPEED_MAX?: string | number;
  VOYAGE_IDLE_TIME_MINS?: string | number;
  ELAPSED_NOANCH?: string | number;
}

// Query params for the Port Calls service. Identify EITHER a vessel
// (mmsi/imo/shipid) OR a port (portid) — the underlying API endpoint is the
// same either way, just with a different identifying parameter.
export interface PortCallsParams {
  mmsi?: string;
  imo?: string;
  shipid?: string;
  portid?: string;
  timespan?: number; // max age in minutes, max 2880
  movetype?: 0 | 1; // 0 = arrivals only, 1 = departures only
  exclude_intransit?: 0 | 1;
  fromdate?: string; // "YYYY-MM-DD HH:MM", max 190-day range with todate
  todate?: string;
  msgtype?: 'simple' | 'extended';
}

// Raw voyage forecast record, field names as documented for the "Single
// Vessel Voyage Forecast" service (VI01), JSON (`protocol=jsono`) shape.
export interface VoyageForecastRecord {
  MMSI?: string | number;
  IMO?: string | number;
  SHIP_ID?: string | number;
  SHIPNAME?: string;
  DESTINATION?: string;
  LAST_PORT_ID?: string | number;
  LAST_PORT?: string;
  LAST_PORT_UNLOCODE?: string;
  LAST_PORT_TIME?: string;
  NEXT_PORT_ID?: string | number;
  NEXT_PORT_NAME?: string;
  NEXT_PORT_UNLOCODE?: string;
  ETA?: string; // AIS-broadcast ETA
  ETA_CALC?: string; // MarineTraffic-calculated ETA
  // Present only when msgtype=extended
  DISTANCE_TRAVELLED?: string | number;
  DISTANCE_TO_GO?: string | number;
  SPEED_CALC?: string | number;
  DRAUGHT?: string | number;
  DRAUGHT_MAX?: string | number;
  LOAD_STATUS_NAME?: string;
  ROUTE?: string;
}

// Query params for the Single Vessel Voyage Forecast service.
export interface VoyageForecastParams {
  mmsi?: string;
  imo?: string;
  shipid?: string;
  msgtype?: 'simple' | 'extended';
}

export class MarineTrafficApiClient {
  private axiosInstance: AxiosInstance;
  private apiKey: string;
  private baseUrl: string = 'https://services.marinetraffic.com/api';
  private retryDelay: number = 1000; // Initial retry delay in ms
  private maxRetries: number = 3;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new ProtocolError(ProtocolErrorCode.InvalidParams, ERROR_MESSAGES.MISSING_API_KEY);
    }

    this.apiKey = apiKey;
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });

    // Add request interceptor to include API key
    this.axiosInstance.interceptors.request.use((config) => {
      config.params = {
        ...config.params,
        apiKey: this.apiKey,
      };
      return config;
    });
  }

  /**
   * Make an API request with retry logic for rate limiting
   */
  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, any>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      const config: AxiosRequestConfig = {
        params,
      };

      const response: AxiosResponse = await this.axiosInstance.get(endpoint, config);
      return response.data as T;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // Handle rate limiting (429 Too Many Requests)
        if (axiosError.response?.status === 429 && retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequest(endpoint, params, retryCount + 1);
        }

        // Handle authentication errors
        if (axiosError.response?.status === 401) {
          throw new ProtocolError(ProtocolErrorCode.InvalidRequest, ERROR_MESSAGES.INVALID_API_KEY);
        }

        // Handle other API errors
        if (axiosError.response) {
          throw new ProtocolError(
            ProtocolErrorCode.InternalError,
            `${ERROR_MESSAGES.API_ERROR}: ${axiosError.response.status} - ${axiosError.response.data}`
          );
        } else {
          throw new ProtocolError(ProtocolErrorCode.InternalError, ERROR_MESSAGES.NETWORK_ERROR);
        }
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get vessel position by MMSI or IMO
   */
  async getVesselPosition(identifier: string): Promise<VesselPosition> {
    const isMMSI = /^\d{9}$/.test(identifier);
    const params: Record<string, any> = {};

    if (isMMSI) {
      params.mmsi = identifier;
    } else {
      params.imo = identifier;
    }

    return this.makeRequest<VesselPosition>(ENDPOINTS.VESSEL_POSITION, params);
  }

  /**
   * Get vessel details by MMSI or IMO
   */
  async getVesselDetails(identifier: string): Promise<VesselDetails> {
    const isMMSI = /^\d{9}$/.test(identifier);
    const params: Record<string, any> = {};

    if (isMMSI) {
      params.mmsi = identifier;
    } else {
      params.imo = identifier;
    }

    return this.makeRequest<VesselDetails>(ENDPOINTS.VESSEL_DETAILS, params);
  }

  /**
   * Search for vessels by name or other parameters
   */
  async searchVessels(searchParams: SearchParams): Promise<VesselPosition[]> {
    return this.makeRequest<VesselPosition[]>(ENDPOINTS.VESSEL_SEARCH, searchParams);
  }

  /**
   * Get vessels in a specific area
   */
  async getVesselsInArea(areaParams: AreaParams): Promise<VesselPosition[]> {
    return this.makeRequest<VesselPosition[]>(ENDPOINTS.VESSELS_IN_AREA, areaParams);
  }

  /**
   * Get arrival/departure port call history, scoped to either a vessel
   * (mmsi/imo/shipid) or a port (portid).
   *
   * Per the documented contract, the API key is a URL path segment for this
   * service, not a query parameter, so it's appended to the endpoint here
   * rather than relying on the request interceptor (which still adds a
   * redundant `apiKey` query param — harmless, MarineTraffic ignores
   * unrecognized query params on this endpoint).
   */
  async getPortCalls(params: PortCallsParams): Promise<PortCallRecord[]> {
    const endpoint = `${ENDPOINTS.PORT_CALLS}/${this.apiKey}`;
    const queryParams: Record<string, any> = {
      v: 6, // latest version per the documented service contract
      protocol: 'jsono', // JSON objects; the service defaults to XML otherwise
      msgtype: params.msgtype ?? 'simple',
    };

    if (params.mmsi) queryParams.mmsi = params.mmsi;
    if (params.imo) queryParams.imo = params.imo;
    if (params.shipid) queryParams.shipid = params.shipid;
    if (params.portid) queryParams.portid = params.portid;
    if (params.timespan !== undefined) queryParams.timespan = params.timespan;
    if (params.movetype !== undefined) queryParams.movetype = params.movetype;
    if (params.exclude_intransit !== undefined) {
      queryParams.exclude_intransit = params.exclude_intransit;
    }
    if (params.fromdate) queryParams.fromdate = params.fromdate;
    if (params.todate) queryParams.todate = params.todate;

    const data = await this.makeRequest<PortCallRecord[] | PortCallRecord>(endpoint, queryParams);
    return Array.isArray(data) ? data : [data];
  }

  /**
   * Get the machine-learning voyage forecast (predicted destination/ETA)
   * for a single vessel. Same URL-path API key convention as getPortCalls.
   */
  async getVoyageForecast(params: VoyageForecastParams): Promise<VoyageForecastRecord[]> {
    const endpoint = `${ENDPOINTS.VOYAGE_FORECAST}/${this.apiKey}`;
    const queryParams: Record<string, any> = {
      v: 2, // latest version per the documented service contract
      protocol: 'jsono',
      msgtype: params.msgtype ?? 'simple',
    };

    if (params.mmsi) queryParams.mmsi = params.mmsi;
    if (params.imo) queryParams.imo = params.imo;
    if (params.shipid) queryParams.shipid = params.shipid;

    const data = await this.makeRequest<VoyageForecastRecord[] | VoyageForecastRecord>(endpoint, queryParams);
    return Array.isArray(data) ? data : [data];
  }
}
