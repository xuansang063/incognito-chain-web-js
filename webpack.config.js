const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

const optimization = {
  minimize: true,
  minimizer: [
    new TerserPlugin({
      terserOptions: {
        warnings: false,
        compress: {
          comparisons: false,
          drop_console: false
        },
        parse: {},
        mangle: true,
        output: {
          comments: false,
          ascii_only: true
        }
      },
      parallel: true,
      cache: true,
      sourceMap: false
    })
  ],
  nodeEnv: 'production'
};

const devConfig = {
  mode: 'development'
};

const prodConfig = {
  mode: 'production',
  optimization
};

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    devtool: 'source-map',
    entry: {
      wallet: './lib/wallet/wallet.js'
    },
    output: {
      path: path.resolve(__dirname),
      filename: 'build/[name].js',
      library: '',
      libraryTarget: 'umd'
    },
    target: 'web',
    node: {
      fs: 'empty'
    },
    module: {
      rules: [
        { test: /\.js$/, exclude: /node_modules/, loader: 'babel-loader' }
      ]
    },
    ...(isProduction ? prodConfig : devConfig)
  };
};
