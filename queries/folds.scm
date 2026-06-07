;
; Code blocks
;
"{" @fold.start
"}" @fold.end

;
; Do blocks
;
(do) @fold.start
"}" @fold.end

;
; Match bodies
;
(match) @fold.start
"}" @fold.end

;
; Type bodies
;
(type_decl) @fold.start
"}" @fold.end

;
; Struct bodies  
;
(struct) @fold.start
"}" @fold.end

;
; Class bodies
;
(class) @fold.start
"}" @fold.end

;
; Instance bodies
;
(instance) @fold.start
"}" @fold.end

;
; Multi-line comments
;
(comment) @fold.start