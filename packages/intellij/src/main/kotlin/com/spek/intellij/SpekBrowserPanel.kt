package com.spek.intellij

import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.spek.intellij.core.SpekCaches
import com.spek.intellij.core.WatchPolling
import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import java.nio.file.*
import java.util.Timer
import java.util.TimerTask
import java.awt.FlowLayout
import javax.swing.BorderFactory
import javax.swing.BoxLayout
import javax.swing.JButton
import javax.swing.JComponent
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.SwingConstants
import kotlin.concurrent.thread

class SpekBrowserPanel(private val project: Project) : Disposable {
    private val log = Logger.getInstance(SpekBrowserPanel::class.java)
    private var webview: SpekWebviewHost? = null
    private var debounceTimer: Timer? = null
    private var watchThread: Thread? = null
    private var watchService: WatchService? = null
    @Volatile private var disposed = false
    @Volatile private var webviewReady = false
    private val pendingNavigations = mutableListOf<String>()
    var onFileChanged: (() -> Unit)? = null

    val component: JComponent

    init {
        component = if (JcefAvailability.isAvailable()) {
            createBrowserComponent()
        } else {
            createFallbackComponent()
        }

        setupNativeFileWatcher()
    }

    private fun createBrowserComponent(): JComponent {
        // 先建立空白 browser，等 Built-in Server 就緒後再載入 URL
        val host = JcefWebviewHost { isIdeInDarkMode() }
        webview = host
        Disposer.register(this, host)

        // 在背景等待 server 啟動並確認 API handler 就緒，再於 EDT 載入 URL
        ApplicationManager.getApplication().executeOnPooledThread {
            org.jetbrains.ide.BuiltInServerManager.getInstance().waitForStart()
            if (disposed) return@executeOnPooledThread

            val port = org.jetbrains.ide.BuiltInServerManager.getInstance().port
            val projectPath = project.basePath ?: ""
            val encodedPath = java.net.URLEncoder.encode(projectPath, "UTF-8")

            // 輪詢確認 API handler 已註冊並可回應，避免啟動時 404
            waitForApiReady(port, encodedPath)
            if (disposed) return@executeOnPooledThread

            ApplicationManager.getApplication().invokeLater {
                if (disposed) return@invokeLater
                host.loadUrl(buildBrowserUrl())
                // 延遲標記為 ready，讓頁面有時間載入
                Timer().schedule(object : TimerTask() {
                    override fun run() {
                        webviewReady = true
                        flushPendingNavigations()
                    }
                }, 2000)
            }
        }

        return host.component
    }

    private fun createFallbackComponent(): JComponent {
        val panel = JPanel()
        panel.layout = BoxLayout(panel, BoxLayout.Y_AXIS)
        panel.border = BorderFactory.createEmptyBorder(20, 20, 20, 20)

        // Don't phrase this as "this IDE has no JCEF": since 2026.2 the same panel can equally be caused by the
        // plugin failing to declare its com.intellij.modules.jcef dependency (issue #24), so blaming the IDE
        // would be dishonest.
        val messageLabel = JLabel(
            "<html><center>The embedded browser is unavailable.<br>" +
                "spek will open in your external browser instead.</center></html>",
        )
        messageLabel.horizontalAlignment = SwingConstants.CENTER
        messageLabel.alignmentX = JComponent.CENTER_ALIGNMENT

        val buttonPanel = JPanel(FlowLayout(FlowLayout.CENTER))
        val openButton = JButton("Open in Browser")
        openButton.addActionListener { openInExternalBrowser() }
        buttonPanel.alignmentX = JComponent.CENTER_ALIGNMENT
        buttonPanel.add(openButton)

        panel.add(javax.swing.Box.createVerticalGlue())
        panel.add(messageLabel)
        panel.add(javax.swing.Box.createVerticalStrut(12))
        panel.add(buttonPanel)
        panel.add(javax.swing.Box.createVerticalGlue())

        // 背景等待 server 就緒後自動開啟瀏覽器
        ApplicationManager.getApplication().executeOnPooledThread {
            org.jetbrains.ide.BuiltInServerManager.getInstance().waitForStart()
            if (disposed) return@executeOnPooledThread

            val port = org.jetbrains.ide.BuiltInServerManager.getInstance().port
            val encodedPath = java.net.URLEncoder.encode(project.basePath ?: "", "UTF-8")
            waitForApiReady(port, encodedPath)
            if (disposed) return@executeOnPooledThread

            ApplicationManager.getApplication().invokeLater {
                if (!disposed) openInExternalBrowser()
            }
        }

        return panel
    }

