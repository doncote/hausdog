# Supabase / Ktor
-keep class io.github.jan.supabase.** { *; }
-keep class io.ktor.** { *; }
-dontwarn io.ktor.**

# Kotlinx serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.hausdog.app.**$$serializer { *; }
-keepclassmembers class com.hausdog.app.** {
    *** Companion;
}
-keepclasseswithmembers class com.hausdog.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}
