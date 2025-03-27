import autonav from '../../lib/index.js';

// Test with our new flat structure
const files = {
  'index.html': { title: 'Home' },
  'about.html': { title: 'About' },
  'page2/index.html': { title: 'Page 2' },
  'page3/index.html': { title: 'Page 3' },
  'blog/index.html': { title: 'Blog' },
  'blog/post1.html': { title: 'Post 1' },
  'blog/post2.html': { title: 'Post 2' }
};

const metadata = {};

const metalsmithMock = {
  metadata: () => metadata,
  debug: () => () => {}
};

// Run the plugin
autonav()(files, metalsmithMock, () => {
  console.log('COMPLETELY FLAT NAVIGATION STRUCTURE:');
  console.log(JSON.stringify(metadata.nav, null, 2));
});
