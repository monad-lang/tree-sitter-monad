const {sep1} = require('./util.js')

module.exports = {
  // Attribute value can be string, identifier, number, or nested structures
  _attr_value: $ => choice(
    $.string,
    $.identifier,
    $.number,
    $._attr_group,
    $._attr_nested,
  ),
  
  // Group of attribute arguments: [arg1, arg2, ...]
  _attr_group: $ => seq(
    '[',
    sep1($._attr_value, ','),
    ']',
  ),
  
  // Named attribute argument: name := value
  _attr_named_arg: $ => seq(
    field('name', $.identifier),
    token.immediate(':'),
    token.immediate('='),
    field('value', $._attr_value),
  ),
  
  // Nested attribute structure: {name := value, ...}
  _attr_nested: $ => seq(
    '{',
    sep1($._attr_named_arg, ','),
    '}',
  ),
  
  // Single attribute: name or name(arg1, arg2, ...)
  _attribute: $ => seq(
    field('name', $.identifier),
    optional(seq(
      '(',
      optional(sep1($._attr_value, ',')),
      ')',
    )),
  ),
}
