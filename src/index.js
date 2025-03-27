// No external debug module needed - we'll use metalsmith.debug

/**
 * @typedef {Object} NavOptions
 * @property {string} [navKey='nav'] - Key in metalsmith metadata for the navigation object
 * @property {string|Function} [navLabelKey='navLabel'] - Frontmatter property to override the default filename-based label, or a function for custom labels
 * @property {string} [navIndexKey='navIndex'] - File property that defines a page's position in navigation
 * @property {boolean} [navExcludeKey='navExclude'] - File property to exclude a page from navigation
 * @property {string} [breadcrumbKey='breadcrumb'] - Key in file metadata for the breadcrumb path array
 * @property {boolean} [navHomePage=true] - Include home page in breadcrumb
 * @property {string} [navHomeLabel='Home'] - Label for home page in breadcrumb
 * @property {string} [sortBy='navIndex'] - Property to sort navigation items by
 * @property {boolean} [sortReverse=false] - Reverse sort order
 * @property {Function} [pathFilter=null] - Custom function to filter file paths
 * @property {boolean} [usePermalinks=true] - Whether to use permalink-style paths (/about/ instead of /about.html)
 */

/**
 * @typedef {Object} ConfiguredNavOptions
 * @property {Object.<string, NavOptions>} [configs] - Multiple named navigation configurations
 * @property {NavOptions} [options] - Default options for all navigations if configs not provided
 */

/**
 * Creates hierarchical navigation trees and breadcrumb paths from file structure.
 * IMPORTANT: This plugin must be used AFTER the layouts plugin since it expects
 * content files to have been transformed to .html files.
 * 
 * This plugin supports both traditional callback-style API and modern Promise-based
 * API for use with async/await in Metalsmith v2.5.0 and above.
 * 
 * @param {ConfiguredNavOptions|NavOptions} [options] - Navigation options or configurations
 * @returns {import('metalsmith').Plugin} Plugin function that returns a Promise when no callback is provided
 * @example
 * // Basic usage - AFTER layouts plugin
 * metalsmith.use(markdown())
 *   .use(layouts())
 *   .use(autonav());
 * 
 * // With options - AFTER layouts plugin
 * metalsmith.use(markdown())
 *   .use(layouts())
 *   .use(autonav({
 *     navKey: 'navigation',
 *     breadcrumbKey: 'breadcrumbs',
 *     navLabel: 'title',
 *     sortBy: 'date',
 *     sortReverse: true,
 *     usePermalinks: true
 *   }));
 * 
 * // Without permalinks (creates paths like /about.html) - AFTER layouts plugin
 * metalsmith.use(markdown())
 *   .use(layouts())
 *   .use(autonav({
 *     usePermalinks: false
 *   }));
 * 
 * // Multiple navigation configurations
 * metalsmith.use(markdown())
 *   .use(layouts())
 *   .use(autonav({
 *     configs: {
 *       main: { 
 *         navKey: 'mainNav',
 *         navLabel: 'title'
 *       },
 *       footer: {
 *         navKey: 'footerNav',
 *         navExcludeKey: 'footerExclude',
 *         sortBy: 'footerOrder'
 *       }
 *     }
 *   }));
 * 
 * // Modern Promise-based usage with async/await
 * metalsmith.use(markdown())
 *   .use(layouts())
 *   .use(async (files, metalsmith) => {
 *     await autonav({ navKey: 'navigation' })(files, metalsmith);
 *     console.log('Navigation generated successfully!');
 *   });
 */
