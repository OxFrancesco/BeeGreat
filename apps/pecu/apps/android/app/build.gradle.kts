plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.kotlin.compose)
  alias(libs.plugins.kotlin.serialization)
}

android {
  namespace = "app.pecu"
  compileSdk { version = release(37) { minorApiLevel = 1 } }
  defaultConfig {
    applicationId = "app.pecu"
    minSdk = 26
    targetSdk = 36
    versionCode = 9
    versionName = "0.1.8"
    buildConfigField("String", "API_ORIGIN", "\"https://pecu.app\"")
    // Public identifier from the same Clerk instance used by pecu.app.
    buildConfigField("String", "CLERK_PUBLISHABLE_KEY", "\"pk_test_c3RyaWtpbmctYnVmZmFsby05ODUxLmNsZXJrLmFjY291bnRzLmRldiQ\"")
  }
  buildTypes {
    release {
      isMinifyEnabled = true
      isShrinkResources = true
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
    create("benchmark") {
      initWith(getByName("release"))
      signingConfig = signingConfigs.getByName("debug")
      matchingFallbacks += "release"
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
  buildFeatures { compose = true; buildConfig = true }
  sourceSets.getByName("test").resources.srcDir("../../../tests/fixtures/presentation")
  testOptions {
    unitTests.isIncludeAndroidResources = true
    unitTests.all {
      it.systemProperty("pecu.recordDither", providers.gradleProperty("recordDither").getOrElse("false"))
      it.systemProperty("pecu.recordStockGraph", providers.gradleProperty("recordStockGraph").getOrElse("false"))
      it.systemProperty("pecu.recordLogin", providers.gradleProperty("recordLogin").getOrElse("false"))
      it.jvmArgs("--add-opens=java.base/java.lang=ALL-UNNAMED", "--add-opens=java.base/java.util=ALL-UNNAMED", "--add-opens=java.base/java.io=ALL-UNNAMED", "--add-opens=java.base/java.net=ALL-UNNAMED", "--add-opens=java.base/java.security=ALL-UNNAMED", "--add-opens=java.base/java.text=ALL-UNNAMED", "--add-opens=java.base/jdk.internal.access=ALL-UNNAMED", "--add-opens=java.desktop/java.awt.font=ALL-UNNAMED", "--add-opens=jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED")
    }
  }
}

dependencies {
  implementation(project(":dither"))
  implementation(platform(libs.compose.bom))
  implementation(libs.compose.material3)
  implementation(libs.compose.material.icons)
  implementation(libs.compose.foundation)
  implementation(libs.compose.ui)
  implementation(libs.androidx.activity.compose)
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.lifecycle.viewmodel.compose)
  implementation(libs.androidx.browser)
  implementation(libs.clerk.api)
  implementation(libs.kotlinx.serialization.json)
  implementation(libs.kotlinx.coroutines)
  implementation(libs.okhttp)
  implementation(libs.coil.compose)
  implementation(libs.coil.network)
  implementation(libs.markdown.m3)
  implementation(libs.zxing.core)
  testImplementation(libs.junit)
  testImplementation(libs.kotlinx.coroutines.test)
  testImplementation(libs.okhttp.mockwebserver)
  testImplementation(libs.robolectric)
  testImplementation("androidx.compose.ui:ui-test-junit4")
  debugImplementation("androidx.compose.ui:ui-test-manifest")
  debugImplementation(libs.compose.ui.tooling)
}
