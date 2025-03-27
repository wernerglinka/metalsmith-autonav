/* global describe, it */

const assert = require('node:assert').strict;

// Import the plugin using CommonJS format
const autonav = require('../lib/index.cjs');

describe('metalsmith-autonav (CommonJS)', () => {
  // Verify the module loads correctly and exports a function
  it('should be properly importable as a CommonJS module', () => {
    assert.strictEqual(typeof autonav, 'function', 'Plugin should be a function when required with CommonJS');
    assert.strictEqual(typeof autonav(), 'function', 'Plugin should return a function when called');
  });
  
  // Add a basic functionality test to verify the plugin works with CommonJS
  it('should generate navigation in CommonJS environment', (done) => {
    // Create test files
    const files = {
      'index.md': {
        title: 'Home',
        contents: Buffer.from('# Home')
      },
      'about.md': {
        title: 'About',
        contents: Buffer.from('# About')
      }
    };
    
    // Create metalsmith metadata object
    const metadata = {};
    
    // Create metalsmith instance mock
    const metalsmithMock = {
      metadata: () => metadata,
      source: () => 'src',
      destination: () => 'build',
      debug: () => () => {}
    };
    
    // Run the plugin
    const plugin = autonav();
    
    plugin(files, metalsmithMock, (err) => {
      if (err) {
        return done(err);
      }
      
      // Check navigation tree was created
      assert.strictEqual(typeof metadata.nav, 'object', 'Navigation object should exist in metadata');
      
      // Check breadcrumbs were added to files
      assert.strictEqual(Array.isArray(files['about.md'].breadcrumb), true, 'Breadcrumb array should be added to files');
      
      done();
    });
  });
});