# Signals and Sinks

Signals and Sinks (S'n'S) is a library for live values inspired by the TC39 proposal for signals as JavaScript/ECMAScript feature. I believe such feature can be a library, so I have written a small library to demonstrate that.

A signal (live value) can be either a `State` wrapping any JavaScript value or `Computed` - the return value a function, that depend on one more values. The return values cannot be changed directly. Upon changing the value of a `State` signal, all `Computed` signals that depends on the changed `State` even indirectly, would be updated. The update is lazy, so the performance of `State.set` does not depend on user code and the `Computed.get` will only execute its callback if any dependent value have changed (detected by `Object.is`). This allow `Computed` values to behave as live values, without affecting the performance of the application.

A `Sink` is an observe of signals and will call its function every time any of its dependent signals have changed. The call will happen only once per microtask and it will never happen in the same microtask as the change of the signal. This means you can change signals multiple times synchronously, while the `Sink` will be called only once. This also means, if a signal is changed, but the change is reverted in the same microtask, the `Sink` callback won't be called.  

Signals and Sinks is not compatible with the TC39 proposal, but semantically it can do everything the proposal includes. However, because it is a library, certain aspects differs from the language feature, namely:

1. `Signal.Computed` must explicitly list all signals it depends as its first parameter (and provide the callback in its last parameter).
2. There is no global `Watcher` for signals.
3. The `effect` function is a `Sink` object. The reason for using an object is because `Sink` will keep strong references to its dependent signals, if the `Sink` need to be stopped, this can be done by a `destroy` method instead of waiting for garbage collection. Explicitly removing signals observers can be a useful feature to the performance.

# Usage

## Live values

When an imperative programming language assigns a variables, the assigned value is just a snapshot, the formula it was assigned from does not persist. For example:

```javascript
let a = 2;
let b = 3;
let c = a + b;
console.log(c); // 5 === a + b
b = 7; // b is updated
console.log(c); // 5 !== a + b
```

For the most part this is desirable behavior, as every variable is associated with its value, not with how the value it is derived from. However, sometimes we need live values, that are associated with their derived formula, rather than their current value. This is solved by associating the variable with a formula (function return value) and the variable it depend upon (function arguments).

```javascript
const sum = (a, b) => a + b;
const a = new Signal.State(2);
const b = new Signal.State(3);
const c = new Signal.Computed(a, b, Signal.unwrapper(sum));
console.log(c.get()); // 5 == a + b
b.set(7);
console.log(c.get()); // 9 == a + b
```
In this case, three signals are created. The first 2 signals are `State`, which is just wrapper for any JavaScript value. The `State` is writable value, it can be read or updated.

The `c` variable contains a computed signal. It is the result of a formula, which in imperative terms means the result of execution a function. However, `c` is not merely a snapshot, it is reactive to change in its parameters, in this case `a` and `b`. When `b` is updated to `7`, `c` is updated to `9`. All reactions are synchronous and lazy.

* Synchronous: The value of `c` will react immediately upon the value of `a` or `b` is set. This will happen after the `.set` method returns. No need to wait for the next microtask.
* Lazy: The callback of `c` won't be executed until `c.get()` is called. Instead `b.set()` only change the state of `c` from `fresh` to `dirty`. If the value of `c` is never retrieved, the callback won't be called.

## TC39 example

One aspect of efficient reactive implementation is the ability to minimize calling user function on the graph, when that is unnecessary. In the TC39 proposal currently there is an example like that:

```javascript
const counter = new Signal.State(0);
const isEven = new Signal.Computer(() => (counter.get() & 1) == 0);
const parity = new Signal.Computed(() => isEven.get() ? "even" : "odd");

declare function effect(cb: () => void): (() => void);

effect(() => element.innerText = parity.get());

setInterval(() => counter.set(counter.get() + 1), 1000);
```

Let convert that code to work for this library and fix some aspects:

```javascript
const counter = new Signal.State(0);
const isEven = new Signal.Computed(counter, () => (counter.get() & 1) === 0);
const parity = new Signal.Computed(isEven, () => isEven.get() ? 'even' : 'odd');

const effect = new Sink(parity, element.innerText = parity.get());

counter.set(counter.get() + 1);
console.log(parity.get()); // Calls isEven and parity callback
counter.set(counter.get() + 2);
console.log(parity.get()); // Calls only isEven callback
```

