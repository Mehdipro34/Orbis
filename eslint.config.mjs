import {defineConfig,globalIgnores} from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files:[
      "src/components/bookmarks-view.tsx",
      "src/components/clans-view.tsx",
      "src/components/live-feed.tsx",
      "src/components/notifications-view.tsx",
      "src/components/post-interactions.tsx",
      "src/components/profile-view.tsx"
    ],
    rules:{
      // These components synchronize asynchronous API reads with their loading state.
      "react-hooks/set-state-in-effect":"off"
    }
  },
  globalIgnores([
    ".next/**","out/**","build/**","next-env.d.ts","node_modules/**",
    "api/**","public/**","src/index.js","supabase/**",
    "tests/orbis-static.test.mjs","tests/orbis-public-feed.k6.js"
  ])
]);
