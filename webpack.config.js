const path = require('path');

//console.log("dirname", __dirname);
let common_config = {
  node: {
    __dirname: true
  },
  mode: process.env.ENV || 'development',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: [
          /node_modules/,
           path.resolve(__dirname, "src/ui")
        ]
      }
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
};

module.exports = [
  Object.assign({}, common_config, {
    target: 'electron-main',
    entry: {
      main: './src/main/main.ts',
    },
    output: {
      filename: '[name]-bundle.js',
      path: path.resolve(__dirname, 'src/main/dist')
    },
    node: {
      __dirname: false,  // Use Node.js __dirname at runtime for correct preload path
    },
  }),
  Object.assign({}, common_config, {
    target: 'electron-preload',
    entry: {
      preload: './src/main/preload.ts',
    },
    output: {
      filename: '[name]-bundle.js',
      path: path.resolve(__dirname, 'src/main/dist')
    },
  }),
  Object.assign({}, common_config, {
    target: 'web',
    entry: {
      renderer: './src/renderer/renderer.ts',      
    },
    output: {
      filename: '[name]-bundle.js',
      path: path.resolve(__dirname, 'src/renderer/dist')
    },
  }),
  Object.assign({}, common_config, {
    target: 'webworker',
    entry: {      
      bspGenerator: './src/workers/bspGenerator.ts',
      rayCaster: './src/workers/ray-caster.ts'
    },
    output: {
      filename: '[name]-bundle.js',
      path: path.resolve(__dirname, 'src/workers/dist')
    },
  })
]
