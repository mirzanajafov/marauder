module.exports = {
  ...require('../../jest.base.cjs'),
  moduleNameMapper: { '^@marauder/shared$': '<rootDir>/../../../packages/shared/src/index.ts' },
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.jest.json' }] },
};
