import { suite, test } from 'mocha';
import assert from 'node:assert';
import Signal from '../index.js';

suite('Signal', () => {
    test('.constructor()', function () {
        assert.throws(() => { new Signal(); }, TypeError, 'Illegal constructor');
        class Bad extends Signal {}
        assert.throws(() => { new Bad(); }, TypeError, 'Illegal constructor');
    });
});

suite('Signal.State', () => {
    test('.constructor()', function () {
        assert.doesNotThrow(() => { new Signal.State(); });
        assert.doesNotThrow(() => { new Signal.State(true); });
        assert.doesNotThrow(() => { new Signal.State(Symbol('test')); });
        assert.doesNotThrow(() => { new Signal.State(5.5); });
        assert.doesNotThrow(() => { new Signal.State('string'); });
        assert.doesNotThrow(() => { new Signal.State(Object.create(null)); });
        assert.doesNotThrow(() => { new Signal.State(Signal.State); });
        let called = 0;
        class CustomState extends Signal.State {
            constructor(...args) {
                super(...args);
                ++called;
            }
        }
        assert.doesNotThrow(() => { new CustomState(5); });
        assert.strictEqual(called, 1);
    });
    test('.get()', function () {
        const signal_und = new Signal.State();
        assert.strictEqual(signal_und.get(), void 0);

        const symbol = Symbol('test');
        const signal_symbol = new Signal.State(symbol);
        assert.strictEqual(signal_symbol.get(), symbol);

        const object = {};
        const signal_object = new Signal.State(object);
        assert.strictEqual(signal_object.get(), object);
    });
    test('.set()', function () {
        const signal = new Signal.State();
        assert.strictEqual(signal.get(), void 0);
        const symbol = Symbol('test');
        signal.set(symbol);
        assert.strictEqual(signal.get(), symbol);
        const object = {};
        signal.set(object);
        assert.strictEqual(signal.get(), object);
        signal.set(null);
        assert.strictEqual(signal.get(), null);
        signal.set();
        assert.strictEqual(signal.get(), void 0);
    });
    test('extends', function () {
        let called = 0;
        class CustomState extends Signal.State {
            constructor(...args) {
                super(...args);
                ++called;
            }
        }
        const signal = new CustomState();
        assert.strictEqual(called, 1);
        assert.strictEqual(signal.get(), void 0);
        const symbol = Symbol('test');
        signal.set(symbol);
        assert.strictEqual(signal.get(), symbol);
        const object = {};
        signal.set(object);
        assert.strictEqual(signal.get(), object);
        signal.set(null);
        assert.strictEqual(signal.get(), null);
        signal.set();
        assert.strictEqual(signal.get(), void 0);
    });
});

