# kotlinx.serialization keeps its own rules through consumer files.
# Convex's Rust FFI bindings are loaded by reflection.
-keep class dev.convex.** { *; }
-keep class uniffi.** { *; }
