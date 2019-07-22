// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import * as assert from 'assert';
import {AnyObject} from 'loopback-datasource-juggler';
import {Options} from '../common-types';
import {Entity} from '../model';
import {Filter, Where} from '../query';
import {EntityCrudRepository, getRepositoryCapabilities} from '../repositories';

// TODO(bajtos) add test coverage

/**
 * Dedupe an array
 * @param {Array} input an array
 * @returns {Array} an array with unique items
 */
export function uniq<T>(input: T[]): T[] {
  const uniqArray: T[] = [];
  if (!input) {
    return uniqArray;
  }
  assert(Array.isArray(input), 'array argument is required');

  const comparableA = input.map(item =>
    isBsonType(item) ? item.toString() : item,
  );
  for (let i = 0, n = comparableA.length; i < n; i++) {
    if (comparableA.indexOf(comparableA[i]) === i) {
      uniqArray.push(input[i]);
    }
  }
  return uniqArray;
}

// TODO(bajtos) add test coverage
export function isBsonType(value: unknown): value is object {
  if (typeof value !== 'object' || !value) return false;

  // bson@1.x stores _bsontype on ObjectID instance, bson@4.x on prototype
  return check(value) || check(value.constructor.prototype);

  function check(target: unknown) {
    return Object.prototype.hasOwnProperty.call(target, '_bsontype');
  }
}

// TODO(bajtos) add test coverage
export async function findByForeignKeys<
  Target extends Entity,
  TargetID,
  TargetRelations extends object,
  ForeignKey
>(
  targetRepository: EntityCrudRepository<Target, TargetID, TargetRelations>,
  fkName: StringKeyOf<Target>,
  fkValues: ForeignKey[],
  _scope?: Filter<Target>,
  options?: Options,
): Promise<(Target & TargetRelations)[]> {
  const repoCapabilities = getRepositoryCapabilities(targetRepository);
  const pageSize = repoCapabilities.inqLimit || 256;

  // TODO(bajtos) add test coverage
  const queries = splitByPageSize(fkValues, pageSize).map(fks => {
    const where = ({
      [fkName]: fks.length === 1 ? fks[0] : {inq: fks},
    } as unknown) as Where<Target>;

    // TODO(bajtos) take into account scope fields like pagination, fields, etc
    // FIXME(bajtos) for v1, reject unsupported scope options
    const targetFilter = {where};
    return targetFilter;
  });

  const results = await Promise.all(
    queries.map(q => targetRepository.find(q, options)),
  );

  return flatten(results);
}

function flatten<T>(items: T[][]): T[] {
  // Node.js 11+
  if (typeof items.flat === 'function') {
    return items.flat(1);
  }
  // Node.js 8 and 10
  return ([] as T[]).concat(...items);
}

function splitByPageSize<T>(items: T[], pageSize: number): T[][] {
  if (pageSize < 0) return [items];
  if (!pageSize) throw new Error(`Invalid page size: ${pageSize}`);
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  return pages;
}

export type StringKeyOf<T> = Extract<keyof T, string>;

// TODO(bajtos) add test coverage
export function buildLookupMap<Key, InType, OutType = InType>(
  list: InType[],
  keyName: StringKeyOf<InType>,
  reducer: (accumulator: OutType | undefined, current: InType) => OutType,
): Map<Key, OutType> {
  const lookup = new Map<Key, OutType>();
  for (const entity of list) {
    const key = getKeyValue(entity, keyName) as Key;
    const original = lookup.get(key);
    const reduced = reducer(original, entity);
    lookup.set(key, reduced);
  }
  return lookup;
}

// TODO(bajtos) add test coverage
export function flattenTargetsOfOneToOneRelation<
  SourceWithRelations extends Entity,
  Target extends Entity
>(
  sourceIds: unknown[],
  targetEntities: Target[],
  targetKey: StringKeyOf<Target>,
): (Target | undefined)[] {
  const lookup = buildLookupMap<unknown, Target, Target>(
    targetEntities,
    targetKey,
    reduceAsSingleItem,
  );

  return flattenMapByKeys(sourceIds, lookup);
}

export function reduceAsSingleItem<T>(_acc: T | undefined, it: T) {
  return it;
}

// TODO(bajtos) add test coverage
export function flattenTargetsOfOneToManyRelation<Target extends Entity>(
  sourceIds: unknown[],
  targetEntities: Target[],
  targetKey: StringKeyOf<Target>,
): (Target[] | undefined)[] {
  const lookup = buildLookupMap<unknown, Target, Target[]>(
    targetEntities,
    targetKey,
    reduceAsArray,
  );

  return flattenMapByKeys(sourceIds, lookup);
}

export function reduceAsArray<T>(acc: T[] | undefined, it: T) {
  if (acc) acc.push(it);
  else acc = [it];
  return acc;
}

export function getKeyValue<T>(model: T, keyName: string) {
  const rawKey = (model as AnyObject)[keyName];
  // Hacky workaround for MongoDB, see _SPIKE_.md for details
  if (typeof rawKey === 'object' && rawKey.constructor.name === 'ObjectID') {
    return rawKey.toString();
  }
  return rawKey;
}

export function flattenMapByKeys<T>(
  sourceIds: unknown[],
  targetMap: Map<unknown, T>,
): (T | undefined)[] {
  const result: (T | undefined)[] = new Array(sourceIds.length);

  for (const ix in sourceIds) {
    const key = sourceIds[ix];
    const target = targetMap.get(key);
    result[ix] = target;
  }

  return result;
}