// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::{DataSourceType, Error, OutlierThreshold, WeatherData, WeatherDataOracle, WeatherDataOracleClient, WeatherDataStatus};

fn setup() -> (Env, WeatherDataOracleClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, WeatherDataOracle);
    let client = WeatherDataOracleClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    (env, client, admin)
}

fn str(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

// ── Initialization ────────────────────────────────────────────────────────────

#[test]
fn test_initialize() {
    let (_, client, admin) = setup();
    client.initialize(&admin, &None);
    assert_eq!(client.get_admin(), admin);
}

#[test]
fn test_initialize_with_threshold() {
    let (_, client, admin) = setup();
    client.initialize(&admin, &Some(5));
    assert_eq!(client.get_threshold(), 5);
}

#[test]
fn test_initialize_already_initialized() {
    let (_, client, admin) = setup();
    client.initialize(&admin, &None);
    let result = client.try_initialize(&admin, &None);
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn test_initialize_invalid_threshold() {
    let (_, client, admin) = setup();
    let result = client.try_initialize(&admin, &Some(0));
    assert_eq!(result, Err(Ok(Error::InvalidThreshold)));
}

// ── Data Sources ──────────────────────────────────────────────────────────────

#[test]
fn test_add_data_source() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    let ds = client.get_data_source(&source);
    assert!(ds.active);
    assert_eq!(ds.submissions, 0);
}

#[test]
fn test_add_duplicate_source_fails() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    let result = client.try_add_data_source(&admin, &source, &str(&env, "WeatherAPI2"), &DataSourceType::Satellite);
    assert_eq!(result, Err(Ok(Error::SourceAlreadyExists)));
}

#[test]
fn test_remove_data_source() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    client.remove_data_source(&admin, &source);
    let ds = client.get_data_source(&source);
    assert!(!ds.active);
}

#[test]
fn test_remove_nonexistent_source_fails() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    let result = client.try_remove_data_source(&admin, &source);
    assert_eq!(result, Err(Ok(Error::SourceNotFound)));
}

#[test]
fn test_non_admin_cannot_add_source() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let unauthorized = Address::generate(&env);
    let source = Address::generate(&env);
    let result = client.try_add_data_source(&unauthorized, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_add_source_not_initialized_fails() {
    let (env, client, admin) = setup();
    let source = Address::generate(&env);
    let result = client.try_add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    assert_eq!(result, Err(Ok(Error::NotInitialized)));
}

#[test]
fn test_max_sources_exceeded() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    // Add 50 sources (max)
    for i in 0..50 {
        let source = Address::generate(&env);
        client.add_data_source(&admin, &source, &str(&env, &format!("Source{}", i)), &DataSourceType::WeatherAPI);
    }
    let extra_source = Address::generate(&env);
    let result = client.try_add_data_source(&admin, &extra_source, &str(&env, "Extra"), &DataSourceType::WeatherAPI);
    assert_eq!(result, Err(Ok(Error::MaxSourcesExceeded)));
}

// ── Verification Threshold ────────────────────────────────────────────────────

#[test]
fn test_set_verification_threshold() {
    let (_, client, admin) = setup();
    client.initialize(&admin, &None);
    client.set_verification_threshold(&admin, &7);
    assert_eq!(client.get_threshold(), 7);
}

#[test]
fn test_set_threshold_unauthorized() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let unauthorized = Address::generate(&env);
    let result = client.try_set_verification_threshold(&unauthorized, &5);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_set_threshold_invalid() {
    let (_, client, admin) = setup();
    client.initialize(&admin, &None);
    let result = client.try_set_verification_threshold(&admin, &0);
    assert_eq!(result, Err(Ok(Error::InvalidThreshold)));
}

// ── Outlier Threshold ────────────────────────────────────────────────────────

#[test]
fn test_set_outlier_threshold() {
    let (_, client, admin) = setup();
    client.initialize(&admin, &None);
    let threshold = OutlierThreshold {
        temperature_min: -3000,
        temperature_max: 5000,
        humidity_min: 1000,
        humidity_max: 9000,
        pressure_min: 9000,
        pressure_max: 10500,
        wind_speed_max: 2000,
    };
    client.set_outlier_threshold(&admin, &threshold);
    let retrieved = client.get_outlier_threshold();
    assert_eq!(retrieved.temperature_min, threshold.temperature_min);
}

#[test]
fn test_default_outlier_threshold() {
    let (_, client, admin) = setup();
    client.initialize(&admin, &None);
    let threshold = client.get_outlier_threshold();
    assert_eq!(threshold.temperature_min, -5000);
    assert_eq!(threshold.temperature_max, 6000);
}

// ── Weather Data Submission ───────────────────────────────────────────────────

#[test]
fn test_submit_weather_data() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    
    let id = client.submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    
    assert_eq!(id, 0);
    assert_eq!(client.get_data_count(), 1);
}

#[test]
fn test_submit_unauthorized_source() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let unauthorized = Address::generate(&env);
    
    let result = client.try_submit_weather_data(
        &unauthorized,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    assert_eq!(result, Err(Ok(Error::SourceNotFound)));
}

