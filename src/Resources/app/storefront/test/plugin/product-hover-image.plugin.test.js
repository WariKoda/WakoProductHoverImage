import ProductHoverImagePlugin from '../../src/plugin/product-hover-image.plugin';

const productBoxMarkup = `
    <div class="product-box">
        <div class="card-body">
            <div class="product-image-wrapper">
                <span class="first-child"></span>
                <span class="second-child"></span>
                <div data-wako-product-hover-image>
                    <template data-wako-product-hover-image-template>
                        <img class="wako-product-hover-image" src="/hover.jpg" alt="">
                    </template>
                </div>
            </div>
        </div>
    </div>
`;

const replacementCardBodyMarkup = `
    <div class="product-image-wrapper">
        <span class="replacement-child"></span>
        <div data-wako-product-hover-image>
            <template data-wako-product-hover-image-template>
                <img class="wako-product-hover-image" src="/replacement-hover.jpg" alt="">
            </template>
        </div>
    </div>
`;

const lazyProductBoxMarkup = `
    <div class="product-box">
        <div class="card-body">
            <div class="product-image-wrapper">
                <span class="first-child"></span>
                <div data-wako-product-hover-image>
                    <img class="wako-product-hover-image" src="/lazy-hover.jpg" loading="lazy" alt="" aria-hidden="true">
                </div>
            </div>
        </div>
    </div>
`;

const lazyReplacementCardBodyMarkup = `
    <div class="product-image-wrapper">
        <span class="replacement-child"></span>
        <div data-wako-product-hover-image>
            <img class="wako-product-hover-image" src="/lazy-replacement.jpg" loading="lazy" alt="" aria-hidden="true">
        </div>
    </div>
`;

function markImageAsComplete(image, { naturalWidth = 800, naturalHeight = 600 } = {}) {
    Object.defineProperty(image, 'complete', { value: true, configurable: true });
    Object.defineProperty(image, 'naturalWidth', { value: naturalWidth, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: naturalHeight, configurable: true });

    return image;
}

function dispatchPointer(target, type, {
    pointerType = 'mouse',
    pointerId = 1,
    buttons = 0,
    pressure = 0,
    relatedTarget = null,
} = {}) {
    const event = new Event(type, { bubbles: true });

    Object.defineProperties(event, {
        pointerType: { value: pointerType },
        pointerId: { value: pointerId },
        buttons: { value: buttons },
        pressure: { value: pressure },
        relatedTarget: { value: relatedTarget },
    });

    target.dispatchEvent(event);
}

