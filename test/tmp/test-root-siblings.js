import autonav from '../../lib/index.js';

// Simplified example demonstrating that root pages are siblings instead of children of index
const files = {
  'index.html': { title: 'Home' },
  'about.html': { title: 'About' },
  'contact.html': { title: 'Contact' },
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
  console.log(JSON.stringify({
    // Just the top level structure for clarity
    navStructure: {
      path: metadata.nav.path,
      title: metadata.nav.title,
      childrenKeys: Object.keys(metadata.nav.children)
    },
    // Drill into blog to see its children
    blogChildren: metadata.nav.children.blog ? 
      Object.keys(metadata.nav.children.blog.children) : []
  }, null, 2));
});
