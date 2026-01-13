const path = require("path");
const fs = require("fs/promises");
const { execFileSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const INCLUDE_PATHS = [
  "src",
  "assets",
  "_locales",
  "README.md",
  "PRIVACY.md",
  "TEST_CHECKLIST.md",
  "RELEASE.md",
];
const TARGETS = ["chrome", "firefox", "opera"];
const FIREFOX_MIN_VERSION = "109.0";

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
};

const writeJson = async (filePath, data) => {
  const content = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(filePath, content, "utf8");
};

const ensureEmptyDir = async (dirPath) => {
  await fs.rm(dirPath, { recursive: true, force: true });
  await fs.mkdir(dirPath, { recursive: true });
};

const copyPath = async (sourcePath, destPath) => {
  const stat = await fs.lstat(sourcePath);
  if (stat.isDirectory()) {
    await fs.mkdir(destPath, { recursive: true });
    const entries = await fs.readdir(sourcePath);
    for (const entry of entries) {
      if (entry === ".DS_Store") {
        continue;
      }
      await copyPath(
        path.join(sourcePath, entry),
        path.join(destPath, entry)
      );
    }
    return;
  }
  await fs.copyFile(sourcePath, destPath);
};

const buildManifestForTarget = (baseManifest, target) => {
  if (target !== "firefox") {
    return { ...baseManifest };
  }
  const firefoxId = process.env.FIREFOX_EXTENSION_ID;
  const gecko = { strict_min_version: FIREFOX_MIN_VERSION };
  if (firefoxId) {
    gecko.id = firefoxId;
  }
  return {
    ...baseManifest,
    browser_specific_settings: {
      gecko,
    },
  };
};

const zipTarget = (targetDir, zipPath) => {
  const args = ["-r", zipPath, "manifest.json", ...INCLUDE_PATHS];
  execFileSync("zip", args, { cwd: targetDir, stdio: "inherit" });
};

const buildAll = async () => {
  const baseManifest = await readJson(path.join(ROOT_DIR, "manifest.json"));
  const version = baseManifest.version || "0.0.0";

  await fs.mkdir(DIST_DIR, { recursive: true });

  for (const target of TARGETS) {
    const targetDir = path.join(DIST_DIR, target);
    await ensureEmptyDir(targetDir);

    for (const entry of INCLUDE_PATHS) {
      await copyPath(
        path.join(ROOT_DIR, entry),
        path.join(targetDir, entry)
      );
    }

    const manifest = buildManifestForTarget(baseManifest, target);
    await writeJson(path.join(targetDir, "manifest.json"), manifest);

    const zipName = `yt-gemini-summary-${target}-v${version}.zip`;
    const zipPath = path.join(DIST_DIR, zipName);
    await fs.rm(zipPath, { force: true });
    zipTarget(targetDir, zipPath);
  }
};

buildAll().catch((error) => {
  console.error("[build] Failed to build packages.", error);
  process.exitCode = 1;
});
