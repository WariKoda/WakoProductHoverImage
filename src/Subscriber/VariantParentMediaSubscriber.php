<?php declare(strict_types=1);

namespace WakoProductHoverImage\Subscriber;

use Shopware\Core\Content\Product\ProductCollection;
use Shopware\Core\Content\Product\ProductEntity;
use Shopware\Core\Content\Product\ProductEvents;
use Shopware\Core\Framework\DataAbstractionLayer\EntityRepository;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Criteria;
use Shopware\Core\System\SalesChannel\Entity\SalesChannelEntityLoadedEvent;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use WakoProductHoverImage\Service\ProductBoxMediaCriteria;
use WakoProductHoverImage\Service\ProductHoverImageConfig;

final readonly class VariantParentMediaSubscriber implements EventSubscriberInterface
{
    public const EXTENSION_NAME = 'wakoProductHoverImageParent';

    /**
     * @param EntityRepository<ProductCollection> $productRepository
     */
    public function __construct(
        private ProductHoverImageConfig $config,
        private ProductBoxMediaCriteria $mediaCriteria,
        private EntityRepository $productRepository,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            'sales_channel.' . ProductEvents::PRODUCT_LOADED_EVENT => ['onProductsLoaded', -1000],
        ];
    }

    /**
     * @param SalesChannelEntityLoadedEvent<ProductEntity> $event
     */
    public function onProductsLoaded(SalesChannelEntityLoadedEvent $event): void
    {
        $salesChannelContext = $event->getSalesChannelContext();

        if (!$this->config->isEnabled($salesChannelContext)
            || !$this->config->needsParentMedia($salesChannelContext)
            || !$this->config->hasAnyEnabledContext($salesChannelContext)
        ) {
            return;
        }

        $productsByParentId = [];

        foreach ($event->getEntities() as $product) {
            $parentId = $product->getParentId();

            if ($parentId !== null && !$product->hasExtension(self::EXTENSION_NAME)) {
                $productsByParentId[$parentId][] = $product;
            }
        }

        if ($productsByParentId === []) {
            return;
        }

        $criteria = new Criteria(array_keys($productsByParentId));
        $this->mediaCriteria->apply($criteria, $this->config->getMediaLimit($salesChannelContext));
        $parents = $this->productRepository->search($criteria, $salesChannelContext->getContext())->getEntities();

        foreach ($productsByParentId as $parentId => $products) {
            $parent = $parents->get($parentId);

            if (!$parent instanceof ProductEntity) {
                continue;
            }

            foreach ($products as $product) {
                $product->addExtension(self::EXTENSION_NAME, $parent);
            }
        }
    }
}