Let observer how this work and notice the similarities and the differences between the proposal and this library.

**Difference 1**: Signals upon a signal or sink depends are explicitly declared. The proposal itself declare that the values form directed acyclic graph (DAG). However, it is unclear from the proposal how such graph is formed, because a computed signal must know to which signals to react. That is `Signal.Computed` must somehow know that it uses `counter` and that `counter` is a signal. However, due to the dynamic nature of JavaScript, the former is only known at compile time of the function (which is still done in the runtime), while the latter is only known during the execution of `counter.get`, which can be within an `if/else` statement. In this library we explicitly state the dependent signals as parameters to `Signal.Computed`, but the disadvantage is, it is possible the callback to access a signal it did not declare as dependent and thus not be reactive to it. While we do not know when this would be useful, this could actually be a feature, allowing the user of this library to explicitly omit a signal from dependent list even if they are present in the callback.

**Similarity 1**: Execution of the `Signal.Computed` callbacks are lazy. The statement `counter.set(counter.get() + 1)` do not execute `isEven` and `parity` callbacks.

**Similarity 2**: The statement `counter.set(counter.get() + 2)` will cause `isEven` to become `dirty`, which will cause `parity` to become dirty. However `parity.get()` won't execute the parity callback, because its dependent signal `isEven` did not change its value. Namely, if the counter was at `2` before and now it is `4`, the previous value of `isEven` was `true` and the return value of the callback is also `true`, thus no dependent signals of `parity` changed its values.

**Similarity 3**: The effect of changing `parity` will be applied to the `element` by updating its `innerText`.

**Difference 2**: The effect of changing `parity` won't be applied to the `element` synchronously. That is, the `element.innerText` will be updated in the next microtask. This is sufficiently close execution for updating UI elements or other reactions, while preventing circular executions misuse. This also means `parity` can be changed multiple times in a single microtask execution and the UI reaction will only run if the `parity` ends up with different value after the microtask.

**Difference 3**: The owner of the `effect` variable can call `effect.destroy()` which will cause the `Sink` to remove its dependent signals and it callback and it will never be invoked again, thus safe for garbage collection.

# Memory consideration

Every `Signal.State` will have strong reference to the value it currently wraps (only relevant if it is an object). Calling `.set()` to change the value will remove the reference of the value it was holding and add reference to the new value.

Every `Signal.Computed` will hold strong reference to all its dependent signals and the callback.

Every `Signal.State` and `Signal.Computed` will hold weak references to the signals and sinks that depend upon this signal.

Since `Signal.Computed` will never invoke its callback unless explicitly called with `.get()`, the `Signal.Computed` do not need special considerations for destructions and can be safely unreferenced to be collected by the garbage collector (just as any other javascript object).

The `Sink` objects will execute their callback when their dependent signals change value, thus they require special considerations. If unreferenced, they will eventually be garbage collected, but until then the callback will continue to be called. Moreover, since each time a dependent signals is notified, it will temporarily obtain strong reference to the `Sink` thus promoting to newer space, making it less likely to be garbage collected. The strong reference will not be kept, thus garbage collection is still possible, but unlikely. To ensure `Sink` is safe for garbage collection, keep a reference to the alive `Sink` objects, and call `.destroy()` when those objects are not longer required.

# Circular References Consideration

The idea behind `Signal.Computed` is to be able to specify predefined functions.

```javascript
function foo(a, b, c) {
    /* Do something funny */
    return /* Something useful */;
}

const boo = new Signal.Computed(s1, s2, s3, foo);
const goo = new Signal.Computed(g1, g2, g3, foo);
```

In this case both `boo` and `goo` will have the same callback, but will react to different signals, thus call `foo` with different arguments. By passing the dependent signals as function arguments in the same order the signals were specified, the code of `foo` can be independent of its dependent signals (or if `Signal.unwrapper` is used, it can be independent from the signal library altogether).

However, in the examples above we specified a callback function directly as parameter:

```javascript
const boo = new Signal.Computed(s1, s2, s3, function foo() { /* ... */ });
```

Doing so, `foo` can access signals by closure as `foo` is declared in the same scope where `s1`, `s2` and `s3` are visible. In this, case the dependent signals can be used directly without using the function arguments.

