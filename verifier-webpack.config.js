var path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");

const optimization = {
  minimize: true,
  minimizer: [
    new TerserPlugin({
      terserOptions: {
        warnings: false,
        compress: {
          comparisons: false,
          drop_console: false,
        },
        parse: {},
        mangle: true,
        output: {
          comments: false,
          ascii_only: true,
        },
      },
      parallel: true,
      cache: true,
      sourceMap: false,
    }),
  ],
  nodeEnv: "production",
};

const devConfig = {
  mode: "development",
};

const prodConfig = {
  mode: "production",
  optimization,
};

const aliasConfig = {
  resolve: {
    alias: {
      "@lib": path.resolve(__dirname, "lib"),
    },
  },
};

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production";

  const cfg = {
    devtool: "source-map",
    entry: {
      verifier: "./lib/verifier/index.js",
    },
    output: {
      path: path.resolve(__dirname, 'lib/verifier/build'),
      filename: "[name].js",
      library: "",
      libraryTarget: "umd",
    },
    target: "web",
    node: {
      fs: "empty",
    },
    module: {
      rules: [{
        test: /\.js$/,
        exclude: /node_modules/,
        loader: "babel-loader",
        options: {
          plugins: ["lodash", "@babel/plugin-proposal-class-properties", ["@babel/plugin-transform-runtime", {
            "regenerator": true
          }]],
          presets: ["@babel/preset-env"],
        },
      }, ],
    },
    ...(isProduction ? prodConfig : devConfig),
    ...aliasConfig,
  };

  return cfg;
};