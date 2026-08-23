;
; Scopes
;
(def) @local.scope
(class_method) @local.scope
(instance) @local.scope
(lambda) @local.scope
(let) @local.scope
(do) @local.scope
(match_case) @local.scope

;
; Let bindings
;
(let_binding name: (identifier) @local.definition)

;
; Function / lambda / class-type parameters
;
(param_group name: (identifier) @local.definition)
(implicit_param name: (identifier) @local.definition)
(lambda_param (identifier) @local.definition)

;
; Match-case bound names
;
(match_case arguments: (identifier) @local.definition)
(field_pattern name: (identifier) @local.definition)
(field_pattern binder: (identifier) @local.definition)

;
; Do-notation bindings
;
(do_bind name: (identifier) @local.definition)
(do_let name: (identifier) @local.definition)

;
; References
;
(identifier) @local.reference
