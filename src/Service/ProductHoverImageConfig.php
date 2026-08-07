<?php declare(strict_types=1);

namespace WakoProductHoverImage\Service;

use Shopware\Core\System\SalesChannel\SalesChannelContext;
use Shopware\Core\System\SystemConfig\SystemConfigService;

final readonly class ProductHoverImageConfig
{
    public const CONFIG_PREFIX = 'WakoProductHoverImage.config.';

    public const CONFIG_KEY = self::CONFIG_PREFIX . 'enabled';

    public const CUSTOM_FIELD_NAME = 'wako_product_hover_image_media_id';

    public const SELECTION_SECOND_MEDIA = 'second_media';

    public const SELECTION_FIRST_NON_COVER = 'first_non_cover';

    public const SELECTION_CONFIGURED_POSITION = 'configured_position';

    public const SELECTION_CUSTOM_FIELD = 'custom_field';

    public const SELECTION_NEXT_VALID_IMAGE = 'next_valid_image';

    public const VARIANT_INHERIT = 'inherit';

    public const VARIANT_ONLY = 'variant_only';

    public const VARIANT_PARENT_FALLBACK = 'parent_fallback';

    private const DEFAULT_HOVER_DELAY = 100;

    private const DEFAULT_TRANSITION_DURATION = 200;

    private const DEFAULT_MEDIA_POSITION = 2;

    private const MAX_DURATION = 500;

    private const MAX_MEDIA_POSITION = 20;

    private const SELECTION_STRATEGIES = [
        self::SELECTION_SECOND_MEDIA,
        self::SELECTION_FIRST_NON_COVER,
        self::SELECTION_CONFIGURED_POSITION,
        self::SELECTION_CUSTOM_FIELD,
        self::SELECTION_NEXT_VALID_IMAGE,
    ];

    private const VARIANT_MODES = [
        self::VARIANT_INHERIT,
        self::VARIANT_ONLY,
        self::VARIANT_PARENT_FALLBACK,
    ];

    public function __construct(private SystemConfigService $systemConfigService)
    {
    }

    public function isEnabled(?SalesChannelContext $context): bool
    {
        return $this->getBool($context, 'enabled', false);
    }

    public function isListingEnabled(?SalesChannelContext $context): bool
    {
        return $this->getBool($context, 'enableListing', true);
    }

    public function isCrossSellingEnabled(?SalesChannelContext $context): bool
    {
        return $this->getBool($context, 'enableCrossSelling', true);
    }

    public function isWishlistEnabled(?SalesChannelContext $context): bool
    {
        return $this->getBool($context, 'enableWishlist', true);
    }

    public function isCmsEnabled(?SalesChannelContext $context): bool
    {
        return $this->getBool($context, 'enableCms', true);
    }

    public function hasAnyEnabledContext(?SalesChannelContext $context): bool
    {
        return $this->isListingEnabled($context)
            || $this->isCrossSellingEnabled($context)
            || $this->isWishlistEnabled($context)
            || $this->isCmsEnabled($context);
    }

    public function getSelectionStrategy(?SalesChannelContext $context): string
    {
        $value = $this->get($context, 'selectionStrategy');

        return \is_string($value) && \in_array($value, self::SELECTION_STRATEGIES, true)
            ? $value
            : self::SELECTION_SECOND_MEDIA;
    }

    public function getVariantMediaMode(?SalesChannelContext $context): string
    {
        $value = $this->get($context, 'variantMediaMode');

        return \is_string($value) && \in_array($value, self::VARIANT_MODES, true)
            ? $value
            : self::VARIANT_INHERIT;
    }

    public function getMediaPosition(?SalesChannelContext $context): int
    {
        return $this->getBoundedInt(
            $context,
            'mediaPosition',
            self::DEFAULT_MEDIA_POSITION,
            1,
            self::MAX_MEDIA_POSITION,
        );
    }

    public function getHoverDelay(?SalesChannelContext $context): int
    {
        return $this->getBoundedInt($context, 'hoverDelay', self::DEFAULT_HOVER_DELAY, 0, self::MAX_DURATION);
    }

    public function getTransitionDuration(?SalesChannelContext $context): int
    {
        return $this->getBoundedInt(
            $context,
            'transitionDuration',
            self::DEFAULT_TRANSITION_DURATION,
            0,
            self::MAX_DURATION,
        );
    }

    public function getMediaLimit(?SalesChannelContext $context): ?int
    {
        return match ($this->getSelectionStrategy($context)) {
            self::SELECTION_SECOND_MEDIA => 2,
            self::SELECTION_CONFIGURED_POSITION => $this->getMediaPosition($context),
            default => null,
        };
    }

    public function needsParentMedia(?SalesChannelContext $context): bool
    {
        return $this->getVariantMediaMode($context) === self::VARIANT_PARENT_FALLBACK;
    }

    private function getBool(?SalesChannelContext $context, string $key, bool $default): bool
    {
        if ($context === null) {
            return false;
        }

        try {
            $value = $this->systemConfigService->get(self::CONFIG_PREFIX . $key, $context->getSalesChannelId());
        } catch (\Throwable) {
            return false;
        }

        return $value === null ? $default : $value === true;
    }

    private function get(?SalesChannelContext $context, string $key): mixed
    {
        if ($context === null) {
            return null;
        }

        try {
            return $this->systemConfigService->get(self::CONFIG_PREFIX . $key, $context->getSalesChannelId());
        } catch (\Throwable) {
            return null;
        }
    }

    private function getBoundedInt(
        ?SalesChannelContext $context,
        string $key,
        int $default,
        int $minimum,
        int $maximum,
    ): int {
        $value = $this->get($context, $key);

        if (!\is_int($value)) {
            return $default;
        }

        return max($minimum, min($maximum, $value));
    }
}
