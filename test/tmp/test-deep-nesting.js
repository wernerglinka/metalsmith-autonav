import autonav from '../../lib/index.js';

// Test specifically for deep nesting and breadcrumb generation
const files = {
  'index.html': { title: 'Home' },
  'about.html': { title: 'About' },
  'blog/index.html': { title: 'Blog' },
  'blog/post1.html': { title: 'Post 1' },
  'blog/category/index.html': { title: 'Category' },
  'blog/category/deep-post.html': { title: 'Deep Post' },
  'blog/category/subcategory/index.html': { title: 'Subcategory' }, 
  'blog/category/subcategory/very-deep-post.html': { title: 'Very Deep Post' }
};

const metadata = {};

const metalsmithMock = {
  metadata: () => metadata,
  debug: () => () => {}
};

// Run the plugin
autonav()(files, metalsmithMock, () => {
  console.log('NAVIGATION STRUCTURE:');
  console.log(JSON.stringify(metadata.nav, null, 2));
  
  console.log('BREADCRUMB FOR DEEP POST:');
  console.log(JSON.stringify(files['blog/category/deep-post.html'].breadcrumb, null, 2));
  
  console.log('BREADCRUMB FOR VERY DEEP POST:');
  console.log(JSON.stringify(files['blog/category/subcategory/very-deep-post.html'].breadcrumb, null, 2));
});
