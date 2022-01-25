function removeClass(name) {
	return (element) => {
		const classString = element.className;
		var classes = classString.split(' ');
		if (classes.includes(name)) {
			classes = classes.reduce((a,v)=>(v===name?a:a.concat(v)),[]);
		}
		const newString = classes.join(' ');
		element.className = newString;
	}
}

function addClass(name) {
	return (element) => {
		const classString = element.className;
		const classes = classString.split(' ');
		if (!classes.includes(name)) {
			classes.push(name);
		}
		const newString = classes.join(' ');
		element.className = newString;
	}
}

function addEvents(obj) {
	// obj has key: event-name, val: function
	return (element) => {
		Object.keys(obj).forEach(key=>{
			element.addEventListener(key, obj[key]);
		})
	}
}

function removeEvents(obj, store) {
	return (element) => {
		Object.keys(obj).forEach(key=>{
			element.removeEventListener(key, obj[key]);
		})
	}
}

function setStyles(obj) {
	return (element) => {
		Object.keys(obj).forEach(key=>{
			element.style[key] = obj[key];
		})
	}
}

module.exports = {
	removeClass,
	addClass,
	addEvents,
	removeEvents,
	setStyles
}