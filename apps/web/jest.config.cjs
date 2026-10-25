module.exports = {
  ...require('../../jest.base.cjs'),
  rootDir: 'test',
  moduleNameMapper: { '^@marauder/shared$': '<rootDir>/../../../packages/shared/src/index.ts' },
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
};
