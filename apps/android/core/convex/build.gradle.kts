plugins {
  alias(libs.plugins.android.library)
  alias(libs.plugins.kotlin.serialization)
}

android {
  namespace = "com.beegreat.convex"
  compileSdk {
    version =
      release(libs.versions.compileSdk.get().toInt()) {
        minorApiLevel = libs.versions.compileSdkMinor.get().toInt()
      }
  }

  defaultConfig { minSdk = libs.versions.minSdk.get().toInt() }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
}

dependencies {
  api(libs.convex.mobile)
  api(libs.clerk.convex)
  api(libs.clerk.api)
  api(libs.kotlinx.coroutines)
  api(libs.kotlinx.serialization.json)
  testImplementation(libs.junit)
  testImplementation(libs.kotlinx.coroutines.test)
}
