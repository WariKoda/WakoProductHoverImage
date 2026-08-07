<?php declare(strict_types=1);

namespace WakoProductHoverImage\Tests\Unit\Subscriber;

use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Shopware\Core\Content\Product\Aggregate\ProductCrossSelling\ProductCrossSellingEntity;
use Shopware\Core\Content\Product\Events\ProductCrossSellingIdsCriteriaEvent;
use Shopware\Core\Content\Product\Events\ProductCrossSellingStreamCriteriaEvent;
use Shopware\Core\Content\Product\Events\ProductListingCriteriaEvent;
use Shopware\Core\Content\Product\Events\ProductSearchCriteriaEvent;
use Shopware\Core\Content\Product\Events\ProductSuggestCriteriaEvent;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Criteria;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Filter\EqualsFilter;
use Shopware\Core\System\SalesChannel\SalesChannelContext;
use Shopware\Core\System\SystemConfig\SystemConfigService;
use Shopware\Storefront\Page\Wishlist\WishListPageProductCriteriaEvent;
use Shopware\Storefront\Pagelet\Wishlist\GuestWishListPageletProductCriteriaEvent;
use Symfony\Component\EventDispatcher\EventDispatcher;
use Symfony\Component\HttpFoundation\Request;
use WakoProductHoverImage\Service\ProductBoxMediaCriteria;
use WakoProductHoverImage\Service\ProductHoverImageConfig;
use WakoProductHoverImage\Subscriber\ProductBoxMediaCriteriaSubscriber;

final class ProductBoxMediaCriteriaSubscriberTest extends TestCase
{
    private SalesChannelContext&MockObject $context;

    protected function setUp(): void
    {
        $this->context = $this->createMock(SalesChannelContext::class);
        $this->context->method('getSalesChannelId')->willReturn('sales-channel-id');
    }

    public function testSubscribedEventsUseLatePriority(): void
    {
        foreach (ProductBoxMediaCriteriaSubscriber::getSubscribedEvents() as $listener) {
            self::assertSame(-1000, $listener[1]);
        }
    }

    public function testLateSubscriberPreservesCriteriaFromEarlierListeners(): void
    {
        $criteria = new Criteria();
        $foreignFilter = new EqualsFilter('media.position', 5);
        $dispatcher = new EventDispatcher();
        $dispatcher->addListener(
            ProductListingCriteriaEvent::class,
            static function (ProductListingCriteriaEvent $event) use ($foreignFilter): void {
                $mediaCriteria = $event->getCriteria()->getAssociation('media');
                $mediaCriteria->addFilter($foreignFilter);
                $mediaCriteria->setLimit(1);
            },
        );
        $dispatcher->addSubscriber($this->subscriber(true));

        $dispatcher->dispatch(new ProductListingCriteriaEvent(
            $this->request('frontend.navigation.page'),
            $criteria,
            $this->context,
        ));

        $mediaCriteria = $criteria->getAssociation('media');
        self::assertSame([$foreignFilter], $mediaCriteria->getFilters());
        self::assertSame(1, $mediaCriteria->getLimit());
        self::assertTrue($mediaCriteria->hasAssociation('media'));
    }

    public function testActiveFeatureExtendsListingCriteria(): void
    {
        $criteria = new Criteria();
        $request = $this->request('frontend.navigation.page');

        $this->subscriber(true)->onProductListingCriteria(
            new ProductListingCriteriaEvent($request, $criteria, $this->context),
        );

        self::assertTrue($criteria->hasAssociation('media'));
    }

    public function testSearchListingIsNotChangedAndDoesNotReadConfig(): void
    {
        $criteria = new Criteria();
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->expects(self::never())->method('get');
        $subscriber = $this->subscriberWithSystemConfig($systemConfig);

        $subscriber->onProductListingCriteria(
            new ProductListingCriteriaEvent($this->request('frontend.search.page'), $criteria, $this->context),
        );

        self::assertFalse($criteria->hasAssociation('media'));
    }

    public function testDedicatedSearchAndSuggestEventsAreIgnoredWithoutConfigLookup(): void
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->expects(self::never())->method('get');
        $subscriber = $this->subscriberWithSystemConfig($systemConfig);

