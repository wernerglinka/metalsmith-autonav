import autonav from '../../lib/index.js';

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
  console.log(JSON.stringify(metadata, null, 2));
});
