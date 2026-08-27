package com.spek.intellij.core

import java.io.File

/**
 * 判定檔案監看是否需要改用 polling（輪詢）。對齊 @spekjs/core 的 watch-polling.ts。
 *
 * 背景：Java NIO `WatchService` 在 Linux 走 inotify，但 inotify 事件在 9p / drvfs / NFS /
 * CIFS / FUSE 等網路型或虛擬掛載上不會傳遞（devcontainer / WSL 把 host 目錄掛進容器即如此），
 * 此時 `WatchService` 永遠收不到事件、live-reload 靜默失效。判別依據是「被監看路徑所在掛載
 * 的 fstype」，而非「是否在容器」。`WatchService` 本身不支援 polling，故呼叫端在需要時改以
 * 輪詢掃描取代。
 *
 * 純函式（fsTypeNeedsPolling / parseMountFsType / parsePollingOverride /
 * hasRemoteEnvIndicator / decidePolling）與 I/O 薄層（detectMountFsType / shouldUsePolling）
 * 分離，方便單元測試。
 */
object WatchPolling {
    /** The file extensions a change edit can touch: markdown plus every data artifact extension. It comes
     *  from ArtifactFiles' one source, so the snapshot cannot drift from what discovery treats as an
     *  artifact. */
    private val WATCHED_EXTENSIONS = listOf(".md") + ArtifactFiles.DATA_EXTENSIONS

    /** 不傳遞原生事件、需改用 polling 的 fstype（小寫比對；`fuse.*` 另以前綴判定） */
    private val NON_EVENT_FS_TYPES = setOf(
        "9p", "v9fs", "drvfs", "cifs", "smb3", "smbfs",
        "nfs", "nfs4", "vboxsf", "vmhgfs", "prl_fs", "lustre", "glusterfs",
    )

    /** 給定 fstype 是否屬於「不傳遞原生事件」集合。null / 空字串回 false。 */
    fun fsTypeNeedsPolling(fsType: String?): Boolean {
        if (fsType.isNullOrEmpty()) return false
        val t = fsType.lowercase()
        if (t == "fuse" || t == "fuseblk" || t.startsWith("fuse.")) return true
        return NON_EVENT_FS_TYPES.contains(t)
    }

    /** 還原 /proc/mounts 掛載點中的八進位跳脫（空白 \040、tab \011 等） */
    private fun unescapeMountField(s: String): String =
        Regex("""\\(\d{3})""").replace(s) { m -> m.groupValues[1].toInt(8).toChar().toString() }

    /** 掛載點 mountPoint 是否涵蓋 targetPath（root `/` 涵蓋一切；否則需為路徑前綴） */
    private fun pathCoveredBy(targetPath: String, mountPoint: String): Boolean {
        if (mountPoint == "/") return true
        val mp = mountPoint.trimEnd('/')
        return targetPath == mp || targetPath.startsWith("$mp/")
    }

    /**
     * 純函式：從 `/proc/mounts` 內容解析出涵蓋 targetPath 的掛載 fstype。
     * 取「掛載點為 targetPath 前綴且最長」者的 fstype（相同掛載點後者覆蓋前者）；對不到回 null。
     */
    fun parseMountFsType(mountsContent: String, targetPath: String): String? {
        var bestLen = -1
        var bestType: String? = null
        for (line in mountsContent.split("\n")) {
            if (line.isBlank()) continue
            val parts = line.split(" ")
            if (parts.size < 3) continue
            val mountPoint = unescapeMountField(parts[1])
            val fsType = parts[2]
            if (pathCoveredBy(targetPath, mountPoint) && mountPoint.length >= bestLen) {
                bestLen = mountPoint.length
                bestType = fsType
            }
        }
        return bestType
    }

    /** I/O 薄層：偵測 path 所在掛載的 fstype。僅 Linux 有意義；/proc 不可讀時回 null。 */
    fun detectMountFsType(path: String): String? {
        if (!isLinux()) return null
        val resolved = try { File(path).canonicalPath } catch (_: Exception) { path }
        return try {
            parseMountFsType(File("/proc/mounts").readText(), resolved)
        } catch (_: Exception) {
            null
        }
    }

