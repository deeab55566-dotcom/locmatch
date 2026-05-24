export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface UpdateProfileData {
  bio?: string;
  location?: string;
  interests?: string[];
}

export interface UpdateLocationData {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}