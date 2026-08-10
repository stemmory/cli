// stemmory-cli/packages/cli/src/lib/fs-safety.js
//
// Shared pre-flight + atomic-write helpers (adversarial review
///8/10/17/18). Goals:
//   - refuse to write through a symlink or over a directory instead of
//     following/clobbering it
//   - write-temp-then-rename so a crash or full disk mid-write leaves
//     either the old file or the new one, never a truncated hybrid -
//     which is exactly how the orphan-marker corruption starts
//     (closes the permission race as a side effect: the
//     renamed-in file carries the temp file's freshly chmod'd perms, not
//     whatever the old file happened to have)
//   - map raw errno codes to one-line messages instead of letting a raw
//     stack trace (with absolute paths) reach the user
import { closeSync, fchmodSync, fsyncSync, lstatSync, mkdirSync, openSync, renameSync, unlinkSync, writeSync } from "node:fs";
import path from "node:path";

export class StemmoryFsError extends Error {}

/**
 * @param {NodeJS.ErrnoException} err
 * @param {string} targetPath
 * @returns {string}
 */
export function mapFsError(err, targetPath) {
  switch (err.code) {
    case "EACCES":
    case "EPERM":
      return `permission denied writing "${targetPath}"`;
    case "EISDIR":
      return `"${targetPath}" is a directory, expected a file`;
    case "ENOTDIR":
      return `a parent directory of "${targetPath}" is not a directory`;
    case "EROFS":
      return `"${targetPath}" is on a read-only filesystem`;
    case "ENOSPC":
      return `no space left on device writing "${targetPath}"`;
    default:
      return `could not write "${targetPath}" (${err.code ?? err.message})`;
  }
}

/**
 * Refuses a symlink or a directory sitting where a file needs to go.
 * Missing is fine - that's the ordinary first-run case.
 * @param {string} filePath
 */
export function assertSafeFileTarget(filePath) {
  /** @type {import("node:fs").Stats} */
  let stat;
  try {
    stat = lstatSync(filePath);
  } catch (err) {
    const errno = /** @type {NodeJS.ErrnoException} */ (err);
    if (errno.code === "ENOENT") return;
    throw new StemmoryFsError(mapFsError(errno, filePath));
  }
  if (stat.isSymbolicLink()) {
    throw new StemmoryFsError(`refusing to write through a symlink: "${filePath}"`);
  }
  if (stat.isDirectory()) {
    throw new StemmoryFsError(`"${filePath}" is a directory, expected a file`);
  }
}

/**
 * Refuses a non-directory (or a symlink) sitting where a directory needs
 * to go, e.g. `.stemmory` existing as a plain file.
 * @param {string} dirPath
 */
export function assertSafeDirTarget(dirPath) {
  /** @type {import("node:fs").Stats} */
  let stat;
  try {
    stat = lstatSync(dirPath);
  } catch (err) {
    const errno = /** @type {NodeJS.ErrnoException} */ (err);
    if (errno.code === "ENOENT") return;
    throw new StemmoryFsError(mapFsError(errno, dirPath));
  }
  if (!stat.isDirectory()) {
    throw new StemmoryFsError(`"${dirPath}" exists and is not a directory`);
  }
}

/**
 * Write-to-temp-then-rename in the SAME directory (so the rename is a
 * single-filesystem, atomic operation), with the target's final
 * permission bits forced onto the fd via `fchmod` before any content is
 * written and before it's ever linked into place - a partially-written
 * temp file is never visible under the real filename, and it's never
 * briefly world-readable either.
 * @param {string} filePath
 * @param {string} content
 * @param {number} mode - POSIX permission bits, e.g. 0o600.
 */
export function atomicWriteFile(filePath, content, mode) {
  const dir = path.dirname(filePath);
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  } catch (err) {
    throw new StemmoryFsError(mapFsError(/** @type {NodeJS.ErrnoException} */ (err), filePath));
  }
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.stemmory-tmp-${process.pid}-${Date.now()}`);

  let fd;
  try {
    fd = openSync(tmpPath, "w", mode);
  } catch (err) {
    throw new StemmoryFsError(mapFsError(/** @type {NodeJS.ErrnoException} */ (err), filePath));
  }
  try {
    fchmodSync(fd, mode); // force exact bits regardless of umask, before content lands
    writeSync(fd, content);
    fsyncSync(fd);
  } catch (err) {
    closeSync(fd);
    try {
      unlinkSync(tmpPath);
    } catch {
      // best-effort cleanup only
    }
    throw new StemmoryFsError(mapFsError(/** @type {NodeJS.ErrnoException} */ (err), filePath));
  }
  closeSync(fd);

  try {
    renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // best-effort cleanup only
    }
    throw new StemmoryFsError(mapFsError(/** @type {NodeJS.ErrnoException} */ (err), filePath));
  }
}
