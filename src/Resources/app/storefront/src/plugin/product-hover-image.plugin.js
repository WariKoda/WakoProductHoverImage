import Plugin from 'src/plugin-system/plugin.class';

export default class ProductHoverImagePlugin extends Plugin {
    static options = {
        productBoxSelector: '.product-box',
        markerSelector: '[data-wako-product-hover-image]',
        templateSelector: '[data-wako-product-hover-image-template]',
        searchPageSelector: '.search-page',
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
        this._onProductBoxMutations = this._onProductBoxMutations.bind(this);
        this._listenerOptions = { passive: true };
        this._hoverMediaQuery = window.matchMedia?.(this.options.hoverMediaQuery) ?? null;
        this._activePointers = new Map();
        this._touchedProductBoxes = new Set();
        this._readyProductBoxes = new Set();
        this._pendingHoverTimers = new Map();
        this._pendingImageListeners = new Set();
        this._isDestroyed = false;
        this._observedProductBox = null;
        this._mutationObserver = new MutationObserver(this._onProductBoxMutations);

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
        this._stopObservingProductBox();
    }

    _onPointerOver(event) {
        if (!this._isAllowedPointer(event)) {
            return;
        }

        const productBox = this._findProductBox(event.target);

        if (!productBox || this._isInternalTransition(productBox, event.relatedTarget)) {
            return;
        }

        if (productBox.closest(this.options.searchPageSelector)) {
            return;
        }

        const pointerKey = this._pointerKey(event);
        const previousProductBox = this._activePointers.get(pointerKey);

        this._activePointers.delete(pointerKey);

        if (previousProductBox
            && previousProductBox !== productBox
            && ![...this._activePointers.values()].includes(previousProductBox)
        ) {
            previousProductBox.classList.remove(this.options.activeClass);
            this._cancelHover(previousProductBox);
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
        if (!this._isAllowedPointer(event)) {
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
            productBox.classList.remove(this.options.activeClass);
            this._cancelHover(productBox);
        }

        if (productBox === this._observedProductBox) {
            this._observeMostRecentActiveProductBox();
        }
    }

    _observeProductBox(productBox) {
        if (productBox === this._observedProductBox) {
            return;
        }

        this._mutationObserver.disconnect();
        this._observedProductBox = productBox;
        this._mutationObserver.observe(productBox, {
            childList: true,
            subtree: true,
        });
        this._synchronizeProductBox(productBox);
    }

    _stopObservingProductBox() {
        this._mutationObserver.disconnect();
        this._observedProductBox = null;
    }

    _observeMostRecentActiveProductBox() {
        const activeProductBoxes = [...this._activePointers.values()].reverse();
        const productBox = activeProductBoxes.find((candidate) => (
            candidate.isConnected
            && candidate.classList.contains(this.options.activeClass)
            && !candidate.closest(this.options.searchPageSelector)
        ));

        if (productBox) {
            this._observeProductBox(productBox);
            return;
        }

        this._stopObservingProductBox();
    }

    _forgetProductBox(productBox) {
        this._activePointers.forEach((activeProductBox, pointerKey) => {
            if (activeProductBox === productBox) {
                this._activePointers.delete(pointerKey);
            }
        });
    }

    _onProductBoxMutations() {
        const productBox = this._observedProductBox;

        if (!productBox) {
            this._stopObservingProductBox();
            return;
        }

        if (!productBox.isConnected || !productBox.classList.contains(this.options.activeClass)) {
            this._forgetProductBox(productBox);
            this._observeMostRecentActiveProductBox();
            return;
        }

        if (productBox.closest(this.options.searchPageSelector)) {
            productBox.classList.remove(this.options.activeClass);
            productBox.classList.remove(this.options.loadedClass);
            this._forgetProductBox(productBox);
            this._observeMostRecentActiveProductBox();
            return;
        }

        this._synchronizeProductBox(productBox);
    }

    _synchronizeProductBox(productBox) {
        const marker = productBox.querySelector(this.options.markerSelector);

        if (!marker) {
            productBox.classList.remove(this.options.loadedClass);
            return;
        }

        if (!this._isContextEnabled(productBox, marker)) {
            productBox.classList.remove(this.options.activeClass);
            productBox.classList.remove(this.options.loadedClass);
            this._cancelHover(productBox);
            this._forgetProductBox(productBox);
            return;
        }

        const state = marker.dataset[this.options.stateDataKey];

        if (state === 'loading' || state === 'loaded' || state === 'failed') {
            return;
        }

        if (!this._readyProductBoxes.has(productBox)) {
            this._scheduleMaterialization(productBox, marker);
            return;
        }

        this._materializeFreshMarker(productBox, marker);
    }

    _scheduleMaterialization(productBox, marker) {
        if (this._pendingHoverTimers.has(productBox)) {
            return;
        }

        const delay = this._boundedInteger(marker.dataset.wakoHoverDelay, 0);

        if (delay === 0) {
            this._readyProductBoxes.add(productBox);
            this._materializeFreshMarker(productBox, marker);
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

        return marker.dataset[dataKey] !== '0';
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

        const insertedElement = image.parentElement?.tagName === 'PICTURE' ? image.parentElement : image;
        const transitionDuration = this._boundedInteger(marker.dataset.wakoTransitionDuration, 200);

        image.style.setProperty(this.options.transitionDurationProperty, `${transitionDuration}ms`);
        marker.dataset[this.options.stateDataKey] = 'loading';
        productBox.classList.remove(this.options.loadedClass);

        const listener = { image, onLoad: null, onError: null };
        const removeListeners = () => {
            image.removeEventListener('load', listener.onLoad);
            image.removeEventListener('error', listener.onError);
            this._pendingImageListeners.delete(listener);
        };
        const onLoad = () => {
            removeListeners();

            if (this._isDestroyed) {
                return;
            }

            marker.dataset[this.options.stateDataKey] = 'loaded';

            if (productBox.contains(marker)) {
                productBox.classList.add(this.options.loadedClass);
            }
        };
        const onError = () => {
            removeListeners();

            if (this._isDestroyed) {
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
        marker.append(fragment);
    }
}
