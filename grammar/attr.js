const {sep0} = require('./util.js')

// Real attribute syntax is `#[...]` (see core/src/parser.rs
// attribute_parser/attr_arg_parser/vis_parser). The old `@[...]` delimiter
// was a legacy form that's since been freed up as a general infix operator
// (`@`), so `#[` is the only valid attribute bracket.
module.exports = {
  // A single positional/named/group argument inside `#[...]`.
  attr_arg: $ => choice(
    $.attr_named_block,
    $.attr_group,
    $.string,
    $.number,
    $.identifier,
  ),

  // `{ name := value, name2 := value2 }`
  attr_named_block: $ => seq(
    '{',
    sep0(seq(field('name', $.identifier), ':=', field('value', $.attr_arg)), ','),
    '}',
  ),

  // `[ item1, item2 ]`
  attr_group: $ => seq(
    '[',
    sep0($.attr_arg, ','),
    ']',
  ),

  // `#[name arg1 arg2 ...]` — args are space-separated, zero or more.
  attribute: $ => seq(
    '#[',
    field('name', $.identifier),
    repeat(field('argument', $.attr_arg)),
    ']',
  ),

  // Attributes stack: `#[a]\n#[b]\ndef ...`
  attributes: $ => repeat1($.attribute),

  visibility: $ => choice('pub', 'priv'),
}
