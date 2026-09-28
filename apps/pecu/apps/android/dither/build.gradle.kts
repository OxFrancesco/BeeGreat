plugins {
  alias(libs.plugins.android.library)
  alias(libs.plugins.kotlin.compose)
}
android {
  namespace = "app.pecu.dither"
  compileSdk { version = release(37) { minorApiLevel = 1 } }
  defaultConfig { minSdk = 26 }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
  buildFeatures { compose = true }
  testOptions {
    unitTests.isIncludeAndroidResources = true
    unitTests.all {
      it.jvmArgs("--add-opens=java.base/java.lang=ALL-UNNAMED", "--add-opens=java.base/java.util=ALL-UNNAMED", "--add-opens=java.base/java.io=ALL-UNNAMED", "--add-opens=java.base/java.net=ALL-UNNAMED", "--add-opens=java.base/java.security=ALL-UNNAMED", "--add-opens=java.base/java.text=ALL-UNNAMED", "--add-opens=java.base/jdk.internal.access=ALL-UNNAMED", "--add-opens=java.desktop/java.awt.font=ALL-UNNAMED", "--add-opens=jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED")
    }
  }
}
dependencies {
  implementation(platform(libs.compose.bom))
  implementation(libs.compose.ui)
  implementation(libs.compose.foundation)
  implementation(libs.compose.material3)
  implementation(libs.androidx.lifecycle.runtime.compose)
  testImplementation(libs.junit)
  testImplementation(libs.robolectric)
}
