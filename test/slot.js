import { suite, test } from 'mocha';
import assert from 'node:assert';
import { Slot } from '../index.js';

suite('Slot', () => {
    test('.constructor()', function () {
        assert.throws(() => { new Slot(); }, TypeError);
        class ExtendSlot extends Slot {}
        assert.throws(() => { new ExtendSlot(); }, TypeError);
    });
    test('empty', function () {
        let slot;
        let called = 0;
        const fun = () => { called++; }
        assert.doesNotThrow(() => {
            slot = new Slot(fun);
        });
        assert(slot instanceof Slot, `slot instanceof Slot`);
    });
});
