import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/main.js', // Your main JS file
  output: {
    file: './dist/main.js',
    format: 'iife', // Immediately Invoked Function Expression (suitable for browsers)
    name: 'App', // Name of the global variable for your app
  },
  plugins: [
    resolve(),  // Helps Rollup find modules in node_modules
    commonjs()  // Converts CommonJS modules to ES6
  ]
};
