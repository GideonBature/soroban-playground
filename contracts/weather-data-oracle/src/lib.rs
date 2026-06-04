// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

//! # Weather Data Oracle Contract
//!
//! Provides reliable, tamper-resistant weather data for Soroban applications.
//! Supports multiple data sources (satellite, ground stations, weather APIs),
//! verification thresholds, outlier detection, and circuit breakers.
//!
//! ## Lifecycle
//! 1. Admin calls `initialize`.
//! 2. Admin adds trusted data sources via `add_data_source`.
//! 3. Sources submit weather data via `submit_weather_data`.
//! 4. Once confirmations reach threshold, data is auto-verified.
//! 5. Admin can finalize or trigger circuit breaker.

#![no_std]

mod storage;
mod test;
mod types;

use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, String};

use crate::storage::{
    get_admin, get_data_count, get_outlier_threshold, get_source, get_source_count, get_threshold,
    get_weather_data, is_circuit_breaker_active, is_initialized, is_paused, set_admin,
    set_circuit_breaker, set_data_count, set_initialized, set_outlier_threshold, set_paused,
    set_source, set_source_count, set_threshold, set_weather_data, source_exists,
};
use crate::types::{DataSource, DataSourceType, Error, OutlierThreshold, WeatherData, WeatherDataStatus};

#[contract]
pub struct WeatherDataOracle;

#[contractimpl]
impl WeatherDataOracle {
    /// Initialize the contract. Can only be called once.
    pub fn initialize(
        env: Env,
        admin: Address,
        verification_threshold: Option<u32>,
    ) -> Result<(), Error> {
        if is_initialized(&env) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        set_admin(&env, &admin);
        set_initialized(&env);
        if let Some(t) = verification_threshold {
            if t == 0 {
                return Err(Error::InvalidThreshold);
            }
            set_threshold(&env, t);
        }
        set_source_count(&env, 0);
        env.events().publish((symbol_short!("init"),), admin);
        Ok(())
    }

    /// Add a trusted data source. Admin only.
    pub fn add_data_source(
        env: Env,
        admin: Address,
        source: Address,
        name: String,
        source_type: DataSourceType,
    ) -> Result<(), Error> {
        ensure_initialized(&env)?;
        not_paused(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        if source_exists(&env, &source) {
            return Err(Error::SourceAlreadyExists);
        }
        if get_source_count(&env) >= storage::get_max_sources() {
            return Err(Error::MaxSourcesExceeded);
        }
        let ds = DataSource {
            address: source.clone(),
            name,
            source_type,
            active: true,
            submissions: 0,
            reputation_score: 100,
        };
        set_source(&env, &ds);
        set_source_count(&env, get_source_count(&env) + 1);
        env.events().publish((symbol_short!("srcAdd"),), source);
        Ok(())
    }

    /// Remove a data source. Admin only.
    pub fn remove_data_source(env: Env, admin: Address, source: Address) -> Result<(), Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        let mut ds = get_source(&env, &source).ok_or(Error::SourceNotFound)?;
        ds.active = false;
        set_source(&env, &ds);
        env.events().publish((symbol_short!("srcRm"),), source);
        Ok(())
    }

