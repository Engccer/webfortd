import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // SwiftPM 로컬 빌드 산출물(git-ignored) — swift test 실행 머신에서 lint가 깨지는 것 방지.
    "ios/**/.build/**",
  ]),
  // underscore prefix(_id, _text 등)는 의도된 ignore convention.
  // destructure rest 패턴 또는 시그니처 호환용 unused param에 사용.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
