#!/usr/bin/env node

import {program} from 'commander'
import path from 'path'

import {entangle} from '../src/index.js'

program
.arguments('<source>')
.option('-s, --standalone', 'bundle resources for offline viewing')
.option('-o, --output <output>', 'html file to output')
.action(function(source, options) {

	// get out file
	const {name, dir} = path.parse(source)
	var outFile
	if (options.output) {
		outFile = options.output
	} else {
		outFile = path.join(dir, name + '.html')
	}

	// run entangle
	entangle(source, outFile, options.standalone)
})
.parse(process.argv);
