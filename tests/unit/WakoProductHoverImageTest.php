<?php declare(strict_types=1);

namespace WakoProductHoverImage\Tests\Unit;

use Doctrine\DBAL\Connection;
use PHPUnit\Framework\TestCase;
use Shopware\Core\Framework\Context;
use Shopware\Core\Framework\DataAbstractionLayer\EntityRepository;
use Shopware\Core\Framework\Plugin\Context\UninstallContext;
use Symfony\Component\DependencyInjection\ContainerInterface;
use WakoProductHoverImage\Migration\Migration1774000000CreateHoverImageCustomField;
use WakoProductHoverImage\Service\ProductHoverImageConfig;
use WakoProductHoverImage\WakoProductHoverImage;

final class WakoProductHoverImageTest extends TestCase
{
    public function testUninstallKeepsCustomFieldSetWhenUserDataShouldBePreserved(): void
    {
        $container = $this->createMock(ContainerInterface::class);
        $container->expects(self::never())->method('get');

        $uninstallContext = $this->createMock(UninstallContext::class);
        $uninstallContext->expects(self::once())->method('keepUserData')->willReturn(true);

        $plugin = $this->plugin();
        $plugin->setContainer($container);
        $plugin->uninstall($uninstallContext);
    }

    public function testUninstallDeletesCustomFieldSetWhenUserDataShouldBeRemoved(): void
    {
        $context = Context::createDefaultContext();
        $connection = $this->createMock(Connection::class);
        $connection->expects(self::once())
            ->method('executeStatement')
            ->with(
                self::logicalAnd(
                    self::stringContains('JSON_REMOVE'),
                    self::stringContains('JSON_CONTAINS_PATH'),
                ),
                ['customFieldPath' => '$.' . ProductHoverImageConfig::CUSTOM_FIELD_NAME],
            );

        $repository = $this->createMock(EntityRepository::class);
        $repository->expects(self::once())
            ->method('delete')
            ->with(
                [['id' => Migration1774000000CreateHoverImageCustomField::CUSTOM_FIELD_SET_ID]],
                $context,
            );

        $container = $this->createMock(ContainerInterface::class);
        $container->expects(self::exactly(2))
            ->method('get')
            ->willReturnCallback(static fn (string $id): object => match ($id) {
                Connection::class => $connection,
                'custom_field_set.repository' => $repository,
                default => throw new \LogicException('Unexpected service: ' . $id),
            });

        $uninstallContext = $this->createMock(UninstallContext::class);
        $uninstallContext->expects(self::once())->method('keepUserData')->willReturn(false);
        $uninstallContext->expects(self::once())->method('getContext')->willReturn($context);

        $plugin = $this->plugin();
        $plugin->setContainer($container);
        $plugin->uninstall($uninstallContext);
    }

    private function plugin(): WakoProductHoverImage
    {
        return new WakoProductHoverImage(true, dirname(__DIR__, 2) . '/src');
    }
}
