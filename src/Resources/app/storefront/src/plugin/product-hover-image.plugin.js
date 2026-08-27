import Plugin from 'src/plugin-system/plugin.class';

export default class ProductHoverImagePlugin extends Plugin {
    static options = {
        productBoxSelector: '.product-box',
        markerSelector: '[data-wako-product-hover-image]',
        templateSelector: '[data-wako-product-hover-image-template]',
        activeClass: 'is-wako-product-hover-image-active',
        loadedClass: 'is-wako-product-hover-image-loaded',
        stateDataKey: 'wakoProductHoverImageState',
        hoverMediaQuery: '(any-hover: hover) and (any-pointer: fine)',
        crossSellingContextSelector: '.product-detail-cross-selling',
        cmsContextSelector: '.cms-element-product-slider, .cms-element-product-box',
        wishlistClass: 'box-wishlist',
        transitionDurationProperty: '--wako-product-hover-image-transition-duration',
    };

    init() {
        this._onPointerOver = this._onPointerOver.bind(this);
        this._onPointerOut = this._onPointerOut.bind(this);
        this._listenerOptions = { passive: true };
        this._hoverMediaQuery = window.matchMedia?.(this.options.hoverMediaQuery) ?? null;
        this._activePointers = new Map();
        this._touchedProductBoxes = new Set();
        this._readyProductBoxes = new Set();
        this._pendingHoverTimers = new Map();
        this._pendingImageListeners = new Set();
        this._boundImages = new WeakMap();
        this._trackedMarkers = new WeakMap();
        this._isDestroyed = false;
        this._productBoxObservers = new Map();
        this._documentMutationObserver = new MutationObserver(() => this._synchronizeObservedProductBoxes());
        this._documentMutationObserver.observe(this.el, {
            childList: true,
            subtree: true,
        });

        this.el.addEventListener('pointerover', this._onPointerOver, this._listenerOptions);
        this.el.addEventListener('pointerout', this._onPointerOut, this._listenerOptions);
    }

    destroy() {
        this.el.removeEventListener('pointerover', this._onPointerOver, this._listenerOptions);
        this.el.removeEventListener('pointerout', this._onPointerOut, this._listenerOptions);
        this._isDestroyed = true;
        this._activePointers.clear();
        this._pendingHoverTimers.forEach((timer) => window.clearTimeout(timer));
        this._pendingHoverTimers.clear();
        this._readyProductBoxes.clear();
        this._touchedProductBoxes.forEach((productBox) => {
            productBox.classList.remove(this.options.activeClass);
            productBox.classList.remove(this.options.loadedClass);
        });
        this._touchedProductBoxes.clear();
        this._pendingImageListeners.forEach(({ image, onLoad, onError }) => {
            image.removeEventListener('load', onLoad);
            image.removeEventListener('error', onError);
        });
        this._pendingImageListeners.clear();
        this._boundImages = new WeakMap();
        this._trackedMarkers = new WeakMap();
        this._documentMutationObserver.disconnect();
        this._stopObservingProductBoxes();
    }

    _onPointerOver(event) {
        if (!this._isAllowedPointer(event)) {
            return;
        }

        const productBox = this._findProductBox(event.target);

        if (!productBox || this._isInternalTransition(productBox, event.relatedTarget)) {
            return;
        }

        const pointerKey = this._pointerKey(event);
        const previousProductBox = this._activePointers.get(pointerKey);

        this._activePointers.delete(pointerKey);

        if (previousProductBox
            && previousProductBox !== productBox
            && ![...this._activePointers.values()].includes(previousProductBox)
        ) {
            this._releaseProductBox(previousProductBox);
        }

        const marker = productBox.querySelector(this.options.markerSelector);

        if (marker && !this._isContextEnabled(productBox, marker)) {
            return;
        }

        productBox.classList.add(this.options.activeClass);
        this._touchedProductBoxes.add(productBox);
        this._activePointers.set(pointerKey, productBox);
        this._observeProductBox(productBox);
        this._synchronizeProductBox(productBox);
    }

    _onPointerOut(event) {
        if (event.pointerType === 'touch') {
            return;
        }

        const productBox = this._findProductBox(event.target);

        if (!productBox || this._isInternalTransition(productBox, event.relatedTarget)) {
            return;
        }

        const pointerKey = this._pointerKey(event);

        if (this._activePointers.get(pointerKey) === productBox) {
            this._activePointers.delete(pointerKey);
        }

        if (![...this._activePointers.values()].includes(productBox)) {
            this._releaseProductBox(productBox);
        }
    }

    _observeProductBox(productBox) {
        if (this._productBoxObservers.has(productBox)) {
            return;
        }

        const observer = new MutationObserver(() => this._onProductBoxMutations(productBox));

        observer.observe(productBox, {
            childList: true,
            subtree: true,
        });
        this._productBoxObservers.set(productBox, observer);
    }

