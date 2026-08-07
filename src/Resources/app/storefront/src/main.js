const PluginManager = window.PluginManager;

PluginManager.register(
    'WakoProductHoverImage',
    () => import('./plugin/product-hover-image.plugin'),
    '.is-wako-product-hover-image-enabled',
);
