# Mangle

Another attempt at writing [tangle documents](http://worrydream.com/Tangle/) in your favorite markdown editor.

The main objective was to keep the "explanation" part as readable as possible.

## Example

A "mangle" document is split into three sections:
1. the explanation (markdown)
2. variable options (yaml)
3. the update function (coffeescript)

```mangle
# Cookies

If you eat `${cookies} cookies`, you will consume `${calories} calories`, or `${percent}%` of your recommended daily intake.

---
cookies:
  class: TKAdjustableNumber
  min: 0
  max: 10
  initial: 3
percent:
  format: %.0f

---
update = {cookies} ->
  calories: cookies*50,
  percent: cookies*2.38
```

## Similar projects

- https://github.com/jqhoogland/remark-tangle
- https://github.com/alecperkins/active-markdown