<?php declare(strict_types=1);

namespace WakoProductHoverImage\Tests\Unit\Service;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Shopware\Core\System\SalesChannel\SalesChannelContext;
use Shopware\Core\System\SystemConfig\SystemConfigService;
use WakoProductHoverImage\Service\ProductHoverImageConfig;

final class ProductHoverImageConfigTest extends TestCase
{
    private const SALES_CHANNEL_ID = '018f8f9a9d9b7000b7bcb035e7b83c90';

    private SalesChannelContext&MockObject $context;

    protected function setUp(): void
    {
        $this->context = $this->createMock(SalesChannelContext::class);
        $this->context->method('getSalesChannelId')->willReturn(self::SALES_CHANNEL_ID);
    }

    public function testExplicitTrueEnablesFeatureForSalesChannel(): void
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->expects(self::once())
            ->method('get')
            ->with(ProductHoverImageConfig::CONFIG_KEY, self::SALES_CHANNEL_ID)
            ->willReturn(true);

        self::assertTrue((new ProductHoverImageConfig($systemConfig))->isEnabled($this->context));
    }

    #[DataProvider('disabledValues')]
    public function testOnlyExplicitBooleanTrueEnablesFeature(mixed $value): void
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->method('get')->willReturn($value);

        self::assertFalse((new ProductHoverImageConfig($systemConfig))->isEnabled($this->context));
    }

    /**
     * @return iterable<string, array{mixed}>
     */
    public static function disabledValues(): iterable
    {
        yield 'false' => [false];
        yield 'missing' => [null];
        yield 'string true' => ['true'];
        yield 'integer one' => [1];
    }

    public function testMissingContextKeepsFeatureDisabledWithoutLookup(): void
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->expects(self::never())->method('get');

        self::assertFalse((new ProductHoverImageConfig($systemConfig))->isEnabled(null));
    }

    public function testSystemConfigExceptionFailsClosed(): void
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->method('get')->willThrowException(new \RuntimeException('Unavailable'));

        self::assertFalse((new ProductHoverImageConfig($systemConfig))->isEnabled($this->context));
        self::assertFalse((new ProductHoverImageConfig($systemConfig))->isListingEnabled($this->context));
    }

    public function testContextOptionsDefaultToEnabledButRejectManipulatedValues(): void
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->method('get')->willReturnCallback(
            static fn (string $key): mixed => str_ends_with($key, 'enableWishlist') ? 'true' : null,
        );
        $config = new ProductHoverImageConfig($systemConfig);

        self::assertTrue($config->isListingEnabled($this->context));
        self::assertTrue($config->isCrossSellingEnabled($this->context));
        self::assertFalse($config->isWishlistEnabled($this->context));
        self::assertTrue($config->isCmsEnabled($this->context));
    }

    public function testSelectionStrategyAndVariantModeAreWhitelisted(): void
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $values = [
            ProductHoverImageConfig::CONFIG_PREFIX . 'selectionStrategy' => ProductHoverImageConfig::SELECTION_CUSTOM_FIELD,
            ProductHoverImageConfig::CONFIG_PREFIX . 'variantMediaMode' => ProductHoverImageConfig::VARIANT_PARENT_FALLBACK,
        ];
        $systemConfig->method('get')->willReturnCallback(
            static fn (string $key): mixed => $values[$key] ?? null,
        );
        $config = new ProductHoverImageConfig($systemConfig);

        self::assertSame(ProductHoverImageConfig::SELECTION_CUSTOM_FIELD, $config->getSelectionStrategy($this->context));
        self::assertSame(ProductHoverImageConfig::VARIANT_PARENT_FALLBACK, $config->getVariantMediaMode($this->context));
        self::assertNull($config->getMediaLimit($this->context));
        self::assertTrue($config->needsParentMedia($this->context));
    }

    public function testInvalidSelectionAndVariantValuesUseSafeDefaults(): void
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->method('get')->willReturn('invalid');
        $config = new ProductHoverImageConfig($systemConfig);

        self::assertSame(ProductHoverImageConfig::SELECTION_SECOND_MEDIA, $config->getSelectionStrategy($this->context));
        self::assertSame(ProductHoverImageConfig::VARIANT_INHERIT, $config->getVariantMediaMode($this->context));
        self::assertSame(2, $config->getMediaLimit($this->context));
        self::assertFalse($config->needsParentMedia($this->context));
    }

    #[DataProvider('loadingModes')]
    public function testLoadingModeAcceptsWhitelistedValues(string $mode): void
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->expects(self::once())
            ->method('get')
            ->with(ProductHoverImageConfig::CONFIG_PREFIX . 'loadingMode', self::SALES_CHANNEL_ID)
            ->willReturn($mode);

        self::assertSame($mode, (new ProductHoverImageConfig($systemConfig))->getLoadingMode($this->context));
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function loadingModes(): iterable
    {
        yield 'lazy' => [ProductHoverImageConfig::LOADING_MODE_LAZY];
        yield 'on hover' => [ProductHoverImageConfig::LOADING_MODE_ON_HOVER];
    }

    #[DataProvider('invalidLoadingModes')]
    public function testLoadingModeUsesLazyDefaultForMissingOrInvalidValues(mixed $value): void
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->method('get')->willReturn($value);

        self::assertSame(
            ProductHoverImageConfig::LOADING_MODE_LAZY,
            (new ProductHoverImageConfig($systemConfig))->getLoadingMode($this->context),
        );
    }

    /**
     * @return iterable<string, array{mixed}>
     */
    public static function invalidLoadingModes(): iterable
    {
        yield 'missing' => [null];
        yield 'unknown string' => ['eager'];
        yield 'boolean' => [true];
        yield 'integer' => [1];
    }

    public function testLoadingModeUsesLazyDefaultWithoutContextOrWhenConfigLookupFails(): void
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $systemConfig->expects(self::once())
            ->method('get')
            ->willThrowException(new \RuntimeException('Unavailable'));
        $config = new ProductHoverImageConfig($systemConfig);

        self::assertSame(ProductHoverImageConfig::LOADING_MODE_LAZY, $config->getLoadingMode(null));
        self::assertSame(ProductHoverImageConfig::LOADING_MODE_LAZY, $config->getLoadingMode($this->context));
    }

    public function testNumericValuesAreBoundedAndWrongTypesUseDefaults(): void
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $values = [
            ProductHoverImageConfig::CONFIG_PREFIX . 'hoverDelay' => -20,
            ProductHoverImageConfig::CONFIG_PREFIX . 'transitionDuration' => 900,
            ProductHoverImageConfig::CONFIG_PREFIX . 'mediaPosition' => '7',
        ];
        $systemConfig->method('get')->willReturnCallback(
            static fn (string $key): mixed => $values[$key] ?? null,
        );
        $config = new ProductHoverImageConfig($systemConfig);

        self::assertSame(0, $config->getHoverDelay($this->context));
        self::assertSame(500, $config->getTransitionDuration($this->context));
        self::assertSame(2, $config->getMediaPosition($this->context));
    }

    public function testConfiguredPositionControlsMediaLimit(): void
    {
        $systemConfig = $this->createMock(SystemConfigService::class);
        $values = [
            ProductHoverImageConfig::CONFIG_PREFIX . 'selectionStrategy' => ProductHoverImageConfig::SELECTION_CONFIGURED_POSITION,
            ProductHoverImageConfig::CONFIG_PREFIX . 'mediaPosition' => 7,
        ];
        $systemConfig->method('get')->willReturnCallback(
            static fn (string $key): mixed => $values[$key] ?? null,
        );
        $config = new ProductHoverImageConfig($systemConfig);

        self::assertSame(7, $config->getMediaLimit($this->context));
    }
}
