# metalsmith-autonav

Metalsmith plugin that automatically generates navigation trees and breadcrumb paths based on file structure

[![metalsmith:plugin][metalsmith-badge]][metalsmith-url]
[![npm: version][npm-badge]][npm-url]
[![license: MIT][license-badge]][license-url]
[![coverage][coverage-badge]][coverage-url]
[![ESM/CommonJS][modules-badge]][npm-url]

## Features

- Automatically generates hierarchical navigation from file structure
- Adds breadcrumb paths to each file
- Sorts navigation items based on custom properties
- Fully customizable options for determining navigation titles and paths
- Multiple navigation configurations in a single pass (e.g., header, footer, sidebar)
- Smart handling of directory nodes in navigation
- Flexible path handling with permalink support
- Modern Promise-based API with callback support for backward compatibility
- Supports both ESM and CommonJS module formats

## Installation

```bash
npm install metalsmith-autonav
```

## Usage

This plugin follows the standard Metalsmith plugin pattern and can be used both with ESM and CommonJS.

> **IMPORTANT**: This plugin must be used **before** the layouts plugin in your Metalsmith build chain. At this point, all your content files will have been transformed to `.html` files, which the autonav plugin expects.

### ESM (preferred)

```javascript
import metalsmith from 'metalsmith';
import markdown from 'metalsmith-markdown';
import layouts from 'metalsmith-layouts';
import autonav from 'metalsmith-autonav';

metalsmith(__dirname)
  .use(markdown()) // Convert Markdown to HTML
  .use(autonav({  // Then generate navigation
    // options go here
    navKey: 'navigation',
    breadcrumbKey: 'breadcrumbs',
    navLabelKey: 'navLabel'
  }))
  .use(layouts()) // Apply layouts
  .build((err) => {
    if (err) throw err;
    console.log('Build complete!');
  });
```

### CommonJS

```javascript
const metalsmith = require('metalsmith');
const markdown = require('metalsmith-markdown');
const layouts = require('metalsmith-layouts');
const autonav = require('metalsmith-autonav');

metalsmith(__dirname)
  .use(markdown()) // Convert Markdown to HTML
  .use(autonav({  // Then generate navigation
    // options go here
    navKey: 'navigation',
    breadcrumbKey: 'breadcrumbs',
    navLabelKey: 'navLabel'
  }))
  .use(layouts()) // Apply layouts
  .build((err) => {
    if (err) throw err;
    console.log('Build complete!');
  });
```

## How It Works

The plugin scans all files and generates:

1. A simpleflat navigation structure
2. Breadcrumb paths in each file's metadata

### Navigation Structure

The navigation structure features a simple flat organization. Each page may have its own children, maintaining a hierarchical structure for nested content.

Each navigation item contains only the essential properties:

- `title` - The display name for the navigation item
- `path` - The URL path (following the usePermalinks option setting)
- `children` - An object containing any child pages (empty object if none exist)
- `index` - (Optional) Only present if a page has a navIndex value set

For example, with this file structure:

```
src/
  index.md
  about.md
  blog/
    index.md
    post1.md
    post2.md
  products/
    index.md
    product1.md
```

The generated navigation object would look like:

```javascript
{
  "home": {
    "title": "Home",
    "path": "/"
  },
  "about": {
    "title": "About",
    "path": "/about/",
    "children": {}
  },
  "blog": {
    "title": "Blog",
    "path": "/blog/",
    "children": {
      "post1": {
        "title": "Post 1",
        "path": "/blog/post1/",
        "children": {}
      },
      "post2": {
        "title": "Post 2",
        "path": "/blog/post2/",
        "children": {}
      }
    }
  },
  "products": {
    "title": "Products",
    "path": "/products/",
    "children": {
      "product1": {
        "title": "Product 1",
        "path": "/products/product1/",
        "children": {}
      }
    }
  }
}
```

### Breadcrumb Paths

Each file will have a breadcrumb array added to its metadata, showing the path from the home page to the current page.

For example, the file `products/product1.html` would have a breadcrumb like:

```javascript
[
  { title: "Home", path: "/" },
  { title: "Products", path: "/products/" },
  { title: "Product 1", path: "/products/product1/" }  // With usePermalinks: true (default)
]
```