function autonav(options = {}) {
  // Default options for a single navigation
  const defaultOpts = {
    navKey: 'nav',
    navLabelKey: 'navLabel', // Frontmatter property to override the default filename-based label
    navIndexKey: 'navIndex',
    navExcludeKey: 'navExclude',
    breadcrumbKey: 'breadcrumb',
    navHomePage: true,
    navHomeLabel: 'Home',
    sortBy: 'navIndex',
    sortReverse: false,
    pathFilter: null,
    usePermalinks: true
  };

  return function(files, metalsmith, done) {
    const debug = metalsmith.debug ? metalsmith.debug('metalsmith-autonav') : () => {};
    
    // Promise-based implementation
    const processNavigation = async () => {
      try {
        // Handle multiple configurations if provided
        if (options.configs && typeof options.configs === 'object') {
          debug('Multiple navigation configurations detected: %O', Object.keys(options.configs));
          
          // Process each navigation configuration
          for (const configName of Object.keys(options.configs)) {
            const configOpts = {
              ...defaultOpts,
              ...options.options, // Global options if provided
              ...options.configs[configName] // Config-specific options
            };
            
            debug('Building navigation for config "%s" with options: %O', configName, configOpts);
            
            // Build navigation tree for this config
            const navTree = buildNavTree(files, configOpts, debug);
            
            // Add to metalsmith metadata
            metalsmith.metadata()[configOpts.navKey] = navTree;
            debug('Added navigation tree for "%s" to metalsmith metadata key: %s', configName, configOpts.navKey);
            
            // Generate breadcrumbs for this config
            generateBreadcrumbs(files, navTree, configOpts, debug);
          }
        } else {
          // Single navigation configuration
          const opts = { ...defaultOpts, ...options };
          debug('Single navigation configuration with options: %O', opts);
          
          // Build navigation tree
          const navTree = buildNavTree(files, opts, debug);
          
          // Add navigation to metalsmith metadata
          metalsmith.metadata()[opts.navKey] = navTree;
          debug('Added navigation tree to metalsmith metadata: %O', navTree);
          
          // Generate breadcrumbs for each file
          generateBreadcrumbs(files, navTree, opts, debug);
        }
        
        debug('Completed processing all navigations');
        return Promise.resolve();
      } catch (error) {
        debug('Error processing navigation: %O', error);
        return Promise.reject(error);
      }
    };
    
    // Support both callback and Promise-based workflows
    if (done) {
      // Traditional callback style
      processNavigation()
        .then(() => setImmediate(done))
        .catch(err => setImmediate(() => done(err)));
    } else {
      // Modern Promise style (for async/await in Metalsmith v2.5.0+)
      return processNavigation();
    }
  };
}

/**
 * Build navigation tree from files
 * 
 * @param {Object} files - Metalsmith files object
 * @param {NavOptions} options - Navigation options
 * @param {Function} debug - Debug function
 * @returns {Object} Navigation tree
 */
