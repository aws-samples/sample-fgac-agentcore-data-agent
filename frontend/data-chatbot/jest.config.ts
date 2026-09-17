import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  moduleNameMapper: {
    // Handle @/* path alias from tsconfig
    "^@/(.*)$": "<rootDir>/$1",
    // Handle CSS imports
    "\\.(css|less|scss|sass)$": "<rootDir>/__mocks__/styleMock.js",
    // Handle image imports
    "\\.(jpg|jpeg|png|gif|svg|webp)$": "<rootDir>/__mocks__/fileMock.js",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
};

export default config;
