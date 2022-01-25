# Entangle

Another attempt at writing [Tangle.js](http://worrydream.com/Tangle/) documents in markdown.

The main objective here was to keep the "explanation" part as readable as possible, without loosing the power of javascript.

## Install

```shell
npm install -g entangle-doc
```

## Usage

```shell
entangle <source.entangle>
```

If you have trouble opening the output html in Mac Safari, try Firefox.

## Explanation

A "Entangle" document is split into three sections, separated by `---`:
1. the content (markdown)
2. the config (yaml)
3. the code (coffeescript)

The code is a single function, named `update`, that produces the dependent variables from the independent variables (i.e. the user controls). Entangle will bundle the content, script, and some styles (a la the original Tangle.js) into a standalone html file which you can open.

## Example

example/cookies.entangle:

```entangle
# Cookies

If you eat `${cookies} cookies`, you will consume `${calories} calories`, or `${percent}%` of your recommended daily intake.

---

cookies:
  class: TKAdjustableNumber
  min: 0
  max: 10
  initial: 3
percent:
  format: "%.0f"

---

update = ({cookies}) ->
  calories: cookies*50,
  percent: cookies*2.38
```

Running...

```shell
entangle example/cookies.entangle
```

... will output ...

![example/cookies.html](images/cookies.png)

## API

I also included some hooks for parsing entangle code.

```javascript
import {parse} from "entangle-doc"

const { html, javascript } = parse(source)
```

## Similar projects

- https://github.com/jqhoogland/remark-tangle
- https://github.com/alecperkins/active-markdown