#[test]
fn test_submit_inactive_source() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    client.remove_data_source(&admin, &source);
    
    let result = client.try_submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    assert_eq!(result, Err(Ok(Error::SourceInactive)));
}

#[test]
fn test_submit_invalid_location() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    
    let result = client.try_submit_weather_data(
        &source,
        &str(&env, ""),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    assert_eq!(result, Err(Ok(Error::InvalidLocation)));
}

#[test]
fn test_submit_invalid_coordinates() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    
    let result = client.try_submit_weather_data(
        &source,
        &str(&env, "New York"),
        &910000, // Invalid latitude
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    assert_eq!(result, Err(Ok(Error::InvalidCoordinates)));
}

#[test]
fn test_submit_invalid_temperature() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    
    let result = client.try_submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &11000, // Invalid temperature
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    assert_eq!(result, Err(Ok(Error::InvalidTemperature)));
}

#[test]
fn test_submit_invalid_humidity() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    
    let result = client.try_submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &11000, // Invalid humidity
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    assert_eq!(result, Err(Ok(Error::InvalidHumidity)));
}

#[test]
fn test_submit_invalid_pressure() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    
    let result = client.try_submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &4000, // Invalid pressure
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    assert_eq!(result, Err(Ok(Error::InvalidPressure)));
}

#[test]
fn test_submit_invalid_wind_speed() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    
    let result = client.try_submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &11000, // Invalid wind speed
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    assert_eq!(result, Err(Ok(Error::InvalidWindSpeed)));
}

#[test]
fn test_submit_invalid_wind_direction() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    
    let result = client.try_submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &400, // Invalid wind direction
        &55,
        &DataSourceType::WeatherAPI,
    );
    assert_eq!(result, Err(Ok(Error::InvalidWindDirection)));
}

#[test]
fn test_submit_invalid_precipitation() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    
    let result = client.try_submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &60000, // Invalid precipitation
        &DataSourceType::WeatherAPI,
    );
    assert_eq!(result, Err(Ok(Error::InvalidPrecipitation)));
}

#[test]
fn test_submit_outlier_detected() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "WeatherAPI1"), &DataSourceType::WeatherAPI);
    
    let threshold = OutlierThreshold {
        temperature_min: 0,
        temperature_max: 3000,
        humidity_min: 0,
        humidity_max: 8000,
        pressure_min: 9500,
        pressure_max: 10500,
        wind_speed_max: 500,
    };
    client.set_outlier_threshold(&admin, &threshold);
    
    let result = client.try_submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &3500, // Outlier temperature
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    assert_eq!(result, Err(Ok(Error::OutlierDetected)));
}

#[test]
fn test_submission_increments_source_count() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    client.add_data_source(&admin, &source, &str(&env, "Source1"), &DataSourceType::WeatherAPI);
    
    let ds_before = client.get_data_source(&source);
    assert_eq!(ds_before.submissions, 0);
    
    client.submit_weather_data(
        &source,
        &str(&env, "NYC"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    
    let ds_after = client.get_data_source(&source);
    assert_eq!(ds_after.submissions, 1);
}

// ── Weather Data Confirmation ─────────────────────────────────────────────────

#[test]
fn test_confirm_weather_data() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &Some(3));
    let source1 = Address::generate(&env);
    let source2 = Address::generate(&env);
    let source3 = Address::generate(&env);
    
    client.add_data_source(&admin, &source1, &str(&env, "Source1"), &DataSourceType::WeatherAPI);
    client.add_data_source(&admin, &source2, &str(&env, "Source2"), &DataSourceType::Satellite);
    client.add_data_source(&admin, &source3, &str(&env, "Source3"), &DataSourceType::GroundStation);
    
    let id = client.submit_weather_data(
        &source1,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    
    client.confirm_weather_data(&source2, &id);
    client.confirm_weather_data(&source3, &id);
    
    let data = client.get_weather_data(&id);
    assert_eq!(data.status, WeatherDataStatus::Verified);
}

#[test]
fn test_confirm_unauthorized() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    
    client.add_data_source(&admin, &source, &str(&env, "Source1"), &DataSourceType::WeatherAPI);
    
    let id = client.submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    
    let result = client.try_confirm_weather_data(&unauthorized, &id);
    assert_eq!(result, Err(Ok(Error::SourceNotFound)));
}

#[test]
fn test_confirm_inactive_source() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    
    client.add_data_source(&admin, &source, &str(&env, "Source1"), &DataSourceType::WeatherAPI);
    
    let id = client.submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    
    client.remove_data_source(&admin, &source);
    let result = client.try_confirm_weather_data(&source, &id);
    assert_eq!(result, Err(Ok(Error::SourceInactive)));
}

// ── Weather Data Finalization ─────────────────────────────────────────────────