    _unobserveProductBox(productBox) {
        const observer = this._productBoxObservers.get(productBox);

        if (observer === undefined) {
            return;
        }

        observer.disconnect();
        this._productBoxObservers.delete(productBox);
    }

    _stopObservingProductBoxes() {
        this._productBoxObservers.forEach((observer) => observer.disconnect());
        this._productBoxObservers.clear();
    }

    _releaseProductBox(productBox) {
        productBox.classList.remove(this.options.activeClass);
        this._cancelHover(productBox);
        this._unobserveProductBox(productBox);
    }

    _forgetProductBox(productBox) {
        this._activePointers.forEach((activeProductBox, pointerKey) => {
            if (activeProductBox === productBox) {
                this._activePointers.delete(pointerKey);
            }
        });
        this._releaseTrackedMarker(productBox);
        this._touchedProductBoxes.delete(productBox);
        productBox.classList.remove(this.options.loadedClass);
        this._releaseProductBox(productBox);
    }

    _synchronizeObservedProductBoxes() {
        const productBoxes = new Set([
            ...this._productBoxObservers.keys(),
            ...this._touchedProductBoxes,
        ]);

        productBoxes.forEach((productBox) => {
            if (!productBox.isConnected) {
                this._forgetProductBox(productBox);
                return;
            }

            if (this._productBoxObservers.has(productBox)) {
                this._onProductBoxMutations(productBox);
            }
        });
    }

    _onProductBoxMutations(productBox) {
        if (this._isDestroyed || !this._productBoxObservers.has(productBox)) {
            return;
        }

        if (!productBox.isConnected || !productBox.classList.contains(this.options.activeClass)) {
            this._forgetProductBox(productBox);
            return;
        }

        this._synchronizeProductBox(productBox);
    }

    _synchronizeProductBox(productBox) {
        const marker = productBox.querySelector(this.options.markerSelector);

        this._trackMarker(productBox, marker);

        if (!marker) {
            productBox.classList.remove(this.options.loadedClass);
            return;
        }

        if (!this._isContextEnabled(productBox, marker)) {
            productBox.classList.remove(this.options.loadedClass);
            this._forgetProductBox(productBox);
            return;
        }

        const state = marker.dataset[this.options.stateDataKey];
        const nativeImage = marker.querySelector('img');

        if (nativeImage) {
            if (state === 'loading' || state === 'loaded' || state === 'failed') {
                this._synchronizeBoundImage(productBox, marker);
                return;
            }

            productBox.classList.remove(this.options.loadedClass);
            this._bindImage(productBox, marker, nativeImage, null);
            return;
        }

        if (state === 'loading' || state === 'loaded' || state === 'failed') {
            return;
        }

        if (!this._readyProductBoxes.has(productBox)) {
            this._scheduleMaterialization(productBox, marker);
            return;
        }

        this._materializeFreshMarker(productBox, marker);
    }

    _synchronizeBoundImage(productBox, marker) {
        const currentImage = marker.querySelector('img');

        if (!currentImage || this._boundImages.get(marker) === currentImage) {
            return;
        }

        productBox.classList.remove(this.options.loadedClass);
        this._bindImage(productBox, marker, currentImage, null);
    }

    _trackMarker(productBox, marker) {
        const trackedMarker = this._trackedMarkers.get(productBox) ?? null;

        if (trackedMarker === marker) {
            return;
        }

        if (trackedMarker) {
            this._releaseMarker(trackedMarker);
        }

        if (marker) {
            this._trackedMarkers.set(productBox, marker);
            return;
        }

        this._trackedMarkers.delete(productBox);
    }

    _releaseMarker(marker) {
        this._releaseImageListeners(marker);
        this._boundImages.delete(marker);
    }

    _releaseTrackedMarker(productBox) {
        const marker = this._trackedMarkers.get(productBox);

        if (marker) {
            this._releaseMarker(marker);
            this._trackedMarkers.delete(productBox);
        }
    }

    _scheduleMaterialization(productBox, marker) {
        if (this._pendingHoverTimers.has(productBox)) {
            return;
        }

        const delay = this._boundedInteger(marker.dataset.wakoHoverDelay, 0);

        if (delay === 0) {
            this._readyProductBoxes.add(productBox);
            this._synchronizeProductBox(productBox);
            return;
        }

        const timer = window.setTimeout(() => {
            this._pendingHoverTimers.delete(productBox);

            if (this._isDestroyed
                || !productBox.isConnected
                || ![...this._activePointers.values()].includes(productBox)
            ) {
                return;
            }

            this._readyProductBoxes.add(productBox);
            this._synchronizeProductBox(productBox);
        }, delay);

        this._pendingHoverTimers.set(productBox, timer);
    }

    _cancelHover(productBox) {
        const timer = this._pendingHoverTimers.get(productBox);

        if (timer !== undefined) {
            window.clearTimeout(timer);
            this._pendingHoverTimers.delete(productBox);
        }

        this._readyProductBoxes.delete(productBox);
    }