function flushMutations() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('ProductHoverImagePlugin', () => {
    let plugin;

    beforeEach(() => {
        document.body.innerHTML = productBoxMarkup;
        window.matchMedia = jest.fn().mockReturnValue({ matches: true });
        plugin = new ProductHoverImagePlugin(document.body);
    });

    afterEach(() => {
        plugin.destroy();
        jest.useRealTimers();
    });

    test('does not materialize an image without a marker', () => {
        document.querySelector('[data-wako-product-hover-image]').remove();
        dispatchPointer(document.querySelector('.product-box'), 'pointerover');

        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
    });

    test.each([
        ['missing template', ''],
        ['template without image', '<template data-wako-product-hover-image-template><span></span></template>'],
    ])('marks malformed markup as failed for %s', (description, markerMarkup) => {
        const marker = document.querySelector('[data-wako-product-hover-image]');
        marker.innerHTML = markerMarkup;

        dispatchPointer(document.querySelector('.product-box'), 'pointerover');

        expect(marker.dataset.wakoProductHoverImageState).toBe('failed');
        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
    });

    test('removes the complete picture element after an image error', () => {
        const marker = document.querySelector('[data-wako-product-hover-image]');
        marker.innerHTML = `
            <template data-wako-product-hover-image-template>
                <picture><source srcset="/hover.webp"><img src="/hover.jpg" alt=""></picture>
            </template>
        `;
        dispatchPointer(document.querySelector('.product-box'), 'pointerover');

        marker.querySelector('img').dispatchEvent(new Event('error'));

        expect(marker.querySelector('picture')).toBeNull();
        expect(marker.dataset.wakoProductHoverImageState).toBe('failed');
    });

    test('ignores touch input, even when the device supports hover', () => {
        dispatchPointer(document.querySelector('.product-box'), 'pointerover', { pointerType: 'touch' });

        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
        expect(document.querySelector('.product-box').classList.contains('is-wako-product-hover-image-active')).toBe(false);
    });

    test('touch pointerout does not deactivate an active mouse hover', () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');

        dispatchPointer(productBox, 'pointerout', { pointerType: 'touch' });

        expect(productBox.classList.contains('is-wako-product-hover-image-active')).toBe(true);
    });

    test('ignores input when no fine hover pointer is available', () => {
        plugin._hoverMediaQuery.matches = false;
        dispatchPointer(document.querySelector('.product-box'), 'pointerover');

        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
    });

    test('fails closed when matchMedia is unavailable', () => {
        plugin.destroy();
        window.matchMedia = undefined;
        plugin = new ProductHoverImagePlugin(document.body);

        dispatchPointer(document.querySelector('.product-box'), 'pointerover');

        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
    });

    test('materializes only after the configured hover delay', () => {
        jest.useFakeTimers();
        const marker = document.querySelector('[data-wako-product-hover-image]');
        marker.dataset.wakoHoverDelay = '120';

        dispatchPointer(document.querySelector('.product-box'), 'pointerover');
        jest.advanceTimersByTime(119);
        expect(document.querySelector('.wako-product-hover-image')).toBeNull();

        jest.advanceTimersByTime(1);
        expect(document.querySelector('.wako-product-hover-image')).not.toBeNull();
        jest.useRealTimers();
    });

    test('cancels delayed materialization when the pointer leaves', () => {
        jest.useFakeTimers();
        const productBox = document.querySelector('.product-box');
        document.querySelector('[data-wako-product-hover-image]').dataset.wakoHoverDelay = '120';

        dispatchPointer(productBox, 'pointerover');
        dispatchPointer(productBox, 'pointerout');
        jest.advanceTimersByTime(120);

        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
        jest.useRealTimers();
    });

    test('rejects an invalid configured transition duration', () => {
        const marker = document.querySelector('[data-wako-product-hover-image]');
        marker.dataset.wakoTransitionDuration = '900';

        dispatchPointer(document.querySelector('.product-box'), 'pointerover');

        expect(document.querySelector('.wako-product-hover-image').style.getPropertyValue(
            '--wako-product-hover-image-transition-duration',
        )).toBe('200ms');
    });

    test.each([
        ['listing', 'wakoEnableListing', null],
        ['cross-selling', 'wakoEnableCrossSelling', 'product-detail-cross-selling'],
        ['CMS', 'wakoEnableCms', 'cms-element-product-slider'],
        ['wishlist', 'wakoEnableWishlist', 'box-wishlist'],
    ])('respects a disabled %s context', (description, dataKey, contextClass) => {
        const productBox = document.querySelector('.product-box');
        const marker = document.querySelector('[data-wako-product-hover-image]');
        marker.dataset[dataKey] = '0';

        if (contextClass === 'box-wishlist') {
            productBox.classList.add(contextClass);
        } else if (contextClass) {
            const context = document.createElement('div');
            context.className = contextClass;
            productBox.before(context);
            context.append(productBox);
        }

        dispatchPointer(productBox, 'pointerover');

        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
        expect(productBox.classList.contains('is-wako-product-hover-image-active')).toBe(false);
    });

    test('materializes an image only once for mouse hover', () => {
        const productBox = document.querySelector('.product-box');

        dispatchPointer(productBox, 'pointerover');
        dispatchPointer(productBox, 'pointerout');
        dispatchPointer(productBox, 'pointerover');

        expect(document.querySelectorAll('.wako-product-hover-image')).toHaveLength(1);
    });

    test('its own DOM mutation does not materialize a second image', async () => {
        const materializeSpy = jest.spyOn(plugin, '_materializeImage');

        dispatchPointer(document.querySelector('.product-box'), 'pointerover');
        await flushMutations();

        expect(materializeSpy).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll('.wako-product-hover-image')).toHaveLength(1);
    });

    test('accepts a hovering pen but ignores a pen touching the screen', () => {
        const productBox = document.querySelector('.product-box');

        dispatchPointer(productBox, 'pointerover', {
            pointerType: 'pen',
            buttons: 1,
            pressure: 0.5,
        });
        expect(document.querySelector('.wako-product-hover-image')).toBeNull();

        dispatchPointer(productBox, 'pointerover', { pointerType: 'pen' });
        expect(document.querySelectorAll('.wako-product-hover-image')).toHaveLength(1);
    });

    test('ignores pointer transitions between children of the same product box', () => {
        const materializeSpy = jest.spyOn(plugin, '_materializeImage');
        const firstChild = document.querySelector('.first-child');
        const secondChild = document.querySelector('.second-child');

        dispatchPointer(firstChild, 'pointerover');
        dispatchPointer(firstChild, 'pointerout', { relatedTarget: secondChild });
        dispatchPointer(secondChild, 'pointerover', { relatedTarget: firstChild });

        expect(materializeSpy).toHaveBeenCalledTimes(1);
        expect(document.querySelector('.product-box').classList.contains('is-wako-product-hover-image-active')).toBe(true);
    });

    test('marks the image as loaded only after its load event', () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');

        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);

        document.querySelector('.wako-product-hover-image').dispatchEvent(new Event('load'));

        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(true);
        expect(document.querySelector('[data-wako-product-hover-image]').dataset.wakoProductHoverImageState).toBe('loaded');
    });

    test('keeps a loaded image in the DOM after leaving the product box', () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        document.querySelector('.wako-product-hover-image').dispatchEvent(new Event('load'));

        dispatchPointer(productBox, 'pointerout');

        expect(productBox.classList.contains('is-wako-product-hover-image-active')).toBe(false);
        expect(document.querySelector('.wako-product-hover-image')).not.toBeNull();
    });

    test('reuses an image that finishes loading after pointerout', () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        const image = document.querySelector('.wako-product-hover-image');
        dispatchPointer(productBox, 'pointerout');

        image.dispatchEvent(new Event('load'));
        dispatchPointer(productBox, 'pointerover');

        expect(productBox.classList.contains('is-wako-product-hover-image-active')).toBe(true);
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(true);
        expect(document.querySelectorAll('.wako-product-hover-image')).toHaveLength(1);
    });

    test('removes a failed image and does not retry in the same DOM lifecycle', () => {
        const productBox = document.querySelector('.product-box');
        const marker = document.querySelector('[data-wako-product-hover-image]');
        dispatchPointer(productBox, 'pointerover');

        document.querySelector('.wako-product-hover-image').dispatchEvent(new Event('error'));

        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
        expect(marker.dataset.wakoProductHoverImageState).toBe('failed');
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);

        dispatchPointer(productBox, 'pointerout');
        dispatchPointer(productBox, 'pointerover');
        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
    });

    test('a load from replaced markup does not mark the current box as loaded', () => {
        const productBox = document.querySelector('.product-box');
        const oldImageWrapper = document.querySelector('.product-image-wrapper');
        dispatchPointer(productBox, 'pointerover');
        const detachedImage = document.querySelector('.wako-product-hover-image');

        oldImageWrapper.remove();
        detachedImage.dispatchEvent(new Event('load'));

        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);
    });

    test('materializes a fresh marker when the card body is replaced during hover', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        document.querySelector('.wako-product-hover-image').dispatchEvent(new Event('load'));

        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(true);

        document.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        await flushMutations();

        const replacementImage = document.querySelector('.wako-product-hover-image');
        const replacementMarker = document.querySelector('[data-wako-product-hover-image]');

        expect(replacementImage.getAttribute('src')).toBe('/replacement-hover.jpg');
        expect(replacementMarker.dataset.wakoProductHoverImageState).toBe('loading');
        expect(productBox.classList.contains('is-wako-product-hover-image-active')).toBe(true);
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);

        replacementImage.dispatchEvent(new Event('load'));

        expect(replacementMarker.dataset.wakoProductHoverImageState).toBe('loaded');
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(true);
    });

    test('detects a new marker when the hovered variant previously had none', async () => {
        document.querySelector('[data-wako-product-hover-image]').remove();
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');

        document.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        await flushMutations();

        expect(document.querySelector('.wako-product-hover-image').getAttribute('src')).toBe('/replacement-hover.jpg');
    });

    test('does not materialize replaced markup after leaving the product box', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        dispatchPointer(productBox, 'pointerout');

        document.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        await flushMutations();

        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
    });

    test('clears loaded state when a marker is removed without replacement', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        document.querySelector('.wako-product-hover-image').dispatchEvent(new Event('load'));

        document.querySelector('[data-wako-product-hover-image]').remove();
        await flushMutations();

        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);
    });

    test('applies the search guard when observed markup moves into a search page', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        const image = productBox.querySelector('.wako-product-hover-image');
        const searchPage = document.createElement('div');
        searchPage.className = 'search-page';
        document.body.append(searchPage);
        searchPage.append(productBox);
        await flushMutations();

        expect(productBox.classList.contains('is-wako-product-hover-image-active')).toBe(false);
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);
        expect(plugin._pendingImageListeners.size).toBe(0);

        image.dispatchEvent(new Event('load'));
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);
    });

    test('releases an active product box that disconnects from the document', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        const marker = productBox.querySelector('[data-wako-product-hover-image]');
        const image = marker.querySelector('.wako-product-hover-image');

        productBox.remove();
        await flushMutations();

        expect(plugin._activePointers.size).toBe(0);
        expect(plugin._productBoxObservers.size).toBe(0);
        expect(plugin._pendingImageListeners.size).toBe(0);
        expect(plugin._boundImages.has(marker)).toBe(false);
        expect(plugin._touchedProductBoxes.has(productBox)).toBe(false);
        expect(productBox.classList.contains('is-wako-product-hover-image-active')).toBe(false);

        image.dispatchEvent(new Event('load'));
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);
    });

    test('releases a disconnected product box after the pointer already left', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        const marker = productBox.querySelector('[data-wako-product-hover-image]');
        const image = marker.querySelector('.wako-product-hover-image');
        dispatchPointer(productBox, 'pointerout');

        expect(plugin._pendingImageListeners.size).toBe(1);
        expect(plugin._productBoxObservers.size).toBe(0);

        productBox.remove();
        await flushMutations();

        expect(plugin._pendingImageListeners.size).toBe(0);
        expect(plugin._boundImages.has(marker)).toBe(false);
        expect(plugin._touchedProductBoxes.has(productBox)).toBe(false);

        image.dispatchEvent(new Event('load'));
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);
    });

    test('does not materialize a replacement queued immediately before pointerout', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');

        document.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        dispatchPointer(productBox, 'pointerout');
        await flushMutations();

        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
    });

    test('an old image error cannot change a fresh replacement marker', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        const detachedImage = document.querySelector('.wako-product-hover-image');

        document.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        await flushMutations();
        const replacementMarker = document.querySelector('[data-wako-product-hover-image]');
        const replacementImage = replacementMarker.querySelector('.wako-product-hover-image');

        detachedImage.dispatchEvent(new Event('error'));

        expect(replacementMarker.dataset.wakoProductHoverImageState).toBe('loading');
        expect(replacementMarker.querySelector('.wako-product-hover-image')).toBe(replacementImage);
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);
    });

    test('materializes only the final marker after multiple synchronous replacements', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');

        document.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        document.querySelector('.card-body').innerHTML = replacementCardBodyMarkup.replace(
            '/replacement-hover.jpg',
            '/final-hover.jpg',
        );
        await flushMutations();

        expect(document.querySelectorAll('.wako-product-hover-image')).toHaveLength(1);
        expect(document.querySelector('.wako-product-hover-image').getAttribute('src')).toBe('/final-hover.jpg');
    });

    test('allows one fresh attempt after a failed marker is replaced', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        document.querySelector('.wako-product-hover-image').dispatchEvent(new Event('error'));

        document.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        await flushMutations();

        const replacementMarker = document.querySelector('[data-wako-product-hover-image]');
        expect(replacementMarker.dataset.wakoProductHoverImageState).toBe('loading');
        expect(replacementMarker.querySelectorAll('.wako-product-hover-image')).toHaveLength(1);
    });

    test('cleans up the previous box when the same pointer switches without pointerout', () => {
        document.body.insertAdjacentHTML('beforeend', productBoxMarkup);
        const [firstProductBox, secondProductBox] = document.querySelectorAll('.product-box');

        dispatchPointer(firstProductBox, 'pointerover', { pointerId: 1 });
        dispatchPointer(secondProductBox, 'pointerover', { pointerId: 1 });

        expect(firstProductBox.classList.contains('is-wako-product-hover-image-active')).toBe(false);
        expect(secondProductBox.classList.contains('is-wako-product-hover-image-active')).toBe(true);
    });

    test('keeps a box active while another allowed pointer remains inside it', () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover', { pointerId: 1 });
        dispatchPointer(productBox, 'pointerover', { pointerId: 2, pointerType: 'pen' });

        dispatchPointer(productBox, 'pointerout', { pointerId: 1 });

        expect(productBox.classList.contains('is-wako-product-hover-image-active')).toBe(true);
    });

    test('synchronizes every concurrently active product box', async () => {
        document.body.insertAdjacentHTML('beforeend', productBoxMarkup);
        const [firstProductBox, secondProductBox] = document.querySelectorAll('.product-box');

        dispatchPointer(firstProductBox, 'pointerover', { pointerId: 1 });
        dispatchPointer(secondProductBox, 'pointerover', { pointerId: 2, pointerType: 'pen' });

        firstProductBox.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        secondProductBox.querySelector('.card-body').innerHTML = replacementCardBodyMarkup.replace(
            '/replacement-hover.jpg',
            '/second-hover.jpg',
        );
        await flushMutations();

        expect(firstProductBox.querySelector('.wako-product-hover-image').getAttribute('src'))
            .toBe('/replacement-hover.jpg');
        expect(secondProductBox.querySelector('.wako-product-hover-image').getAttribute('src'))
            .toBe('/second-hover.jpg');
    });

    test('drops stale loaded state of a box that is not the most recent pointer target', async () => {
        document.body.insertAdjacentHTML('beforeend', productBoxMarkup);
        const [firstProductBox, secondProductBox] = document.querySelectorAll('.product-box');

        dispatchPointer(firstProductBox, 'pointerover', { pointerId: 1 });
        firstProductBox.querySelector('.wako-product-hover-image').dispatchEvent(new Event('load'));
        dispatchPointer(secondProductBox, 'pointerover', { pointerId: 2, pointerType: 'pen' });

        expect(firstProductBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(true);

        firstProductBox.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        await flushMutations();

        const replacementMarker = firstProductBox.querySelector('[data-wako-product-hover-image]');

        expect(firstProductBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);
        expect(replacementMarker.dataset.wakoProductHoverImageState).toBe('loading');

        replacementMarker.querySelector('.wako-product-hover-image').dispatchEvent(new Event('load'));

        expect(firstProductBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(true);
        expect(secondProductBox.classList.contains('is-wako-product-hover-image-active')).toBe(true);
    });

    test('stops observing a box the pointer left while another box stays active', async () => {
        document.body.insertAdjacentHTML('beforeend', productBoxMarkup);
        const [firstProductBox, secondProductBox] = document.querySelectorAll('.product-box');

        dispatchPointer(firstProductBox, 'pointerover', { pointerId: 1 });
        dispatchPointer(secondProductBox, 'pointerover', { pointerId: 2, pointerType: 'pen' });
        dispatchPointer(firstProductBox, 'pointerout', { pointerId: 1 });

        firstProductBox.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        secondProductBox.querySelector('.card-body').innerHTML = replacementCardBodyMarkup.replace(
            '/replacement-hover.jpg',
            '/second-hover.jpg',
        );
        await flushMutations();

        expect(firstProductBox.querySelector('.wako-product-hover-image')).toBeNull();
        expect(secondProductBox.querySelector('.wako-product-hover-image').getAttribute('src'))
            .toBe('/second-hover.jpg');
    });

    test('stops observing the previous box when the same pointer switches boxes', async () => {
        document.body.insertAdjacentHTML('beforeend', productBoxMarkup);
        const [firstProductBox, secondProductBox] = document.querySelectorAll('.product-box');

        dispatchPointer(firstProductBox, 'pointerover', { pointerId: 1 });
        dispatchPointer(secondProductBox, 'pointerover', { pointerId: 1 });

        firstProductBox.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        await flushMutations();

        expect(firstProductBox.querySelector('.wako-product-hover-image')).toBeNull();
        expect(secondProductBox.querySelector('.wako-product-hover-image')).not.toBeNull();
    });

    test('stops observing a box whose context turns out to be disabled', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');

        document.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        document.querySelector('[data-wako-product-hover-image]').dataset.wakoEnableListing = '0';
        await flushMutations();

        expect(productBox.classList.contains('is-wako-product-hover-image-active')).toBe(false);
        expect(productBox.querySelector('.wako-product-hover-image')).toBeNull();

        document.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        await flushMutations();

        expect(productBox.querySelector('.wako-product-hover-image')).toBeNull();
    });

    test('releases pending image listeners when the whole marker is replaced', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        const staleMarker = document.querySelector('[data-wako-product-hover-image]');
        const staleImage = staleMarker.querySelector('.wako-product-hover-image');

        document.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        await flushMutations();

        expect([...plugin._pendingImageListeners].some((listener) => listener.marker === staleMarker)).toBe(false);
        expect(plugin._boundImages.has(staleMarker)).toBe(false);

        staleImage.dispatchEvent(new Event('load'));

        expect(staleMarker.dataset.wakoProductHoverImageState).toBe('loading');
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);
    });

    test('releases pending image listeners when the marker is removed without replacement', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        const staleMarker = document.querySelector('[data-wako-product-hover-image]');
        const staleImage = staleMarker.querySelector('.wako-product-hover-image');

        staleMarker.remove();
        await flushMutations();

        expect(plugin._pendingImageListeners.size).toBe(0);
        expect(plugin._boundImages.has(staleMarker)).toBe(false);

        staleImage.dispatchEvent(new Event('error'));

        expect(staleMarker.dataset.wakoProductHoverImageState).toBe('loading');
        expect(staleMarker.querySelector('.wako-product-hover-image')).toBe(staleImage);
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);
    });

    test('recognizes a product box inserted after plugin initialization', () => {
        document.body.innerHTML = '';
        document.body.insertAdjacentHTML('beforeend', productBoxMarkup);

        dispatchPointer(document.querySelector('.product-box'), 'pointerover');

        expect(document.querySelectorAll('.wako-product-hover-image')).toHaveLength(1);
    });

    test('ignores product boxes inside a search page', () => {
        document.body.innerHTML = `<div class="search-page">${productBoxMarkup}</div>`;

        dispatchPointer(document.querySelector('.product-box'), 'pointerover');

        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
    });

    test('does not react to keyboard focus', () => {
        const productBox = document.querySelector('.product-box');
        productBox.setAttribute('tabindex', '0');
        productBox.focus();

        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
        expect(productBox.classList.contains('is-wako-product-hover-image-active')).toBe(false);
    });

    test('destroy cancels delayed materialization', () => {
        jest.useFakeTimers();
        document.querySelector('[data-wako-product-hover-image]').dataset.wakoHoverDelay = '120';
        dispatchPointer(document.querySelector('.product-box'), 'pointerover');

        plugin.destroy();
        jest.advanceTimersByTime(120);

        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
        jest.useRealTimers();
    });

    test('destroy removes active and loaded classes from touched boxes', () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        document.querySelector('.wako-product-hover-image').dispatchEvent(new Event('load'));

        plugin.destroy();

        expect(productBox.classList.contains('is-wako-product-hover-image-active')).toBe(false);
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);
    });

    test('destroy prevents a delayed load from changing marker state or classes', () => {
        const productBox = document.querySelector('.product-box');
        const marker = document.querySelector('[data-wako-product-hover-image]');
        dispatchPointer(productBox, 'pointerover');
        const image = document.querySelector('.wako-product-hover-image');
        plugin.destroy();

        image.dispatchEvent(new Event('load'));

        expect(marker.dataset.wakoProductHoverImageState).toBe('loading');
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);
    });

    test('destroy prevents a delayed error from changing marker state or DOM', () => {
        const productBox = document.querySelector('.product-box');
        const marker = document.querySelector('[data-wako-product-hover-image]');
        dispatchPointer(productBox, 'pointerover');
        const image = document.querySelector('.wako-product-hover-image');
        plugin.destroy();

        image.dispatchEvent(new Event('error'));

        expect(marker.dataset.wakoProductHoverImageState).toBe('loading');
        expect(marker.querySelector('.wako-product-hover-image')).toBe(image);
    });

    test('destroy removes delegated pointer listeners and disconnects the observer', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        plugin.destroy();

        document.querySelector('.card-body').innerHTML = replacementCardBodyMarkup;
        dispatchPointer(productBox, 'pointerover');
        await flushMutations();

        expect(document.querySelector('.wako-product-hover-image')).toBeNull();
    });
});