With `usePermalinks: false`, the paths would include the .html extension:

```javascript
[
  { title: "Home", path: "/index.html" },
  { title: "Products", path: "/products/index.html" },
  { title: "Product 1", path: "/products/product1.html" }
]
```

Example of using breadcrumbs in your templates:

```nunjucks
<!-- Display breadcrumbs -->
<ul class="breadcrumbs">
  {% for item in breadcrumb %}
    {% if loop.last %}
      <li>{{ item.title }}</li>
    {% else %}
      <li><a href="{{ item.path }}">{{ item.title }}</a></li>
    {% endif %}
  {% endfor %}
</ul>
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| navKey | String | 'nav' | Key in metalsmith metadata for the navigation object |
| navLabelKey | String/Function | 'navLabel' | Frontmatter property to override the default filename-based label, or a function for custom labels |
| navIndexKey | String | 'navIndex' | File property that defines a page's position in navigation |
| navExcludeKey | String | 'navExclude' | File property to exclude a page from navigation |
| breadcrumbKey | String | 'breadcrumb' | Key in file metadata for the breadcrumb path array |
| navHomePage | Boolean | true | Include home page in breadcrumb |
| navHomeLabel | String | 'Home' | Label for home page in breadcrumb (can be overridden with navLabel) |
| sortBy | String/Function | 'navIndex' | Property to sort navigation items by, or custom sort function |
| sortReverse | Boolean | false | Reverse sort order |
| pathFilter | Function | null | Custom function to filter file paths |
| usePermalinks | Boolean | true | Whether to use permalink-style paths (/about/ instead of /about.html) |
| configs | Object | null | Multiple named navigation configurations (see Multiple Navigations example) |

## Examples

### Modern Promise-Based Usage

For Metalsmith v2.5.0 and above, you can use the Promise-based API:

```javascript
// With async/await (recommended)
metalsmith(__dirname)
  .use(markdown())
  .use(async (files, metalsmith) => {
    // You can await the autonav plugin
    await autonav({
      navKey: 'navigation',
      navLabelKey: 'navLabel'
    })(files, metalsmith);
    
    // Do something with the navigation data
    console.log('Navigation generated:', metalsmith.metadata().navigation);
  })
  .use(layouts())
  .build()
  .then(() => console.log('Build complete!'))
  .catch(err => console.error(err));

// With promises
metalsmith(__dirname)
  .use(markdown())
  .use((files, metalsmith) => {
    return autonav({
      navKey: 'navigation',
      navLabelKey: 'navLabel'
    })(files, metalsmith)
      .then(() => {
        // Do something with the navigation data
        console.log('Navigation generated:', metalsmith.metadata().navigation);
      });
  })
  .use(layouts())
  .build()
  .then(() => console.log('Build complete!'))
  .catch(err => console.error(err));
