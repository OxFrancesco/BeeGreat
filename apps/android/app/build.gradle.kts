import java.util.Properties

plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.kotlin.compose)
  alias(libs.plugins.kotlin.serialization)
}

// Public runtime configuration. Read from local.properties (gitignored), then
// Gradle properties, then the defaults below. The agent URL defaults to the
// production worker for the same reason the Expo app does: a phone cannot
// reach the developer's localhost.
val localProperties =
  Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
  }

fun config(name: String, default: String = ""): String =
  localProperties.getProperty(name) ?: (project.findProperty(name) as String?) ?: default

android {
  namespace = "com.beegreat.app"
  compileSdk {
    version =
      release(libs.versions.compileSdk.get().toInt()) {
        minorApiLevel = libs.versions.compileSdkMinor.get().toInt()
      }
  }

  defaultConfig {
    applicationId = "com.beegreat.app"
    minSdk = libs.versions.minSdk.get().toInt()
    targetSdk = libs.versions.targetSdk.get().toInt()
    versionCode = 20
    versionName = "1.0.0"

    buildConfigField("String", "CLERK_PUBLISHABLE_KEY", "\"${config("CLERK_PUBLISHABLE_KEY")}\"")
    buildConfigField("String", "CONVEX_URL", "\"${config("CONVEX_URL")}\"")
    buildConfigField(
      "String",
      "AGENT_URL",
      "\"${config("AGENT_URL", "https://beegreat-agent.oddofrancesco000.workers.dev")}\"",
    )
    buildConfigField("String", "SENTRY_DSN", "\"${config("SENTRY_DSN")}\"")
    buildConfigField("String", "REOWN_PROJECT_ID", "\"${config("REOWN_PROJECT_ID")}\"")
  }

  // Release signing reads RELEASE_STORE_FILE / RELEASE_STORE_PASSWORD /
  // RELEASE_KEY_ALIAS / RELEASE_KEY_PASSWORD from local.properties or the
  // environment. Without them the release build signs with the debug key so
  // it still assembles locally; CI must provide the real keystore.
  val releaseStore = config("RELEASE_STORE_FILE", System.getenv("RELEASE_STORE_FILE") ?: "")
  signingConfigs {
    if (releaseStore.isNotBlank()) {
      create("release") {
        storeFile = rootProject.file(releaseStore)
        storePassword = config("RELEASE_STORE_PASSWORD", System.getenv("RELEASE_STORE_PASSWORD") ?: "")
        keyAlias = config("RELEASE_KEY_ALIAS", System.getenv("RELEASE_KEY_ALIAS") ?: "")
        keyPassword = config("RELEASE_KEY_PASSWORD", System.getenv("RELEASE_KEY_PASSWORD") ?: "")
      }
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = true
      isShrinkResources = true
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
      signingConfig = if (releaseStore.isNotBlank()) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlin {
    compilerOptions {
      jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
      freeCompilerArgs.addAll("-opt-in=androidx.compose.material3.ExperimentalMaterial3Api")
    }
  }

  buildFeatures {
    compose = true
    buildConfig = true
  }
}

dependencies {
  implementation(projects.core.design)
  implementation(projects.core.convex)
  implementation(projects.core.flue)
  implementation(projects.core.contract)

  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.lifecycle.runtime)
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.lifecycle.viewmodel.compose)
  implementation(libs.androidx.activity.compose)
  implementation(libs.androidx.navigation.compose)
  implementation(libs.androidx.browser)
  implementation(libs.kotlinx.serialization.json)
  implementation(libs.okhttp)
  implementation(libs.coil.compose)
  implementation(libs.coil.network)
  implementation(libs.coil.gif)
  implementation(libs.markdown.m3)
  implementation(libs.markdown.coil)
  implementation(platform(libs.reown.bom))
  implementation(libs.reown.core)
  implementation(libs.reown.appkit)
  implementation(libs.zxing.core)
  implementation(libs.sentry.android)

  testImplementation(libs.junit)
  testImplementation(libs.kotlinx.coroutines.test)
  debugImplementation(libs.compose.ui.tooling)
}
