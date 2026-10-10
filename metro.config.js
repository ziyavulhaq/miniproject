const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push(
  // Adds support for `.tflite` files
  'tflite',
  // Adds support for `.txt` label files
  'txt'
);

module.exports = config;