describe('ProductHoverImagePlugin with native lazy markup', () => {
    let plugin;

    beforeEach(() => {
        document.body.innerHTML = lazyProductBoxMarkup;
        window.matchMedia = jest.fn().mockReturnValue({ matches: true });
        plugin = new ProductHoverImagePlugin(document.body);
    });

    afterEach(() => {
        plugin.destroy();
        jest.useRealTimers();
    });

    test('leaves the browser-managed image untouched until an allowed hover', () => {
        const marker = document.querySelector('[data-wako-product-hover-image]');
        const image = document.querySelector('.wako-product-hover-image');

        expect(marker.dataset.wakoProductHoverImageState).toBeUndefined();
        expect(image.getAttribute('loading')).toBe('lazy');
        expect(image.style.getPropertyValue('--wako-product-hover-image-transition-duration')).toBe('');
        expect(document.querySelector('.product-box').classList.contains('is-wako-product-hover-image-active')).toBe(false);
    });

    test('reuses the existing lazy image instead of cloning it', () => {
        const marker = document.querySelector('[data-wako-product-hover-image]');
        const image = marker.querySelector('img');

        dispatchPointer(document.querySelector('.product-box'), 'pointerover');

        expect(marker.querySelectorAll('img')).toHaveLength(1);
        expect(marker.querySelector('img')).toBe(image);
        expect(marker.dataset.wakoProductHoverImageState).toBe('loading');
    });

    test('keeps the native loading attribute and applies the transition duration', () => {
        const marker = document.querySelector('[data-wako-product-hover-image]');
        marker.dataset.wakoTransitionDuration = '150';

        dispatchPointer(document.querySelector('.product-box'), 'pointerover');

        const image = marker.querySelector('img');

        expect(image.getAttribute('loading')).toBe('lazy');
        expect(image.style.getPropertyValue('--wako-product-hover-image-transition-duration')).toBe('150ms');
    });

    test('marks the lazy image as loaded only after its load event', () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');

        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);

        document.querySelector('.wako-product-hover-image').dispatchEvent(new Event('load'));

        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(true);
        expect(document.querySelector('[data-wako-product-hover-image]').dataset.wakoProductHoverImageState).toBe('loaded');
    });

    test('marks an already complete lazy image as loaded without a load event', () => {
        const productBox = document.querySelector('.product-box');
        const image = markImageAsComplete(document.querySelector('.wako-product-hover-image'));

        dispatchPointer(productBox, 'pointerover');

        expect(document.querySelector('[data-wako-product-hover-image]').dataset.wakoProductHoverImageState).toBe('loaded');
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(true);
        expect(document.querySelector('.wako-product-hover-image')).toBe(image);
    });

    test('removes an already broken lazy picture on the first allowed hover', () => {
        const marker = document.querySelector('[data-wako-product-hover-image]');
        marker.innerHTML = '<picture><source srcset="/lazy-hover.webp"><img class="wako-product-hover-image" src="/lazy-hover.jpg" loading="lazy" alt=""></picture>';
        markImageAsComplete(marker.querySelector('img'), { naturalWidth: 0, naturalHeight: 0 });

        dispatchPointer(document.querySelector('.product-box'), 'pointerover');

        expect(marker.querySelector('picture')).toBeNull();
        expect(marker.dataset.wakoProductHoverImageState).toBe('failed');
    });

    test('removes the complete picture element after a lazy image error', () => {
        const marker = document.querySelector('[data-wako-product-hover-image]');
        marker.innerHTML = '<picture><source srcset="/lazy-hover.webp"><img class="wako-product-hover-image" src="/lazy-hover.jpg" loading="lazy" alt=""></picture>';
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');

        marker.querySelector('img').dispatchEvent(new Event('error'));

        expect(marker.querySelector('picture')).toBeNull();
        expect(marker.dataset.wakoProductHoverImageState).toBe('failed');
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);
    });

    test('ignores touch input and never activates the lazy image', () => {
        const marker = document.querySelector('[data-wako-product-hover-image]');

        dispatchPointer(document.querySelector('.product-box'), 'pointerover', { pointerType: 'touch' });

        expect(marker.dataset.wakoProductHoverImageState).toBeUndefined();
        expect(marker.querySelectorAll('img')).toHaveLength(1);
        expect(marker.querySelector('img').style.getPropertyValue(
            '--wako-product-hover-image-transition-duration',
        )).toBe('');
        expect(document.querySelector('.product-box').classList.contains('is-wako-product-hover-image-active')).toBe(false);
    });

    test('ignores the on-hover delay for native lazy markup', () => {
        const marker = document.querySelector('[data-wako-product-hover-image]');
        marker.dataset.wakoHoverDelay = '120';

        dispatchPointer(document.querySelector('.product-box'), 'pointerover');

        expect(marker.dataset.wakoProductHoverImageState).toBe('loading');
        expect(marker.querySelectorAll('img')).toHaveLength(1);
    });

    test('does not duplicate the lazy image when the pointer re-enters', () => {
        const productBox = document.querySelector('.product-box');
        const image = document.querySelector('.wako-product-hover-image');
        dispatchPointer(productBox, 'pointerover');
        image.dispatchEvent(new Event('load'));

        dispatchPointer(productBox, 'pointerout');
        dispatchPointer(productBox, 'pointerover');

        expect(document.querySelectorAll('.wako-product-hover-image')).toHaveLength(1);
        expect(document.querySelector('.wako-product-hover-image')).toBe(image);
        expect(document.querySelector('[data-wako-product-hover-image]').dataset.wakoProductHoverImageState).toBe('loaded');
    });

    test('watches a lazy image that replaces the previous one inside the same marker', async () => {
        const productBox = document.querySelector('.product-box');
        const marker = document.querySelector('[data-wako-product-hover-image]');
        dispatchPointer(productBox, 'pointerover');
        const staleImage = marker.querySelector('img');
        staleImage.dispatchEvent(new Event('load'));

        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(true);

        marker.innerHTML = '<img class="wako-product-hover-image" src="/lazy-variant.jpg" loading="lazy" alt="">';
        await flushMutations();

        const freshImage = marker.querySelector('img');

        expect(freshImage).not.toBe(staleImage);
        expect(marker.querySelectorAll('img')).toHaveLength(1);
        expect(marker.dataset.wakoProductHoverImageState).toBe('loading');
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);

        staleImage.dispatchEvent(new Event('load'));
        expect(marker.dataset.wakoProductHoverImageState).toBe('loading');

        freshImage.dispatchEvent(new Event('load'));
        expect(marker.dataset.wakoProductHoverImageState).toBe('loaded');
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(true);
    });

    test('watches a lazy image of a card body replaced during hover', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        document.querySelector('.wako-product-hover-image').dispatchEvent(new Event('load'));

        document.querySelector('.card-body').innerHTML = lazyReplacementCardBodyMarkup;
        await flushMutations();

        const replacementMarker = document.querySelector('[data-wako-product-hover-image]');
        const replacementImage = replacementMarker.querySelector('img');

        expect(replacementImage.getAttribute('src')).toBe('/lazy-replacement.jpg');
        expect(replacementImage.getAttribute('loading')).toBe('lazy');
        expect(replacementMarker.querySelectorAll('img')).toHaveLength(1);
        expect(replacementMarker.dataset.wakoProductHoverImageState).toBe('loading');
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);

        replacementImage.dispatchEvent(new Event('load'));

        expect(replacementMarker.dataset.wakoProductHoverImageState).toBe('loaded');
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(true);
    });

    test('does not activate a lazy replacement after leaving the product box', async () => {
        const productBox = document.querySelector('.product-box');
        dispatchPointer(productBox, 'pointerover');
        dispatchPointer(productBox, 'pointerout');

        document.querySelector('.card-body').innerHTML = lazyReplacementCardBodyMarkup;
        await flushMutations();

        expect(document.querySelector('[data-wako-product-hover-image]').dataset.wakoProductHoverImageState).toBeUndefined();
    });

    test('respects a disabled context for lazy markup', () => {
        const productBox = document.querySelector('.product-box');
        const marker = document.querySelector('[data-wako-product-hover-image]');
        marker.dataset.wakoEnableListing = '0';

        dispatchPointer(productBox, 'pointerover');

        expect(marker.dataset.wakoProductHoverImageState).toBeUndefined();
        expect(productBox.classList.contains('is-wako-product-hover-image-active')).toBe(false);
    });

    test('ignores lazy markup inside a search page', () => {
        document.body.innerHTML = `<div class="search-page">${lazyProductBoxMarkup}</div>`;

        dispatchPointer(document.querySelector('.product-box'), 'pointerover');

        expect(document.querySelector('[data-wako-product-hover-image]').dataset.wakoProductHoverImageState).toBeUndefined();
    });

    test('watches a lazy replacement of a box that is not the most recent pointer target', async () => {
        document.body.insertAdjacentHTML('beforeend', lazyProductBoxMarkup);
        const [firstProductBox, secondProductBox] = document.querySelectorAll('.product-box');

        dispatchPointer(firstProductBox, 'pointerover', { pointerId: 1 });
        const staleMarker = firstProductBox.querySelector('[data-wako-product-hover-image]');
        const staleImage = staleMarker.querySelector('img');
        staleImage.dispatchEvent(new Event('load'));
        dispatchPointer(secondProductBox, 'pointerover', { pointerId: 2, pointerType: 'pen' });

        firstProductBox.querySelector('.card-body').innerHTML = lazyReplacementCardBodyMarkup;
        await flushMutations();

        const replacementMarker = firstProductBox.querySelector('[data-wako-product-hover-image]');

        expect(replacementMarker.querySelector('img').getAttribute('src')).toBe('/lazy-replacement.jpg');
        expect(replacementMarker.dataset.wakoProductHoverImageState).toBe('loading');
        expect(firstProductBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);

        staleImage.dispatchEvent(new Event('load'));
        expect(firstProductBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);

        replacementMarker.querySelector('img').dispatchEvent(new Event('load'));
        expect(firstProductBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(true);
    });

    test('destroy stops watching the lazy image', () => {
        const productBox = document.querySelector('.product-box');
        const marker = document.querySelector('[data-wako-product-hover-image]');
        dispatchPointer(productBox, 'pointerover');
        const image = marker.querySelector('img');

        plugin.destroy();
        image.dispatchEvent(new Event('load'));

        expect(marker.dataset.wakoProductHoverImageState).toBe('loading');
        expect(marker.querySelector('img')).toBe(image);
        expect(productBox.classList.contains('is-wako-product-hover-image-loaded')).toBe(false);
    });

    test('destroy keeps a failing lazy image in the DOM', () => {
        const productBox = document.querySelector('.product-box');
        const marker = document.querySelector('[data-wako-product-hover-image]');
        dispatchPointer(productBox, 'pointerover');
        const image = marker.querySelector('img');

        plugin.destroy();
        image.dispatchEvent(new Event('error'));

        expect(marker.querySelector('img')).toBe(image);
        expect(marker.dataset.wakoProductHoverImageState).toBe('loading');
    });
});
