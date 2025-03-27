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
  
  // Test for debug export marker - this tests the CommonJS compatibility code
  it('should handle debug export marker', (done) => {
    // Create test environment
    const files = { 'index.md': { contents: Buffer.from('# Home') } };
    const metadata = {};
    const metalsmithMock = { 
      metadata: () => metadata, 
      source: () => 'src',
      destination: () => 'build',
      debug: () => () => {} 
    };
    
    // Save original process.env.DEBUG_EXPORTS
    const originalDebugExports = process.env.DEBUG_EXPORTS;
    
    try {
      // Set debug environment
      process.env.DEBUG_EXPORTS = 'true';
      
      // Test that the plugin runs without error in debug mode
      autonav()(files, metalsmithMock, (err) => {
        if (err) {
          return done(err);
        }
        
        // Check navigation was still generated properly
        assert.strictEqual(typeof metadata.nav, 'object', 'Navigation should be added to metadata even in debug mode');
        assert.ok(metadata.nav.home, 'Home page should be in navigation');
        
        done();
      });
    } finally {
      // Restore original DEBUG_EXPORTS environment
      process.env.DEBUG_EXPORTS = originalDebugExports;
    }
  });
  
  // Test the error handling in a CommonJS context
  it('should handle errors in CommonJS context', (done) => {
    // Create a problematic setup
    const files = {};
    const metalsmithMock = {
      metadata: () => null, // This will cause an error
      source: () => 'src',
      destination: () => 'build',
      debug: () => () => {}
    };
    
    // Run plugin and expect it to handle errors
    autonav()(files, metalsmithMock, (err) => {
      assert.ok(err, 'Should return an error');
      done();
    });
  });
});