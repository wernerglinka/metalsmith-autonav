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
/**
 * Helper function to get navigation property from file
 * 
 * Gets the property from the navigation object
 * 
 * @param {Object} file - The file object
 * @param {string} propKey - The property key to look for
 * @param {Object} options - The plugin options
 * @returns {*} The property value or undefined
 */
function getNavProperty(file, propKey, options) {
  // Get from the navigation object
  if (file[options.navigationObjectKey]) {
    return file[options.navigationObjectKey][propKey];
  }
  
  // Return undefined if navigation object doesn't exist
  return undefined;
}

function autonav(options = {}) {
  // Default options for a single navigation
  const defaultOpts = {
    navKey: 'nav',
    navigationObjectKey: 'navigation', // Object containing all navigation properties
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
    // Removed activeClass and activeTrailClass options as they're not useful in static site context
    sectionMenus: null // Object mapping section paths to menu keys
  };

  return function(files, metalsmith, done) {
    const debug = metalsmith.debug ? metalsmith.debug('metalsmith-autonav') : () => {};
    
    // Promise-based implementation
    const processNavigation = async () => {
      try {
        // Handle multiple configurations if provided
        if (options.configs && typeof options.configs === 'object') {
          // Check if 'main' config exists (case-insensitive) since we need it for section menus
          const hasMainConfig = Object.keys(options.configs).some(key => key.toLowerCase() === 'main');
          
          // If there's no 'main' config but there are section menus, use the first config instead
          let mainConfigName = hasMainConfig ? 
            Object.keys(options.configs).find(key => key.toLowerCase() === 'main') :
            Object.keys(options.configs)[0];
            
          debug('Will use config "%s" for section menus', mainConfigName);
          
          debug('Multiple navigation configurations detected: %O', Object.keys(options.configs));
          
          // Process each navigation configuration
          for (const configName of Object.keys(options.configs)) {
            debug('Processing config: %s', configName);
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
          
          // Note structure of main navigation if debugging enabled
          if (configName.toLowerCase() === 'main') {
            debug('Main nav tree structure: %s', 
              Object.keys(navTree).map(key => `${key} (${navTree[key].path})`).join(', '));
          }
            
            // Generate breadcrumbs for this config
            generateBreadcrumbs(files, navTree, configOpts, debug);
            
            // Generate section-specific menus from this navigation tree
            // We'll use either the 'main' config or the first config if 'main' doesn't exist
            if ((configName.toLowerCase() === 'main' || configName === mainConfigName) && 
                options.sectionMenus && typeof options.sectionMenus === 'object') {
              // Debug section menus processing
              debug('Generating section-specific menus for config "%s"', configName);
              
              // Debug section menu generation
              debug('Generating section menus with paths: %s', Object.keys(options.sectionMenus).join(', '));
              debug('Looking for sections in nav tree with keys: %s', Object.keys(navTree).join(', '));
              
              // Create section menus using this navigation tree
              for (const [sectionPath, menuKey] of Object.entries(options.sectionMenus)) {
                debug('Creating section menu for %s as %s from %s navigation', sectionPath, menuKey, configName);
                
                // Find the section in the nav tree
                let sectionNode = null;
                
                // Handle root sections (simple string match at top level)
                if (sectionPath === '/') {
                  sectionNode = navTree;
                } else {
                  // Normalize the section path to ensure it starts and ends with /
                  const normalizedSectionPath = 
                    sectionPath.startsWith('/') ? sectionPath : `/${sectionPath}`;
                  
                  // First try to find a direct match in the tree (faster)
                  // Since our tree is now flat at the top level for common sections
                  debug('Looking for section path: %s', normalizedSectionPath);
                  
                  // A special check for common naming patterns
                  const sectionKey = sectionPath.replace(/^\/|\/$/g, '');
                  debug('Extracted section key: %s', sectionKey);
                  
                  // First try finding by key directly
                  if (navTree[sectionKey]) {
                    debug('Found section by key: %s', sectionKey);
                    sectionNode = navTree[sectionKey];
                  } else {
                    // Try finding by path
                    for (const key in navTree) {
                      debug('Comparing with node "%s" path: %s', key, navTree[key].path);
                      
                      if (navTree[key].path === normalizedSectionPath) {
                        debug('Match found for path %s in node %s', normalizedSectionPath, key);
                        sectionNode = navTree[key];
                        break;
                      }
                    }
                  }
                  
                  // If not found directly, search more thoroughly
                  if (!sectionNode) {
                    // Use find function to navigate the tree (simpler than recursion here)
                    const findSection = (tree, path) => {
                      for (const key in tree) {
                        const item = tree[key];
                        
                        // If this item's path matches the section path
                        if (item.path === normalizedSectionPath || 
                            (normalizedSectionPath.endsWith('/') && 
                             item.path === normalizedSectionPath.slice(0, -1))) {
                          return item;
                        }
                        
                        // Check children
                        if (item.children && Object.keys(item.children).length > 0) {
                          const found = findSection(item.children, path);
                          if (found) {
                            return found;
                          }
                        }
                      }
                      return null;
                    };
                    
                    sectionNode = findSection(navTree, normalizedSectionPath);
                  }
                }
                
                // If section found, add its children as a new nav tree
                if (sectionNode) {
                  debug('Found section %s for menu %s', sectionPath, menuKey);
                  
                  if (sectionPath === '/') {
                    // For root, use the entire tree
                    metalsmith.metadata()[menuKey] = navTree;
                    debug('Created root menu %s with %d items', menuKey, Object.keys(navTree).length);
                  } else if (sectionNode.children) {
                    // For section paths like /blog/ etc., need to create a proper section menu
                    // First find the section key from the path (e.g., 'blog' from '/blog/')
                    const sectionKey = sectionPath.replace(/^\/|\/$/g, '');
                    
                    // Create a menu containing the section's children
                    // The key change is that we're just passing the children directly,
                    // rather than creating a new empty object
                    const sectionMenu = sectionNode.children;
                    
                    debug('Created section menu %s with %d items - keys: %s', 
                      menuKey, 
                      Object.keys(sectionMenu).length,
                      Object.keys(sectionMenu).join(', '));
                    
                    metalsmith.metadata()[menuKey] = sectionMenu;
                    
                    // Additional debugging for section menus if needed
                    if (menuKey.includes('Menu')) {
                      debug('Created %s with %d items: %s', 
                        menuKey, 
                        Object.keys(sectionMenu).length,
                        Object.keys(sectionMenu).join(', '));
                    }
                  } else {
                    debug('Found section %s but it has no children', sectionPath);
                  }
                  
                  debug('Created section menu %s with %d items', 
                       menuKey, 
                       sectionNode.children ? Object.keys(sectionNode.children).length : 0);
                } else {
                  debug('WARNING: Section %s not found for menu %s', sectionPath, menuKey);
                  debug('Available paths: %s', 
                    Object.keys(navTree).map(key => `${key}: ${navTree[key].path}`).join(', '));
                }
              }
            }
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
          
          // Generate section-specific menus if configured
          // Handle sectionMenus for both global config (opts.sectionMenus) and top-level config (options.sectionMenus)
          // This gives flexibility for how the sectionMenus can be specified
          const sectionMenusConfig = opts.sectionMenus || options.sectionMenus;
          if (sectionMenusConfig && typeof sectionMenusConfig === 'object') {
            debug('Generating section-specific menus for single configuration with config: %O', sectionMenusConfig);
            
            // Create section menus
            for (const [sectionPath, menuKey] of Object.entries(sectionMenusConfig)) {
              debug('Creating section menu for %s as %s', sectionPath, menuKey);
              
              // Find the section in the nav tree
              let sectionNode = null;
              
              // Handle root sections (simple string match at top level)
              if (sectionPath === '/') {
                sectionNode = navTree;
              } else {
                // Normalize the section path to ensure it starts and ends with /
                const normalizedSectionPath = 
                  sectionPath.startsWith('/') ? sectionPath : `/${sectionPath}`;
                
                // First try to find a direct match in the tree (faster)
                // Since our tree is now flat at the top level for common sections
                for (const key in navTree) {
                  if (navTree[key].path === normalizedSectionPath) {
                    sectionNode = navTree[key];
                    break;
                  }
                }
                
                // If not found directly, search more thoroughly
                if (!sectionNode) {
                  // Use find function to navigate the tree (simpler than recursion here)
                  const findSection = (tree, path) => {
                    for (const key in tree) {
                      const item = tree[key];
                      
                      // If this item's path matches the section path
                      debug('Deep search - Comparing %s with %s', item.path, normalizedSectionPath);
                      
                      if (item.path === normalizedSectionPath || 
                          (normalizedSectionPath.endsWith('/') && 
                           item.path === normalizedSectionPath.slice(0, -1))) {
                        debug('Deep match found for %s', normalizedSectionPath);
                        return item;
                      }
                      
                      // Check children
                      if (item.children && Object.keys(item.children).length > 0) {
                        const found = findSection(item.children, path);
                        if (found) {
                          return found;
                        }
                      }
                    }
                    return null;
                  };
                  
                  sectionNode = findSection(navTree, normalizedSectionPath);
                }
              }
              
              // If section found, add its children as a new nav tree
              if (sectionNode) {
                if (sectionPath === '/') {
                  // For root, use the entire tree
                  metalsmith.metadata()[menuKey] = navTree;
                } else if (sectionNode.children) {
                  // For section paths like /blog/ etc., need to create a proper section menu
                  // First find the section key from the path (e.g., 'blog' from '/blog/')
                  const sectionKey = sectionPath.replace(/^\/|\/$/g, '');
                  
                  // Create a menu containing both the section itself and its children
                  const sectionMenu = {};
                  
                  // Add direct children to the menu
                  for (const childKey in sectionNode.children) {
                    sectionMenu[childKey] = sectionNode.children[childKey];
                  }
                  
                  metalsmith.metadata()[menuKey] = sectionMenu;
                }
                debug('Created section menu %s with %d items', 
                     menuKey, 
                     sectionNode.children ? Object.keys(sectionNode.children).length : 0);
              } else {
                debug('WARNING: Section %s not found for menu %s', sectionPath, menuKey);
              }
            }
          }
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

  // Track index files separately to avoid duplicate entries
  const indexFiles = {};
  const regularFiles = {};
  
  // First pass - separate index files from regular files
  filePaths.forEach(filePath => {
    const isIndexFile = filePath.endsWith('index.md') || filePath.endsWith('index.html');
    if (isIndexFile) {
      const dirPath = filePath.replace(/index\.(md|html)$/, '');
      indexFiles[dirPath] = filePath;
    } else {
      regularFiles[filePath] = true;
    }
  });

  // Sort files if needed
  if (options.sortBy) {
    filePaths.sort((a, b) => {
      // First check for navigation.navIndex property
      let aNav = files[a][options.navigationObjectKey];
      let bNav = files[b][options.navigationObjectKey];
      
      let valA = (aNav && aNav[options.navIndexKey] !== undefined) ? 
                  aNav[options.navIndexKey] : 
                  (files[a][options.sortBy] !== undefined ? files[a][options.sortBy] : Infinity);
                  
      let valB = (bNav && bNav[options.navIndexKey] !== undefined) ? 
                  bNav[options.navIndexKey] : 
                  (files[b][options.sortBy] !== undefined ? files[b][options.sortBy] : Infinity);
      
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
    // We need to check both locations due to tests being written for direct property access
    if (getNavProperty(file, options.navExcludeKey, options) || file[options.navExcludeKey]) {
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
      
      // Special case for index files at root level to be compatible with tests
      if ((filePath === 'index.md' || filePath === 'index.html') && !navTitle) {
        navTitle = 'Home';
      }
    } else {
      // Standard behavior:
      // 1. Use navigation.navLabelKey or file.navLabelKey if present in frontmatter
      // 2. Special case for root index file to be "Home" for tests compatibility
      // 3. Otherwise, use filename converted to title case
      const baseFilename = filename.replace(/\.(html|md)$/, '');
      
      // For all files, check for custom labels first
      // Important: We need to check both the nested and direct paths for tests
      const customLabel = getNavProperty(file, options.navLabelKey, options) || file[options.navLabelKey];
        
      if (customLabel) {
        // Use custom label if provided
        navTitle = customLabel;
      } else if (baseFilename === 'index' && segments.length === 0) {
        // Default root index to "Home" for tests
        navTitle = 'Home';
      } else {
        // Otherwise, use title case conversion
        navTitle = toTitleCase(baseFilename);
      }
    }
    let navIndex = getNavProperty(file, options.navIndexKey, options);
    navIndex = navIndex !== undefined ? navIndex : Infinity;
    
    // Build path for URL based on permalink preferences
    let urlPath;
    
    if (options.usePermalinks) {
      // For permalinks style: /about/ instead of /about.html
      if (filePath.endsWith('index.md') || filePath.endsWith('index.html')) {
        // For index files, the path is the directory
        urlPath = filePath.replace(/index\.(md|html)$/, '');
      } else {
        // For other files, create pretty URL by removing extension and adding trailing slash
        // Make sure to correctly handle the path for nested files
        urlPath = filePath.replace(/\.(md|html)$/, '/');
        
        // Ensure paths don't contain doubled directory names (blogblogpost-1)
        // First normalize path separators
        urlPath = urlPath.replace(/\\/g, '/');
        
        // Make sure the path starts with the correct parent directory
        // If this is a file in a directory, split path correctly to rebuild it properly
        const pathParts = filePath.split('/');
        if (pathParts.length > 1) {
          // This is a nested file - like blog/blogpost-1.html
          const parentDir = pathParts[0]; // e.g., "blog"
          const fileName = pathParts[pathParts.length-1].replace(/\.(md|html)$/, ''); // e.g., "blogpost-1"
          
          // Ensure we preserve the exact original filename in the path
          // This is important for matching filenames in the navigation structure
          
          // Make sure the URL starts with parent directory and preserves the exact original filename
          if (options.usePermalinks) {
            urlPath = `/${parentDir}/${fileName}/`;
          } else {
            urlPath = `/${parentDir}/${fileName}.html`;
          }
        }
      }
    } else {
      // For non-permalink style: /about.html
      urlPath = filePath.replace(/\.md$/, '.html');
    }
    
    // Normalize the path to ensure it starts with /
    // Handle nested paths correctly by replacing backslashes with forward slashes
    // (We already handle this for non-index files above, but need to do it for index files too)
    urlPath = urlPath.replace(/\\/g, '/');
    const normalizedPath = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
    
    // Create navigation item with only essential properties
    const navItem = {
      title: navTitle,
      path: normalizedPath,
      children: {}
    };
    
    // Only add index if it exists (for sorting)
    if (navIndex !== undefined && navIndex !== Infinity) {
      navItem.index = navIndex;
    }
    
    // Save the normalized path to the file's navigation object for active page detection
    if (!file[options.navigationObjectKey]) {
      file[options.navigationObjectKey] = {};
    }
    file[options.navigationObjectKey].path = normalizedPath;
    
    // For backward compatibility with the tests
    file.path = normalizedPath;
    
    // Add to tree based on path segments
    addToTree(tree, segments, navItem, filePath, options, debug);
  });

  // Remove duplicate entries where pages are their own children
  // This is a post-processing step to clean up the tree
  cleanupTree(tree);
  
  // Sort children in tree
  sortTree(tree, options);

  return tree;
}

/**
 * Clean up the navigation tree to remove duplicates and invalid entries
 * 
 * @param {Object} tree - Navigation tree to clean up
 */
function cleanupTree(tree) {
  // First, collect all unique paths in the tree to detect duplicates
  const pathMap = new Map();
  const duplicates = new Set();
  
  // Step 1: Collect paths and identify which ones are duplicates
  const collectPaths = (node, parentPath = '') => {
    // Process this node
    if (node.path) {
      if (pathMap.has(node.path)) {
        // This is a duplicate path
        duplicates.add(node.path);
      } else {
        // First time seeing this path
        pathMap.set(node.path, true);
      }
    }
    
    // Process children if they exist
    if (node.children) {
      Object.values(node.children).forEach(childNode => {
        collectPaths(childNode, node.path);
      });
    }
  };
  
  // Collect paths for each top-level item
  Object.values(tree).forEach(node => {
    collectPaths(node);
  });
  
  // Step 2: Fix malformed paths and detect patterns like "/blogblogpost-1/"
  // before we do deeper duplicate removal
  const fixMalformedPaths = (node) => {
    if (!node || !node.children) return;
    
    // Process each child
    Object.keys(node.children).forEach(childKey => {
      const childNode = node.children[childKey];
      if (!childNode || !childNode.path) return;
      
      // Check for patterns like "/blogblogpost-1/" or similar malformed paths
      const pathParts = childNode.path.split('/').filter(Boolean);
      
      // Test for directory name repeated in path (e.g., "blogblogpost-1")
      // This is a common malformed pattern we want to fix
      if (pathParts.length >= 1) {
        const firstPart = pathParts[0];
        
        if (pathParts.length >= 2) {
          const secondPart = pathParts[1];
          
          // ONLY fix paths that are clearly malformed like "/blogblog/" or "/blogblog "
          // We need to preserve valid filenames like "blogpost-1" that happen to start with the directory name
          
          // First, check for exact directory name duplication - this is the most obvious error case
          // Example: "/blog/blog/" should be fixed to "/blog/"
          if (secondPart === firstPart) {
            childNode.path = `/${firstPart}/`;
          }
          // Next, check for directory name immediately followed by the same name - this is likely a path join error
          // Example: "/blogblog/" should be fixed to "/blog/"
          else if (secondPart === firstPart + firstPart) {
            childNode.path = `/${firstPart}/`;
          }
          // For truly malformed paths with no separator - look for "/blogblogX" pattern
          // Do NOT touch legitimate filenames like "blogpost-1" that start with directory name
          else if (secondPart.startsWith(firstPart) && 
                   // Only fix paths that don't have a legitimate separator after the firstPart
                   // A legitimate separator would be: "-", "_", ".", or a digit
                   !secondPart.substring(firstPart.length, firstPart.length + 1).match(/[-_.0-9]/)) {
            
            // Check if this actually looks like a doubled directory error and not a legitimate filename
            // This is a heuristic - if we're just duplicating the directory with maybe a character or two,
            // it's probably an error. If it's a substantial word after the prefix, it's probably intentional.
            const remainder = secondPart.slice(firstPart.length);
            if (remainder.length <= 2) {
              // This is likely a path error - fix it
              const goodPath = `/${firstPart}/${remainder}/`;
              childNode.path = goodPath;
            }
            // Otherwise, leave it alone - it's likely a legitimate filename that happens to start with 
            // the directory name, like "blog/blogpost-1.html"
          }
        }
      }
      
      // Process this node's children recursively
      fixMalformedPaths(childNode);
    });
  };
  
  // Apply fix for malformed paths first
  fixMalformedPaths({ children: tree });
  
  // Step 3: Handle duplicates and self-references in the tree
  const removeDuplicates = (node) => {
    if (!node.children) return;
    
    // Check for pattern where an item has itself as a child with a different path
    // This applies to any path, not just blog posts
    Object.keys(node.children).forEach(childKey => {
      const childNode = node.children[childKey];
      
      if (childNode.children) {
        // Look for grandchildren with the same key as their parent
        Object.keys(childNode.children).forEach(grandchildKey => {
          if (grandchildKey === childKey) {
            // This is our duplicate pattern! Remove the nested node and keep just the parent
            // But first, use the most correct path (usually the grandchild's)
            const grandchildNode = childNode.children[grandchildKey];
            if (grandchildNode && grandchildNode.path) {
              // Use the more specific path if it's available
              if (grandchildNode.path.split('/').length > childNode.path.split('/').length) {
                childNode.path = grandchildNode.path;
              }
            }
            // Now remove the duplicate grandchild
            delete childNode.children[grandchildKey];
          }
        });
      }
    });
    
    // Now continue with standard duplicate checks
    Object.keys(node.children).forEach(childKey => {
      const childNode = node.children[childKey];
      
      // Check if child has the same path as parent (self-reference)
      if (childNode.path === node.path) {
        delete node.children[childKey];
        return;
      }
      
      // Check for path correctness and duplication
      if (duplicates.has(childNode.path)) {
        // This path appears multiple times
        // Check if the path has nested duplication
        const pathParts = childNode.path.split('/').filter(Boolean);
        
        // Check for doubled path segments (e.g., /blog/blog/)
        let hasDoubledSegment = false;
        for (let i = 0; i < pathParts.length - 1; i++) {
          if (pathParts[i] === pathParts[i+1]) {
            hasDoubledSegment = true;
            break;
          }
        }
        
        // If path has doubled segments, remove this node
        if (hasDoubledSegment) {
          delete node.children[childKey];
          return;
        }
      }
      
      // Check if this node has any children with the same key but different paths
      if (childNode.children) {
        removeDuplicates(childNode);
        
        // Check for case where a node has a child with the same key as itself
        Object.keys(childNode.children).forEach(grandchildKey => {
          const grandchildNode = childNode.children[grandchildKey];
          
          // If grandchild has the same key as the child but is a different node
          if (grandchildKey === childKey) {
            // We found a blog post that appears to be its own child
            // Keep only the child with the more correct path
            
            // For paths like "/blogblogpost-1/" vs "/blog/blogpost-1/", 
            // the one with the "/" after the directory name is usually correct
            const childParts = childNode.path.split('/');
            const grandchildParts = grandchildNode.path.split('/');
            
            // Usually the path with more segments is the correct one
            if (grandchildParts.length > childParts.length) {
              // The grandchild has a more specific path - use it and remove the duplicate
              Object.assign(childNode, {
                path: grandchildNode.path,
                title: grandchildNode.title
              });
            }
            
            // Always remove the grandchild to avoid the self-referencing loop
            delete childNode.children[grandchildKey];
          }
        });
      }
    });
  };
  
  // Apply duplicate removal to the tree
  removeDuplicates({ children: tree });
  
  // Final pass - remove any empty children objects to clean up the tree
  const cleanEmptyChildren = (node) => {
    if (!node.children) return;
    
    // If children object is empty, replace with empty object
    if (Object.keys(node.children).length === 0) {
      node.children = {};
      return;
    }
    
    // Process each child
    Object.values(node.children).forEach(childNode => {
      cleanEmptyChildren(childNode);
    });
  };
  
  cleanEmptyChildren({ children: tree });
}


/**
 * Add navigation item to tree at specified path
 * 
 * @param {Object} tree - Navigation tree to add to
 * @param {Array} segments - Path segments
 * @param {Object} navItem - Navigation item to add
 * @param {string} filePath - Original file path
 * @param {NavOptions} options - Navigation options
 */
function addToTree(tree, segments, navItem, filePath, options) {
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
        // Get the parent segment name (the directory that contains this index file)
        const parentSegment = pathSegments[depth - 1].replace(/\.(html|md)$/, '');
        
        // Get or create the parent node
        if (!node[parentSegment]) {
          node[parentSegment] = {
            title: parentSegment.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
            path: segmentPath,
            children: {}
          };
        }
        
        // Update parent with index file attributes
        // But preserve existing children
        const existingChildren = node[parentSegment].children || {};
        
        // Update with index file info
        node[parentSegment].title = navItem.title;
        node[parentSegment].path = navItem.path;
        
        // Keep index property if provided
        if (navItem.index !== undefined) {
          node[parentSegment].index = navItem.index;
        }
        
        // Preserve children
        node[parentSegment].children = existingChildren;
        
        return node[parentSegment];
      } 
      
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
    
    if (isLastSegment) {
      // Regular file at the end of the path (e.g., about.html)
      const key = segment.replace(/\.(html|md)$/, '');
      
      // If one level deep, add directly to tree with the correct key
      if (depth === 0) {
        node[key] = navItem;
        return node[key];
      } 
      
      // For files in subdirectories (depth > 0):
      // Find or create the parent directory node
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
          children: {}
        };
      }
      
      // Add to parent's children, but make sure we're not duplicating
      // Don't add if this key already exists at top level (which can happen with index.md files)
      if (!node[parentKey].children[key]) {
        node[parentKey].children[key] = navItem;
      }
      
      return node[parentKey].children[key];
    } 
    
    // Intermediate directory in the path
    const key = segment.replace(/\.(html|md)$/, '');
    
    // Create node if it doesn't exist
    if (!node[key]) {
      node[key] = {
        title: key.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
        path: segmentPath,
        children: {}
      };
    }
    
    // Continue to next level
    return buildTreeRecursively(node[key].children, pathSegments, depth + 1);
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
      
      // We no longer use isDirectory property, so sorting is purely by index or other properties
      
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
        // Sort by the specified property or index
        const propName = options.sortBy || 'index';
        const valueA = a[propName] !== undefined ? a[propName] : Infinity;
        const valueB = b[propName] !== undefined ? b[propName] : Infinity;
        
        // For string comparisons
        if (typeof valueA === 'string' && typeof valueB === 'string') {
          return options.sortReverse ? valueB.localeCompare(valueA) : valueA.localeCompare(valueB);
        }
        
        // For numeric comparisons (ensuring sortReverse is respected)
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


// The markActiveTrail function has been removed since it's not useful in a static site context
// Active states must be determined at runtime in the browser, not during build time

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
    
    // Add breadcrumb to the navigation object
    if (!file[options.navigationObjectKey]) {
      file[options.navigationObjectKey] = {};
    }
    
    // Add breadcrumb to navigation object
    file[options.navigationObjectKey][options.breadcrumbKey] = breadcrumb;
    
    // Also add directly to file for backward compatibility with tests
    file[options.breadcrumbKey] = breadcrumb;
    debug('Added breadcrumb to %s: %O', filePath, breadcrumb);
    
    // We don't add active trail information anymore as it's not useful in a static site context
    // Active states must be determined at runtime in the browser, not during build time
  });
}

// ESM export
export default autonav;

// CommonJS export compatibility
if (typeof module !== 'undefined') {
  // TEST PLACEHOLDER: This log helps verify CommonJS compatibility
  if (process.env.DEBUG_EXPORTS) {
    // Using console.warn which is allowed by our linting rules
    console.warn('=== TEST MARKER: metalsmith-autonav CommonJS export activated ===');
  }
  module.exports = autonav;
}