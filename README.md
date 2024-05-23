# Signals and Slots

Signals and Slots (S'n'S) is a library for live values inspired by the TC39 proposal for signals as JavaScript/ECMAScript feature. I believe such feature can be a library, so I have written a small library to demonstrate that.

A signal (live value) can be either a `State` wrapping any JavaScript value or `Computed` - the return value a function, that depend on one more values. The return values cannot be changed directly. Upon changing the value of a `State` signal, all `Computed` signals that depends on the changed `State` even indirectly, would be updated. The update is lazy, so the performance of `State.set` does not depend on user code and the `Computed.get` will only execute its callback if any dependent value have changed (detected by `Object.is`). This allow `Computed` values to behave as live values, without affecting the performance of the application.

A `Slot` is an observe of signals and will call its function every time any of its dependent signals have changed. The call will happen only once per microtask and it will never happen in the same microtask as the change of the signal. This means you can change signals multiple times synchronously, while the `Slot` will be called only once. This also means, if a signal is changed, but the change is reverted in the same microtask, the `Slot` callback won't be called.  

Signals and Slots is not compatible with the TC39 proposal, but semantically it can do everything the proposal includes. However, because it is a library, certain aspects differs from the language feature, namely:

1. `Signal.Computed` must explicitly list all signals it depends as its first parameter (and provide the callback in its last parameter).
2. There is no global `Watcher` for signals.
3. The `effect` function is a `Slot` object. The reason for using an object is because `Slot` will keep strong references to its dependent signals, if the `Slot` need to be stopped, this can be done by a `destroy` method instead of waiting for garbage collection. Explicitly removing signals observers can be a useful feature to the performance.
