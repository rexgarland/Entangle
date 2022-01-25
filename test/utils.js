import assert from 'assert'

import { merge, hash } from '../src/utils.js'

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

it('hash', () => {
	const text = 'hello there'
	const h1 = hash(text)
	const h2 = hash('another')
	const h3 = hash(text)
	assert.notEqual(h1, h2)
	assert.equal(h1, h3)
	assert.equal(h1.length, 8)

	const h4 = hash(text, 4)
	assert.equal(h4.length, 4)
})