// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

use soroban_sdk::{Address, Env};

use crate::types::{DataSource, Error, OutlierThreshold, WeatherData};

const ADMIN: &str = "ADMIN";
const INITIALIZED: &str = "INIT";
const PAUSED: &str = "PAUSED";
const DATA_COUNT: &str = "DCOUNT";
const THRESHOLD: &str = "THRESH";
const CIRCUIT_BREAKER: &str = "CB";
const MAX_SOURCES: u32 = 50;

pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&soroban_sdk::symbol_short!("INIT"))
}

pub fn set_initialized(env: &Env) {
    env.storage().instance().set(&soroban_sdk::symbol_short!("INIT"), &true);
}

pub fn get_admin(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&soroban_sdk::symbol_short!("ADMIN"))
        .ok_or(Error::NotInitialized)
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&soroban_sdk::symbol_short!("ADMIN"), admin);
}

pub fn is_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&soroban_sdk::symbol_short!("PAUSED"))
        .unwrap_or(false)
}

pub fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&soroban_sdk::symbol_short!("PAUSED"), &paused);
}

pub fn get_data_count(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&soroban_sdk::symbol_short!("DCOUNT"))
        .unwrap_or(0u32)
}

pub fn set_data_count(env: &Env, count: u32) {
    env.storage().instance().set(&soroban_sdk::symbol_short!("DCOUNT"), &count);
}

pub fn get_threshold(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&soroban_sdk::symbol_short!("THRESH"))
        .unwrap_or(3u32)
}

pub fn set_threshold(env: &Env, threshold: u32) {
    env.storage().instance().set(&soroban_sdk::symbol_short!("THRESH"), &threshold);
}

pub fn is_circuit_breaker_active(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&soroban_sdk::symbol_short!("CB"))
        .unwrap_or(false)
}

pub fn set_circuit_breaker(env: &Env, active: bool) {
    env.storage().instance().set(&soroban_sdk::symbol_short!("CB"), &active);
}

pub fn get_weather_data(env: &Env, id: u32) -> Result<WeatherData, Error> {
    let key = (soroban_sdk::symbol_short!("WD"), id);
    env.storage()
        .persistent()
        .get(&key)
        .ok_or(Error::DataNotFound)
}

pub fn set_weather_data(env: &Env, data: &WeatherData) {
    let key = (soroban_sdk::symbol_short!("WD"), data.id);
    env.storage().persistent().set(&key, data);
}

pub fn get_source(env: &Env, source: &Address) -> Option<DataSource> {
    let key = (soroban_sdk::symbol_short!("SRC"), source.clone());
    env.storage().persistent().get(&key)
}

pub fn set_source(env: &Env, source: &DataSource) {
    let key = (soroban_sdk::symbol_short!("SRC"), source.address.clone());
    env.storage().persistent().set(&key, source);
}

pub fn source_exists(env: &Env, source: &Address) -> bool {
    let key = (soroban_sdk::symbol_short!("SRC"), source.clone());
    env.storage().persistent().has(&key)
}

pub fn get_source_count(env: &Env) -> u32 {
    let key = soroban_sdk::symbol_short!("SCOUNT");
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or(0u32)
}

pub fn set_source_count(env: &Env, count: u32) {
    let key = soroban_sdk::symbol_short!("SCOUNT");
    env.storage().instance().set(&key, &count);
}

pub fn get_max_sources() -> u32 {
    MAX_SOURCES
}

pub fn get_outlier_threshold(env: &Env) -> OutlierThreshold {
    let key = soroban_sdk::symbol_short!("OUTLIER");
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or(OutlierThreshold {
            temperature_min: -5000,  // -50.00°C
            temperature_max: 6000,  // 60.00°C
            humidity_min: 0,         // 0.00%
            humidity_max: 10000,     // 100.00%
            pressure_min: 8700,      // 870.0 hPa
            pressure_max: 10850,     // 1085.0 hPa
            wind_speed_max: 4000,    // 400.0 km/h
        })
}

pub fn set_outlier_threshold(env: &Env, threshold: &OutlierThreshold) {
    let key = soroban_sdk::symbol_short!("OUTLIER");
    env.storage().instance().set(&key, threshold);
}
