// src/types.ts

export interface TrainSearchQuery {
  q: string;
}

export interface TrainSearchResponse {
  success: boolean;
  timestamp: number;
  data: TrainSearchResult[];
}

export interface TrainSearchResult {
  train_number: string;
  train_name: string;
}

export interface TrainScheduleResponse {
  success: boolean;
  data: {
    stations: Array<{
      station: string;
      arrival: string | null;
      departure: string | null;
      distance: number;
      platform: string | null;
      seq: number;
    }>;
  };
}

export interface TrainsBetweenResponse {
  success: boolean;
  data: {
    count: number;
    trains: Array<{
      distance: number;
      duration: number;
      from: { departure: string; name: string; code: string };
      to: { arrival: string; name: string; code: string };
      train: { name: string; number: string; type: string };
    }>;
  };
}

export interface RecentSearch {
  id: string;
  type: 'live_status' | 'train_schedule' | 'trains_between';
  trainNumber?: string;
  date?: string;
  fromStation?: string;
  toStation?: string;
  timestamp: number;
}

export interface Station {
  stationCode: string;
  stationName: string;
  distance: number;
  isHalt: boolean;
  scheduledArrival?: string;
  scheduledDeparture?: string;
  actualArrival?: string;
  actualDeparture?: string;
  delayArrival?: number;
  delayDeparture?: number;
  status: string;
}

export interface TrainStatusResponse {
  success: boolean;
  data: {
    trainNumber: string;
    trainName: string;
    status: string;
    currentStation?: {
      stationName: string;
      stationCode: string;
    };
    startDate: string;
    train: {
      source: { name: string; code: string };
      destination: { name: string; code: string };
    };
    route: Station[];
  };
}
