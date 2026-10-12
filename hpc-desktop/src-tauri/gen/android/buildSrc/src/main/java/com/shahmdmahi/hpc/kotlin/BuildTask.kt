import java.io.File
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction
import javax.inject.Inject
import org.gradle.process.ExecOperations

abstract class BuildTask : DefaultTask() {
    @get:Inject
    abstract val execOperations: ExecOperations

    @Input
    var rootDirRel: String? = null
    @Input
    var projectDir: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        val rootDir = File(projectDir, rootDirRel ?: ".")
        val profile = if (release == true) "release" else "debug"
        val arch = when (target) {
            "aarch64" -> "arm64-v8a"
            "armv7" -> "armeabi-v7a"
            "i686" -> "x86"
            "x86_64" -> "x86_64"
            else -> "arm64-v8a"
        }
        val targetTriple = when (target) {
            "aarch64" -> "aarch64-linux-android"
            "armv7" -> "armv7-linux-androideabi"
            "i686" -> "i686-linux-android"
            "x86_64" -> "x86_64-linux-android"
            else -> target ?: "aarch64-linux-android"
        }
        val jniDestDir = File(projectDir, "src/main/jniLibs/$arch")
        jniDestDir.mkdirs()
        val soDest = File(jniDestDir, "libhpc_lib.so")
        val soSrc = File(rootDir, "src-tauri/target/$targetTriple/$profile/libhpc_lib.so")

        if (soDest.exists() && soDest.length() > 0) {
            logger.lifecycle("Using existing jniLib: ${soDest.absolutePath}")
            return
        }

        if (soSrc.exists() && soSrc.length() > 0) {
            logger.lifecycle("Copying ${soSrc.absolutePath} to ${soDest.absolutePath}")
            soSrc.copyTo(soDest, overwrite = true)
            return
        }

        val executable = """pnpm"""
        try {
            runTauriCli(executable)
        } catch (e: Exception) {
            if (soSrc.exists() && soSrc.length() > 0) {
                logger.lifecycle("Falling back to copying ${soSrc.absolutePath}")
                soSrc.copyTo(soDest, overwrite = true)
                return
            }
            if (Os.isFamily(Os.FAMILY_WINDOWS)) {
                val fallbacks = listOf(
                    "$executable.exe",
                    "$executable.cmd",
                    "$executable.bat",
                )

                var lastException: Exception = e
                for (fallback in fallbacks) {
                    try {
                        runTauriCli(fallback)
                        return
                    } catch (fallbackException: Exception) {
                        if (soSrc.exists() && soSrc.length() > 0) {
                            logger.lifecycle("Falling back to copying ${soSrc.absolutePath}")
                            soSrc.copyTo(soDest, overwrite = true)
                            return
                        }
                        lastException = fallbackException
                    }
                }
                throw lastException
            } else {
                throw e
            }
        }
    }

    fun runTauriCli(executable: String) {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")
        val args = listOf("tauri", "android", "android-studio-script")

        execOperations.exec {
            workingDir(File(projectDir, rootDirRel))
            executable(executable)
            args(args)
            if (logger.isEnabled(LogLevel.DEBUG)) {
                args("-vv")
            } else if (logger.isEnabled(LogLevel.INFO)) {
                args("-v")
            }
            if (release) {
                args("--release")
            }
            args(listOf("--target", target))
        }.assertNormalExitValue()
    }
}