import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import path from "path";

// The version crash reports carry: "<commit count>-<short sha>", e.g. 86-04b6aa7. The count keeps versions in
// order for AppReporter's "first seen in" and "came back" notes. A clone with shallow history (as some hosts make)
// is deepened first, or the count would be wrong. `npm run dev` is always 0-dev.
function gitVersion() {
  const git = args => execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  const shallow = () => git("rev-parse --is-shallow-repository") === "true";
  // Render's clone is shallow and its own remote won't deepen it, so fall back to the public repo.
  for (const from of ["", "https://github.com/RedNoot/wordshake.git"]) {
    try { if (shallow()) git(`fetch --unshallow --quiet ${from}`); } catch {}
  }
  try {
    const sha = git("rev-parse --short=7 HEAD");
    if (shallow()) {
      console.warn("version: couldn't deepen the shallow clone, so the version has no commit count");
      return `0-${sha}`;
    }
    return `${git("rev-list --count HEAD")}-${sha}`;
  }
  catch {
    console.warn("version: git isn't available here, so the version has no commit count");
    const sha = (process.env.RENDER_GIT_COMMIT || "").slice(0, 7);
    return sha ? `0-${sha}` : "0-dev";
  }
}

export default defineConfig(({ command }) => {
  const version = command === "build" ? gitVersion() : "0-dev";
  return {
    plugins: [
      react(),
      // The server reads the same version from dist/version.json (server/lib/reporting.js).
      { name: "version-file", writeBundle(opts) { writeFileSync(path.join(opts.dir, "version.json"), JSON.stringify({ version })); } },
    ],
    define: { __APP_VERSION__: JSON.stringify(version) },
    server: {
      proxy: {
        "/api": "http://localhost:3001",
        "/socket.io": { target: "http://localhost:3001", ws: true },
        "/check": "http://localhost:3001",
      },
    },
  };
});
