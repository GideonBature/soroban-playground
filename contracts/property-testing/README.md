# Property-Based Testing Utilities for Soroban

This package provides reusable, gas‑efficient utilities to test Soroban smart contracts using property‑based, invariant, boundary, and fuzz testing techniques.


## What is Property-Based Testing in Soroban?

Property‑based testing validates that a contract behaves correctly for a wide range of inputs, not just a small set of hand‑picked test cases. Instead of writing individual tests, you define properties (invariants) that must always hold true, then provide a collection of inputs to verify them.


## Utilities Overview

### 1. PropertyTester
Executes property tests against multiple inputs, tracking failures and iteration counts.

#### Example Usage
```rust
use soroban_sdk::{Env, String, Vec};
use property_testing::{PropertyTester, PropertyTestResult};

let env = Env::default();
let tester = PropertyTester::new(&env);

let mut inputs = Vec::new(&env);
inputs.push_back(1);
inputs.push_back(2);
inputs.push_back(3);

let result: PropertyTestResult = tester.test(inputs, |&x| {
    if x > 0 {
        Ok(())
    } else {
        Err(String::from_str(&env, "not positive"))
    }
});

assert!(result.passed);
```


### 2. InvariantChecker
Maintains and checks a collection of invariants (conditions that must always be true) during state transitions.

#### Example Usage
```rust
use soroban_sdk::{Env, String};
use property_testing::InvariantChecker;

let env = Env::default();
let mut checker = InvariantChecker::new(&env);

checker.add_invariant("always positive", || {
    // Check some state here
    Ok(())
});
checker.add_invariant("balance valid", || {
    // Another invariant
    Ok(())
});

assert!(checker.check_all().is_ok());
```


### 3. BoundaryTester
Explicitly tests boundary conditions, overflows, underflows, and edge‑case values.

#### Example Usage
```rust
use soroban_sdk::{Env, String};
use property_testing::BoundaryTester;

let env = Env::default();
let tester = BoundaryTester::new(&env);

// Test i128 boundaries
let results = tester.test_i128_boundaries(|x| {
    if x < 0 {
        Err(String::from_str(&env, "negative value"))
    } else {
        Ok(())
    }
});

// Use checked arithmetic
let sum = tester.checked_add_i128(100, 200).unwrap();
```


### 4. FuzzGenerator
Generates pseudo‑random test inputs of common Soroban types, using a deterministic seed for reproducibility.

#### Example Usage
```rust
use soroban_sdk::Env;
use property_testing::FuzzGenerator;

let env = Env::default();
let mut gen = FuzzGenerator::new(&env, 12345);

let random_u64 = gen.gen_u64();
let random_bool = gen.gen_bool();
let random_address = gen.gen_address();
let random_string = gen.gen_string(5, 15);
let random_vec = gen.gen_vec_u64(2, 10);
```


### 5. PropertyValidator
Provides simple, reusable assertions for validating runtime contract behaviors.

#### Example Usage
```rust
use soroban_sdk::{Env, String, Vec};
use property_testing::PropertyValidator;

let env = Env::default();
let validator = PropertyValidator::new(&env);

validator.assert_true(5 > 3, "5 should be bigger")?;
validator.assert_eq(2 + 2, 4, "addition is wrong")?;

let mut validations = Vec::new(&env);
validations.push_back(validator.assert_lt(10, 20, "lt failed"));
validations.push_back(validator.assert_ge(100, 0, "ge failed"));
assert!(validator.validate_all(validations).is_ok());
```


## Setup & Execution Instructions

### Installation
The package is already set up as part of the Soroban playground workspace. Just include it in your contract's Cargo.toml (for testing):
```toml
[dev-dependencies]
property-testing = { path = "../property-testing" }
```

### Running Tests
To run the test suite:
```bash
cd contracts/property-testing
cargo test
```
