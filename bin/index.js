#!/usr/bin/env node

import {program} from 'commander'
import path from 'path'

import entangle from 'entangle-standalone'

program
.arguments('<source>')
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
	entangle(source, outFile)
})
.parse(process.argv);
