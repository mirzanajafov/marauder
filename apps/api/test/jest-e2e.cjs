module.exports = {
  ...require('../../../jest.base.cjs'),
  rootDir: '..',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  forceExit: true,
  testTimeout: 30000,
};
