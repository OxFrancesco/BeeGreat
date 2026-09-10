# kotlinx.serialization keeps its own rules through consumer files.
# Convex's Rust FFI bindings are loaded by reflection.
-keep class dev.convex.** { *; }
-keep class uniffi.** { *; }

# Reown / WalletConnect keep their JSON models through consumer rules; Moshi
# adapters are generated. Keep the sealed models we pattern-match on.
-keep class com.reown.appkit.client.Modal$Model$** { *; }
-keep class com.reown.appkit.client.models.** { *; }

# Our Convex and Flue wire types are decoded by kotlinx.serialization; keep
# the generated serializers reachable after shrinking.
-keep,includedescriptorclasses class com.beegreat.**$$serializer { *; }
-keepclassmembers class com.beegreat.** {
    *** Companion;
}
-keepclasseswithmembers class com.beegreat.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# OkHttp / Okio are fine under R8 defaults; silence the optional platform warnings.
-dontwarn okhttp3.internal.platform.**
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**

# Clerk talks to its API through Retrofit proxies created at runtime. R8's
# full mode strips the generic signatures Retrofit reads back, which surfaces
# as a ClassCastException in ClerkApi.configure on the first launch of a
# release build. Keep the service interfaces intact.
-keepattributes Signature, InnerClasses, EnclosingMethod, RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations, AnnotationDefault
-keep interface com.clerk.api.network.api.** { *; }
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
-if interface * { @retrofit2.http.* public *** *(...); }
-keep,allowoptimization,allowshrinking,allowobfuscation class <3>

# Convex's Rust bridge goes through JNA, which resolves Java classes from
# native code by name. Obfuscating them breaks Native.initIDs at startup.
-keep class com.sun.jna.** { *; }
-keepclassmembers class * extends com.sun.jna.** { public *; }
-dontwarn java.awt.**
