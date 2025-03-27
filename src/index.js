// No external debug module needed - we'll use metalsmith.debug

/**
 * @typedef {Object} NavOptions
 * @property {string} [navKey='nav'] - Key in metalsmith metadata for the navigation object
 * @property {string|Function} [navLabel='title'] - File property that defines a page's title in navigation, or a function that returns the label
 * @property {string} [navIndexKey='navIndex'] - File property that defines a page's position in navigation
 * @property {boolean} [navExcludeKey='navExclude'] - File property to exclude a page from navigation
 * @property {string} [breadcrumbKey='breadcrumb'] - Key in file metadata for the breadcrumb path array
 * @property {boolean} [navHomePage=true] - Include home page in breadcrumb
 * @property {string} [navHomeLabel='Home'] - Label for home page in breadcrumb
 * @property {string} [sortBy='navIndex'] - Property to sort navigation items by
 * @property {boolean} [sortReverse=false] - Reverse sort order
 * @property {Function} [pathFilter=null] - Custom function to filter file paths
 * @property {boolean} [usePermalinks=true] - Whether to use permalink-style paths (/about/ instead of /about.html)
 * @property {boolean} [includeDirs=true] - Whether to include directory nodes in the navigation
 * @property {boolean} [mergeMatchingFilesAndDirs=true] - Whether to merge file and directory nodes that have matching names
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
    usePermalinks: true,
    includeDirs: true,
    mergeMatchingFilesAndDirs: true
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
  const tree = { children: {} };
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

  // Track directories we've encountered for merging
  const dirNodes = new Map();

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
    
    // Create navigation item
    const navItem = {
      title: navTitle,
      path: urlPath.startsWith('/') ? urlPath : `/${urlPath}`,
      index: navIndex,
      children: {},
      isFile: true,
      originalPath: filePath
    };
    
    // Add to tree based on path segments
    addToTree(tree, segments, navItem, filePath, options, dirNodes, debug);
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
 * @param {Map} dirNodes - Map of directory nodes for merging
 * @param {Function} debug - Debug function
 */
function addToTree(tree, segments, navItem, filePath, options, dirNodes, debug) {
  // For index files at root level, add to parent level
  if (segments.length === 0 && (filePath === 'index.html' || filePath === 'index.md')) {
    Object.keys(navItem).forEach(key => {
      if (key !== 'children') {
        tree[key] = navItem[key];
      }
    });
    return;
  }
  
  // For other files at root level, add to children
  if (segments.length === 0) {
    // Get the filename without extension to use as the key
    const fileKey = navItem.title.toLowerCase().replace(/\s+/g, '-');
    tree.children[fileKey] = navItem;
    return;
  }
  
  // For nested index files, add to parent directory node
  if (filePath.endsWith('index.html') || filePath.endsWith('index.md')) {
    // Get the directory path
    const dirPath = segments.join('/');
    const dirNode = dirNodes.get(dirPath);
    
    if (dirNode) {
      Object.keys(navItem).forEach(key => {
        if (key !== 'children') {
          dirNode[key] = navItem[key];
        }
      });
      return;
    }
  }
  
  // For nested files, traverse or create path
  let currentLevel = tree;
  
  // Initialize children object if it doesn't exist
  if (!currentLevel.children) {
    currentLevel.children = {};
  }
  
  // Build directory path for tracking
  let dirPath = '';
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isLastSegment = i === segments.length - 1;
    
    // Update directory path
    dirPath += (dirPath ? '/' : '') + segment;
    
    // Handle directory node
    if (!currentLevel.children[segment]) {
      // Create directory node
      const dirNode = {
        title: segment,
        path: options.usePermalinks ? `/${dirPath}/` : '#', // Use permalink style for directory paths if enabled
        children: {},
        isDirectory: true,
        originalPath: dirPath
      };
      
      // Only add directory node if includeDirs is true or this is not the last segment
      if (options.includeDirs || !isLastSegment) {
        currentLevel.children[segment] = dirNode;
        
        // Store in directory nodes map for potential merging
        dirNodes.set(dirPath, dirNode);
      }
    }
    
    // If this is the last segment and we have a matching directory with the same name as the file
    if (isLastSegment && options.mergeMatchingFilesAndDirs) {
      // Get the filename without extension
      const fileBasename = navItem.title.toLowerCase();
      
      // Check if segment matches file basename (for cases like /products/chairs.html and /products/chairs/index.html)
      if (segment.toLowerCase() === fileBasename) {
        debug('Found matching file and directory: %s', dirPath);
        
        // If we have a directory node with the same name, merge file metadata into it
        const dirNode = dirNodes.get(dirPath);
        if (dirNode) {
          // Prefer file metadata over directory info
          Object.keys(navItem).forEach(key => {
            if (key !== 'children') {
              dirNode[key] = navItem[key];
            }
          });
          
          // But preserve isDirectory flag so we know this is a merged node
          dirNode.isMerged = true;
          
          // Skip adding file node separately
          return;
        }
      }
    }
    
    // Move to next level
    currentLevel = currentLevel.children[segment];
  }
  
  // Add file as leaf node
  const leafKey = navItem.title.toLowerCase().replace(/\s+/g, '-');
  currentLevel.children[leafKey] = navItem;
}