However, this means the callback of a `Signal.Computed` can modify its dependent signals during evaluation. While this is not a good practice, this library have explicitly declared behavior for such operation, namely:

1. `foo` won't be called again recursively by the signal library.
2. Calling `this.get()` in `foo` will be `undefined` upon creation of `boo`.
3. The variable `boo` won't exist during the first evaluation `foo`.
4. Calling `boo.get()` or `this.get()` from within `foo` will return the currently known value of `boo` even if it is `dirty`. This means, the `boo` won't be updated until the `foo` returns.

In other words, a signal is updated by its callback function. From within the callback function, the value of the signal would appear as not yet updated, even if its dependent signals have new value.

# Exception handling

If a `Signal.Computed` callback throws an exception, the exception will be stored as a signal state. Since the callback is only called in response to `.get()` that exception will be thrown from that method. However, the exception itself might be from a callback of dependent signal, as `Signal.Computed` might depend on other `Signal.Computed` signals. In the latter case, the signal won't be updated, it will remain `dirty` and will continue to throw an exception until the `Signal.Computed` that caused the exception is updated.

Note that signals use `try/catch` to recognize when an exception is thrown or returned. Returning `new Error()` object won't be considered an exception and it will become a value of the state. The `.get()` will always return if the callback returns and it will only throw if any callback throws.

# Future improvements

## Async Signals

Current signals are updated synchronously. An `AsyncSignal.Computed` will accepted an awaitable function (i.e. one that can return a promise/thenable) and wait for the result before proceeding.

## Pluggable comparator

Currently the value of the signal is checked for updates using `Object.is`. This is better than `===` operator, as it does everything `===`, but properly handles `NaN` (updating `NaN` to `NaN` won't cause recomputation). The only caveat is, it does not distiguish between `+0.0` and `-0.0`, we could potentially check for this case manually, but the performance impact is not worth it.

However, it is possible `Object.is` is not good enough and certain users might want to plug their own comparison function. However, the current interface of `Signal` and `Sink` do not support `options` parameter.

# Reference

## Signal

Base class for a signal. Used for `instanceof` checks. Not extensible.

### Signal.sinks()

Return an iterator of the signals and sinks that depend upon the current signal. Immutable, but the amount of return sinks will be reduced by the garbage collector.

## Signal.State extends Signal

A wrapper for mutable value. The `Signal.State` is always `fresh` as wrapped value always match the value retrieved by `.get()`. This is an extensible class.

### constructor(value)

Creates a `Signal.State` initializing its initial value to `value`.

### .get()

Retrieve the value of the state signal.

### .set(value)

Sets the signal value to `value` and notify all dependent sinks transitively.

## Signal.Computed extends Signal

A wrapper for computed value.

### constructor(...signals, callback)

Given 0 or more signals and a callback, create a `Signal.Computed`. The signal would check for updates every time the value is retrieved by `.get()` and one of the specified dependent signals gets an update. If a dependent signal value is different from the currently known value, the `callback` will be called to recomputed the signal value.

The constructor will also call the `callback` synchronously before it returns to compute the initial value. This is subject to change once a better method for handling the initial undefined state is found.

The constructor will not throw even if the `callback` throws.

**Note**: The inital value consideration handles special case where the signal do not know its value and its dependent signal values. Even when start at a `dirty` state, it is not guarantee that it will be properly processed. A better method can be found to handle the initial state cleanly without loss of performance, in which case the `callback` will only be called upon the `.get()` method. This is currently work in progress.

### .get()

Retrieve the value of the signal. If the signal is `dirty` update the value of its dependent signals, and if there is an update, calls the callback to recompute the signal value.

## Sink

Gets a notification every time a signal is updated.

### constructor(...signals, callback)

Same interface as `Signal.Computed`. However the `callback` is not initially called. The callback will be called **after** one or more of its dependent signals are updated to a new value.

**Note**: The return value of the `callback` is ignored. Unhandled exceptions within the `callback` will be printed to the console.

### update()

Schedule a re-check of the dependent signals.

### destroy()

Detach all dependent signals and makes the object safe for garbage collection. No more invocation of the `callback` will be made.

### destroyed

`true` if the sink is destroyed, `false` otherwise.