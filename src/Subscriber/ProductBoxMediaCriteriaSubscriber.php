<?php declare(strict_types=1);

namespace WakoProductHoverImage\Subscriber;

use Shopware\Core\Content\Product\Events\ProductCrossSellingIdsCriteriaEvent;
use Shopware\Core\Content\Product\Events\ProductCrossSellingStreamCriteriaEvent;
use Shopware\Core\Content\Product\Events\ProductListingCriteriaEvent;
use Shopware\Core\Content\Product\Events\ProductSearchCriteriaEvent;
use Shopware\Core\Content\Product\Events\ProductSuggestCriteriaEvent;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Criteria;
use Shopware\Core\System\SalesChannel\SalesChannelContext;
use Shopware\Storefront\Page\Wishlist\WishListPageProductCriteriaEvent;
use Shopware\Storefront\Pagelet\Wishlist\GuestWishListPageletProductCriteriaEvent;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\Request;
use WakoProductHoverImage\Service\ProductBoxMediaCriteria;
use WakoProductHoverImage\Service\ProductHoverImageConfig;

final readonly class ProductBoxMediaCriteriaSubscriber implements EventSubscriberInterface
{
    private const PRIORITY = -1000;

    public function __construct(
        private ProductHoverImageConfig $config,
        private ProductBoxMediaCriteria $mediaCriteria,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            ProductListingCriteriaEvent::class => ['onProductListingCriteria', self::PRIORITY],
            ProductSearchCriteriaEvent::class => ['onProductListingCriteria', self::PRIORITY],
            WishListPageProductCriteriaEvent::class => ['onWishListCriteria', self::PRIORITY],
            GuestWishListPageletProductCriteriaEvent::class => ['onGuestWishListCriteria', self::PRIORITY],
            ProductCrossSellingIdsCriteriaEvent::class => ['onCrossSellingIdsCriteria', self::PRIORITY],
            ProductCrossSellingStreamCriteriaEvent::class => ['onCrossSellingStreamCriteria', self::PRIORITY],
        ];
    }

    public function onProductListingCriteria(ProductListingCriteriaEvent $event): void
    {
        if ($event instanceof ProductSuggestCriteriaEvent
            || $this->isUnsupportedSearchRoute($event->getRequest())
        ) {
            return;
        }

        $context = $event->getSalesChannelContext();

        if (!$this->config->isListingEnabled($context)) {
            return;
        }

        $this->apply($event->getCriteria(), $context);
    }

    public function onWishListCriteria(WishListPageProductCriteriaEvent $event): void
    {
        if ($event->getRequest()->attributes->get('_route') === 'frontend.wishlist.product.list') {
            return;
        }

        $context = $event->getSalesChannelContext();

        if (!$this->config->isWishlistEnabled($context)) {
            return;
        }

        $this->apply($event->getCriteria(), $context);
    }

    public function onGuestWishListCriteria(GuestWishListPageletProductCriteriaEvent $event): void
    {
        $context = $event->getSalesChannelContext();

        if (!$this->config->isWishlistEnabled($context)) {
            return;
        }

        $this->apply($event->getCriteria(), $context);
    }

    public function onCrossSellingIdsCriteria(ProductCrossSellingIdsCriteriaEvent $event): void
    {
        $context = $event->getSalesChannelContext();

        if (!$this->config->isCrossSellingEnabled($context)) {
            return;
        }

        $this->apply($event->getCriteria(), $context);
    }

    public function onCrossSellingStreamCriteria(ProductCrossSellingStreamCriteriaEvent $event): void
    {
        $context = $event->getSalesChannelContext();

        if (!$this->config->isCrossSellingEnabled($context)) {
            return;
        }

        $this->apply($event->getCriteria(), $context);
    }

    private function apply(Criteria $criteria, SalesChannelContext $context): void
    {
        if (!$this->config->isEnabled($context)) {
            return;
        }

        $this->mediaCriteria->apply($criteria, $this->config->getMediaLimit($context));
    }

    private function isUnsupportedSearchRoute(Request $request): bool
    {
        return \in_array(
            $request->attributes->get('_route'),
            ['frontend.search.suggest', 'widgets.search.filter'],
            true,
        );
    }
}
