<?php declare(strict_types=1);

namespace WakoProductHoverImage\Tests\Unit\Subscriber;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Shopware\Core\Content\Cms\Aggregate\CmsSlot\CmsSlotCollection;
use Shopware\Core\Content\Cms\Aggregate\CmsSlot\CmsSlotEntity;
use Shopware\Core\Content\Cms\DataResolver\CriteriaCollection;
use Shopware\Core\Content\Cms\DataResolver\ResolverContext\ResolverContext;
use Shopware\Core\Content\Cms\Extension\CmsSlotsDataCollectExtension;
use Shopware\Core\Content\Product\ProductDefinition;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Criteria;
use Shopware\Core\System\SalesChannel\SalesChannelContext;
use Shopware\Core\System\SystemConfig\SystemConfigService;
use Symfony\Component\HttpFoundation\Request;
use WakoProductHoverImage\Service\ProductBoxMediaCriteria;
use WakoProductHoverImage\Service\ProductHoverImageConfig;
use WakoProductHoverImage\Subscriber\CmsProductBoxMediaCriteriaSubscriber;

final class CmsProductBoxMediaCriteriaSubscriberTest extends TestCase
{
    private SalesChannelContext&MockObject $context;

    protected function setUp(): void
    {
        $this->context = $this->createMock(SalesChannelContext::class);
        $this->context->method('getSalesChannelId')->willReturn('sales-channel-id');
    }

    public function testSubscribesToPostCollectExtensionWithLatePriority(): void
    {
        self::assertSame(
            ['onCmsSlotsDataCollected', -1000],
            CmsProductBoxMediaCriteriaSubscriber::getSubscribedEvents()[CmsSlotsDataCollectExtension::onPost()],
        );
    }

    #[DataProvider('supportedSlotTypes')]
    public function testSupportedSlotCriteriaAreExtended(string $slotType): void
    {
        $criteria = new Criteria();
        $extension = $this->extension($slotType, $criteria);

        $this->subscriber(true)->onCmsSlotsDataCollected($extension);

        self::assertTrue($criteria->hasAssociation('media'));
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function supportedSlotTypes(): iterable
    {
        yield 'product box' => ['product-box'];
        yield 'product slider' => ['product-slider'];
    }

    public function testUnsupportedSlotIsNotChanged(): void
    {
        $criteria = new Criteria();
        $extension = $this->extension('image', $criteria);

        $this->subscriber(true)->onCmsSlotsDataCollected($extension);

        self::assertFalse($criteria->hasAssociation('media'));
    }

    public function testNonProductDefinitionCriteriaAreNotChanged(): void
    {
        $criteria = new Criteria();
        $slot = $this->slot('product-box');
        $collection = new CriteriaCollection();
        $collection->add('media', 'media', $criteria);
        $extension = $this->extensionWithResult($slot, [$slot->getUniqueIdentifier() => $collection]);

        $this->subscriber(true)->onCmsSlotsDataCollected($extension);

        self::assertFalse($criteria->hasAssociation('media'));
    }

    public function testMissingCriteriaCollectionIsIgnored(): void
    {
        $slot = $this->slot('product-box');
        $extension = $this->extensionWithResult($slot, []);

        $this->subscriber(true)->onCmsSlotsDataCollected($extension);

        self::assertSame([], $extension->result);
    }

    public function testMalformedExtensionResultIsIgnored(): void
    {
        $criteria = new Criteria();
        $extension = $this->extension('product-box', $criteria);
        (new \ReflectionProperty($extension, 'result'))->setValue($extension, 'unexpected');

        $this->subscriber(true)->onCmsSlotsDataCollected($extension);

        self::assertFalse($criteria->hasAssociation('media'));
    }

    public function testInactiveFeatureDoesNotChangeCriteria(): void
    {
        $criteria = new Criteria();
        $extension = $this->extension('product-box', $criteria);

        $this->subscriber(false)->onCmsSlotsDataCollected($extension);

        self::assertFalse($criteria->hasAssociation('media'));
    }

    public function testDisabledCmsContextDoesNotChangeCriteria(): void
    {
        $criteria = new Criteria();
        $extension = $this->extension('product-slider', $criteria);
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->method('get')->willReturnCallback(
            static fn (string $key): mixed => str_ends_with($key, 'enableCms') ? false : true,
        );

        $this->subscriberWithSystemConfig($systemConfig)->onCmsSlotsDataCollected($extension);

        self::assertFalse($criteria->hasAssociation('media'));
    }

    public function testSearchContextIsIgnoredWithoutConfigLookup(): void
    {
        $criteria = new Criteria();
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->expects(self::never())->method('get');
        $request = new Request();
        $request->attributes->set('_route', 'widgets.search.pagelet');
        $extension = $this->extension('product-slider', $criteria, $request);

        $this->subscriberWithSystemConfig($systemConfig)->onCmsSlotsDataCollected($extension);

        self::assertFalse($criteria->hasAssociation('media'));
    }

    public function testRepeatedApplicationIsIdempotentForMultipleCriteria(): void
    {
        $firstCriteria = new Criteria();
        $secondCriteria = new Criteria();
        $slot = $this->slot('product-slider');
        $collection = new CriteriaCollection();
        $collection->add('first', ProductDefinition::class, $firstCriteria);
        $collection->add('second', ProductDefinition::class, $secondCriteria);
        $extension = $this->extensionWithResult($slot, [$slot->getUniqueIdentifier() => $collection]);
        $subscriber = $this->subscriber(true);

        $subscriber->onCmsSlotsDataCollected($extension);
        $subscriber->onCmsSlotsDataCollected($extension);

        foreach ([$firstCriteria, $secondCriteria] as $criteria) {
            self::assertSame(2, $criteria->getAssociation('media')->getLimit());
            self::assertCount(2, $criteria->getAssociation('media')->getSorting());
        }
    }

    private function extension(
        string $slotType,
        Criteria $criteria,
        ?Request $request = null,
    ): CmsSlotsDataCollectExtension {
        $slot = $this->slot($slotType);
        $collection = new CriteriaCollection();
        $collection->add('product', ProductDefinition::class, $criteria);

        return $this->extensionWithResult(
            $slot,
            [$slot->getUniqueIdentifier() => $collection],
            $request,
        );
    }

    /**
     * @param array<string, CriteriaCollection> $result
     */
    private function extensionWithResult(
        CmsSlotEntity $slot,
        array $result,
        ?Request $request = null,
    ): CmsSlotsDataCollectExtension {
        $extension = new CmsSlotsDataCollectExtension(
            new CmsSlotCollection([$slot]),
            new ResolverContext($this->context, $request ?? new Request()),
        );
        $extension->result = $result;

        return $extension;
    }

    private function slot(string $type): CmsSlotEntity
    {
        $slot = new CmsSlotEntity();
        $slot->setId(md5($type));
        $slot->setType($type);
        $slot->setSlot($type);

        return $slot;
    }

    private function subscriber(bool $enabled): CmsProductBoxMediaCriteriaSubscriber
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->method('get')->willReturn($enabled);

        return $this->subscriberWithSystemConfig($systemConfig);
    }

    private function subscriberWithSystemConfig(SystemConfigService $systemConfig): CmsProductBoxMediaCriteriaSubscriber
    {
        return new CmsProductBoxMediaCriteriaSubscriber(
            new ProductHoverImageConfig($systemConfig),
            new ProductBoxMediaCriteria(),
        );
    }
}