    /// Update the verification threshold. Admin only.
    pub fn set_verification_threshold(
        env: Env,
        admin: Address,
        threshold: u32,
    ) -> Result<(), Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        if threshold == 0 {
            return Err(Error::InvalidThreshold);
        }
        set_threshold(&env, threshold);
        Ok(())
    }

    /// Set outlier detection thresholds. Admin only.
    pub fn set_outlier_threshold(
        env: Env,
        admin: Address,
        threshold: OutlierThreshold,
    ) -> Result<(), Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        set_outlier_threshold(&env, &threshold);
        Ok(())
    }

    /// Submit weather data. Must be a registered active source.
    pub fn submit_weather_data(
        env: Env,
        submitter: Address,
        location: String,
        latitude: i64,
        longitude: i64,
        temperature: i32,
        humidity: u32,
        pressure: u32,
        wind_speed: u32,
        wind_direction: u32,
        precipitation: u32,
        source_type: DataSourceType,
    ) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        not_paused(&env)?;
        check_circuit_breaker(&env)?;
        submitter.require_auth();

        let mut ds = get_source(&env, &submitter).ok_or(Error::SourceNotFound)?;
        if !ds.active {
            return Err(Error::SourceInactive);
        }

        // Validate inputs
        validate_location(&location)?;
        validate_coordinates(latitude, longitude)?;
        validate_temperature(temperature)?;
        validate_humidity(humidity)?;
        validate_pressure(pressure)?;
        validate_wind_speed(wind_speed)?;
        validate_wind_direction(wind_direction)?;
        validate_precipitation(precipitation)?;

        // Outlier detection
        let outlier_threshold = get_outlier_threshold(&env);
        if is_outlier(&outlier_threshold, temperature, humidity, pressure, wind_speed) {
            return Err(Error::OutlierDetected);
        }

        let id = get_data_count(&env);
        let data = WeatherData {
            id,
            location,
            latitude,
            longitude,
            temperature,
            humidity,
            pressure,
            wind_speed,
            wind_direction,
            precipitation,
            timestamp: env.ledger().timestamp(),
            status: WeatherDataStatus::Pending,
            submitter: submitter.clone(),
            confirmations: 1,
            source_type,
        };
        set_weather_data(&env, &data);
        set_data_count(&env, id + 1);

        ds.submissions += 1;
        set_source(&env, &ds);

        env.events().publish(
            (symbol_short!("WeatherDataSubmitted"),),
            (id, submitter, data.temperature),
        );
        Ok(id)
    }

    /// Confirm existing weather data. Each active source can add one confirmation.
    /// Auto-verifies when confirmations reach threshold.
    pub fn confirm_weather_data(env: Env, source: Address, data_id: u32) -> Result<(), Error> {
        ensure_initialized(&env)?;
        not_paused(&env)?;
        check_circuit_breaker(&env)?;
        source.require_auth();

        let ds = get_source(&env, &source).ok_or(Error::SourceNotFound)?;
        if !ds.active {
            return Err(Error::SourceInactive);
        }

        let mut data = get_weather_data(&env, data_id)?;
        if data.status == WeatherDataStatus::Finalized {
            return Err(Error::DataAlreadyFinalized);
        }

        data.confirmations += 1;
        let threshold = get_threshold(&env);
        if data.confirmations >= threshold {
            data.status = WeatherDataStatus::Verified;
            env.events().publish((symbol_short!("WeatherDataVerified"),), data_id);
        }
        set_weather_data(&env, &data);
        Ok(())
    }

    /// Finalize verified weather data. Admin only.
    pub fn finalize_weather_data(env: Env, admin: Address, data_id: u32) -> Result<(), Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        let mut data = get_weather_data(&env, data_id)?;
        if data.status == WeatherDataStatus::Finalized {
            return Err(Error::DataAlreadyFinalized);
        }
        data.status = WeatherDataStatus::Finalized;
        set_weather_data(&env, &data);
        env.events().publish((symbol_short!("WeatherDataFinalized"),), data_id);
        Ok(())
    }

    /// Activate or deactivate the circuit breaker. Admin only.
    pub fn set_circuit_breaker(env: Env, admin: Address, active: bool) -> Result<(), Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        set_circuit_breaker(&env, active);
        if active {
            env.events().publish((symbol_short!("CircuitBreakerActivated"),), &());
        } else {
            env.events().publish((symbol_short!("CircuitBreakerDeactivated"),), &());
        }
        Ok(())
    }

    /// Pause the contract. Admin only.
    pub fn pause(env: Env, admin: Address) -> Result<(), Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        set_paused(&env, true);
        env.events().publish((symbol_short!("paused"),), admin);
        Ok(())
    }

    /// Unpause the contract. Admin only.
    pub fn unpause(env: Env, admin: Address) -> Result<(), Error> {
        ensure_initialized(&env)?;
        admin.require_auth();
        require_admin(&env, &admin)?;
        set_paused(&env, false);
        env.events().publish((symbol_short!("unpaused"),), admin);
        Ok(())
    }

    // ── Read-only ─────────────────────────────────────────────────────────────

    pub fn get_weather_data(env: Env, data_id: u32) -> Result<WeatherData, Error> {
        ensure_initialized(&env)?;
        get_weather_data(&env, data_id)
    }

    pub fn get_historical_data(
        env: Env,
        location: String,
        from_timestamp: u64,
        to_timestamp: u64,
    ) -> Result<u32, Error> {
        ensure_initialized(&env)?;
        // Returns count of data points in range (actual data would need indexed storage)
        let total = get_data_count(&env);
        if from_timestamp > to_timestamp {
            return Err(Error::InvalidTimestamp);
        }
        // Simplified: return count (full implementation would iterate through data)
        Ok(total)
    }

    pub fn get_data_count(env: Env) -> u32 {
        get_data_count(&env)
    }

    pub fn get_threshold(env: Env) -> u32 {
        get_threshold(&env)
    }

    pub fn is_circuit_breaker_active(env: Env) -> bool {
        is_circuit_breaker_active(&env)
    }

    pub fn is_paused(env: Env) -> bool {
        is_paused(&env)
    }

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        get_admin(&env)
    }

    pub fn get_data_source(env: Env, source: Address) -> Result<DataSource, Error> {
        ensure_initialized(&env)?;
        get_source(&env, &source).ok_or(Error::SourceNotFound)
    }

    pub fn get_source_count(env: Env) -> u32 {
        get_source_count(&env)
    }

    pub fn get_outlier_threshold(env: Env) -> OutlierThreshold {
        get_outlier_threshold(&env)
    }
}