        foreach ([ProductSearchCriteriaEvent::class, ProductSuggestCriteriaEvent::class] as $eventClass) {
            $criteria = new Criteria();
            $subscriber->onProductListingCriteria(new $eventClass(new Request(), $criteria, $this->context));
            self::assertFalse($criteria->hasAssociation('media'));
        }
    }

    public function testUnknownListingRouteRemainsSupported(): void
    {
        $criteria = new Criteria();

        $this->subscriber(true)->onProductListingCriteria(
            new ProductListingCriteriaEvent(new Request(), $criteria, $this->context),
        );

        self::assertTrue($criteria->hasAssociation('media'));
    }

    public function testInactiveFeatureDoesNotChangeCriteria(): void
    {
        $criteria = new Criteria();

        $this->subscriber(false)->onProductListingCriteria(
            new ProductListingCriteriaEvent($this->request('frontend.navigation.page'), $criteria, $this->context),
        );

        self::assertFalse($criteria->hasAssociation('media'));
    }

    public function testActiveFeatureExtendsWishlistCriteria(): void
    {
        $criteria = new Criteria();

        $this->subscriber(true)->onWishListCriteria(
            new WishListPageProductCriteriaEvent($criteria, $this->context, new Request()),
        );

        self::assertTrue($criteria->hasAssociation('media'));
    }

    public function testWishlistProductIdEndpointIsNotChanged(): void
    {
        $criteria = new Criteria();
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->expects(self::never())->method('get');

        $this->subscriberWithSystemConfig($systemConfig)->onWishListCriteria(
            new WishListPageProductCriteriaEvent(
                $criteria,
                $this->context,
                $this->request('frontend.wishlist.product.list'),
            ),
        );

        self::assertFalse($criteria->hasAssociation('media'));
    }

    public function testActiveFeatureExtendsGuestWishlistCriteria(): void
    {
        $criteria = new Criteria();

        $this->subscriber(true)->onGuestWishListCriteria(
            new GuestWishListPageletProductCriteriaEvent($criteria, $this->context, new Request()),
        );

        self::assertTrue($criteria->hasAssociation('media'));
    }

    public function testActiveFeatureExtendsCrossSellingIdsCriteria(): void
    {
        $criteria = new Criteria();

        $this->subscriber(true)->onCrossSellingIdsCriteria(
            new ProductCrossSellingIdsCriteriaEvent(new ProductCrossSellingEntity(), $criteria, $this->context),
        );

        self::assertTrue($criteria->hasAssociation('media'));
    }

    public function testActiveFeatureExtendsCrossSellingStreamCriteria(): void
    {
        $criteria = new Criteria();

        $this->subscriber(true)->onCrossSellingStreamCriteria(
            new ProductCrossSellingStreamCriteriaEvent(new ProductCrossSellingEntity(), $criteria, $this->context),
        );

        self::assertTrue($criteria->hasAssociation('media'));
    }

    public function testDisabledListingContextDoesNotChangeCriteria(): void
    {
        $criteria = new Criteria();
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->method('get')->willReturnCallback(
            static fn (string $key): mixed => str_ends_with($key, 'enableListing') ? false : true,
        );

        $this->subscriberWithSystemConfig($systemConfig)->onProductListingCriteria(
            new ProductListingCriteriaEvent($this->request('frontend.navigation.page'), $criteria, $this->context),
        );

        self::assertFalse($criteria->hasAssociation('media'));
    }

    public function testDisabledWishlistContextDoesNotChangeCriteria(): void
    {
        $criteria = new Criteria();
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->method('get')->willReturnCallback(
            static fn (string $key): mixed => str_ends_with($key, 'enableWishlist') ? false : true,
        );

        $this->subscriberWithSystemConfig($systemConfig)->onGuestWishListCriteria(
            new GuestWishListPageletProductCriteriaEvent($criteria, $this->context, new Request()),
        );

        self::assertFalse($criteria->hasAssociation('media'));
    }

    public function testDisabledCrossSellingContextDoesNotChangeCriteria(): void
    {
        $criteria = new Criteria();
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->method('get')->willReturnCallback(
            static fn (string $key): mixed => str_ends_with($key, 'enableCrossSelling') ? false : true,
        );

        $this->subscriberWithSystemConfig($systemConfig)->onCrossSellingIdsCriteria(
            new ProductCrossSellingIdsCriteriaEvent(new ProductCrossSellingEntity(), $criteria, $this->context),
        );

        self::assertFalse($criteria->hasAssociation('media'));
    }

    public function testConfiguredPositionControlsCriteriaLimit(): void
    {
        $criteria = new Criteria();
        $systemConfig = $this->createMock(SystemConfigService::class);
        $values = [
            ProductHoverImageConfig::CONFIG_KEY => true,
            ProductHoverImageConfig::CONFIG_PREFIX . 'enableListing' => true,
            ProductHoverImageConfig::CONFIG_PREFIX . 'selectionStrategy' => ProductHoverImageConfig::SELECTION_CONFIGURED_POSITION,
            ProductHoverImageConfig::CONFIG_PREFIX . 'mediaPosition' => 6,
            ProductHoverImageConfig::CONFIG_PREFIX . 'variantMediaMode' => ProductHoverImageConfig::VARIANT_PARENT_FALLBACK,
        ];
        $systemConfig->method('get')->willReturnCallback(
            static fn (string $key): mixed => $values[$key] ?? null,
        );

        $this->subscriberWithSystemConfig($systemConfig)->onProductListingCriteria(
            new ProductListingCriteriaEvent($this->request('frontend.navigation.page'), $criteria, $this->context),
        );

        self::assertSame(6, $criteria->getAssociation('media')->getLimit());
        self::assertFalse($criteria->hasAssociation('parent'));
    }

    private function subscriber(bool $enabled): ProductBoxMediaCriteriaSubscriber
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->method('get')->willReturn($enabled);

        return $this->subscriberWithSystemConfig($systemConfig);
    }

    private function subscriberWithSystemConfig(SystemConfigService $systemConfig): ProductBoxMediaCriteriaSubscriber
    {
        return new ProductBoxMediaCriteriaSubscriber(
            new ProductHoverImageConfig($systemConfig),
            new ProductBoxMediaCriteria(),
        );
    }

    private function request(string $route): Request
    {
        $request = new Request();
        $request->attributes->set('_route', $route);

        return $request;
    }
}
