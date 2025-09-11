const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/',
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader'],
        },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.REACT_APP_WHATSAPP_GROUP_URL': JSON.stringify(process.env.REACT_APP_WHATSAPP_GROUP_URL || ''),
    }),
  ],
  devServer: {
    static: [
      path.join(__dirname, 'dist'),
      path.join(__dirname, 'public')
    ],
    historyApiFallback: true,
  host: '0.0.0.0', // permite acesso a partir de outros dispositivos na LAN
    port: 80,
  allowedHosts: 'all', // libera acesso usando IP local ou hostname
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:8080',
        changeOrigin: true,
        pathRewrite: { '^/api': '' }
      }
    ],
  },
};
