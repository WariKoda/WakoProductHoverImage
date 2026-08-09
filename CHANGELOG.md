# Changelog

All notable changes to this project are documented in this file.

## 1.0.1 - 2026-08-09

- Fixed the GitHub Actions ESLint step so it checks the plugin's JavaScript files and fails on warnings.
- Added removal of the generated custom-field set and its product assignments when the plugin is uninstalled without preserving user data.

## 1.0.0 - 2026-08-07

- Added Sales-Channel-specific activation through Shopware system configuration.
- Added five deterministic media-selection strategies for listings, CMS product boxes and sliders, cross-selling, and wishlists.
- Added configurable media position, hover delay, and transition duration.
- Added independent context toggles for listings, CMS elements, cross-selling, and wishlists.
- Added Shopware inheritance, variant-only, and batched parent-fallback media modes.
- Added an automatically registered product media custom field for explicit hover-image selection.
- Added inert hover-image markup without an initial image request.
- Added delegated pointer handling for dynamically inserted and replaced product boxes.
- Added mouse and hovering-pen support while excluding touch and keyboard focus.
- Added passive compatibility with variant image switches.
- Added reduced-motion support.
- Released the plugin under the MIT License.
