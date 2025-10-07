const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
	mode: 'production',
	entry: './src/index.js',
	module: {
		rules: [
			{
				test: /\.css$/,
				use: [
					'style-loader',
					'css-loader',
				],
			},
		],
	},
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'Leaflet.Freezy.bundle.js',
	},
	plugins: [
		new CopyPlugin({
			patterns: [
				{
					from: "./public/",
					globOptions: { ignore: [
						'**/index.html'
					] }
				},
			],
		}),
		new HtmlWebpackPlugin({
			template: './public/index.html',
			inject: 'head',
			scriptLoading: 'blocking',
		}),
	],
	devServer: {
		watchFiles: [ 'public/*.css' ],
	},
};