/**
 * Sort the tree recursively
 * 
 * @param {Object} tree - Navigation tree or subtree to sort
 * @param {NavOptions} options - Navigation options
 */
function sortTree(tree, options) {
  if (tree.children && Object.keys(tree.children).length > 0) {
    // Convert children object to array, sort, and convert back
    const childrenArray = Object.entries(tree.children).map(([key, child]) => {
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
        if (a.isDirectory && !b.isDirectory) {
          return -1;
        }
        if (!a.isDirectory && b.isDirectory) {
          return 1;
        }
        
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
      };
    }
    
    // Apply sorting
    childrenArray.sort(sortFunction);
    
    // Replace children with sorted object
    tree.children = {};
    childrenArray.forEach(child => {
      const { key, ...rest } = child;
      tree.children[key] = rest;
      
      // Recursively sort child's children
      sortTree(tree.children[key], options);
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
  debug('Generating breadcrumbs for files');
  
  Object.keys(files).forEach(filePath => {
    const file = files[filePath];
    
    // Skip files that should be excluded
    if (file[options.navExcludeKey]) {
      return;
    }
    
    // Generate breadcrumb path
    const breadcrumb = [];
    
    // Add home page to breadcrumb if needed
    if (options.navHomePage) {
      const homePath = options.usePermalinks ? '/' : '/index.html';
      breadcrumb.push({
        title: options.navHomeLabel,
        path: homePath
      });
    }
    
    // Split path and find in navigation tree
    const segments = filePath.split('/').filter(segment => segment.length > 0);
    
    if (segments.length > 0) {
      let currentPath = '';
      let currentLevel = navTree;
      
      // Try to find each segment in the nav tree
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        currentPath += `/${segment}`;
        
        // Check if it's the last segment, which might be a file
        if (i === segments.length - 1) {
          // Get the navigation title using the same approach as for nav items
          let navTitle;
          
          // Convert filename from slug format to title case
          const toTitleCase = (str) => {
            return str
              .replace(/\.(html|md)$/, '')
              .replace(/-/g, ' ')
              .replace(/\b\w/g, char => char.toUpperCase());
          };
          
          // First check if a function was provided
          if (typeof options.navLabelKey === 'function') {
            // Allow for custom label generation via function
            navTitle = options.navLabelKey(file, filePath, segment);
          } else {
            // Use navLabel from frontmatter if it exists, otherwise use filename in title case
            navTitle = file[options.navLabelKey] || toTitleCase(segment);
          }
          
          // Apply permalink settings for path
          let itemPath;
          if (options.usePermalinks) {
            if (currentPath.endsWith('index.md') || currentPath.endsWith('index.html')) {
              itemPath = currentPath.replace(/index\.(md|html)$/, '');
            } else {
              itemPath = currentPath.replace(/\.(md|html)$/, '/');
            }
          } else {
            itemPath = currentPath.replace(/\.md$/, '.html');
          }
          
          breadcrumb.push({
            title: navTitle,
            path: itemPath
          });
        } else if (currentLevel.children && currentLevel.children[segment]) {
          // Add intermediate directory to breadcrumb
          
          // Apply permalink settings for directory paths
          let itemPath;
          if (options.usePermalinks) {
            itemPath = `${currentPath}/`;
          } else {
            itemPath = currentLevel.children[segment].path || currentPath;
          }
          
          breadcrumb.push({
            title: currentLevel.children[segment].title || segment,
            path: itemPath
          });
          currentLevel = currentLevel.children[segment];
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