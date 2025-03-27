import autonav from '../../lib/index.js';

// Test with your exact file structure with permalinks (all files are /page/index.html)
const files = {
  'index.html': { title: 'Index' },
  'page2/index.html': { title: 'Page2' },
  'page3/index.html': { title: 'Page3' },
  'page4/index.html': { title: 'Page4' },
  'blog/index.html': { title: 'Blog' },
  'blog/blogpost-1/index.html': { title: 'Blogpost 1' },
  'blog/blogpost-2/index.html': { title: 'Blogpost 2' },
  'blog/blogpost-3/index.html': { title: 'Blogpost 3' }
};

const metadata = {};

const metalsmithMock = {
  metadata: () => metadata,
  debug: () => () => {}
};

// Run the plugin
autonav()(files, metalsmithMock, () => {
  console.log('CLEANED-UP STRUCTURE:');
  console.log(JSON.stringify(metadata.nav, null, 2));
});