    _isContextEnabled(productBox, marker) {
        let dataKey = 'wakoEnableListing';

        if (productBox.closest(this.options.crossSellingContextSelector)) {
            dataKey = 'wakoEnableCrossSelling';
        } else if (productBox.classList.contains(this.options.wishlistClass)) {
            dataKey = 'wakoEnableWishlist';
        } else if (productBox.closest(this.options.cmsContextSelector)) {
            dataKey = 'wakoEnableCms';
        }

        return marker.dataset[dataKey] === '1';
    }

    _boundedInteger(value, fallback) {
        if (typeof value !== 'string' || !/^\d{1,3}$/.test(value)) {
            return fallback;
        }

        const parsedValue = Number(value);

        return parsedValue <= 500 ? parsedValue : fallback;
    }

    _materializeFreshMarker(productBox, marker) {
        const state = marker.dataset[this.options.stateDataKey];

        if (state === 'loading' || state === 'loaded' || state === 'failed') {
            return;
        }

        productBox.classList.remove(this.options.loadedClass);
        this._materializeImage(productBox, marker);
    }

    _isAllowedPointer(event) {
        if (!this._hoverMediaQuery?.matches) {
            return false;
        }

        if (event.pointerType === 'mouse') {
            return true;
        }

        return event.pointerType === 'pen' && event.buttons === 0 && event.pressure === 0;
    }

    _pointerKey(event) {
        return `${event.pointerType}:${event.pointerId ?? 0}`;
    }

    _findProductBox(target) {
        if (!(target instanceof Element)) {
            return null;
        }

        return target.closest(this.options.productBoxSelector);
    }

    _isInternalTransition(productBox, relatedTarget) {
        return relatedTarget instanceof Node && productBox.contains(relatedTarget);
    }

    _materializeImage(productBox, marker) {
        const nativeImage = marker.querySelector('img');

        if (nativeImage) {
            this._bindImage(productBox, marker, nativeImage, null);
            return;
        }

        const template = marker.querySelector(this.options.templateSelector);

        if (!(template instanceof HTMLTemplateElement)) {
            marker.dataset[this.options.stateDataKey] = 'failed';
            return;
        }

        const fragment = template.content.cloneNode(true);
        const image = fragment.querySelector('img');

        if (!image) {
            marker.dataset[this.options.stateDataKey] = 'failed';
            return;
        }

        this._bindImage(productBox, marker, image, fragment);
    }

    _bindImage(productBox, marker, image, fragment) {
        this._releaseImageListeners(marker);

        const insertedElement = image.parentElement?.tagName === 'PICTURE' ? image.parentElement : image;
        const transitionDuration = this._boundedInteger(marker.dataset.wakoTransitionDuration, 200);

        image.style.setProperty(this.options.transitionDurationProperty, `${transitionDuration}ms`);
        this._boundImages.set(marker, image);
        marker.dataset[this.options.stateDataKey] = 'loading';
        productBox.classList.remove(this.options.loadedClass);

        const listener = { marker, image, onLoad: null, onError: null };
        const removeListeners = () => {
            image.removeEventListener('load', listener.onLoad);
            image.removeEventListener('error', listener.onError);
            this._pendingImageListeners.delete(listener);
        };
        const isStale = () => this._isDestroyed || this._boundImages.get(marker) !== image;
        const onLoad = () => {
            removeListeners();

            if (isStale()) {
                return;
            }

            marker.dataset[this.options.stateDataKey] = 'loaded';

            if (productBox.contains(marker)) {
                productBox.classList.add(this.options.loadedClass);
            }
        };
        const onError = () => {
            removeListeners();

            if (isStale()) {
                return;
            }

            insertedElement.remove();
            marker.dataset[this.options.stateDataKey] = 'failed';

            if (productBox.contains(marker)) {
                productBox.classList.remove(this.options.loadedClass);
            }
        };

        listener.onLoad = onLoad;
        listener.onError = onError;
        this._pendingImageListeners.add(listener);
        image.addEventListener('load', onLoad, { once: true });
        image.addEventListener('error', onError, { once: true });

        if (fragment) {
            marker.append(fragment);
            return;
        }

        this._settleCompleteImage(image, onLoad, onError);
    }

    _settleCompleteImage(image, onLoad, onError) {
        if (image.complete !== true) {
            return;
        }

        if (image.naturalWidth === 0 && image.naturalHeight === 0) {
            onError();
            return;
        }

        onLoad();
    }

    _releaseImageListeners(marker) {
        this._pendingImageListeners.forEach((listener) => {
            if (listener.marker !== marker) {
                return;
            }

            listener.image.removeEventListener('load', listener.onLoad);
            listener.image.removeEventListener('error', listener.onError);
            this._pendingImageListeners.delete(listener);
        });
    }
}
