const PREC = {
  max: 1024,
  arg: 1023,
  lead: 1022,
  min: 10,
}
module.exports = {
  PREC,

  rules: {
    // \n \r \t \b \f \\ \/ \" \' plus braced unicode escapes \u{XXXX}
    // (1-6 hex digits), plus a line-continuation escape (`\` followed by
    // whitespace/newline, discarded) — matching core/src/parser/string.rs.
    quoted_char: $ => token(
      seq(
        '\\', choice(
          /u\{[a-fA-F0-9]{1,6}\}/,
          /[\\/"'nrtbf]/,
          /[ \t\r\n]+/,
        ),
      ),
    ),
  }
}