function buildNavTree(files, options, debug) {
  // Create a hierarchical structure with pages nested appropriately
  const tree = {};
  const filePaths = Object.keys(files);
  
  debug('Building navigation tree from %d files', filePaths.length);

  // Sort files if needed
  if (options.sortBy) {
    filePaths.sort((a, b) => {
      let valA = files[a][options.sortBy] !== undefined ? files[a][options.sortBy] : Infinity;
      let valB = files[b][options.sortBy] !== undefined ? files[b][options.sortBy] : Infinity;
      
      // For string comparisons
      if (typeof valA === 'string' && typeof valB === 'string') {
        return options.sortReverse ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      
      // For numeric comparisons
      return options.sortReverse ? valB - valA : valA - valB;
    });
  }

  // Process each file
  filePaths.forEach(filePath => {
    const file = files[filePath];
    
    // Skip files that should be excluded from navigation
    if (file[options.navExcludeKey]) {
      debug('Skipping file excluded from navigation: %s', filePath);
      return;
    }
    
    // Skip files filtered by custom pathFilter
    if (options.pathFilter && !options.pathFilter(filePath, file)) {
      debug('Skipping file filtered by custom pathFilter: %s', filePath);
      return;
    }

    // Get file path segments
    const segments = filePath.split('/');
    const filename = segments.pop();
    
    // Skip if not an HTML file or markdown file (that will become HTML)
    if (!filename.endsWith('.html') && !filename.endsWith('.md')) {
      return;
    }

    // Get the navigation title/label with simpler, more direct approach
    let navTitle;
    
    // Convert filename from slug format to title case (e.g., "about-us" → "About Us")
    const toTitleCase = (str) => {
      // Handle index files by using their parent directory name instead
      if (str === 'index' && segments.length > 0) {
        return segments[segments.length - 1]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, char => char.toUpperCase());
      }
      return str
        .replace(/-/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
    };
    
    // First check if a function was provided
    if (typeof options.navLabelKey === 'function') {
      // Allow for custom label generation via function
      navTitle = options.navLabelKey(file, filePath, filename);
    } else {
      // Standard behavior:
      // 1. Use file[navLabelKey] if present in frontmatter
      // 2. Otherwise, use filename converted to title case
      const baseFilename = filename.replace(/\.(html|md)$/, '');
      navTitle = file[options.navLabelKey] || toTitleCase(baseFilename);
    }
    let navIndex = file[options.navIndexKey] !== undefined ? file[options.navIndexKey] : Infinity;
    
    // Build path for URL based on permalink preferences
    let urlPath;
    
    if (options.usePermalinks) {
      // For permalinks style: /about/ instead of /about.html
      if (filePath.endsWith('index.md') || filePath.endsWith('index.html')) {
        // For index files, the path is the directory
        urlPath = filePath.replace(/index\.(md|html)$/, '');
      } else {
        // For other files, create pretty URL by removing extension and adding trailing slash
        urlPath = filePath.replace(/\.(md|html)$/, '/');
      }
    } else {
      // For non-permalink style: /about.html
      urlPath = filePath.replace(/\.md$/, '.html');
    }
    
    // Create navigation item with only essential properties
    const navItem = {
      title: navTitle,
      path: urlPath.startsWith('/') ? urlPath : `/${urlPath}`,
      children: {}
    };
    
    // Mark actual files vs directory nodes
    navItem.isFile = true;
    
    // Mark index files specifically
    if (filePath.endsWith('index.html') || filePath.endsWith('index.md')) {
      navItem.isIndexFile = true;
    }
    
    // Only add index if it exists (for sorting)
    if (navIndex !== undefined && navIndex !== Infinity) {
      navItem.index = navIndex;
    }
    
    // Add to tree based on path segments
    addToTree(tree, segments, navItem, filePath, options, debug);
  });

  // Sort children in tree
  sortTree(tree, options);

  return tree;
}


/**
 * Add navigation item to tree at specified path
 * 
 * @param {Object} tree - Navigation tree to add to
 * @param {Array} segments - Path segments
 * @param {Object} navItem - Navigation item to add
 * @param {string} filePath - Original file path
 * @param {NavOptions} options - Navigation options
 * @param {Function} debug - Debug function
 */
function addToTree(tree, segments, navItem, filePath, options, debug) {
  // For root level files (index.html, about.html)
  if (segments.length === 0) {
    // Get key from filename (without extension)
    let key;
    if (filePath === 'index.html' || filePath === 'index.md') {
      key = 'home'; // Use 'home' for index files
    } else {
      key = filePath.replace(/\.(html|md)$/, '').toLowerCase();
    }
    
    // Add directly to tree (no nesting under children)
    tree[key] = navItem;
    return;
  }

  // Implement a recursive approach for handling nested paths
  const buildTreeRecursively = (node, pathSegments, depth = 0) => {
    // Base case - we've reached the end of the path
    if (depth >= pathSegments.length) {
      return node;
    }

    const segment = pathSegments[depth];
    const isLastSegment = depth === pathSegments.length - 1;
    const isIndexFile = isLastSegment && (segment === 'index.html' || segment === 'index.md');
    
    // Skip index segment for path building
    const segmentForPath = segment.replace(/index\.(html|md)$/, '');
    
    // Build path up to this point
    let currentPath = '/';
    for (let i = 0; i <= depth; i++) {
      const pathSegment = pathSegments[i].replace(/index\.(html|md)$/, '');
      if (pathSegment) {
        currentPath += pathSegment + (i < depth || !options.usePermalinks ? '' : '/');
      }
    }
    
    // Format path based on permalinks setting
    let segmentPath = options.usePermalinks 
      ? currentPath
      : (isIndexFile ? currentPath : `${currentPath.replace(/\/$/, '')}.html`);
    
    if (isIndexFile) {
      // For index files, update the parent node
      if (depth > 0) {
        const parentSegment = pathSegments[depth - 1].replace(/\.(html|md)$/, '');
        
        // Get or create the parent node
        if (!node[parentSegment]) {
          node[parentSegment] = {
            title: parentSegment.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
            path: segmentPath,
            children: {},
            isDirectory: true
          };
        }
        
        // Update parent with index file attributes
        // But preserve existing children
        const existingChildren = node[parentSegment].children || {};
        
        // Update with index file info
        node[parentSegment].title = navItem.title;
        node[parentSegment].path = navItem.path;
        node[parentSegment].isIndexFile = true;
        node[parentSegment].isDirectory = false;
        
        // Keep index property if provided
        if (navItem.index !== undefined) {
          node[parentSegment].index = navItem.index;
        }
        
        // Preserve children
        node[parentSegment].children = existingChildren;
        
        return node[parentSegment];
      } else {
        // Root index file
        if (!node.home) {
          node.home = navItem;
        } else {
          // Update existing home node
          const existingChildren = node.home.children || {};
          Object.assign(node.home, navItem);
          node.home.children = existingChildren;
        }
        return node.home;
      }
    } 
    else if (isLastSegment) {
      // Regular file at the end of the path (e.g., about.html)
      const key = segment.replace(/\.(html|md)$/, '');
      
      // If one level deep, add directly to tree with the correct key
      if (depth === 0) {
        node[key] = navItem;
        return node[key];
      } 
      // Otherwise, add to appropriate parent's children
      else {
        // Find or create the parent node
        const parentKey = pathSegments[depth - 1].replace(/\.(html|md)$/, '');
        
        if (!node[parentKey]) {
          // Create parent path
          let parentPath = '/';
          for (let i = 0; i < depth; i++) {
            const pathSegment = pathSegments[i].replace(/index\.(html|md)$/, '');
            if (pathSegment) {
              parentPath += pathSegment + (options.usePermalinks ? '/' : '');
            }
          }
          
          node[parentKey] = {
            title: parentKey.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
            path: parentPath,
            children: {},
            isDirectory: true
          };
        }
        
        // Add to parent's children
        node[parentKey].children[key] = navItem;
        return node[parentKey].children[key];
      }
    } 
    else {
      // Intermediate directory in the path
      const key = segment.replace(/\.(html|md)$/, '');
      
      // Create node if it doesn't exist
      if (!node[key]) {
        node[key] = {
          title: key.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
          path: segmentPath,
          children: {},
          isDirectory: true
        };
      }
      
      // Continue to next level
      return buildTreeRecursively(node[key].children, pathSegments, depth + 1);
    }
  };
  
  // Start recursive tree building
  buildTreeRecursively(tree, segments.concat(filePath.split('/').pop()), 0);
}

/**
 * Sort the tree recursively
 * 
 * @param {Object} tree - Navigation tree or subtree to sort
 * @param {NavOptions} options - Navigation options
 */
function sortTree(tree, options) {
  // For our flat structure, first sort the top-level pages
  const entries = Object.entries(tree);
  
  // Skip if no entries to sort
  if (entries.length === 0) return;
  
  // Custom sort function
  let sortFunction;
  
  if (typeof options.sortBy === 'function') {
    // Use provided sort function directly
    sortFunction = (a, b) => options.sortBy(a[1], b[1], options);
  } else {
    // Default sort by index property
    sortFunction = (a, b) => {
      const [, itemA] = a;
      const [, itemB] = b;
      
      // Standard directory sorting - directories come first by default
      if (itemA.isDirectory && !itemB.isDirectory) {
        return -1;
      }
      if (!itemA.isDirectory && itemB.isDirectory) {
        return 1;
      }
      
      // Otherwise, sort by the specified property or index
      const propName = options.sortBy || 'index';
      const valueA = itemA[propName] !== undefined ? itemA[propName] : Infinity;
      const valueB = itemB[propName] !== undefined ? itemB[propName] : Infinity;
      
      // For string comparisons
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return options.sortReverse ? valueB.localeCompare(valueA) : valueA.localeCompare(valueB);
      }
      
      // For numeric comparisons
      return options.sortReverse ? valueB - valueA : valueA - valueB;
    };
  }
  
  // Apply sorting and rebuild the tree
  const sortedEntries = entries.sort(sortFunction);
  const newTree = {};
  
  // Reconstruct the tree in sorted order
  sortedEntries.forEach(([key, value]) => {
    newTree[key] = value;
    
    // Recursively sort children of this page
    if (value.children && Object.keys(value.children).length > 0) {
      // For children, use the original algorithm
      const childrenArray = Object.entries(value.children).map(([childKey, child]) => {
        return { key: childKey, ...child };
      });
      
      // Apply the same sorting logic to children
      childrenArray.sort((a, b) => {
        // If one item is a directory and one is a file, directories come first by default
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        
        // Otherwise, sort by the specified property or index
        const propName = options.sortBy || 'index';
        const valueA = a[propName] !== undefined ? a[propName] : Infinity;
        const valueB = b[propName] !== undefined ? b[propName] : Infinity;
        
        // For string comparisons
        if (typeof valueA === 'string' && typeof valueB === 'string') {
          return options.sortReverse ? valueB.localeCompare(valueA) : valueA.localeCompare(valueB);
        }
        
        // For numeric comparisons
        return options.sortReverse ? valueB - valueA : valueA - valueB;
      });
      
      // Replace children with sorted object
      value.children = {};
      childrenArray.forEach(child => {
        const { key: childKey, ...rest } = child;
        value.children[childKey] = rest;
        
        // Recursively sort any deeper children
        if (rest.children && Object.keys(rest.children).length > 0) {
          sortTree(rest.children, options);
        }
      });
    }
  });
  
  // Replace the original tree with the sorted one
  Object.keys(tree).forEach(key => delete tree[key]);
  Object.assign(tree, newTree);
}