    /**
     * 純函式：解析明確覆寫。`SPEK_WATCH_POLLING` 優先，其次 `CHOKIDAR_USEPOLLING`。
     * 回 true/false 為使用者明確要求；回 null 表示無意見（交由偵測決定）。
     */
    fun parsePollingOverride(env: Map<String, String?>): Boolean? {
        val raw = env["SPEK_WATCH_POLLING"] ?: env["CHOKIDAR_USEPOLLING"] ?: return null
        return when (raw.trim().lowercase()) {
            "1", "true", "on", "yes" -> true
            "0", "false", "off", "no" -> false
            else -> null
        }
    }

    /** 純函式：環境是否顯示 remote / container（無法判定 fstype 時的保底訊號） */
    fun hasRemoteEnvIndicator(env: Map<String, String?>): Boolean =
        listOf("REMOTE_CONTAINERS", "REMOTE_CONTAINERS_IPC", "CODESPACES", "WSL_DISTRO_NAME", "WSL_INTEROP")
            .any { !env[it].isNullOrEmpty() }

    /** decidePolling 的輸入訊號 */
    data class PollingSignals(
        val override: Boolean?,
        val isLinux: Boolean,
        val fsType: String?,
        val remoteIndicator: Boolean,
    )

    /**
     * 純函式：依優先序決定是否 polling。
     * 1) 明確覆寫最優先 2) 非 Linux 一律原生（false）3) fstype 屬非事件集合 → true
     * 4) fstype 已判定為原生 → false 5) fstype 無法判定 → 用 remoteIndicator 保底。
     */
    fun decidePolling(s: PollingSignals): Boolean {
        s.override?.let { return it }
        if (!s.isLinux) return false
        if (fsTypeNeedsPolling(s.fsType)) return true
        if (s.fsType != null) return false
        return s.remoteIndicator
    }

    private fun isLinux(): Boolean =
        System.getProperty("os.name").orEmpty().lowercase().contains("linux")

    private fun dockerEnvExists(): Boolean =
        try { File("/.dockerenv").exists() } catch (_: Exception) { false }

    /**
     * 是否應對 path 使用 polling。整合覆寫、fstype 偵測與環境保底訊號。
     * `extraRemoteIndicator` 供呼叫端補強（如 IDE 偵測到 remote backend）。
     */
    fun shouldUsePolling(path: String, extraRemoteIndicator: Boolean = false): Boolean {
        val env: Map<String, String?> = System.getenv()
        return decidePolling(
            PollingSignals(
                override = parsePollingOverride(env),
                isLinux = isLinux(),
                fsType = detectMountFsType(path),
                remoteIndicator = hasRemoteEnvIndicator(env) || dockerEnvExists() || extraRemoteIndicator,
            ),
        )
    }

    /** polling 間隔（ms）。取 `CHOKIDAR_INTERVAL`，否則預設 1000ms。 */
    fun pollingIntervalMs(env: Map<String, String?> = System.getenv()): Long {
        val n = env["CHOKIDAR_INTERVAL"]?.toLongOrNull()
        return if (n != null && n > 0) n else 1000L
    }

    /**
     * 遞迴掃描 dir 下 WATCHED_EXTENSIONS（`.md` + data artifact 副檔名）的 `絕對路徑 -> "lastModified:size"`
     * 快照（跳過 dotfile / dotdir）。
     * 輪詢時比對前後兩次快照：不相等即代表有新增 / 刪除 / 修改，需重新整理。無 IDE 相依，可單元測試。
     *
     * 值同時納入 size：9p / NFS 等網路掛載常是整秒 mtime，就地 append 若同秒內完成、mtime 不進位，
     * 只靠 lastModified 會漏偵測；chokidar 的 fs.watchFile 比對完整 stat，此處對齊該行為。
     */
    fun scanSnapshot(dir: File): Map<String, String> {
        val result = HashMap<String, String>()
        dir.walkTopDown()
            .onEnter { !it.name.startsWith(".") }
            .filter { f -> f.isFile && WATCHED_EXTENSIONS.any { ext -> f.name.lowercase().endsWith(ext) } }
            .forEach { result[it.absolutePath] = "${it.lastModified()}:${it.length()}" }
        return result
    }
}
