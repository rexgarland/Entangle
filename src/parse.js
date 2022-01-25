import yaml from "js-yaml";
import CoffeeScript from "coffeescript";
import { remark } from "remark";
import remarkRehype from "remark-rehype";
import rehypeStringify from 'rehype-stringify'
import { VFile } from "vfile";

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import Handlebars from "handlebars";

import fs from 'fs'
import path from 'path'

import { trimChars, merge, hash } from "./utils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));

export function split(entangleText) {
	const [a, b, c] = entangleText.split("\n---\n");
	const content = a;
	const config = yaml.load(b);
	const code = CoffeeScript.compile(c, { bare: true });
	return { content, config, code };
}

function parseVariables(markdown) {
	const variables = {}
	for (var match of markdown.matchAll(/\`[^`]*\$\{([^\}]+)\}[^`]*\`/g)) {
		const literal = match[0];
		const name = match[1];
		variables[name] = {
			literal,
			location: [match.index, match.index + literal.length],
		};
	}
	return variables
}

function parseConfig(config) {
	// append config data to the variables already found in the content section
	const data = {}
	for (const variable of Object.keys(config)) {
		data[variable] = {
			...data[variable],
			...config[variable],
		};
	}
	return data;
}

const TO_PREPEND_WITH_DATA = ["min", "max", "step", "format"];
const TO_EXCLUDE = ["literal", "location","initial"];

function renderContent(markdown) {
	// create html from markdown
	return (variables, id) => {
		// create spans
		const spans = {};
		Object.keys(variables).forEach((varName) => {
			const attrs = variables[varName];
			const literal = trimChars("`")(attrs.literal);
			const innerHTML = literal.replace(/\$\{[^\}]+\}/, "");
			const attributes = {};
			Object.keys(attrs).forEach((attr) => {
				var key = attr;
				if (TO_EXCLUDE.includes(attr)) {
					return;
				}
				if (TO_PREPEND_WITH_DATA.includes(attr)) {
					key = "data-" + attr;
				}
				attributes[key] = attrs[attr];
			});
			const attributesString = Object.keys(attributes)
				.map((key) => `${key}="${attributes[key]}"`)
				.join(" ");
			spans[varName] = `<span data-var="${varName}" ${attributesString}>${innerHTML}</span>`;
			markdown = markdown.replace(
				new RegExp(`\`[^\`]*\\$\\{${varName}\\}[^\`]*\``),
				// spans[varName]
				`\{\{\{${varName}\}\}\}`
			);
		});

		var markup = String(remark().use(remarkRehype).use(rehypeStringify).processSync(markdown));
		const template = Handlebars.compile(markup)
		var markup = template(spans)

		return `<div id="${id}" class="Tangle">`+markup+'</div>'
	};
}

function renderCode(code) {
	// return the initial object (based on the data) and the updater function
	// returned as javascript code strings
	return (data, id) => {
		const initialObj = {};
		Object.keys(data)
			.filter((k) => "initial" in data[k])
			.forEach((k) => {
				const d = data[k];
				initialObj[k] = d.initial;
			});
		const initial = "const initial=" + JSON.stringify(initialObj);
		const context = { initial, updater: code.replace(/update/g,'updater'), id };
		// render js
		const jsSource = fs.readFileSync(
			path.join(__dirname, "../templates/example.template.js"),
			"utf8"
		);
		const jsTemplate = Handlebars.compile(jsSource);
		const script = jsTemplate(context);
		return script
	};
}

export function parse(entangle) {
	const { content, config, code } = split(entangle);
	const variables = parseVariables(content);
	const variableConfig = parseConfig(config);
	const variableData = merge(variables, variableConfig);
	const id = hash(entangle,4);
	const html = renderContent(content)(variableData,id);
	const javascript = renderCode(code)(variableData,id);
	return { html, javascript, id };
}