/**
 * Sort the children of a tree node recursively
 * 
 * @param {Object} node - Navigation tree node
 * @param {NavOptions} options - Navigation options
 */
function sortChildrenTree(node, options) {
  // Skip if no children
  if (!node.children || Object.keys(node.children).length === 0) {
    return;
  }
  
  // Convert children object to array, sort, and convert back
  const childrenArray = Object.entries(node.children).map(([key, child]) => {
    return { key, ...child };
  });
  
  // Custom sort function
  let sortFunction;
  
  if (typeof options.sortBy === 'function') {
    // Use provided sort function directly
    sortFunction = (a, b) => options.sortBy(a, b, options);
  } else {
    // Default sort by index property
    sortFunction = (a, b) => {
      // If one item is a directory and one is a file, directories come first by default
      if (a._isDirectory && !b._isDirectory) {
        return -1;
      }
      if (!a._isDirectory && b._isDirectory) {
        return 1;
      }
      
      // Otherwise, sort by the specified property or index
      // Handle internal _index property for sorting
      const propName = options.sortBy === 'navIndex' ? '_index' : options.sortBy;
      const cleanPropName = propName || '_index';  
      const valueA = a[cleanPropName] !== undefined ? a[cleanPropName] : Infinity;
      const valueB = b[cleanPropName] !== undefined ? b[cleanPropName] : Infinity;
      
      // For string comparisons
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return options.sortReverse ? valueB.localeCompare(valueA) : valueA.localeCompare(valueB);
      }
      
      // For numeric comparisons
      return options.sortReverse ? valueB - valueA : valueA - valueB;
    };
    
    // Apply sorting
    childrenArray.sort(sortFunction);
    
    // Replace children with sorted object
    node.children = {};
    childrenArray.forEach(child => {
      const { key, ...rest } = child;
      // Copy only the public API properties to the result
      node.children[key] = {
        title: rest.title,
        path: rest.path,
        children: rest.children || {}
      };
      
      // Copy internal properties for further processing
      if (rest._index !== undefined) node.children[key]._index = rest._index;
      if (rest._isFile !== undefined) node.children[key]._isFile = rest._isFile;
      if (rest._isDirectory !== undefined) node.children[key]._isDirectory = rest._isDirectory;
      if (rest._originalPath !== undefined) node.children[key]._originalPath = rest._originalPath;
      
      // Recursively sort child's children
      sortChildrenTree(node.children[key], options);
    });
  }
}

