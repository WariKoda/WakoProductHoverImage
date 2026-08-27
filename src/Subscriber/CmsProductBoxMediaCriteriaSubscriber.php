<?php declare(strict_types=1);

namespace WakoProductHoverImage\Subscriber;

use Shopware\Core\Content\Cms\DataResolver\CriteriaCollection;
use Shopware\Core\Content\Cms\Extension\CmsSlotsDataCollectExtension;
use Shopware\Core\Content\Product\ProductDefinition;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\Request;
use WakoProductHoverImage\Service\ProductBoxMediaCriteria;
use WakoProductHoverImage\Service\ProductHoverImageConfig;

final readonly class CmsProductBoxMediaCriteriaSubscriber implements EventSubscriberInterface
{
    private const PRIORITY = -1000;

    private const SUPPORTED_SLOT_TYPES = [
        'product-box',
        'product-slider',
    ];

    public function __construct(
        private ProductHoverImageConfig $config,
        private ProductBoxMediaCriteria $mediaCriteria,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            CmsSlotsDataCollectExtension::onPost() => ['onCmsSlotsDataCollected', self::PRIORITY],
        ];
    }

    public function onCmsSlotsDataCollected(CmsSlotsDataCollectExtension $extension): void
    {
        $resolverContext = $extension->resolverContext;
        $request = $resolverContext->getRequest();
        $result = $this->normalizeResult($extension->result);

        $salesChannelContext = $resolverContext->getSalesChannelContext();

        if ($this->isUnsupportedSearchRoute($request)
            || !$this->config->isCmsEnabled($salesChannelContext)
            || !$this->config->isEnabled($salesChannelContext)
            || $result === null
        ) {
            return;
        }

        foreach ($extension->slots as $slot) {
            if (!\in_array($slot->getType(), self::SUPPORTED_SLOT_TYPES, true)) {
                continue;
            }

            $criteriaCollection = $result[$slot->getUniqueIdentifier()] ?? null;
            if (!$criteriaCollection instanceof CriteriaCollection) {
                continue;
            }

            foreach ($criteriaCollection->all()[ProductDefinition::class] ?? [] as $criteria) {
                $this->mediaCriteria->apply(
                    $criteria,
                    $this->config->getMediaLimit($salesChannelContext),
                );
            }
        }
    }

    /**
     * @return array<array-key, mixed>|null
     */
    private function normalizeResult(mixed $result): ?array
    {
        return \is_array($result) ? $result : null;
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
