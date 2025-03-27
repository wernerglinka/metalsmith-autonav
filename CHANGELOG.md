# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of metalsmith-autonav
- Hierarchical navigation tree generation
- Breadcrumb path generation for each file
- Flexible navigation labels with `navLabel` option (string property or custom function)
- Support for navigation item sorting with custom sort functions
- Custom path filtering
- Ability to exclude pages from navigation
- Flexible permalink handling with `usePermalinks` option
- Multiple navigation configurations in a single pass (e.g., header, footer, sidebar)
- Directory node control with `includeDirs` option
- Smart file and directory node merging with `mergeMatchingFilesAndDirs` option
- Modern Promise-based API with callback support for backward compatibility
- Full ESM and CommonJS compatibility
- Comprehensive test coverage