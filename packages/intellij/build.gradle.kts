import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType

plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.25"
    id("org.jetbrains.kotlin.plugin.serialization") version "1.9.25"
    id("org.jetbrains.intellij.platform") version "2.9.0"
}

group = providers.gradleProperty("pluginGroup").get()
version = providers.gradleProperty("pluginVersion").get()

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        intellijIdeaCommunity(providers.gradleProperty("platformVersion").get())
        pluginVerifier()
    }
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")

    // schema.yaml 需要真正的 YAML parser（巢狀 artifact 清單 + 多行 block scalar），不能沿用
    // config.yaml 那種單行 regex。**明確宣告**而非仰賴 platform classpath 上碰巧有 SnakeYAML：
    // JCEF 的教訓（issue #24）是「平台上原本存在的類別會在跨版本間消失」，插件自帶才不會被那樣打斷。
    implementation("org.yaml:snakeyaml:2.3")

    // 純邏輯單元測試（OpenSpecScanner / ChangeReader / WatchPolling 只吃路徑與本機檔案，不依賴 IntelliJ platform）
    // kotlin("test")：WatchPollingTest 用 kotlin.test.* 斷言；junit-jupiter：以 JUnit5 平台執行
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
    jvmToolchain(17)
}

intellijPlatform {
    pluginConfiguration {
        id = "tw.kewang.spek"
        name = "spek - OpenSpec Viewer"
        version = providers.gradleProperty("pluginVersion").get()
        description = "OpenSpec content viewer for IntelliJ-based IDEs"
        vendor {
            name = "spek"
            url = "https://github.com/spekhq/spek"
        }
        ideaVersion {
            sinceBuild = providers.gradleProperty("pluginSinceBuild").get()
            untilBuild = provider { null }
        }
    }
    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }
    // Verify both ends of the supported range: the oldest supported build and the newest platform release.
    // Caveat worth knowing before trusting this gate: Plugin Verifier checks binary compatibility and does not
    // model plugin-classloader module visibility. It reported the 2026.2-crashing build as "Compatible", so it
    // does NOT catch a platform package moving into a content module (issue #24) — it catches genuine API
    // removals and signature changes.
    // The newest target must use intellijIdea(...): IDEA Community is no longer published separately as of 2025.3
    // and the Gradle plugin rejects 2025.3+ versions under the intellijIdeaCommunity coordinate.
    pluginVerification {
        ides {
            ide(IntelliJPlatformType.IntellijIdeaCommunity, providers.gradleProperty("platformVersion").get())
            ide(IntelliJPlatformType.IntellijIdea, providers.gradleProperty("verifyLatestVersion").get())
        }
    }
}

tasks {
    wrapper {
        gradleVersion = "8.11.1"
    }

    /**
     * `./gradlew runIde -Pspek.headlessIde` — a sandbox IDE that boots without waiting for a click.
     *
     * A fresh sandbox opens on the JetBrains agreement dialog and blocks there forever, which makes
     * `runIde` unusable for verifying the tool window on a machine with no display (Xvfb supplies the
     * X server; nothing supplies the click). These two properties are JetBrains' own switches for
     * that — the same ones their CI images use — and the version marker satisfies the check in
     * `com.intellij.ide.gdpr.EndUserAgreement`.
     *
     * Opt-in, never on by default: it suppresses a consent prompt, which is only appropriate for a
     * throwaway sandbox you are driving yourself.
     */
    runIde {
        if (providers.gradleProperty("spek.headlessIde").isPresent) {
            systemProperty("jb.consents.confirmation.enabled", "false")
            systemProperty("jb.privacy.policy.text", "<!--999.999-->")
            systemProperty("idea.suppress.statistics.report", "true")
        }
    }
    test {
        useJUnitPlatform()

        // The shared task-parser fixture corpus, read by TaskParserCorpusTest alongside the Node
        // suite in packages/core. Resolved from the Gradle project directory at configuration time,
        // never from the process working directory: this suite runs at packages/intellij and the Node
        // one at packages/core, and either can be invoked from the repo root. Overridable so the
        // generator's scratch directory can be substituted:
        //   ./gradlew test -Dspek.taskParserCorpus=<dir>
        val repoCorpus = layout.projectDirectory.dir("../../test-fixtures/task-parser").asFile
        val corpusDir = providers.systemProperty("spek.taskParserCorpus")
            .map { file(it) }
            .getOrElse(repoCorpus)
        systemProperty("spek.taskParserCorpus", corpusDir.absolutePath)
        // The invalid-fixture corpus verifies the *loader's* rejections, so it is deliberately NOT
        // overridable: a generated scratch corpus replaces the parser's inputs, never the loader's
        // own rules.
        systemProperty("spek.taskParserInvalidCorpus", File(repoCorpus, "invalid").absolutePath)

        // The shared schema.yaml fixture, parsed by SchemaCatalogTest and by
        // packages/core/src/schemas.test.ts. Same reasoning as the corpus above: resolved from the
        // Gradle project directory, never the process working directory, and registered as an input
        // so editing the fixture re-runs the suite instead of leaving it up to date.
        val schemaFixtures = layout.projectDirectory.dir("../../test-fixtures/schemas").asFile
        systemProperty("spek.schemaFixtures", schemaFixtures.absolutePath)
        inputs.dir(schemaFixtures).withPropertyName("schemaFixtures")
        // Without this the task is up to date when only a fixture changed, and the suite silently
        // does not run — a change to test data that appears to pass without having executed.
        // It is not a guard against a wrong path: a directory that exists and is empty passes
        // validation here, so the loader's own zero-fixtures check is what fails that.
        inputs.dir(repoCorpus).withPropertyName("taskParserCorpus")
    }
}
