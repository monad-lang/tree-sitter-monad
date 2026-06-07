;
; Lambda parameters
;
(parameters) @local

;
; Let bindings
;
(let) @local
(let name: (identifier) @local)

;
; Function parameters
;
(explicit_binder name: (identifier) @local)
(implicit_binder name: (identifier) @local)
(instance_binder name: (identifier) @local)
(linear_binder name: (identifier) @local)
(affine_binder name: (identifier) @local)

;
; Match parameters
;
(match_alt lhs: (identifier) @local)

;
; Do bind variables
;
(do_bind name: (identifier) @local)

;
; Do let bindings
;
(do_let name: (identifier) @local)

;
; Forall bound variables
;
; TODO: Add binders support