    private fun buildBrowserUrl(): String {
        val port = org.jetbrains.ide.BuiltInServerManager.getInstance().port
        val projectPath = project.basePath ?: ""
        val encodedPath = java.net.URLEncoder.encode(projectPath, "UTF-8")
        val theme = if (isIdeInDarkMode()) "dark" else "light"
        return "http://localhost:$port/spek/webview/index.intellij.html" +
            "?projectPath=$encodedPath&apiBase=http://localhost:$port/api/spek&theme=$theme"
    }

    private fun openInExternalBrowser() {
        val url = buildBrowserUrl()
        com.intellij.ide.BrowserUtil.browse(url)
    }

    private fun isIdeInDarkMode(): Boolean {
        return !com.intellij.ui.JBColor.isBright()
    }

    private fun setupNativeFileWatcher() {
        val basePath = project.basePath ?: return
        val openspecDir = File(basePath, "openspec")
        if (!openspecDir.isDirectory) return

        // inotify（Java NIO WatchService 在 Linux 的底層）在 9p/drvfs/NFS 等掛載上收不到事件
        // （devcontainer/WSL 常見）。這類路徑改用輪詢掃描；其餘維持原生 WatchService。
        if (WatchPolling.shouldUsePolling(openspecDir.absolutePath)) {
            setupPollingWatcher(openspecDir)
        } else {
            setupWatchServiceWatcher(openspecDir)
        }
    }

    private fun setupWatchServiceWatcher(openspecDir: File) {
        val ws = FileSystems.getDefault().newWatchService()
        watchService = ws

        // 遞迴註冊 openspec/ 下所有子目錄
        registerDirRecursively(openspecDir.toPath(), ws)

        watchThread = thread(isDaemon = true, name = "spek-file-watcher") {
            try {
                while (!disposed) {
                    val key = ws.poll(1, java.util.concurrent.TimeUnit.SECONDS) ?: continue
                    var hasRelevantChange = false

                    for (event in key.pollEvents()) {
                        if (event.kind() == StandardWatchEventKinds.OVERFLOW) continue
                        hasRelevantChange = true

                        // 新建的目錄也需要註冊
                        if (event.kind() == StandardWatchEventKinds.ENTRY_CREATE) {
                            val context = event.context() as? Path ?: continue
                            val dir = (key.watchable() as Path).resolve(context)
                            if (dir.toFile().isDirectory) {
                                registerDirRecursively(dir, ws)
                            }
                        }
                    }

                    key.reset()

                    if (hasRelevantChange) {
                        scheduleRefresh()
                    }
                }
            } catch (_: ClosedWatchServiceException) {
                // 正常關閉
            } catch (e: Exception) {
                if (!disposed) {
                    log.warn("File watcher error", e)
                }
            }
        }
    }

    private fun registerDirRecursively(dir: Path, ws: WatchService) {
        try {
            dir.register(
                ws,
                StandardWatchEventKinds.ENTRY_CREATE,
                StandardWatchEventKinds.ENTRY_MODIFY,
                StandardWatchEventKinds.ENTRY_DELETE,
            )
            // 註冊子目錄
            dir.toFile().listFiles()
                ?.filter { it.isDirectory && !it.name.startsWith(".") }
                ?.forEach { registerDirRecursively(it.toPath(), ws) }
        } catch (e: Exception) {
            log.debug("Cannot watch directory: $dir", e)
        }
    }

