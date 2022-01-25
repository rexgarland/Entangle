import assert from 'assert'

import { merge } from '../src/utils.js'

it('merge', () => {
	const obj1 = {
		a: {b: 1}
	}
	const obj2 = {
		a: {c:2},
		d: {e:1}
	}
	const obj3 = {
		a: {b:1,c:2},
		d: {e:1}
	}
	assert.deepEqual(merge(obj1, obj2), obj3)
})