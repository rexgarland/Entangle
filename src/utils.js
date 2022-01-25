import _ from 'lodash'

export function trimChars(chars) {
	return (s) => {
		var out = s;
		while (out.length>0 && chars.includes(out[0])) {
			out = out.slice(1);
		}
		while (out.length>0 && chars.includes(out[out.length - 1])) {
			out = out.slice(0, out.length - 1);
		}
		return out;
	};
}

export function merge(obj1, obj2) {
	const obj = _.cloneDeep(obj1)
	Object.keys(obj2).forEach(key=>{
		if (obj[key]) {
			obj[key] = {
				...obj[key],
				...obj2[key]
			}
		} else {
			obj[key] = obj2[key]
		}
	})
	return obj
}