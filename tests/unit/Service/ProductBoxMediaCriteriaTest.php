<?php declare(strict_types=1);

namespace WakoProductHoverImage\Tests\Unit\Service;

use PHPUnit\Framework\TestCase;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Aggregation\Metric\CountAggregation;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Criteria;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Filter\EqualsFilter;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Query\ScoreQuery;
use Shopware\Core\Framework\DataAbstractionLayer\Search\Sorting\FieldSorting;
use WakoProductHoverImage\Service\ProductBoxMediaCriteria;

final class ProductBoxMediaCriteriaTest extends TestCase
{
    public function testApplyCreatesDeterministicLimitedMediaAssociation(): void
    {
        $criteria = new Criteria();

        (new ProductBoxMediaCriteria())->apply($criteria);

        self::assertTrue($criteria->hasAssociation('media'));

        $mediaCriteria = $criteria->getAssociation('media');
        self::assertTrue($mediaCriteria->hasAssociation('media'));
        self::assertSame(2, $mediaCriteria->getLimit());
        self::assertNull($mediaCriteria->getOffset());
        self::assertSame([], $mediaCriteria->getFilters());
        self::assertSame([], $mediaCriteria->getPostFilters());

        $sorting = $mediaCriteria->getSorting();
        self::assertCount(2, $sorting);
        self::assertSame('position', $sorting[0]->getField());
        self::assertSame(FieldSorting::ASCENDING, $sorting[0]->getDirection());
        self::assertSame('id', $sorting[1]->getField());
        self::assertSame(FieldSorting::ASCENDING, $sorting[1]->getDirection());
    }

    public function testApplyPreservesExistingAssociationCriteriaAndAddsNestedMedia(): void
    {
        $criteria = new Criteria();
        $mediaCriteria = $criteria->getAssociation('media');
        $filter = new EqualsFilter('position', 5);
        $postFilter = new EqualsFilter('mediaId', 'media-id');
        $sorting = new FieldSorting('position', FieldSorting::DESCENDING);
        $query = new ScoreQuery(new EqualsFilter('position', 1), 100.0);
        $aggregation = new CountAggregation('media-count', 'id');
        $nestedMediaCriteria = $mediaCriteria->getAssociation('media');
        $mediaCriteria->addFilter($filter);
        $mediaCriteria->addPostFilter($postFilter);
        $mediaCriteria->addSorting($sorting);
        $mediaCriteria->addQuery($query);
        $mediaCriteria->addAggregation($aggregation);
        $mediaCriteria->addFields(['id', 'position']);
        $mediaCriteria->addState('foreign-state');
        $mediaCriteria->setOffset(3);
        $mediaCriteria->setLimit(1);

        (new ProductBoxMediaCriteria())->apply($criteria);

        self::assertSame($nestedMediaCriteria, $mediaCriteria->getAssociation('media'));
        self::assertSame([$filter], $mediaCriteria->getFilters());
        self::assertSame([$postFilter], $mediaCriteria->getPostFilters());
        self::assertSame([$sorting], $mediaCriteria->getSorting());
        self::assertSame([$query], $mediaCriteria->getQueries());
        self::assertSame(['media-count' => $aggregation], $mediaCriteria->getAggregations());
        self::assertSame(['id', 'position'], $mediaCriteria->getFields());
        self::assertTrue($mediaCriteria->hasState('foreign-state'));
        self::assertSame(3, $mediaCriteria->getOffset());
        self::assertSame(1, $mediaCriteria->getLimit());
    }

    public function testApplySkipsPartialCriteria(): void
    {
        $criteria = new Criteria();
        $criteria->addFields(['id', 'name']);

        (new ProductBoxMediaCriteria())->apply($criteria);

        self::assertFalse($criteria->hasAssociation('media'));
    }

    public function testApplySupportsAConfiguredLimit(): void
    {
        $criteria = new Criteria();

        (new ProductBoxMediaCriteria())->apply($criteria, 7);

        self::assertSame(7, $criteria->getAssociation('media')->getLimit());
    }

    public function testApplySupportsAnUnboundedMediaAssociation(): void
    {
        $criteria = new Criteria();

        (new ProductBoxMediaCriteria())->apply($criteria, null);

        self::assertNull($criteria->getAssociation('media')->getLimit());
        self::assertCount(2, $criteria->getAssociation('media')->getSorting());
    }

    public function testApplyBoundsConfiguredLimit(): void
    {
        $service = new ProductBoxMediaCriteria();
        $lowerCriteria = new Criteria();
        $upperCriteria = new Criteria();

        $service->apply($lowerCriteria, 0);
        $service->apply($upperCriteria, 100);

        self::assertSame(1, $lowerCriteria->getAssociation('media')->getLimit());
        self::assertSame(20, $upperCriteria->getAssociation('media')->getLimit());
    }

    public function testApplyIsIdempotent(): void
    {
        $criteria = new Criteria();
        $service = new ProductBoxMediaCriteria();

        $service->apply($criteria);
        $service->apply($criteria);

        $mediaCriteria = $criteria->getAssociation('media');
        self::assertTrue($mediaCriteria->hasAssociation('media'));
        self::assertSame(2, $mediaCriteria->getLimit());
        self::assertCount(2, $mediaCriteria->getSorting());
    }
}
