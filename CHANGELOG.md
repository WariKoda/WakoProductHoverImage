# Changelog

All notable changes to this project are documented in this file.

## 1.2.0 - 2026-08-27

- Added hover images to regular and AJAX-updated search result listings while keeping search suggestions and aggregation-only filter requests excluded.
- Fixed pointer-out cleanup when the device's hover capability changes during an active interaction.
- Hardened Storefront context handling so only explicit enabled flags can activate a hover image.
- Clarified the context configuration labels and help texts.

## 1.1.0 - 2026-08-10

- Added the `loadingMode` setting with native lazy loading as the default and request-on-hover loading as an alternative.
- Preserved delayed, fine-pointer-only activation and the no-request-before-hover guarantee in `on_hover` mode.
- Prevented disabled Storefront contexts from rendering or requesting lazy hover images.
- Improved cleanup and synchronization for multiple pointers and dynamically replaced product boxes.

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