/**
 * Generate breadcrumbs for each file
 * 
 * @param {Object} files - Metalsmith files object
 * @param {Object} navTree - Navigation tree
 * @param {NavOptions} options - Navigation options
 * @param {Function} debug - Debug function
 */
function generateBreadcrumbs(files, navTree, options, debug) {
  debug('Generating breadcrumbs for files with flat structure');
  
  Object.keys(files).forEach(filePath => {
    const file = files[filePath];
    
    // Skip files that should be excluded
    if (file[options.navExcludeKey]) {
      return;
    }
    
    // Generate breadcrumb path
    const breadcrumb = [];
    
    // Add home page to breadcrumb if needed (for all files, including index)
    if (options.navHomePage) {
      const homePath = options.usePermalinks ? '/' : '/index.html';
      const homeTitle = navTree.home ? navTree.home.title : options.navHomeLabel;
      
      breadcrumb.push({
        title: homeTitle,
        path: homePath
      });
      
      // Special case: if this is the home page itself, we're done
      if (filePath === 'index.html' || filePath === 'index.md') {
        file[options.breadcrumbKey] = breadcrumb;
        debug('Added breadcrumb to index file: %O', breadcrumb);
        return;
      }
    }
    
    // Split the path into segments
    const segments = filePath.split('/').filter(segment => segment.length > 0);
    
    if (segments.length > 0) {
      // For top-level files
      if (segments.length === 1) {
        const fileSegment = segments[0];
        const key = fileSegment.replace(/\.(html|md)$/, '').toLowerCase();
        
        // Check if we have this page in our navigation
        if (navTree[key]) {
          breadcrumb.push({
            title: navTree[key].title,
            path: navTree[key].path
          });
        } else {
          // Fallback if not found in navTree
          const title = fileSegment.replace(/\.(html|md)$/, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase());
            
          breadcrumb.push({
            title: title,
            path: options.usePermalinks 
              ? `/${fileSegment.replace(/\.(html|md)$/, '')}/` 
              : `/${fileSegment.replace(/\.md$/, '.html')}`
          });
        }
      } 
      // For nested files
      else {
        // First, add the parent page
        const parentKey = segments[0];
        if (navTree[parentKey]) {
          breadcrumb.push({
            title: navTree[parentKey].title,
            path: navTree[parentKey].path
          });
          
          // If this is directly under the parent (e.g., blog/post1.html)
          if (segments.length === 2 && !segments[1].startsWith('index.')) {
            const childKey = segments[1].replace(/\.(html|md)$/, '').toLowerCase();
            
            // If we have the child in the navTree
            if (navTree[parentKey].children && navTree[parentKey].children[childKey]) {
              const child = navTree[parentKey].children[childKey];
              breadcrumb.push({
                title: child.title,
                path: child.path
              });
            } else {
              // Fallback if not found
              const title = segments[1].replace(/\.(html|md)$/, '')
                .replace(/-/g, ' ')
                .replace(/\b\w/g, char => char.toUpperCase());
                
              breadcrumb.push({
                title: title,
                path: options.usePermalinks 
                  ? `/${parentKey}/${segments[1].replace(/\.(html|md)$/, '')}/` 
                  : `/${parentKey}/${segments[1].replace(/\.md$/, '.html')}`
              });
            }
          }
          // For deeper nesting or index files
          else {
            // Skip index files in the last segment
            const lastSegment = segments[segments.length - 1];
            const isIndexFile = lastSegment === 'index.html' || lastSegment === 'index.md';
            
            // Build the intermediate path if needed (for deep nesting)
            let currentPath = '/' + parentKey;
            for (let i = 1; i < segments.length - (isIndexFile ? 1 : 0); i++) {
              const segment = segments[i];
              currentPath += '/' + segment.replace(/\.(html|md)$/, '');
              
              // Add breadcrumb for this segment
              breadcrumb.push({
                title: segment.replace(/\.(html|md)$/, '')
                  .replace(/-/g, ' ')
                  .replace(/\b\w/g, char => char.toUpperCase()),
                path: options.usePermalinks 
                  ? `${currentPath}/` 
                  : `${currentPath}.html`
              });
            }
          }
        }
      }
    }
    
    // Add breadcrumb to file metadata
    file[options.breadcrumbKey] = breadcrumb;
    debug('Added breadcrumb to %s: %O', filePath, breadcrumb);
  });
}

// ESM export
export default autonav;

// CommonJS export compatibility
if (typeof module !== 'undefined') {
  // TEST PLACEHOLDER: This log helps verify CommonJS compatibility
  if (process.env.DEBUG_EXPORTS) {
    console.log('=== TEST MARKER: metalsmith-autonav CommonJS export activated ===');
  }
  module.exports = autonav;
}