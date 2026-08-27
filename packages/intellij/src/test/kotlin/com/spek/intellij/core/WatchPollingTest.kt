package com.spek.intellij.core

import java.io.File
import java.nio.file.Files
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import com.spek.intellij.core.WatchPolling.PollingSignals

/** 對齊 @spekjs/core watch-polling.test.ts 的判定邏輯測試 */
class WatchPollingTest {

    @Test
    fun fsTypeNeedsPolling_networkAndVirtualMounts() {
        for (t in listOf("9p", "v9fs", "drvfs", "cifs", "smb3", "nfs", "nfs4", "vboxsf", "prl_fs")) {
            assertTrue(WatchPolling.fsTypeNeedsPolling(t), t)
        }
    }

    @Test
    fun fsTypeNeedsPolling_fuseVariants() {
        assertTrue(WatchPolling.fsTypeNeedsPolling("fuse.sshfs"))
        assertTrue(WatchPolling.fsTypeNeedsPolling("fuse"))
        assertTrue(WatchPolling.fsTypeNeedsPolling("fuseblk"))
    }

    @Test
    fun fsTypeNeedsPolling_nativeFilesystems() {
        for (t in listOf("ext4", "overlay", "btrfs", "xfs", "tmpfs")) {
            assertFalse(WatchPolling.fsTypeNeedsPolling(t), t)
        }
    }

    @Test
    fun fsTypeNeedsPolling_caseInsensitiveAndNull() {
        assertTrue(WatchPolling.fsTypeNeedsPolling("9P"))
        assertTrue(WatchPolling.fsTypeNeedsPolling("NFS4"))
        assertFalse(WatchPolling.fsTypeNeedsPolling(null))
    }

    private val mounts = listOf(
        "rootfs / rootfs rw 0 0",
        "/dev/sda1 / ext4 rw,relatime 0 0",
        "overlay /var/lib/docker overlay rw 0 0",
        "host_mnt /workspaces 9p rw,trans=virtio 0 0",
        "//server/share /mnt/smb cifs rw 0 0",
    ).joinToString("\n")

    @Test
    fun parseMountFsType_longestPrefixWins() {
        assertEquals("9p", WatchPolling.parseMountFsType(mounts, "/workspaces/janitarr/openspec"))
        assertEquals("cifs", WatchPolling.parseMountFsType(mounts, "/mnt/smb/x"))
        assertEquals("ext4", WatchPolling.parseMountFsType(mounts, "/home/user/proj/openspec"))
    }

    @Test
    fun parseMountFsType_exactMountPointCovered() {
        assertEquals("9p", WatchPolling.parseMountFsType(mounts, "/workspaces"))
    }

    @Test
    fun parseMountFsType_handlesOctalEscapedSpace() {
        val m = "/dev/sda1 / ext4 rw 0 0\nhost /mnt/My\\040Files 9p rw 0 0"
        assertEquals("9p", WatchPolling.parseMountFsType(m, "/mnt/My Files/openspec"))
    }

    @Test
    fun parseMountFsType_noMatchReturnsNull() {
        assertNull(WatchPolling.parseMountFsType("garbage line\n", "/x"))
    }

    @Test
    fun parsePollingOverride_truthyFalsy() {
        assertEquals(true, WatchPolling.parsePollingOverride(mapOf("SPEK_WATCH_POLLING" to "on")))
        assertEquals(true, WatchPolling.parsePollingOverride(mapOf("SPEK_WATCH_POLLING" to "1")))
        assertEquals(false, WatchPolling.parsePollingOverride(mapOf("SPEK_WATCH_POLLING" to "off")))
        assertEquals(false, WatchPolling.parsePollingOverride(mapOf("SPEK_WATCH_POLLING" to "0")))
    }

    @Test
    fun parsePollingOverride_fallbackAndUnset() {
        assertEquals(true, WatchPolling.parsePollingOverride(mapOf("CHOKIDAR_USEPOLLING" to "true")))
        assertNull(WatchPolling.parsePollingOverride(emptyMap()))
        assertNull(WatchPolling.parsePollingOverride(mapOf("SPEK_WATCH_POLLING" to "maybe")))
    }

    @Test
    fun parsePollingOverride_spekWins() {
        assertEquals(
            false,
            WatchPolling.parsePollingOverride(
                mapOf("SPEK_WATCH_POLLING" to "off", "CHOKIDAR_USEPOLLING" to "true"),
            ),
        )
    }

    @Test
    fun hasRemoteEnvIndicator_detectsCommonVars() {
        assertTrue(WatchPolling.hasRemoteEnvIndicator(mapOf("REMOTE_CONTAINERS" to "true")))
        assertTrue(WatchPolling.hasRemoteEnvIndicator(mapOf("CODESPACES" to "true")))
        assertTrue(WatchPolling.hasRemoteEnvIndicator(mapOf("WSL_DISTRO_NAME" to "Ubuntu")))
        assertFalse(WatchPolling.hasRemoteEnvIndicator(emptyMap()))
    }

