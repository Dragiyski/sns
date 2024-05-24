import { suite, test } from 'mocha';
import assert from 'node:assert';
import { Sink } from '../index.js';

suite('Sink', () => {
    test('.constructor()', function () {
        assert.throws(() => { new Sink(); }, TypeError);
        class ExtendSink extends Sink {}
        assert.throws(() => { new ExtendSink(); }, TypeError);
    });
    test('empty', function () {
        let sink;
        let called = 0;
        const fun = () => { called++; };
        assert.doesNotThrow(() => {
            sink = new Sink(fun);
        });
        assert(sink instanceof Sink, `sink instanceof Sink`);
        assert.strictEqual(called, 0);
    });
});
