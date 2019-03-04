var path = require('path');

module.exports = {
  mode: 'development',
  entry: {
    wallet: './lib/wallet/wallet.js'
  },
  output: {
    path: path.resolve(__dirname),
    filename: 'build/[name].js',
    library: '',
    libraryTarget:'umd'
  },
  module: {
    rules: [
      { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader" }
    ]
  }
};