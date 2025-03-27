import autonav from '../../lib/index.js';

// Example showing permalink vs. non-permalink path styles
const files = {
  'index.html': { title: 'Home' },
  'about.html': { title: 'About' },
  'blog/index.html': { title: 'Blog' },
  'blog/post1.html': { title: 'Post 1' }
};

const permalinkMetadata = {};
const nonPermalinkMetadata = {};

const metalsmithMock = {
  metadata: () => permalinkMetadata,
  debug: () => () => {}
};

const nonPermalinkMock = {
  metadata: () => nonPermalinkMetadata,
  debug: () => () => {}
};

// Run with permalinks (default)
autonav()(files, metalsmithMock, () => {
  // Run without permalinks
  autonav({ usePermalinks: false })(files, nonPermalinkMock, () => {
    console.log(JSON.stringify({
      withPermalinks: {
        homePath: permalinkMetadata.nav.path,
        aboutPath: permalinkMetadata.nav.children.about.path,
        blogPath: permalinkMetadata.nav.children.blog.path,
        postPath: permalinkMetadata.nav.children.blog.children.post1.path
      },
      withoutPermalinks: {
        homePath: nonPermalinkMetadata.nav.path,
        aboutPath: nonPermalinkMetadata.nav.children.about.path,
        blogPath: nonPermalinkMetadata.nav.children.blog.path,
        postPath: nonPermalinkMetadata.nav.children.blog.children.post1.path
      }
    }, null, 2));
  });
});
