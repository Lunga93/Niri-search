# Writing a Quick Action control

A **control** is a system feature Niri-Search can act on from its right-hand panel:
toggle Bluetooth, toggle Wi-Fi, switch appearance, and so on. This guide is for
contributors adding a new one.

The goal of the framework is that a new control is a small, mostly-declarative
contribution: **one shared descriptor, one native adapter file, one registry
line.** You never touch the panel, keyboard, or rendering code.

## How the pieces split

Reading and setting Linux system state has no single implementation
(D-Bus services, CLIs, per-compositor protocols), so we share the
*declaration* and keep the *execution* native:

| Piece | Location | Scope |
|-------|----------|-------|
| **Descriptor** — what it is: id, match, control kind, on/off labels, info fields | `core/qactions` catalog | shared |
| **Adapter** — how it runs: read + set the system state (`state()` / `apply()`) | `apps/linows/src-tauri/src/qactions/controls/<name>.rs`, each module `cfg`-gated | native |
| **Registration** — wire the adapter to its action id | `qactions/mod.rs` `adapter()` | native, one line |

A control is searchable **and** actionable from its single descriptor; you do not
separately register it with the search engine.

## File map

The files you touch are grouped together; the rest is framework you leave
alone.

You edit:

```
core/qactions/src/lib.rs                                  declare the descriptor + result binding
apps/linows/src-tauri/src/qactions/
  controls/<name>.rs                                      Linux adapter (copy bluetooth.rs)
  controls/mod.rs                                         cfg-gate the module
  mod.rs                                                  one line in adapter()
```

Framework, for reference only, do not edit:

```
apps/linows/src-tauri/src/qactions/mod.rs                 contract + Tauri commands (edit only adapter())
apps/linows/src/js/components/qactions.js                 renders controls, loads state, runs actions
```

## Steps

1. **Declare** the descriptor once in the shared `core/qactions` catalog: id,
   the control kind (toggle/button), on/off labels, and any info fields. Then
   bind the result id(s) that trigger it in `binding_for`
   (e.g. `setting:bluetooth` on Linux). The key hint is derived from the
   control kind (a toggle shows `Ctrl+O`), so you do not set it.
2. **Implement** the adapter. Copy the reference
   (`controls/bluetooth.rs`, talks to BlueZ over D-Bus), rename the type,
   and fill in `state()` and `apply(intent)` (plus `info()` if the
   descriptor declares info fields). Keep **all** system-specific code
   inside this one file.
3. **Register** it: one line in the `adapter()` match in
   `qactions/mod.rs` (`"wifi" => Some(&controls::wifi::WifiControl)`).

## Adapter contract

A control implements this shape (see
`apps/linows/src-tauri/src/qactions/mod.rs`):

- `state()` — read current state for display. Return on / off for a
  toggle, a value string for a non-boolean control, or unavailable with a
  reason when it does not apply on this machine.
- `apply(intent)` — perform the change and report the outcome. It is
  best-effort: never panic, never block the caller; surface problems as a
  failed outcome or a needs-permission outcome.
- `info(keys)` (optional) — resolve the descriptor's info `value_key`s to
  display values.

Adapters may block (D-Bus, CLIs); the commands run them on the blocking
pool.

## Reference

Read
[`bluetooth.rs`](../apps/linows/src-tauri/src/qactions/controls/bluetooth.rs)
(talks to BlueZ over D-Bus) first: a complete, commented adapter and the
template every other control follows.
