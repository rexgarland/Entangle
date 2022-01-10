#!/usr/bin/env node

import {program} from 'commander'
import path from 'path'

import mangle from 'mangle-standalone'

program
	.requiredOption('-f, --file <file>', 'mangle file')
	.option('-o, --output <output>', 'html file to output')
program.parse(process.argv)
const options = program.opts()
console.log(options)

const filename = options.file
const {name, dir} = path.parse(filename)

var outFile
if (options.output) {
	outFile = options.output
} else {
	outFile = path.join(dir, name + '.html')
}

mangle(filename, outFile)