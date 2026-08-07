# WakoProductHoverImage

**Product Hover Image / Produktbild bei Hover** is a Shopware 6.7 Storefront
plugin by WariKoda. It displays a configurable product image when a visitor
hovers a product box with a mouse or a hovering pen.

## Features

- Listing, CMS product boxes and sliders, cross-selling, customer wishlist, and guest wishlist
- Standard, minimal, image, and wishlist product-box layouts
- Sales-Channel-specific activation and settings
- Five deterministic image-selection strategies
- Configurable hover delay and fade duration
- Separate toggles for listings, CMS elements, cross-selling, and wishlists
- Variant-only, Shopware-inheritance, and explicit parent-fallback modes
- Product media selection through the generated `wako_product_hover_image_media_id` custom field
- No additional HTTP endpoint or product-data request
- Image URL remains inert until the first allowed hover
- No image request for touch or keyboard interaction
- Support for AJAX listings and dynamically replaced product boxes
- Deterministic media order by `product_media.position`, then `product_media.id`
- Existing media-association criteria from themes or plugins remain unchanged
- `prefers-reduced-motion` support

Search pages, search suggestions, and product-detail galleries are intentionally
excluded.

## Requirements

- Shopware Core `~6.7.10`
- Shopware Storefront `~6.7.10`

## Installation

Place the plugin in `custom/plugins/WakoProductHoverImage`, then run:

```bash
composer dump-autoload
bin/console plugin:refresh
bin/console plugin:install --activate WakoProductHoverImage
bin/console cache:clear
bin/build-storefront.sh
```

Open **Extensions > My extensions > Product Hover Image > Configuration** and
enable the option globally or for selected Sales Channels. It is disabled by
default.

## Configuration

The selection strategy can use:

1. exactly the second media item;
2. the first valid image different from the cover;
3. a configured 1-based position in the sorted collection;
4. the media selected in the product custom field
   `wako_product_hover_image_media_id`;
5. the next valid image after the cover.

Media are sorted by `product_media.position` and then `product_media.id`. Cover
and hover media must have a URL and Shopware media type `IMAGE`. The default
strategy remains the exact second item and does not silently fall back to a
third item.

The generated product custom field accepts only a media that is also assigned to
the product's applicable media collection. This prevents arbitrary media-library
files from bypassing product assignment and variant rules.

Variant handling supports normal Shopware inheritance, variant-owned media only,
or variant-owned media followed by a separately loaded parent fallback. Parent
products are fetched in a batched repository query because Shopware deliberately
forbids reading the product `parent` association directly in sales-channel
criteria.

New media associations are sorted deterministically. They are limited only when
the selected strategy can be resolved safely with a finite prefix. Existing
association filters, sorting, limits, fields, offsets, queries, aggregations, and
states remain unchanged. Partial-field criteria are skipped. These compatibility
rules can intentionally result in no hover image when another extension supplies
an incomplete media collection.

## Pointer and lazy-loading behavior

A single delegated listener handles current and future `.product-box` elements.
The image markup is stored in an inert `<template>`. It is cloned only after the
configured hover delay for a mouse or a pen hovering without screen contact on a
device that reports a fine hover pointer. Leaving before the delay cancels the
operation, so no active image request is created. The cover stays visible until
the image emits `load`. A failed image is removed and is not retried during that
marker's DOM lifecycle. The fade duration is configurable; reduced-motion user
preferences still disable the transition.

## Theme and plugin compatibility

The theme must retain Shopware's `component_product_box_image_inner` block and a
recognizable `.product-box .product-image-wrapper` structure. A theme that
replaces that block without `parent()` can suppress the marker and needs a small
compatibility template.

The classes `cover-switch` and `.variant-image-switched` are used only as passive
DOM/CSS conventions. There is no PHP, JavaScript, or Composer dependency on a
variant-listing plugin.

Do not run this plugin together with a SharpThemeDelight release that still
contains its own product-box hover-image implementation. Doing so can add two
criteria subscribers, templates, listeners, and image overlays.

## Development and quality checks

```bash
# Standalone plugin checkout
composer install
composer test:unit
composer analyse

# Alternatively, use PHPUnit supplied by the Shopware project
../../../vendor/bin/phpunit -c phpunit.xml.dist

# Storefront Jest, using Shopware's dependencies
cd ../../../vendor/shopware/storefront/Resources/app/storefront
npm ci
npx jest --config ../../../../../../custom/plugins/WakoProductHoverImage/src/Resources/app/storefront/jest.config.js --runInBand

# Production assets from custom/plugins/WakoProductHoverImage
../../../bin/build-storefront.sh
```

Also run the project's PHPStan, ECS, Storefront ESLint, and Stylelint tooling.
Generated Storefront assets belong in
`src/Resources/app/storefront/dist/storefront/js/wako-product-hover-image/`.

## Privacy

The plugin sets no cookies, performs no tracking, uses no external service, and
stores no personal data. It requests only media URLs already generated by
Shopware and exposes no additional product-data endpoint.

## License

This plugin is licensed under the MIT License. See `LICENSE`.
