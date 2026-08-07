const fs = require('fs');
const path = require('path');

const storefrontRoot = [
    path.resolve(__dirname, '../../../../vendor/shopware/storefront/Resources/app/storefront'),
    path.resolve(__dirname, '../../../../../../../vendor/shopware/storefront/Resources/app/storefront'),
].find((candidate) => fs.existsSync(candidate));

if (!storefrontRoot) {
    throw new Error('Shopware Storefront sources not found.');
}

module.exports = {
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    rootDir: __dirname,
    testEnvironment: 'jsdom',
    testMatch: ['<rootDir>/test/**/*.test.js'],
    moduleNameMapper: {
        '^src/(.*)$': `${storefrontRoot}/src/$1`,
    },
    setupFilesAfterEnv: [`${storefrontRoot}/jest.init.js`],
    transform: {
        '^.+\\.(t|j)s$': [
            'babel-jest',
            { configFile: `${storefrontRoot}/.babelrc.js` },
        ],
    },
};