```

### Custom Navigation Titles

By default, the plugin uses the filename converted to title case for navigation labels (e.g., "about-us.md" becomes "About Us").

To customize a page's navigation label, add the `navLabel` property to its frontmatter:

```markdown
---
navLabel: My Custom Nav Label
---
```

### Using a Function for Navigation Labels

For advanced customization, you can provide a function:

```javascript
metalsmith.use(autonav({
  navLabelKey: (file, filePath, filename) => {
    // Custom logic here
    if (file.customProperty) {
      return file.customProperty.toUpperCase();
    }
    // Default to filename with spaces instead of hyphens, and title case
    return filename.replace(/\.(html|md)$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}));
```

### Custom Sorting

To sort by date (newest first):

```javascript
metalsmith.use(autonav({
  sortBy: 'date',
  sortReverse: true
}));
```

Using a custom sort function:

```javascript
metalsmith.use(autonav({
  sortBy: (a, b) => {
    // Your custom sorting logic here
    return a.title.length - b.title.length; // Sort by title length as an example
  }
}));
```

### Excluding Pages

To exclude a page from navigation at navExclude to the page frontmatter:

```markdown
---
navExclude: true
---
```

### Custom Home Link

To customize the home link label and whether to include it in the breadcrumb:

```javascript
metalsmith.use(autonav({
  navHomeLabel: 'Home',
  navHomePage: true
}));
```

### Permalinks Configuration

When working with or without permalinks:

```javascript
// With permalinks (default) - creates paths like /about/
metalsmith.use(autonav({
  usePermalinks: true
}));

// Without permalinks - creates paths like /about.html
metalsmith.use(autonav({
  usePermalinks: false
}));
```

Typical usage with the metalsmith-permalinks plugin:

```javascript
// Process markdown  first
metalsmith
  .use(markdown())
  
  // Then run permalinks plugin to transform file paths
  .use(permalinks())
  
  // Then run autonav with usePermalinks set to true
  .use(autonav({
    usePermalinks: true
  }))
  
  // Finally apply layouts
  .use(layouts());
```

### Multiple Navigation Configurations

Create multiple navigation structures in a single pass:

```javascript
metalsmith.use(autonav({
  // Global options for all navigations
  options: {
    usePermalinks: true,
    navHomePage: true
  },
  
  // Named configurations with specific options
  configs: {
    // Main navigation in header
    main: {
      navKey: 'mainNav',
      navIndexKey: 'mainNavIndex',
      navExcludeKey: 'excludeFromMainNav',
      breadcrumbKey: 'breadcrumbs'
    },
    
    // Footer navigation with different options
    footer: {
      navKey: 'footerNav',
      navExcludeKey: 'excludeFromFooter',
      // No breadcrumbs for footer
      sortBy: 'footerOrder'
    },
    
    // Sidebar navigation with yet another configuration
    sidebar: {
      navKey: 'sideNav',
      navLabelKey: 'shortTitle',
      sortBy: 'sidebarIndex'
    }
  }
}));
```

Then in your templates, access each navigation structure separately:

```handlebars
<!-- Main navigation in header -->
<nav class="main-nav">
  {{#each metadata.mainNav as |item key|}}
    {{#if (ne key "home")}} <!-- Skip home in the menu if desired -->
      <a href="{{item.path}}">{{item.title}}</a>
      
      <!-- Display children if any -->
      {{#if item.children}}
        <ul class="submenu">
          {{#each item.children as |child childKey|}}
            <li><a href="{{child.path}}">{{child.title}}</a></li>
          {{/each}}
        </ul>
      {{/if}}
    {{/if}}
  {{/each}}
</nav>

<!-- Footer navigation -->
<nav class="footer-nav">
  {{#each metadata.footerNav as |item key|}}
    {{#if (ne key "home")}} <!-- Skip home in the menu if desired -->
      <a href="{{item.path}}">{{item.title}}</a>
    {{/if}}
  {{/each}}
</nav>
```

Note the use of `{{#each metadata.mainNav as |item key|}}` which iterates over the flat structure of pages at the root level. The `key` is the page identifier (e.g., "home", "about", "blog") and `item` is the navigation object with its properties.

## Test Coverage

This plugin maintains high test coverage to ensure reliability. Current test coverage is displayed in the badge at the top of this README.

To run tests locally:

```bash
npm test
```

To view coverage details:

```bash
npm run coverage
```

## Debug

This plugin uses metalsmith's debug functionality. To enable debug logs, set the `DEBUG` environment variable:

```bash
DEBUG=metalsmith-autonav node your-metalsmith-build.js
```

## CLI Usage

To use this plugin with the Metalsmith CLI, add it to your `metalsmith.json` file:

```json
{
  "plugins": {
    "metalsmith-markdown": {},
    "metalsmith-layouts": {
      "default": "default.njk",
      "directory": "layouts"
    },
    "metalsmith-autonav": {
      "navKey": "navigation",
      "breadcrumbKey": "breadcrumbs",
      "navLabelKey": "navLabel"
    }
  }
}
```

## License

MIT

[npm-badge]: https://img.shields.io/npm/v/metalsmith-autonav.svg
[npm-url]: https://www.npmjs.com/package/metalsmith-autonav
[metalsmith-badge]: https://img.shields.io/badge/metalsmith-plugin-green.svg?longCache=true
[metalsmith-url]: https://metalsmith.io
[license-badge]: https://img.shields.io/github/license/wernerglinka/metalsmith-autonav
[license-url]: LICENSE
[coverage-badge]: https://img.shields.io/badge/test%20coverage-96%25-brightgreen
[coverage-url]: #test-coverage
[modules-badge]: https://img.shields.io/badge/modules-ESM%2FCJS-blue