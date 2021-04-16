var path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

var LodashModuleReplacementPlugin = require('lodash-webpack-plugin');

var webpack = require('webpack');


const optimization = {
    //   splitChunks: {
    // // include all types of chunks
    // chunks: 'all'
    //   },
    minimize: true,
    minimizer: [
        new TerserPlugin({
            terserOptions: {
                warnings: false,
                compress: {
                    comparisons: false,
                    drop_console: true,
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
    nodeEnv: 'production',
};

const devConfig = {
    mode: 'development',
};

const prodConfig = {
    mode: 'production',
    optimization
};


module.exports = (env, argv) => {
    const isProduction = (argv.mode === 'production');

    return {
        devtool: '', //'source-map',
        entry: {
            wallet: './lib/wallet.js',
        },

        output: {
            path: path.resolve(__dirname, 'build'),
            filename: '[name].js',
            library: '',
            libraryTarget: 'umd'
        },
        target: "web",
        node: {
            fs: "empty"
        },
        module: {
            rules: [{
                test: /\.js$/,
                exclude: /node_modules/,
                loader: "babel-loader",
                'options': {
                    'plugins': ['lodash'],
                }
            }]
        },
        'plugins': [
            new LodashModuleReplacementPlugin,
            // new webpack.optimize.UglifyJsPlugin
        ],
        ...isProduction ? prodConfig : devConfig
    };
};