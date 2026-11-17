import {defineConfig,globalIgnores} from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**","out/**","build/**","next-env.d.ts","node_modules/**",
    "api/**","public/**","src/index.js","supabase/**","tests/orbis-static.test.mjs"
  ])
]);