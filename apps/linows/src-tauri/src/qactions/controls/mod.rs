//! Per-control adapters. One file per control, all of its OS-specific code
//! quarantined inside (see docs/writing-controls.md). `bluetooth` is the
//! reference implementation to copy.

pub mod battery;
pub mod bluetooth;
pub mod keepawake;
pub mod mic;
pub mod power;
pub mod screensaver;
pub mod theme;
pub mod wifi;
