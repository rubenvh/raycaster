// Polyfill TextDecoder/TextEncoder for image-size v2
const { TextDecoder, TextEncoder } = require('util');
global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;
