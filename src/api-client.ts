import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

// MarineTraffic API endpoints
export const ENDPOINTS = {
  VESSEL_POSITION: '/exportvessel/v:5/position',
  VESSEL_DETAILS: '/exportvessel/v:4/vesseldetails',
  VESSEL_SEARCH: '/exportvessel/v:5/ps01',
  VESSELS_IN_AREA: '/exportvessel/v:5/ps02',
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

export class MarineTrafficApiClient {
  private axiosInstance: AxiosInstance;
  private apiKey: string;
  private baseUrl: string = 'https://services.marinetraffic.com/api';
  private retryDelay: number = 1000; // Initial retry delay in ms
  private maxRetries: number = 3;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new McpError(ErrorCode.InvalidParams, ERROR_MESSAGES.MISSING_API_KEY);
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
          throw new McpError(ErrorCode.InvalidRequest, ERROR_MESSAGES.INVALID_API_KEY);
        }

        // Handle other API errors
        if (axiosError.response) {
          throw new McpError(
            ErrorCode.InternalError,
            `${ERROR_MESSAGES.API_ERROR}: ${axiosError.response.status} - ${axiosError.response.data}`
          );
        } else {
          throw new McpError(ErrorCode.InternalError, ERROR_MESSAGES.NETWORK_ERROR);
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
}