    @Test
    fun decidePolling_overrideWins() {
        assertTrue(WatchPolling.decidePolling(PollingSignals(true, false, "ext4", false)))
        assertFalse(WatchPolling.decidePolling(PollingSignals(false, true, "9p", true)))
    }

    @Test
    fun decidePolling_nonLinuxNeverPolls() {
        assertFalse(WatchPolling.decidePolling(PollingSignals(null, false, null, true)))
    }

    @Test
    fun decidePolling_linuxNonEventFsPolls() {
        assertTrue(WatchPolling.decidePolling(PollingSignals(null, true, "9p", false)))
    }

    @Test
    fun decidePolling_linuxNativeFsNoPoll() {
        assertFalse(WatchPolling.decidePolling(PollingSignals(null, true, "overlay", true)))
    }

    @Test
    fun decidePolling_unknownFsFallsBackToRemoteIndicator() {
        assertTrue(WatchPolling.decidePolling(PollingSignals(null, true, null, true)))
        assertFalse(WatchPolling.decidePolling(PollingSignals(null, true, null, false)))
    }

    @Test
    fun pollingIntervalMs_defaultAndOverride() {
        assertEquals(1000L, WatchPolling.pollingIntervalMs(emptyMap()))
        assertEquals(500L, WatchPolling.pollingIntervalMs(mapOf("CHOKIDAR_INTERVAL" to "500")))
        assertEquals(1000L, WatchPolling.pollingIntervalMs(mapOf("CHOKIDAR_INTERVAL" to "abc")))
        assertEquals(1000L, WatchPolling.pollingIntervalMs(mapOf("CHOKIDAR_INTERVAL" to "-5")))
    }

    // --- scanSnapshot：輪詢偵測機制（對應 chokidar 的 polling smoke test） ---

    private val tempDirs = mutableListOf<File>()

    @AfterTest
    fun cleanupTempDirs() {
        tempDirs.forEach { it.deleteRecursively() }
    }

    private fun mkTempOpenspec(): File {
        val dir = Files.createTempDirectory("spek-poll-").toFile()
        tempDirs.add(dir)
        return dir
    }

    @Test
    fun scanSnapshot_detectsNewlyCreatedFile() {
        val dir = mkTempOpenspec()
        val before = WatchPolling.scanSnapshot(dir)
        // watcher ready 後才新建的檔案（容器內失效的情境）
        File(dir, "brainstorm.md").writeText("# hi")
        val after = WatchPolling.scanSnapshot(dir)
        assertNotEquals(before, after, "新建 .md 後快照應改變")
        assertTrue(after.keys.any { it.endsWith("brainstorm.md") })
    }

    @Test
    fun scanSnapshot_detectsFileInNewlyCreatedNestedDir() {
        val dir = mkTempOpenspec()
        val before = WatchPolling.scanSnapshot(dir)
        val nested = File(dir, "changes/x/specs/topic")
        nested.mkdirs()
        File(nested, "spec.md").writeText("# spec")
        assertNotEquals(before, WatchPolling.scanSnapshot(dir), "巢狀新建目錄內的 spec.md 應被偵測")
    }

    @Test
    fun scanSnapshot_detectsSizeChangeWithUnchangedMtime() {
        val dir = mkTempOpenspec()
        val f = File(dir, "spec.md")
        f.writeText("# hi")
        // 釘住 mtime 到固定整秒，模擬 9p / NFS 上就地 append 時 mtime 不進位的情境
        val fixedMtime = 1_700_000_000_000L
        f.setLastModified(fixedMtime)
        val before = WatchPolling.scanSnapshot(dir)
        f.appendText(" appended, size grew")
        f.setLastModified(fixedMtime)
        val after = WatchPolling.scanSnapshot(dir)
        assertNotEquals(before, after, "mtime 不變但 size 改變時仍應偵測到（快照值需納入 size）")
    }

    @Test
    fun scanSnapshot_includesEveryDataExtension_skipsDotDirsAndNonArtifacts() {
        val dir = mkTempOpenspec()
        File(dir, "keep.md").writeText("a")
        File(dir, "keep.yaml").writeText("b")
        File(dir, "keep.yml").writeText("c")
        File(dir, "keep.json").writeText("d")
        File(dir, "ignore.txt").writeText("e")
        File(dir, ".git").apply { mkdirs() }.let { File(it, "inside.md").writeText("f") }
        val snap = WatchPolling.scanSnapshot(dir)
        // Markdown plus every data artifact extension is watched, so editing a .yml / .json artifact
        // changes the snapshot and fires a refresh. A non-artifact (.txt) and dotdirs stay out.
        assertEquals(4, snap.size, "計入 .md 與所有 data 副檔名，跳過非 artifact 與 dotdir")
        assertTrue(snap.keys.any { it.endsWith("keep.md") })
        assertTrue(snap.keys.any { it.endsWith("keep.yaml") })
        assertTrue(snap.keys.any { it.endsWith("keep.yml") })
        assertTrue(snap.keys.any { it.endsWith("keep.json") })
        assertFalse(snap.keys.any { it.endsWith("ignore.txt") })
    }
}
