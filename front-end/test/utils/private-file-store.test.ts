import { Buffer } from "node:buffer"
import { lstat, mkdtemp, readFile, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { readPrivateTextFile, writePrivateFileAtomic, writePrivateFileExclusive } from "../../server/utils/private-file-store"

let dataDirectory: string

describe("private file storage", () => {
  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-private-store-"))
  })

  afterEach(async () => {
    await rm(dataDirectory, { force: true, recursive: true })
  })

  it("atomically writes private files and directories", async () => {
    const path = join(dataDirectory, "nested", "state.json")
    await writePrivateFileAtomic(path, "first")
    await writePrivateFileAtomic(path, "second")

    expect(await readPrivateTextFile(path)).toBe("second")

    if (process.platform !== "win32") {
      expect((await lstat(join(dataDirectory, "nested"))).mode & 0o777).toBe(0o700)
      expect((await lstat(path)).mode & 0o777).toBe(0o600)
    }
  })

  it("does not overwrite exclusive upload targets", async () => {
    const path = join(dataDirectory, "upload.bin")
    await writePrivateFileExclusive(path, Buffer.from("first"))
    await expect(writePrivateFileExclusive(path, Buffer.from("second"))).rejects.toMatchObject({ code: "EEXIST" })
    expect((await readFile(path)).toString("utf-8")).toBe("first")
  })

  it("refuses symbolic-link targets", async () => {
    if (process.platform === "win32")
      return

    const target = join(dataDirectory, "target")
    const linked = join(dataDirectory, "linked")
    await writePrivateFileAtomic(target, "secret")
    await symlink(target, linked)

    await expect(readPrivateTextFile(linked)).rejects.toThrow("Refusing to use symbolic link")
    await expect(writePrivateFileAtomic(linked, "replacement")).rejects.toThrow("Refusing to use symbolic link")
  })
})
