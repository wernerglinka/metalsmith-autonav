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
- Supports active page and active trail detection
- Creates section-specific navigation menus automatically
- Organizes navigation metadata in a clean, nested structure
- Intelligent duplicate detection and prevention for clean navigation trees
- Accurate path normalization for nested files to prevent malformed paths
- Sorts navigation items based on custom properties
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

> **IMPORTANT**: This plugin must be used **after** the markdown plugin and before the layouts plugin in your Metalsmith build chain, because it expects HTML files or Markdown files that will be converted to HTML.

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
    navKey: 'navigation'
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
    navKey: 'navigation'
  }))
  .use(layouts()) // Apply layouts
  .build((err) => {
    if (err) throw err;
    console.log('Build complete!');
  });
```

## How It Works

The plugin scans all files and generates:

1. A flat navigation structure with hierarchical children
2. Breadcrumb paths in each file's metadata

### File Metadata Keys

The plugin organizes all navigation-related metadata in a `navigation` object in frontmatter:

```markdown
---
title: About Us
navigation:
  navLabel: About Our Company
  navIndex: 2
  navExclude: false
---
```

These properties control navigation behavior:

- `navigation.navLabel` - Overwrites the file-name basednavigation label
- `navigation.navIndex` - Defines a page's position in navigation
- `navigation.navExclude` - Set to true to exclude the page from navigation
- `navigation.path` - The normalized path used for client-side active page detection (added automatically)
- `navigation.breadcrumb` - Where the breadcrumb path array is stored (added automatically)

### Navigation Structure

The navigation structure features a simple flat organization at the top level. Each page may have its own children, maintaining a hierarchical structure for nested content.

Each navigation item contains these properties:

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
    "path": "/",
    "children": {}
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

Each navigation item has a normalized path that can be used for client-side active page detection:

```javascript
{
  "title": "Post 1",
  "path": "/blog/post1/", 
  "children": {}
}
```

The normalized paths follow a consistent pattern that makes it easy to use for active page detection in client-side code.

### Breadcrumb Paths

Each file will have a breadcrumb array added to its metadata, showing the path from the home page to the current page.

For example, the file `/products/product1.html` would have a breadcrumb like:

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
  {% for item in navigation.breadcrumb %}
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
| navigationObjectKey | String | 'navigation' | Key for the object containing navigation metadata in frontmatter |
| navHomePage | Boolean | true | Include home page in breadcrumb |
| navHomeLabel | String | 'Home' | Label for home page in breadcrumb |
| sortBy | String/Function | 'navIndex' | Property to sort navigation items by, or custom sort function |
| sortReverse | Boolean | false | Reverse sort order |
| pathFilter | Function | null | Custom function to filter file paths |
| usePermalinks | Boolean | true | Whether to use permalink-style paths (/about/ instead of /about.html) |
| sectionMenus | Object | null | Map of section paths to menu keys for creating section-specific menus |
| configs | Object | null | Multiple named navigation configurations (see Multiple Navigations example) |

## Label Generation Logic

The plugin uses a simple and intuitive approach for generating navigation labels:

1. By default, converts filenames to title case (e.g., "about-us.md" becomes "About Us")
2. For index files, uses the parent directory name in title case (e.g., "blog/index.md" becomes "Blog")
3. Can be overridden with a `navLabel` property in frontmatter (e.g., `navLabel: "Custom Label"`)
4. Advanced users can provide a function for custom label generation via the `navLabelKey` option

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
      navKey: 'navigation'
    })(files, metalsmith);
    
    // Do something with the navigation data
    console.log('Navigation generated:', metalsmith.metadata().navigation);
  })
  .use(layouts())
  .build()
  .then(() => console.log('Build complete!'))
  .catch(err => console.error(err));
```

### Client-side Active Page Detection

The plugin stores each page's path in the navigation metadata. This path can be used for client-side active page detection using JavaScript or CSS:

```nunjucks
<!-- Main navigation with data attributes for client-side active state detection -->
<nav>
  <ul class="main-nav">
    {% for key, item in nav %}
      <li>
        <a href="{{ item.path }}" 
          {% if navigation and navigation.path and item.path and (item.path !== '/' and navigation.path.indexOf(item.path) === 0) or (item.path === '/' and navigation.path === '/') %}class="active"{% endif %}
        >
          {{ key }}
        </a>
        {% if item.children | length > 0 %}
          <ul class="submenu">
            {% for childKey, child in item.children %}
              <li>
                <a href="{{ child.path }}" 
                  {% if navigation and navigation.path and child.path and (child.path !== '/' and navigation.path.indexOf(child.path) === 0) or (child.path === '/' and navigation.path === '/') %}class="active"{% endif %}
                >
                  {{ childKey }}
                </a>
              </li>
            {% endfor %}
          </ul>
        {% endif %}
      </li>
    {% endfor %}
  </ul>
</nav>
```

