// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

use soroban_sdk::{contracterror, contracttype, Address, String};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum WeatherDataStatus {
    Pending,
    Verified,
    Disputed,
    Finalized,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum DataSourceType {
    Satellite,
    GroundStation,
    WeatherAPI,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct WeatherData {
    pub id: u32,
    pub location: String,
    pub latitude: i64,
    pub longitude: i64,
    pub temperature: i32, // in Celsius * 100 (e.g., 2345 = 23.45°C)
    pub humidity: u32,    // in percentage * 100 (e.g., 6500 = 65.00%)
    pub pressure: u32,    // in hPa * 10 (e.g., 10132 = 1013.2 hPa)
    pub wind_speed: u32,  // in km/h * 10 (e.g., 125 = 12.5 km/h)
    pub wind_direction: u32, // in degrees (0-359)
    pub precipitation: u32, // in mm * 10 (e.g., 55 = 5.5 mm)
    pub timestamp: u64,
    pub status: WeatherDataStatus,
    pub submitter: Address,
    pub confirmations: u32,
    pub source_type: DataSourceType,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct DataSource {
    pub address: Address,
    pub name: String,
    pub source_type: DataSourceType,
    pub active: bool,
    pub submissions: u32,
    pub reputation_score: u32, // 0-100
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct OutlierThreshold {
    pub temperature_min: i32,
    pub temperature_max: i32,
    pub humidity_min: u32,
    pub humidity_max: u32,
    pub pressure_min: u32,
    pub pressure_max: u32,
    pub wind_speed_max: u32,
}

#[contracterror]
#[derive(Clone, Debug, PartialEq)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    ContractPaused = 4,
    SourceNotFound = 5,
    SourceAlreadyExists = 6,
    SourceInactive = 7,
    DataNotFound = 8,
    DataAlreadyFinalized = 9,
    InvalidThreshold = 10,
    CircuitBreakerActive = 11,
    InvalidLocation = 12,
    InvalidCoordinates = 13,
    InvalidTemperature = 14,
    InvalidHumidity = 15,
    InvalidPressure = 16,
    InvalidWindSpeed = 17,
    InvalidWindDirection = 18,
    InvalidPrecipitation = 19,
    OutlierDetected = 20,
    InvalidTimestamp = 21,
    MaxSourcesExceeded = 22,
}
