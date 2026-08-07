<?php declare(strict_types=1);

namespace WakoProductHoverImage\Service;

use Shopware\Core\Framework\DataAbstractionLayer\Search\Criteria;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Sorting\FieldSorting;

final class ProductBoxMediaCriteria
{
    public function apply(Criteria $criteria, ?int $mediaLimit = 2): void
    {
        if ($criteria->getFields() !== []) {
            return;
        }

        $this->addMediaAssociation($criteria, $this->normalizeLimit($mediaLimit));
    }

    private function addMediaAssociation(Criteria $criteria, ?int $mediaLimit): void
    {
        $hasMediaAssociation = $criteria->hasAssociation('media');

        $criteria->addAssociation('media.media');

        if ($hasMediaAssociation) {
            return;
        }

        $mediaCriteria = $criteria->getAssociation('media');

        if ($mediaLimit !== null) {
            $mediaCriteria->setLimit($mediaLimit);
        }

        $mediaCriteria->setOffset(null);
        $mediaCriteria->addSorting(
            new FieldSorting('position', FieldSorting::ASCENDING),
            new FieldSorting('id', FieldSorting::ASCENDING),
        );
    }

    private function normalizeLimit(?int $mediaLimit): ?int
    {
        return $mediaLimit === null ? null : max(1, min(20, $mediaLimit));
    }
}
