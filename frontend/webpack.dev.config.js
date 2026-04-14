const path = require('path')
const { merge } = require('webpack-merge')
const baseConfig = require('./webpack.base.config.js')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')

module.exports = merge(baseConfig, {
  mode: 'development',

  devtool: 'eval-cheap-module-source-map',

  output: {
    publicPath: '/',
    filename: 'js/[name].js',
    chunkFilename: 'js/[name].js'
  },

  devServer: {
    host: '0.0.0.0',
    port: 5173,
    hot: true,
    open: false,
    historyApiFallback: true,
    compress: true,
    client: {
      overlay: {
        errors: true,
        warnings: false
      }
    },
    setupMiddlewares: (middlewares, devServer) => {
      console.log('✅ Webpack Dev Server 准备就绪')
      return middlewares
    }
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'index.html'),
      filename: 'index.html',
      inject: true,
      scriptLoading: 'blocking'
    }),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('development')
      }
    })
  ],

  optimization: {
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: false,
    runtimeChunk: false,
    minimize: false,
    moduleIds: 'named'
  },

  cache: false
})
