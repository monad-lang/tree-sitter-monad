;
; Generic brace-delimited bodies
;
"{" @fold.start
"}" @fold.end

;
; Do blocks
;
(do) @fold.start

;
; Match bodies
;
(match_term) @fold.start

;
; Type/struct/class/instance/decls bodies
;
(type_decl) @fold.start
(struct) @fold.start
(class) @fold.start
(instance) @fold.start
(decls_block) @fold.start

;
; Multi-line comments
;
(comment) @fold.start
