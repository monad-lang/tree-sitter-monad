;
; Keywords
;
"def" @keyword
"type" @keyword
"struct" @keyword
"class" @keyword
"instance" @keyword
"infix" @keyword
"use" @keyword
"open" @keyword
"let" @keyword
"in" @keyword
"if" @keyword
"then" @keyword
"else" @keyword
"match" @keyword
"do" @keyword
"return" @keyword

;
; Type operators
;
"->" @operator
"×" @operator

;
; Literals
;
(string) @string
(number) @number
(char) @string
(true) @boolean
(false) @boolean
(hole) @keyword

;
; Comments
;
(comment) @comment

;
; Operators
;
"+" @operator
"-" @operator
"*" @operator
"/" @operator
"%" @operator
"==" @operator
"<" @operator
">" @operator
"<=" @operator
">=" @operator
"≤" @operator
"≥" @operator
"&&" @operator
"||" @operator
">>=" @operator
"<|" @operator
"|>" @operator
"|>." @operator
"<|>" @operator
"++" @operator
"::" @operator

;
; Attributes
;
(attributes) @attribute

;
; Function definitions
;
(def) @function

;
; Type definitions
;
(type_decl) @type
(struct) @type
(class) @type

;
; Constructors
;