### Section-Specific Menus

The plugin can automatically create section-specific menus by extracting portions of the main navigation tree. This is useful for showing relevant sub-navigation in different parts of your site.

Configure section menus using the `sectionMenus` option:

```javascript
// With single navigation configuration
metalsmith.use(autonav({
  // Main navigation settings
  navKey: 'mainNav',
  
  // Section-specific menus
  sectionMenus: {
    '/blog/': 'blogMenu',     // Creates a blogMenu from the /blog section
    '/products/': 'productNav',  // Creates a productNav from the /products section
    '/': 'topMenu'            // Creates a topMenu from the root level
  }
}));

// With multiple navigation configurations
metalsmith.use(autonav({
  // Global options
  options: {
    navHomePage: true
  },
  
  // Section-specific menus (global - uses the 'main' configuration)
  sectionMenus: {
    '/blog/': 'blogMenu',      // Creates a blogMenu from blog section
    '/products/': 'productNav' // Creates a productNav from products section
  },
  
  // Multiple named configurations
  configs: {
    main: {
      navKey: 'nav',          // Primary navigation
      breadcrumbKey: 'breadcrumb'
    },
    footer: {
      navKey: 'footerNav',    // Footer navigation 
      navExcludeKey: 'footerExclude'
    }
  }
}));
```

When using multiple navigation configurations, the section menus are created based on the `main` configuration's navigation tree (case-insensitive, so 'Main' or 'MAIN' will also work). If no configuration named 'main' exists, the plugin will use the first configuration for section menus.

Then in your templates, you can use these section-specific menus:

```nunjucks
<!-- Blog sidebar navigation - shows only blog section items -->
{% if blogMenu %}
  <nav class="blog-sidebar">
    <h3>Blog Categories</h3>
    <ul>
      {% for key, item in blogMenu %}
        <li><a href="{{ item.path }}">{{ item.title }}</a></li>
      {% endfor %}
    </ul>
  </nav>
{% endif %}
```

### Custom Navigation Titles

By default, the plugin uses the filename converted to title case for navigation labels (e.g., "about-us.md" becomes "About Us").

To customize a page's navigation label, add the `navLabel` property to the navigation object in frontmatter:

```markdown
---
title: About Us
navigation:
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

To exclude a page from navigation, add `navExclude: true` to the navigation object in frontmatter:

```markdown
---
title: Secret Page
navigation:
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

### Duplicate Prevention and Path Normalization

The plugin includes advanced handling of navigation paths to prevent common issues:

1. **Duplicate Detection**: The plugin's intelligent cleanup process prevents:
   - Pages appearing as their own children
   - Nested duplicates from folder/index.md files
   - Malformed paths with doubled directory names

2. **Path Normalization**: Especially for nested content, paths are properly normalized:
   - Blog posts: `/blog/post1/` (from blog/post1.html) properly normalized with parent directory
   - Products: `/products/product1/` (from products/product1.html) properly normalized
   - Files with names that include parent directory (like `blog/blogpost-1.html`) correctly preserve original filenames in paths (`/blog/blogpost-1/` not `/blog/post-1/`)
   - Intelligent detection of truly malformed paths vs. legitimate filenames that start with directory name

This ensures your navigation is always clean, consistent, and correctly structured.

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
// Process markdown first
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

```nunjucks
<!-- Main navigation in header -->
<header>
  <nav>
    <ul class="main-nav">
      {% for key, item in mainNav %}
        <li>
          <a href="{{ item.path }}">{{ item.title }}</a>
          {% if item.children | length > 0 %}
            <ul class="submenu">
              {% for childKey, child in item.children %}
                <li><a href="{{ child.path }}">{{ child.title }}</a></li>
              {% endfor %}
            </ul>
          {% endif %}
        </li>
      {% endfor %}
    </ul>
  </nav>
</header>

<!-- Footer navigation -->
<footer>
  <nav>
    <ul class="footer-nav">
      {% for key, item in footerNav %}
        <li><a href="{{ item.path }}">{{ item.title }}</a></li>
      {% endfor %}
    </ul>
  </nav>
</footer>
```

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

To enable debug logs, set the `DEBUG` environment variable:

```bash
DEBUG=metalsmith-autonav* metalsmith
```

Or in your code:

```javascript
metalsmith.env('DEBUG', 'metalsmith-autonav*')
```

## CLI Usage

To use this plugin with the Metalsmith CLI, add it to your `metalsmith.json` file:

```json
{
  "plugins": {
    "metalsmith-markdown": {},
    "metalsmith-autonav": {
      "navKey": "navigation"
    },
    "metalsmith-layouts": {
      "default": "default.njk",
      "directory": "layouts"
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
[coverage-badge]: https://img.shields.io/badge/test%20coverage-88%25-green
[coverage-url]: #test-coverage
[modules-badge]: https://img.shields.io/badge/modules-ESM%2FCJS-blue