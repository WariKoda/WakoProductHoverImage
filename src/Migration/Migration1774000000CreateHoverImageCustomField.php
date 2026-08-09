<?php declare(strict_types=1);

namespace WakoProductHoverImage\Migration;

use Doctrine\DBAL\Connection;
use Shopware\Core\Framework\Migration\MigrationStep;

final class Migration1774000000CreateHoverImageCustomField extends MigrationStep
{
    public const CUSTOM_FIELD_SET_ID = 'e52eb587c1124c8a9f5ad70ee79578e8';

    private const FIELD_ID = 'ad6a224f991e4330a97eb70510e847e1';

    private const RELATION_ID = '4dccb759c0a74168ac2ba5a4490c80b6';

    public function getCreationTimestamp(): int
    {
        return 1774000000;
    }

    public function update(Connection $connection): void
    {
        $connection->executeStatement(
            <<<'SQL'
                INSERT IGNORE INTO `custom_field_set`
                    (`id`, `name`, `config`, `active`, `created_at`)
                VALUES
                    (UNHEX(:id), :name, :config, 1, NOW(3))
                SQL,
            [
                'id' => self::CUSTOM_FIELD_SET_ID,
                'name' => 'wako_product_hover_image',
                'config' => json_encode([
                    'label' => [
                        'en-GB' => 'Product hover image',
                        'de-DE' => 'Produkt-Hoverbild',
                    ],
                ], \JSON_THROW_ON_ERROR),
            ],
        );

        $connection->executeStatement(
            <<<'SQL'
                INSERT IGNORE INTO `custom_field_set_relation`
                    (`id`, `set_id`, `entity_name`, `created_at`)
                VALUES
                    (UNHEX(:id), UNHEX(:setId), 'product', NOW(3))
                SQL,
            [
                'id' => self::RELATION_ID,
                'setId' => self::CUSTOM_FIELD_SET_ID,
            ],
        );

        $connection->executeStatement(
            <<<'SQL'
                INSERT IGNORE INTO `custom_field`
                    (`id`, `name`, `type`, `config`, `active`, `set_id`, `created_at`)
                VALUES
                    (UNHEX(:id), :name, 'media', :config, 1, UNHEX(:setId), NOW(3))
                SQL,
            [
                'id' => self::FIELD_ID,
                'name' => 'wako_product_hover_image_media_id',
                'setId' => self::CUSTOM_FIELD_SET_ID,
                'config' => json_encode([
                    'label' => [
                        'en-GB' => 'Hover image',
                        'de-DE' => 'Hoverbild',
                    ],
                    'componentName' => 'sw-media-field',
                    'customFieldType' => 'media',
                    'customFieldPosition' => 1,
                ], \JSON_THROW_ON_ERROR),
            ],
        );
    }

    public function updateDestructive(Connection $connection): void
    {
    }
}