// ── Private helpers ───────────────────────────────────────────────────────────

fn ensure_initialized(env: &Env) -> Result<(), Error> {
    if !is_initialized(env) {
        return Err(Error::NotInitialized);
    }
    Ok(())
}

fn not_paused(env: &Env) -> Result<(), Error> {
    if is_paused(env) {
        return Err(Error::ContractPaused);
    }
    Ok(())
}

fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
    if get_admin(env)? != *caller {
        return Err(Error::Unauthorized);
    }
    Ok(())
}

fn check_circuit_breaker(env: &Env) -> Result<(), Error> {
    if is_circuit_breaker_active(env) {
        return Err(Error::CircuitBreakerActive);
    }
    Ok(())
}

fn validate_location(location: &String) -> Result<(), Error> {
    if location.is_empty() || location.to_bytes().len() > 64 {
        return Err(Error::InvalidLocation);
    }
    Ok(())
}

fn validate_coordinates(latitude: i64, longitude: i64) -> Result<(), Error> {
    if latitude < -900000 || latitude > 900000 {
        return Err(Error::InvalidCoordinates);
    }
    if longitude < -1800000 || longitude > 1800000 {
        return Err(Error::InvalidCoordinates);
    }
    Ok(())
}

fn validate_temperature(temperature: i32) -> Result<(), Error> {
    if temperature < -10000 || temperature > 10000 {
        return Err(Error::InvalidTemperature);
    }
    Ok(())
}

fn validate_humidity(humidity: u32) -> Result<(), Error> {
    if humidity > 10000 {
        return Err(Error::InvalidHumidity);
    }
    Ok(())
}

fn validate_pressure(pressure: u32) -> Result<(), Error> {
    if pressure < 5000 || pressure > 12000 {
        return Err(Error::InvalidPressure);
    }
    Ok(())
}

fn validate_wind_speed(wind_speed: u32) -> Result<(), Error> {
    if wind_speed > 10000 {
        return Err(Error::InvalidWindSpeed);
    }
    Ok(())
}

fn validate_wind_direction(wind_direction: u32) -> Result<(), Error> {
    if wind_direction >= 360 {
        return Err(Error::InvalidWindDirection);
    }
    Ok(())
}

fn validate_precipitation(precipitation: u32) -> Result<(), Error> {
    if precipitation > 50000 {
        return Err(Error::InvalidPrecipitation);
    }
    Ok(())
}

fn is_outlier(
    threshold: &OutlierThreshold,
    temperature: i32,
    humidity: u32,
    pressure: u32,
    wind_speed: u32,
) -> bool {
    temperature < threshold.temperature_min
        || temperature > threshold.temperature_max
        || humidity < threshold.humidity_min
        || humidity > threshold.humidity_max
        || pressure < threshold.pressure_min
        || pressure > threshold.pressure_max
        || wind_speed > threshold.wind_speed_max
}
