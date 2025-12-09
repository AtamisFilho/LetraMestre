# Add project specific ProGuard rules here.
# Keep serialization classes
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

-keep,includedescriptorclasses class com.letramestre.**$$serializer { *; }
-keepclassmembers class com.letramestre.** {
    *** Companion;
}
-keepclasseswithmembers class com.letramestre.** {
    kotlinx.serialization.KSerializer serializer(...);
}
