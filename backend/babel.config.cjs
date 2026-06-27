const path = require('path');

function requireFromBackendFirst(packageName) {
  try {
    return require(require.resolve(packageName, { paths: [__dirname] }));
  } catch {
    return require(
      require.resolve(packageName, {
        paths: [path.resolve(__dirname, '../node_modules')],
      })
    );
  }
}

module.exports = {
  presets: [
    [
      requireFromBackendFirst('@babel/preset-env'),
      { targets: { node: 'current' } },
    ],
  ],
  plugins: [requireFromBackendFirst('babel-plugin-transform-import-meta')],
};
