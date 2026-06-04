# Weather Data Oracle Contract

A production-ready weather data oracle contract for Soroban that provides reliable, tamper-resistant weather data for applications like insurance protocols and weather derivatives.

## Features

- **Multiple Data Source Types**: Supports satellite, ground station, and weather API data sources
- **Data Verification**: Multi-source confirmation system with configurable verification thresholds
- **Outlier Detection**: Configurable thresholds to detect and reject anomalous weather data
- **Circuit Breaker**: Emergency stop mechanism to halt data submission during attacks or anomalies
- **Comprehensive Validation**: Validates all weather parameters (temperature, humidity, pressure, wind, precipitation)
- **Event Emissions**: Events for data submission, verification, circuit breaker activation, and more
- **Pause/Unpause**: Admin controls to temporarily pause contract operations

## Data Types

### WeatherData
- `location`: String identifier for the location
- `latitude/longitude`: Coordinates (scaled by 10000 for precision)
- `temperature`: Temperature in Celsius * 100 (e.g., 2345 = 23.45°C)
- `humidity`: Humidity percentage * 100 (e.g., 6500 = 65.00%)
- `pressure`: Atmospheric pressure in hPa * 10 (e.g., 10132 = 1013.2 hPa)
- `wind_speed`: Wind speed in km/h * 10 (e.g., 125 = 12.5 km/h)
- `wind_direction`: Wind direction in degrees (0-359)
- `precipitation`: Precipitation in mm * 10 (e.g., 55 = 5.5 mm)
- `timestamp`: Unix timestamp of the observation
- `status`: Pending, Verified, Disputed, or Finalized
- `submitter`: Address of the data source
- `confirmations`: Number of source confirmations
- `source_type`: Satellite, GroundStation, or WeatherAPI

## Contract Functions

### Initialization

#### `initialize(admin: Address, verification_threshold: Option<u32>)`
Initializes the contract with an admin address and optional verification threshold. Can only be called once.

### Data Source Management

#### `add_data_source(admin: Address, source: Address, name: String, source_type: DataSourceType)`
Adds a new trusted data source. Admin only.

#### `remove_data_source(admin: Address, source: Address)`
Deactivates a data source (soft delete). Admin only.

#### `set_verification_threshold(admin: Address, threshold: u32)`
Sets the number of confirmations required for auto-verification. Admin only.

#### `set_outlier_threshold(admin: Address, threshold: OutlierThreshold)`
Sets the outlier detection thresholds for weather parameters. Admin only.

### Weather Data Submission

#### `submit_weather_data(submitter: Address, location: String, latitude: i64, longitude: i64, temperature: i32, humidity: u32, pressure: u32, wind_speed: u32, wind_direction: u32, precipitation: u32, source_type: DataSourceType) -> u32`
Submits weather data from a registered active source. Returns the data ID.

### Data Verification

#### `confirm_weather_data(source: Address, data_id: u32)`
Confirms existing weather data. Each active source can add one confirmation. Auto-verifies when confirmations reach threshold.

#### `finalize_weather_data(admin: Address, data_id: u32)`
Finalizes verified weather data. Admin only.

### Security Controls

#### `set_circuit_breaker(admin: Address, active: bool)`
Activates or deactivates the circuit breaker. When active, blocks all data submissions. Admin only.

#### `pause(admin: Address)`
Pauses the contract. Admin only.

#### `unpause(admin: Address)`
Unpauses the contract. Admin only.

### Read Operations

#### `get_weather_data(data_id: u32) -> WeatherData`
Retrieves weather data by ID.

#### `get_historical_data(location: String, from_timestamp: u64, to_timestamp: u64) -> u32`
Returns the count of data points for a location within a time range.

#### `get_data_count() -> u32`
Returns the total number of weather data submissions.

#### `get_threshold() -> u32`
Returns the current verification threshold.

#### `is_circuit_breaker_active() -> bool`
Returns whether the circuit breaker is active.

#### `is_paused() -> bool`
Returns whether the contract is paused.

#### `get_admin() -> Address`
Returns the admin address.

#### `get_data_source(source: Address) -> DataSource`
Retrieves data source information.

#### `get_source_count() -> u32`
Returns the number of registered data sources.

#### `get_outlier_threshold() -> OutlierThreshold`
Returns the current outlier detection thresholds.

## Events

- `WeatherDataSubmitted(data_id, submitter, temperature)`
- `WeatherDataVerified(data_id)`
- `WeatherDataFinalized(data_id)`
- `CircuitBreakerActivated()`
- `CircuitBreakerDeactivated()`
- `paused(admin)`
- `unpaused(admin)`

## Security Features

### Data Validation
All weather parameters are validated against reasonable physical limits:
- Temperature: -100°C to 100°C
- Humidity: 0% to 100%
- Pressure: 500 hPa to 1200 hPa
- Wind Speed: 0 to 1000 km/h
- Wind Direction: 0 to 359 degrees
- Precipitation: 0 to 5000 mm
- Coordinates: Valid latitude (-90 to 90) and longitude (-180 to 180)

### Outlier Detection
Configurable thresholds detect anomalous data:
- Temperature min/max bounds
- Humidity min/max bounds
- Pressure min/max bounds
- Wind speed max bound

### Circuit Breaker
Emergency stop mechanism to halt all data submissions during:
- Suspected data manipulation attacks
- Malfunctioning data sources
- System anomalies

### Access Control
- Admin-only functions for sensitive operations
- Source authentication for data submission
- Active source requirement for submissions

## Usage Example

```rust
use soroban_sdk::{Address, Env};

// Initialize
let admin = Address::generate(&env);
client.initialize(&admin, &Some(3));

// Add data sources
let satellite = Address::generate(&env);
let ground = Address::generate(&env);
client.add_data_source(&admin, &satellite, &"Satellite1", &DataSourceType::Satellite);
client.add_data_source(&admin, &ground, &"Ground1", &DataSourceType::GroundStation);

// Submit weather data
let data_id = client.submit_weather_data(
    &satellite,
    &"New York",
    &407120,  // 40.7120° N
    &-740060, // 74.0060° W
    &2345,    // 23.45°C
    &6500,    // 65.00%
    &10132,   // 1013.2 hPa
    &125,     // 12.5 km/h
    &180,     // 180° (South)
    &55,      // 5.5 mm
    &DataSourceType::Satellite,
);

// Confirm from another source
client.confirm_weather_data(&ground, &data_id);

// Finalize
client.finalize_weather_data(&admin, &data_id);
```

## Testing

The contract includes comprehensive test coverage with 70+ test cases covering:
- Initialization
- Data source management
- Weather data submission
- Data validation
- Outlier detection
- Verification and finalization
- Circuit breaker functionality
- Pause/unpause operations
- Access control
- Error handling

Run tests with:
```bash
cd contracts/weather-data-oracle
cargo test
```

## Build

```bash
cd contracts/weather-data-oracle
cargo build --release
```

## Deployment

1. Build the contract: `cargo build --release`
2. Deploy to Soroban network using soroban-cli
3. Initialize with admin address
4. Add trusted data sources
5. Configure verification and outlier thresholds

## Use Cases

### Weather Derivatives
- Provide reliable temperature data for weather-based financial instruments
- Enable settlement of weather derivative contracts

### Insurance Protocols
- Supply verified weather data for parametric insurance
- Trigger automatic payouts based on weather conditions

### Agricultural Applications
- Provide historical weather data for crop insurance
- Enable weather-based smart contracts for farming

### Energy Trading
- Supply temperature data for energy demand forecasting
- Enable weather-based energy derivative settlements

## License

MIT
