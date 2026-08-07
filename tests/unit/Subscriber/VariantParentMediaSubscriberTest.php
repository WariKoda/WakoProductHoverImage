<?php declare(strict_types=1);

namespace WakoProductHoverImage\Tests\Unit\Subscriber;

use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Shopware\Core\Content\Product\ProductCollection;
use Shopware\Core\Content\Product\ProductDefinition;
use Shopware\Core\Content\Product\ProductEntity;
use Shopware\Core\Framework\Context;
use Shopware\Core\Framework\DataAbstractionLayer\EntityRepository;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Criteria;
use Shopware\Core\Framework\DataAbstractionLayer\Search\EntitySearchResult;
use Shopware\Core\System\SalesChannel\Entity\SalesChannelEntityLoadedEvent;
use Shopware\Core\System\SalesChannel\SalesChannelContext;
use Shopware\Core\System\SystemConfig\SystemConfigService;
use WakoProductHoverImage\Service\ProductBoxMediaCriteria;
use WakoProductHoverImage\Service\ProductHoverImageConfig;
use WakoProductHoverImage\Subscriber\VariantParentMediaSubscriber;

final class VariantParentMediaSubscriberTest extends TestCase
{
    private const SALES_CHANNEL_ID = '018f8f9a9d9b7000b7bcb035e7b83c90';

    private Context $context;

    private SalesChannelContext&MockObject $salesChannelContext;

    protected function setUp(): void
    {
        $this->context = Context::createDefaultContext();
        $this->salesChannelContext = $this->createMock(SalesChannelContext::class);
        $this->salesChannelContext->method('getSalesChannelId')->willReturn(self::SALES_CHANNEL_ID);
        $this->salesChannelContext->method('getContext')->willReturn($this->context);
    }

    public function testParentFallbackLoadsParentsSeparatelyAndAttachesThem(): void
    {
        $child = $this->product('child-id', 'parent-id');
        $parent = $this->product('parent-id');
        $repository = $this->createMock(EntityRepository::class);
        $repository->expects(self::once())
            ->method('search')
            ->with(
                self::callback(static function (Criteria $criteria): bool {
                    return $criteria->getIds() === ['parent-id']
                        && $criteria->hasAssociation('media')
                        && $criteria->getAssociation('media')->getLimit() === 2;
                }),
                $this->context,
            )
            ->willReturn($this->searchResult(new ProductCollection([$parent])));

        $this->subscriber($repository, ProductHoverImageConfig::VARIANT_PARENT_FALLBACK)
            ->onProductsLoaded($this->event([$child]));

        self::assertSame(
            $parent,
            $child->getExtension(VariantParentMediaSubscriber::EXTENSION_NAME),
        );
    }

    public function testInheritanceModeDoesNotLoadParents(): void
    {
        $repository = $this->createMock(EntityRepository::class);
        $repository->expects(self::never())->method('search');

        $this->subscriber($repository, ProductHoverImageConfig::VARIANT_INHERIT)
            ->onProductsLoaded($this->event([$this->product('child-id', 'parent-id')]));
    }

    public function testParentProductsDoNotTriggerARepositorySearch(): void
    {
        $repository = $this->createMock(EntityRepository::class);
        $repository->expects(self::never())->method('search');

        $this->subscriber($repository, ProductHoverImageConfig::VARIANT_PARENT_FALLBACK)
            ->onProductsLoaded($this->event([$this->product('parent-id')]));
    }

    /**
     * @param EntityRepository<ProductCollection> $repository
     */
    private function subscriber(EntityRepository $repository, string $variantMode): VariantParentMediaSubscriber
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->method('get')->willReturnCallback(
            static function (string $key) use ($variantMode): mixed {
                if ($key === ProductHoverImageConfig::CONFIG_KEY) {
                    return true;
                }

                if (str_ends_with($key, 'variantMediaMode')) {
                    return $variantMode;
                }

                return null;
            },
        );

        return new VariantParentMediaSubscriber(
            new ProductHoverImageConfig($systemConfig),
            new ProductBoxMediaCriteria(),
            $repository,
        );
    }

    /**
     * @param list<ProductEntity> $products
     *
     * @return SalesChannelEntityLoadedEvent<ProductEntity>
     */
    private function event(array $products): SalesChannelEntityLoadedEvent
    {
        return new SalesChannelEntityLoadedEvent(
            $this->createMock(ProductDefinition::class),
            $products,
            $this->salesChannelContext,
        );
    }

    private function product(string $id, ?string $parentId = null): ProductEntity
    {
        $product = new ProductEntity();
        $product->setId($id);
        $product->setParentId($parentId);

        return $product;
    }

    /**
     * @param ProductCollection $products
     *
     * @return EntitySearchResult<ProductCollection>
     */
    private function searchResult(ProductCollection $products): EntitySearchResult
    {
        return new EntitySearchResult(
            'product',
            $products->count(),
            $products,
            null,
            new Criteria(),
            $this->context,
        );
    }
}
