import type { PathLike } from "node:fs"
import { randomUUID } from "node:crypto"
import { constants } from "node:fs"
import { link, lstat, mkdir, open, rename, rm } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

function isMissingFile(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT")
}

async function assertNotSymlink(path: PathLike) {
  try {
    const stats = await lstat(path)
    if (stats.isSymbolicLink())
      throw new Error(`Refusing to use symbolic link: ${String(path)}`)

    return stats
  }
  catch (error) {
    if (isMissingFile(error))
      return null

    throw error
  }
}

export async function ensurePrivateDirectory(path: string) {
  await mkdir(path, { mode: 0o700, recursive: true })
  const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
  try {
    const stats = await handle.stat()
    if (!stats.isDirectory())
      throw new Error(`Private data path is not a directory: ${path}`)

    await handle.chmod(0o700)
  }
  finally {
    await handle.close()
  }
}

export async function readPrivateFile(path: string) {
  const stats = await assertNotSymlink(path)
  if (!stats)
    return null
  if (!stats.isFile())
    throw new Error(`Private data path is not a regular file: ${path}`)

  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    return await handle.readFile()
  }
  finally {
    await handle.close()
  }
}

export async function readPrivateTextFile(path: string) {
  const bytes = await readPrivateFile(path)
  return bytes?.toString("utf-8") ?? null
}

async function writeTemporaryPrivateFile(targetPath: string, contents: string | Uint8Array) {
  const directory = dirname(targetPath)
  await ensurePrivateDirectory(directory)

  const temporaryPath = join(directory, `.${basename(targetPath)}.${randomUUID()}.tmp`)
  const handle = await open(temporaryPath, "wx", 0o600)
  try {
    await handle.writeFile(contents)
    await handle.sync()
  }
  catch (error) {
    await handle.close()
    await rm(temporaryPath, { force: true })
    throw error
  }

  await handle.close()
  return temporaryPath
}

export async function writePrivateFileAtomic(path: string, contents: string | Uint8Array) {
  await assertNotSymlink(path)
  const temporaryPath = await writeTemporaryPrivateFile(path, contents)

  try {
    await rename(temporaryPath, path)
  }
  catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

export async function writePrivateFileExclusive(path: string, contents: string | Uint8Array) {
  await assertNotSymlink(path)
  const temporaryPath = await writeTemporaryPrivateFile(path, contents)

  try {
    await link(temporaryPath, path)
  }
  finally {
    await rm(temporaryPath, { force: true })
  }
}
