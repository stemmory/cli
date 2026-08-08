// stemmory-cli/packages/cli/src/lib/fs-safety.test.js
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { assertSafeDirTarget, assertSafeFileTarget, atomicWriteFile, StemmoryFsError } from "./fs-safety.js";

describe("fs-safety", () => {
  /** @type {string} */
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "stemmory-fs-safety-"));
  });
  afterEach(() => {
    // Some tests chmod a directory read-only; restore before recursive rm.
    try {
      chmodSync(dir, 0o755);
    } catch {
      // ignore
    }
    rmSync(dir, { recursive: true, force: true });
  });

  describe("atomicWriteFile", () => {
    it("writes content and sets the exact mode requested", () => {
      const file = path.join(dir, "out.txt");
      atomicWriteFile(file, "hello\n", 0o600);
      expect(readFileSync(file, "utf8")).toBe("hello\n");
    });

    it("leaves no temp file behind on success", () => {
      const file = path.join(dir, "out.txt");
      atomicWriteFile(file, "hello\n", 0o644);
      expect(readdirSync(dir)).toEqual(["out.txt"]);
    });

    it("creates missing parent directories", () => {
      const file = path.join(dir, "a", "b", "c.txt");
      atomicWriteFile(file, "nested\n", 0o644);
      expect(readFileSync(file, "utf8")).toBe("nested\n");
    });

    it.skipIf(process.platform === "win32")(
      "raises a clean StemmoryFsError (not a raw errno exception) when a parent directory can't be created - regression for a gap found while reproducing finding 7",
      () => {
        // A permission wall INSIDE the path a temp file's own mkdirSync
        // needs to create - this was the exact gap: `atomicWriteFile`'s
        // `mkdirSync` call used to sit outside every try/catch, so a
        // permission failure here reached the caller as a raw Node
        // `EACCES: permission denied, mkdir '/abs/path'` error instead of
        // the mapped one-liner every other failure path already produced.
        const walledDir = path.join(dir, "walled");
        mkdirSync(walledDir);
        chmodSync(walledDir, 0o555); // read-only: can't create a subdirectory inside it
        const file = path.join(walledDir, "nested", "out.txt");

        let caught;
        try {
          atomicWriteFile(file, "x", 0o644);
        } catch (err) {
          caught = err;
        }
        expect(caught).toBeInstanceOf(StemmoryFsError);
        const message = /** @type {Error} */ (caught).message;
        expect(message).toMatch(/permission denied/i);
        expect(message).not.toMatch(/^EACCES:/); // not the raw Node message
      },
    );

    it.skipIf(process.platform === "win32")(
      "raises a clean StemmoryFsError when the target directory itself is read-only",
      () => {
        chmodSync(dir, 0o555);
        let caught;
        try {
          atomicWriteFile(path.join(dir, "out.txt"), "x", 0o644);
        } catch (err) {
          caught = err;
        }
        expect(caught).toBeInstanceOf(StemmoryFsError);
        expect(/** @type {Error} */ (caught).message).toMatch(/permission denied/i);
      },
    );

    it("replaces an existing file's permissions with the newly requested mode (finding 18)", () => {
      const file = path.join(dir, "out.txt");
      writeFileSync(file, "old", { mode: 0o644 });
      atomicWriteFile(file, "new", 0o600);
      expect(statSync(file).mode & 0o777).toBe(0o600);
      expect(readFileSync(file, "utf8")).toBe("new");
    });
  });

  describe("assertSafeFileTarget", () => {
    it("does not throw when the path doesn't exist", () => {
      expect(() => assertSafeFileTarget(path.join(dir, "missing.txt"))).not.toThrow();
    });

    it("throws on a symlink", () => {
      const target = path.join(dir, "target.txt");
      writeFileSync(target, "x");
      const link = path.join(dir, "link.txt");
      symlinkSync(target, link);
      expect(() => assertSafeFileTarget(link)).toThrow(/symlink/i);
    });

    it("throws on a directory", () => {
      const sub = path.join(dir, "sub");
      mkdirSync(sub);
      expect(() => assertSafeFileTarget(sub)).toThrow(/directory/i);
    });

    it("does not throw on a plain existing file", () => {
      const file = path.join(dir, "file.txt");
      writeFileSync(file, "x");
      expect(() => assertSafeFileTarget(file)).not.toThrow();
    });
  });

  describe("assertSafeDirTarget", () => {
    it("does not throw when the path doesn't exist", () => {
      expect(() => assertSafeDirTarget(path.join(dir, "missing"))).not.toThrow();
    });

    it("throws when a plain file sits where a directory is expected", () => {
      const file = path.join(dir, "not-a-dir");
      writeFileSync(file, "x");
      expect(() => assertSafeDirTarget(file)).toThrow(/not a directory/i);
    });

    it("does not throw on an existing directory", () => {
      const sub = path.join(dir, "sub");
      mkdirSync(sub);
      expect(() => assertSafeDirTarget(sub)).not.toThrow();
    });
  });
});