#[test]
fn test_finalize_weather_data() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    
    client.add_data_source(&admin, &source, &str(&env, "Source1"), &DataSourceType::WeatherAPI);
    
    let id = client.submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    
    client.finalize_weather_data(&admin, &id);
    let data = client.get_weather_data(&id);
    assert_eq!(data.status, WeatherDataStatus::Finalized);
}

#[test]
fn test_finalize_unauthorized() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let unauthorized = Address::generate(&env);
    let source = Address::generate(&env);
    
    client.add_data_source(&admin, &source, &str(&env, "Source1"), &DataSourceType::WeatherAPI);
    
    let id = client.submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    
    let result = client.try_finalize_weather_data(&unauthorized, &id);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_finalize_already_finalized() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    
    client.add_data_source(&admin, &source, &str(&env, "Source1"), &DataSourceType::WeatherAPI);
    
    let id = client.submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    
    client.finalize_weather_data(&admin, &id);
    let result = client.try_finalize_weather_data(&admin, &id);
    assert_eq!(result, Err(Ok(Error::DataAlreadyFinalized)));
}

// ── Circuit Breaker ───────────────────────────────────────────────────────────

#[test]
fn test_set_circuit_breaker() {
    let (_, client, admin) = setup();
    client.initialize(&admin, &None);
    client.set_circuit_breaker(&admin, &true);
    assert!(client.is_circuit_breaker_active());
    
    client.set_circuit_breaker(&admin, &false);
    assert!(!client.is_circuit_breaker_active());
}

#[test]
fn test_circuit_breaker_unauthorized() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let unauthorized = Address::generate(&env);
    
    let result = client.try_set_circuit_breaker(&unauthorized, &true);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_circuit_breaker_blocks_submission() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    
    client.add_data_source(&admin, &source, &str(&env, "Source1"), &DataSourceType::WeatherAPI);
    client.set_circuit_breaker(&admin, &true);
    
    let result = client.try_submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    assert_eq!(result, Err(Ok(Error::CircuitBreakerActive)));
}

// ── Pause/Unpause ─────────────────────────────────────────────────────────────

#[test]
fn test_pause() {
    let (_, client, admin) = setup();
    client.initialize(&admin, &None);
    client.pause(&admin);
    assert!(client.is_paused());
    
    client.unpause(&admin);
    assert!(!client.is_paused());
}

#[test]
fn test_pause_unauthorized() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let unauthorized = Address::generate(&env);
    
    let result = client.try_pause(&unauthorized);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_pause_blocks_submission() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    
    client.add_data_source(&admin, &source, &str(&env, "Source1"), &DataSourceType::WeatherAPI);
    client.pause(&admin);
    
    let result = client.try_submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    assert_eq!(result, Err(Ok(Error::ContractPaused)));
}

// ── Read Operations ────────────────────────────────────────────────────────────

#[test]
fn test_get_weather_data() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let source = Address::generate(&env);
    
    client.add_data_source(&admin, &source, &str(&env, "Source1"), &DataSourceType::WeatherAPI);
    
    let id = client.submit_weather_data(
        &source,
        &str(&env, "New York"),
        &407120,
        &-740060,
        &2345,
        &6500,
        &10132,
        &125,
        &180,
        &55,
        &DataSourceType::WeatherAPI,
    );
    
    let data = client.get_weather_data(&id);
    assert_eq!(data.location, str(&env, "New York"));
    assert_eq!(data.temperature, 2345);
    assert_eq!(data.status, WeatherDataStatus::Pending);
}

#[test]
fn test_get_weather_data_not_found() {
    let (_, client, admin) = setup();
    client.initialize(&admin, &None);
    let result = client.try_get_weather_data(&999);
    assert_eq!(result, Err(Ok(Error::DataNotFound)));
}

#[test]
fn test_get_historical_data() {
    let (_, client, admin) = setup();
    client.initialize(&admin, &None);
    let count = client.get_historical_data(&str(&env, "NYC"), &0, &1000000);
    assert_eq!(count, 0);
}

#[test]
fn test_get_historical_data_invalid_range() {
    let (_, client, admin) = setup();
    client.initialize(&admin, &None);
    let result = client.try_get_historical_data(&str(&env, "NYC"), &1000000, &0);
    assert_eq!(result, Err(Ok(Error::InvalidTimestamp)));
}

// ── Multiple Source Types ─────────────────────────────────────────────────────

#[test]
fn test_multiple_source_types() {
    let (env, client, admin) = setup();
    client.initialize(&admin, &None);
    let satellite = Address::generate(&env);
    let ground = Address::generate(&env);
    let api = Address::generate(&env);
    
    client.add_data_source(&admin, &satellite, &str(&env, "Satellite1"), &DataSourceType::Satellite);
    client.add_data_source(&admin, &ground, &str(&env, "Ground1"), &DataSourceType::GroundStation);
    client.add_data_source(&admin, &api, &str(&env, "API1"), &DataSourceType::WeatherAPI);
    
    assert_eq!(client.get_source_count(), 3);
}

#[test]
fn test_default_threshold() {
    let (_, client, admin) = setup();
    client.initialize(&admin, &None);
    assert_eq!(client.get_threshold(), 3);
}
