<?php declare(strict_types=1);

namespace WakoProductHoverImage;

use Doctrine\DBAL\Connection;
use Shopware\Core\Framework\DataAbstractionLayer\EntityRepository;
use Shopware\Core\Framework\Plugin;
use Shopware\Core\Framework\Plugin\Context\UninstallContext;
use Shopware\Core\System\CustomField\Aggregate\CustomFieldSet\CustomFieldSetCollection;
use WakoProductHoverImage\Migration\Migration1774000000CreateHoverImageCustomField;
use WakoProductHoverImage\Service\ProductHoverImageConfig;

final class WakoProductHoverImage extends Plugin
{
    public function uninstall(UninstallContext $uninstallContext): void
    {
        parent::uninstall($uninstallContext);

        if ($uninstallContext->keepUserData()) {
            return;
        }

        if ($this->container === null) {
            throw new \LogicException('The plugin container is not available.');
        }

        $connection = $this->container->get(Connection::class);

        if (!$connection instanceof Connection) {
            throw new \LogicException('The database connection is not available.');
        }

        $customFieldPath = '$.' . ProductHoverImageConfig::CUSTOM_FIELD_NAME;
        $connection->executeStatement(
            <<<'SQL'
                UPDATE `product`
                SET `custom_fields` = JSON_REMOVE(`custom_fields`, :customFieldPath)
                WHERE JSON_CONTAINS_PATH(`custom_fields`, 'one', :customFieldPath) = 1
                SQL,
            ['customFieldPath' => $customFieldPath],
        );

        $repository = $this->container->get('custom_field_set.repository');

        if (!$repository instanceof EntityRepository) {
            throw new \LogicException('The custom field set repository is not available.');
        }

        /** @var EntityRepository<CustomFieldSetCollection> $repository */
        $repository->delete(
            [['id' => Migration1774000000CreateHoverImageCustomField::CUSTOM_FIELD_SET_ID]],
            $uninstallContext->getContext(),
        );
    }
}