    private fun setupPollingWatcher(openspecDir: File) {
        val intervalMs = WatchPolling.pollingIntervalMs()
        var snapshot = WatchPolling.scanSnapshot(openspecDir)
        watchThread = thread(isDaemon = true, name = "spek-file-watcher-poll") {
            try {
                while (!disposed) {
                    Thread.sleep(intervalMs)
                    if (disposed) break
                    val current = WatchPolling.scanSnapshot(openspecDir)
                    if (current != snapshot) {
                        snapshot = current
                        scheduleRefresh()
                    }
                }
            } catch (_: InterruptedException) {
                // 正常關閉（dispose 時 interrupt）
            } catch (e: Exception) {
                if (!disposed) {
                    log.warn("Polling file watcher error", e)
                }
            }
        }
    }

    private fun scheduleRefresh() {
        synchronized(this) {
            // dispose() 在同一把鎖內把 disposed 設為 true，故通過此檢查即保證尚未 dispose，
            // 不會再排程一個會在 dispose 後才觸發的 Timer（避免對已釋放的 JCEF browser 動作）。
            if (disposed) return
            debounceTimer?.cancel()
            debounceTimer = Timer().apply {
                schedule(object : TimerTask() {
                    override fun run() {
                        notifyWebviewFileChanged()
                    }
                }, 500)
            }
        }
    }

    private fun notifyWebviewFileChanged() {
        // Timer 觸發時 browser 可能已被 dispose，二次防護避免對已釋放物件呼叫 executeJavaScript
        if (disposed) return
        // 檔案有變動 → 先清掉 schema 順序快取，「再」通知 webview 重新抓取；順序不可顛倒：若先派發
        // spek:fileChanged，webview 的 re-fetch 可能搶在 clearCache 之前打到 server 而拿到舊順序。
        SpekCaches.clearAll()
        webview?.executeJavaScript("window.dispatchEvent(new CustomEvent('spek:fileChanged'));")
        onFileChanged?.invoke()
    }

    private fun flushPendingNavigations() {
        val paths: List<String>
        synchronized(pendingNavigations) {
            paths = pendingNavigations.toList()
            pendingNavigations.clear()
        }
        if (paths.isNotEmpty()) {
            ApplicationManager.getApplication().invokeLater {
                navigateTo(paths.last())
            }
        }
    }

    private fun waitForApiReady(port: Int, encodedProjectPath: String) {
        val maxRetries = 50
        val retryIntervalMs = 200L
        val checkUrl = "http://localhost:$port/api/spek/fs/detect?path=$encodedProjectPath"

        for (i in 1..maxRetries) {
            if (disposed) return
            try {
                val conn = URI(checkUrl).toURL().openConnection() as HttpURLConnection
                conn.connectTimeout = 500
                conn.readTimeout = 500
                conn.requestMethod = "GET"
                val code = conn.responseCode
                conn.disconnect()
                if (code == 200) {
                    log.info("API handler ready after $i attempt(s)")
                    return
                }
            } catch (_: Exception) {
                // 連線失敗，handler 尚未就緒
            }
            Thread.sleep(retryIntervalMs)
        }
        log.warn("API handler not ready after ${maxRetries * retryIntervalMs}ms, loading webview anyway")
    }

    fun navigateTo(path: String) {
        val host = webview
        if (host != null) {
            if (!webviewReady) {
                synchronized(pendingNavigations) {
                    pendingNavigations.add(path)
                }
                return
            }
            val escapedPath = path.replace("'", "\\'")
            host.executeJavaScript(
                "window.dispatchEvent(new CustomEvent('spek:navigate', { detail: { path: '$escapedPath' } }));",
            )
        } else {
            // JCEF 不可用，開啟外部瀏覽器
            val baseUrl = buildBrowserUrl()
            val hashUrl = baseUrl + "#${path}"
            com.intellij.ide.BrowserUtil.browse(hashUrl)
        }
    }

    override fun dispose() {
        // 與 scheduleRefresh 共用同一把鎖設定 disposed 並取消 debounce，關閉「掃描剛結束→排程新 Timer
        //→dispose」的競態窗口；watchService/watchThread 的關閉不需持鎖，留在鎖外避免不必要的阻塞。
        synchronized(this) {
            disposed = true
            debounceTimer?.cancel()
            debounceTimer = null
        }
        watchService?.close()
        watchThread?.interrupt()
    }
}
