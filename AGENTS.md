# WakoProductHoverImage — Development Guidelines

## Overview

Shopware 6.7 Storefront plugin that loads a configurable product image either
with native lazy loading or on an allowed hover over a product box.

- Namespace: `WakoProductHoverImage`
- Composer package: `wako/product-hover-image`
- Compatibility: Shopware 6.7.10+
- License: MIT
- Vendor: WariKoda

## Architecture

- `ProductHoverImageConfig` reads and validates Sales-Channel-aware settings and
  fails closed when the feature cannot be resolved safely.
- Criteria subscribers cover listing, wishlist, cross-selling, CMS product-box,
  and CMS product-slider data paths. Search and suggest are always excluded.
- `ProductBoxMediaCriteria` configures a media association only when it creates
  it. Existing filters, sorting, limits, offsets, fields, queries,
  aggregations, and states are never changed.
- `VariantParentMediaSubscriber` loads parent products in one separate query;
  Shopware forbids reading the product `parent` association directly in
  Sales-Channel criteria.
- Twig applies the configured image-selection and loading strategies. Native
  lazy loading renders the image directly; loading on hover keeps it inside an
  inert `<template>`.
- One delegated Storefront plugin on `body` handles both loading modes, hover
  delay, multiple pointers, dynamic product boxes, marker replacement, and
  cleanup.

## Invariants

- Disabled means no criteria changes, marker markup, lazy chunk loading, or
  image request.
- Never add the functionality to search, suggest, or product-detail galleries.
- Never reset criteria owned by another plugin.
- In `on_hover` mode, never activate image sources before an allowed pointer
  hover and configured delay. In `lazy` mode, request timing belongs to the
  browser.
- Preserve the Wako CSS/data prefix and keep styles neutral.
- `displayMode` remains Shopware's product-box value and is not a plugin option.

## Validation

Run PHPUnit, PHPStan, Storefront Jest, ESLint, Stylelint, Twig/container lint,
and a production Storefront build. Confirm both generated main and lazy chunks
exist. For release validation, verify both modes in a real browser: `on_hover`
must not request the image before the delay, while `lazy` must use native browser
lazy loading.

## Release provenance

The plugin is licensed under MIT. Preserve `LICENSE` in every release artifact.