suite('Signal.Computed', function () {
    test('.constructor()', function () {
        assert.throws(() => { new Signal.Computed(); }, TypeError);
        assert.throws(() => { new Signal.Computed(null); }, TypeError);
        assert.throws(() => { new Signal.Computed(Symbol('test')); }, TypeError);
        assert.throws(() => { new Signal.Computed(true); }, TypeError);
        assert.throws(() => { new Signal.Computed(5); }, TypeError);
        assert.throws(() => { new Signal.Computed('string'); }, TypeError);
        assert.throws(() => { new Signal.Computed({}); }, TypeError);
        let called = 0;
        let signal;
        assert.doesNotThrow(() => { signal = new Signal.Computed(() => ++called); });
        assert.strictEqual(called, 1);
        assert.throws(() => { new Signal.Computed(signal); }, TypeError);
        assert.throws(() => { new Signal.Computed(signal, void 0); }, TypeError);
        assert.throws(() => { new Signal.Computed(signal, null); }, TypeError);
        assert.throws(() => { new Signal.Computed(signal, Symbol('test')); }, TypeError);
        assert.throws(() => { new Signal.Computed(signal, true); }, TypeError);
        assert.throws(() => { new Signal.Computed(signal, 5); }, TypeError);
        assert.throws(() => { new Signal.Computed(signal, 'string'); }, TypeError);
        assert.throws(() => { new Signal.Computed(signal, {}); }, TypeError);
        assert.throws(() => { new Signal.Computed({}, () => {}); }, TypeError);
        assert.throws(() => { new Signal.Computed(() => {}, () => {}); }, TypeError);
        assert.strictEqual(called, 1);
    });
    test('connection', function () {
        const isEven = { called: 0 };
        const parity = { called: 0 };
        const counter = new Signal.State(0);
        assert.doesNotThrow(() => {
            isEven.signal = new Signal.Computed(counter, c => {
                isEven.called++;
                return (c.get() & 1) === 0;
            });
        });
        assert.doesNotThrow(() => {
            parity.signal = new Signal.Computed(isEven.signal, e => {
                parity.called++;
                return e.get() ? 'even' : 'odd';
            });
        });
        assert.strictEqual(isEven.called, 1);
        assert.strictEqual(parity.called, 1);
        counter.set(counter.get() + 1);
        assert.strictEqual(isEven.called, 1);
        assert.strictEqual(parity.called, 1);
        assert.strictEqual(isEven.signal.get(), false);
        assert.strictEqual(parity.signal.get(), 'odd');
        assert.strictEqual(isEven.called, 2);
        assert.strictEqual(parity.called, 2);
        counter.set(counter.get() + 2);
        assert.strictEqual(isEven.called, 2);
        assert.strictEqual(parity.called, 2);
        assert.strictEqual(isEven.signal.get(), false);
        assert.strictEqual(parity.signal.get(), 'odd');
        assert.strictEqual(isEven.called, 3);
        assert.strictEqual(parity.called, 2);
        counter.set(counter.get() + 1);
        assert.strictEqual(isEven.called, 3);
        assert.strictEqual(parity.called, 2);
        assert.strictEqual(isEven.signal.get(), true);
        assert.strictEqual(parity.signal.get(), 'even');
        assert.strictEqual(isEven.called, 4);
        assert.strictEqual(parity.called, 3);
        assert.strictEqual(parity.signal.get(), 'even');
        assert.strictEqual(isEven.signal.get(), true);
        assert.strictEqual(isEven.called, 4);
        assert.strictEqual(parity.called, 3);
        counter.set(counter.get() + 2);
        assert.strictEqual(isEven.called, 4);
        assert.strictEqual(parity.called, 3);
        assert.strictEqual(parity.signal.get(), 'even');
        assert.strictEqual(isEven.called, 5);
        assert.strictEqual(parity.called, 3);
        assert.strictEqual(isEven.signal.get(), true);
        assert.strictEqual(isEven.called, 5);
        assert.strictEqual(parity.called, 3);
    });
    test('exception', function () {
        const a = new Signal.State(0);
        class CustomError extends Error {};
        let init = false;
        const b = new Signal.Computed(a, () => { if (!init) { init = true; return 42; } throw new CustomError('test'); });
        assert.doesNotThrow(() => { b.get(); });
        assert.strictEqual(b.get(), 42);
        assert.doesNotThrow(() => { a.set(a.get() + 1); });
        assert.throws(() => { b.get(); }, CustomError, 'test');
    });
    test('circular', function () {
        const a = new Signal.State(17);
        const b = new Signal.Computed(a, a => a.get() * 2);
        let init = false;
        const c = new Signal.Computed(b, b => {
            if (!init) {
                init = true;
                return b.get().toString(16);
            }
            a.set(a.get() + 1);
            return `${b.get().toString(16)}: ${c.get()}`;
        });
        assert.strictEqual(c.get(), '22');
        assert.strictEqual(c.get(), '22');
        a.set(a.get() + 1);
        assert.strictEqual(c.get(), '26: 22');
        assert.strictEqual(c.get(), '26: 22');
        a.set(a.get() + 2);
        assert.strictEqual(c.get(), '2c: 26: 22');
        assert.strictEqual(c.get(), '2c: 26: 22');
        a.set(a.get() + 3);
        assert.strictEqual(c.get(), '34: 2c: 26: 22');
        assert.strictEqual(c.get(), '34: 2c: 26: 22');
    });
    test('circular symetric', function () {
        const called = {
            a: 0,
            b: 0,
            c: 0
        };
        const immediate = {
            a: true,
            b: true,
            c: true
        };
        const counter = new Signal.State(0);
        const a = new Signal.Computed(counter, () => {
            ++called.a;
            if (immediate.a) {
                immediate.a = false;
                return counter.get();
            }
            counter.set(counter.get() + 1);
            // eslint-disable-next-line no-use-before-define
            return counter.get() + a.get() + b.get() + c.get();
        });
        const b = new Signal.Computed(counter, a, () => {
            ++called.b;
            if (immediate.b) {
                immediate.b = false;
                return counter.get();
            }
            counter.set(counter.get() + 1);
            // eslint-disable-next-line no-use-before-define
            return counter.get() + a.get() + b.get() + c.get();
        });
        const c = new Signal.Computed(counter, a, b, () => {
            ++called.c;
            if (immediate.c) {
                immediate.c = false;
                return counter.get();
            }
            counter.set(counter.get() + 1);
            return counter.get() + a.get() + b.get() + c.get();
        });
        debugger;
        assert.strictEqual(called.a, 1);
        assert.strictEqual(called.b, 1);
        assert.strictEqual(called.c, 1);
        counter.set(counter.get() + 1);
        assert.strictEqual(a.get(), 13);
        assert.strictEqual(called.a, 2);
        assert.strictEqual(called.b, 2);
        assert.strictEqual(called.c, 2);
        assert.strictEqual(b.get(), 7);
        assert.strictEqual(called.a, 2);
        assert.strictEqual(called.b, 2);
        assert.strictEqual(called.c, 2);
        assert.strictEqual(c.get(), 4);
        assert.strictEqual(called.a, 2);
        assert.strictEqual(called.b, 2);
        assert.strictEqual(called.c, 2);
        assert.strictEqual(a.get(), 13);
        assert.strictEqual(b.get(), 7);
        assert.strictEqual(c.get(), 4);
        assert.strictEqual(called.a, 2);
        assert.strictEqual(called.b, 2);
        assert.strictEqual(called.c, 2);
        counter.set(counter.get() + 1);
        assert.strictEqual(a.get(), 110);
        assert.strictEqual(called.a, 3);
        assert.strictEqual(called.b, 3);
        assert.strictEqual(called.c, 3);
        assert.strictEqual(b.get(), 59);
        assert.strictEqual(called.a, 3);
        assert.strictEqual(called.b, 3);
        assert.strictEqual(called.c, 3);
        assert.strictEqual(c.get(), 32);
        assert.strictEqual(called.a, 3);
        assert.strictEqual(called.b, 3);
        assert.strictEqual(called.c, 3);
    });
    (typeof globalThis.gc !== 'function' ? test.skip : test)('garbage collection', function (done) {
        let called = 0;
        const signals = {
            a: new Signal.State(0)
        };
        signals.b = new Signal.Computed(signals.a, () => ++called);
        const wb = new WeakRef(signals.b);
        delete signals.b;
        globalThis.gc();
        setTimeout(() => {
            globalThis.gc();
            signals.a.set(signals.a.get() + 1);
        }, 10);
        setTimeout(() => {
            try {
                assert(wb.deref() == null, `wb.deref() == null`);
                assert.strictEqual([...signals.a.sinks()].length, 0);
                done();
            } catch (e) {
                done(e);
            }
        }, 20);
    });
});
