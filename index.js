const weakRefMap = new WeakMap();
const symbols = {
    sinks: Symbol('sinks'),
    notify: Symbol('notify'),
    update: Symbol('update'),
    link: Symbol('link'),
    unlink: Symbol('link')
};
const computing = new Set();

export default class Signal {
    #sinks = new Set();

    constructor() {
        if (!isSignalTarget(new.target)) {
            throw new TypeError('Illegal constructor');
        }
        weakRefMap.set(this, new WeakRef(this));
    }

    * [symbols.sinks]() {
        const released = new Set();
        for (const key of this.#sinks.keys()) {
            const sink = key.deref();
            if (sink != null) {
                yield sink;
            } else {
                released.add(key);
            }
        }
        for (const key of released) {
            this.#sinks.delete(key);
        }
    }

    [symbols.notify]() {
        for (const sink of this[symbols.sinks]()) {
            sink[symbols.notify]();
        }
    }

    [symbols.link](sink) {
        this.#sinks.add(weakRefMap.get(sink));
    }

    [symbols.unlink](sink) {
        const value = weakRefMap.get(sink);
        if (value != null) {
            this.#sinks.delete(value);
        }
    }

    sinks() {
        return this[symbols.sinks]();
    }

    static unwrapper(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('Invalid parameter 1: not a function');
        }
        return function (...signals) {
            return Function.prototype.apply.call(callback, this, signals.map(signal => signal.get()));
        };
    }
}

export class State extends Signal {
    #value;

    constructor(value) {
        super();
        this.#value = value;
    }

    [symbols.update]() {
        return this.#value;
    }

    get() {
        return this.#value;
    }

    set(value) {
        if (!Object.is(this.#value, value)) {
            this.#value = value;
            this[symbols.notify]();
        }
    }
}

export class Computed extends Signal {
    #get;
    #state;
    #value;
    #signals;
    #signalMap = new Map();
    #callback;

    constructor(...signals) {
        super();
        if (signals.length < 1) {
            throw new TypeError(`Failed to construct 'Signal.Computed': 1 argument required, but only 0 present.`);
        }
        this.#callback = signals.pop();
        if (typeof this.#callback !== 'function') {
            throw new TypeError(`Failed to construct 'Signal.Computed': parameter ${signals.length + 1} is not a function.`);
        }
        this.#signals = signals;
        signals.forEach((signal, index) => {
            if (!(signal instanceof Signal)) {
                throw new TypeError(`Failed to construct 'Signal.Computed': parameter ${index + 1} is not a Signal.`);
            }
            if (!this.#signalMap.has(signal)) {
                const value = signal[symbols.update]();
                this.#signalMap.set(signal, value);
                signal[symbols.link](this);
            }
        });
        this.#compute();
    }

    #fresh() {
        return this.#get();
    }

    #dirty() {
        this[symbols.update]();
        return this.#get();
    }

    #return() {
        return this.#value;
    }

    #throw() {
        throw this.#value;
    }

    #update() {
        const updates = new Map();
        for (const [signal, lastValue] of this.#signalMap.entries()) {
            const value = signal[symbols.update]();
            if (!Object.is(value, lastValue)) {
                updates.set(signal, value);
            }
        }
        for (const [signal, value] of updates) {
            this.#signalMap.set(signal, value);
        }
        if (updates.size > 0) {
            this.#compute();
        } else if (!computing.has(this)) {
            this[symbols.update] = this.#state = this.#fresh;
        }
        return this.#value;
    }

    #compute() {
        if (computing.has(this)) {
            return;
        }
        computing.add(this);
        this[symbols.update] = this.#state = this.#fresh;
        try {
            this.#value = this.#callback(...this.#signals);
            this.#get = this.#return;
        } catch (e) {
            this.#value = e;
            this.#get = this.#throw;
        } finally {
            computing.delete(this);
        }
    }

    [symbols.notify]() {
        if (!computing.has(this) && this.#state === this.#fresh) {
            this.#state = this.#dirty;
            this[symbols.update] = this.#update;
            super[symbols.notify]();
        }
    }

    get() {
        return this.#state();
    }
}

Object.defineProperties(Signal, {
    State: {
        configurable: true,
        enumerable: true,
        value: State
    },
    Computed: {
        configurable: true,
        enumerable: true,
        value: Computed
    }
});

function * prototypeChain(object) {
    if (object !== Object(object)) {
        return;
    }
    while (object != null) {
        yield object;
        object = Object.getPrototypeOf(object);
    }
}

const extensible = new Set([State, Computed]);

function isSignalTarget(target) {
    for (const Class of prototypeChain(target)) {
        if (extensible.has(Class)) {
            return true;
        }
    }
    return false;
}

export class Sink {
    #signals;
    #callback;
    #signalMap = new Map();
    #scheduled = false;
    #task = this.#run.bind(this);

    constructor(...signals) {
        if (signals.length < 1) {
            throw new TypeError(`Failed to construct 'Signal.Computed': 1 argument required, but only 0 present.`);
        }
        this.#callback = signals.pop();
        if (typeof this.#callback !== 'function') {
            throw new TypeError(`Failed to construct 'Signal.Computed': parameter ${signals.length + 1} is not a function.`);
        }
        weakRefMap.set(this, new WeakRef(this));
        this.#signals = signals;
        signals.forEach((signal, index) => {
            if (!(signal instanceof Signal)) {
                throw new TypeError(`Failed to construct 'Signal.Computed': parameter ${index + 1} is not a Signal.`);
            }
            if (!this.#signalMap.has(signal)) {
                const value = signal[symbols.update]();
                this.#signalMap.set(signal, value);
                signal[symbols.link](this);
            }
        });
    }

    #run() {
        this.#scheduled = false;
        const updates = new Map();
        for (const [signal, lastValue] of this.#signalMap.entries()) {
            const value = signal[symbols.update]();
            if (!Object.is(value, lastValue)) {
                updates.set(signal, value);
            }
        }
        for (const [signal, value] of updates) {
            this.#signalMap.set(signal, value);
        }
        if (updates.size > 0) {
            this.#execute();
        }
    }

    #execute() {
        try {
            this.#callback?.(...this.#signals);
        } catch (e) {
            console.error(e);
        }
    }

    [symbols.notify]() {
        this.#update();
    }

    #update() {
        if (!this.#scheduled) {
            this.#scheduled = true;
            queueMicrotask(this.#task);
        }
    }

    update() {
        this.#update();
    }

    destroy() {
        for (const signal of this.#signalMap.keys()) {
            signal[symbols.unlink](this);
        }
        weakRefMap.delete(this);
        this.#callback = null;
        this.#signalMap.clear();
        this.#signals.length = 0;
    }

    get destroyed() {
        return this.#callback == null;
    }
}
