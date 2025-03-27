import autonav from '../../lib/index.js';

// Let's test with pages that have variable nesting depths
const files = {
  'index.html': { title: 'Home' },
  'about.html': { title: 'About Us' },
  'page2/index.html': { title: 'Page 2' },
  'page3/index.html': { title: 'Page 3' }
};

const metadata = {};

const metalsmithMock = {
  metadata: () => metadata,
  debug: () => () => {}
};

// Run the plugin
autonav()(files, metalsmithMock, () => {
  // Print the structure directly
  console.log('Structure:');
  console.log(JSON.stringify(metadata.nav, null, 2));
  
  // Check how we're handling the top-level keys
  console.log('Root-level keys:', Object.keys(metadata.nav));
  
  // Check how children are structured
  console.log('Children keys:', Object.keys(metadata.nav.children));
});
