;
; Function definitions
;
(def name: (_) @name) @definition.function

;
; Type definitions
;
(type_decl name: (_) @name) @definition.type
(struct name: (_) @name) @definition.struct
(class name: (_) @name) @definition.interface
(instance) @definition.interface

;
; Infix operator definitions
;
(infix definition: (_) @name) @definition.function

;
; Macro definitions
;
(defmacro name: (_) @name) @definition.macro

;
; Module imports
;
(use module: (_) @name) @definition.import
(open module: (_) @name) @definition.import

;
; References
;
(apply name: (identifier) @name) @reference.call
(constructor_name (identifier) @name) @reference.class
