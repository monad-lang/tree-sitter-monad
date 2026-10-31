; Monad syntax highlighting
;
; Node/field names here match grammar.js and grammar/*.js exactly — see
; core/src/parser.rs in the sibling `monad` repo for the language's actual
; grammar (the reference this was built against; the project's own
; docs/src/reference.md has drifted from it in places).
;
; Capture ordering matters: patterns later in this file win over earlier
; ones for the same node, so generic/fallback captures are declared first
; and field-scoped overrides come after them.

;
; Keywords
;
[
  "def"
  "defmacro"
  "let"
  "in"
  "use"
  "open"
  "class"
  "struct"
  "instance"
  "type"
  "match"
  "if"
  "then"
  "else"
  "infix"
  "return"
  "do"
  "with"
  "quote"
  "decls"
] @keyword

["fn" "\\" "ꟛ"] @keyword.function
["pub" "priv"] @keyword.modifier

;
; Punctuation
;
["(" ")" "[" "]" "{" "}"] @punctuation.bracket
["," ";" ":" "." ".." "::"] @punctuation.delimiter
["=>" "->" ":=" "<-"] @operator

;
; Operators — the real table only (no ≤/≥; includes != @ .)
;
[
  ">>=" "<*>" "<|>" "==" "!=" ">=" "<=" ">>" "<<" "|>" "<|"
  "++" "&&" "||" ">" "<" "*" "/" "+" "-" "@"
] @operator

;
; Literals
;
(string) @string
(raw_string) @string
(char) @character
(quoted_char) @string.escape
(number) @number
(hex_number) @number
(float) @number.float
(hole) @constant.builtin

;
; Comments
;
(comment) @comment
(doc_comment) @comment.documentation

;
; Fallback identifier — overridden below by every more specific rule that
; targets a particular field.
;
(identifier) @variable
((identifier) @boolean
  (#any-of? @boolean "true" "false"))
((identifier) @type.builtin
  (#any-of? @type.builtin "Type" "Pred"))
"Sort" @type.builtin

;
; Qualified names / module paths (`IO.println`, `std::list::List.cons`)
;
(module_path (identifier) @module)

;
; Attributes — `#[...]` and the file-level `#![...]`
;
["#[" "#![" "]"] @punctuation.bracket
(attribute name: (identifier) @attribute)
(mote_attr name: (identifier) @attribute)
(attr_named_block name: (identifier) @property)

;
; Multiplicity sigils on binders — `%` erased, `!` linear, `?` affine
;
(multiplicity) @attribute

;
; Declarations — field-scoped, not whole-node
;
(def name: (_) @function)
(defmacro name: (_) @function.macro)
(macro_call name: (identifier) @function.macro)
(macro_call_decl call: (_) @function.macro)
(class_method name: (identifier) @function.method)
(infix operator: (_) @operator definition: (_) @function)

(class name: (_) @type.definition)
(instance class: (_) @type)
(instance name: (_) @type)
(struct name: (_) @type.definition)
(type_decl name: (_) @type.definition)

(constructor name: (identifier) @constructor)
(constructor_name (identifier) @constructor)
(match_case constructor: (hole) @constructor)

(struct_field name: (identifier) @property)
(use_path (identifier) @module)
(use_item name: (identifier) @module)
(use_item name: (use_item_name (identifier) @module))
(use_item alias: (identifier) @module)
(open_filter (identifier) @module)
(use module: (_) @module)
(open module: (_) @module)
(with_decl prefix: (_) @module)

;
; Explicit instance hint (`show #ShowB x`)
;
(dict_hint class: (_) @type)

;
; Parameters / binders
;
(param_group name: (identifier) @variable.parameter)
(implicit_param name: (identifier) @variable.parameter)
(lambda_param (identifier) @variable.parameter)
(field_pattern name: (identifier) @variable.parameter)
(field_pattern binder: (identifier) @variable.parameter)
(let_binding name: (identifier) @variable)
(do_bind name: (identifier) @variable)
(do_let name: (identifier) @variable)
