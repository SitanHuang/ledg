import { Rational } from "../math/rational.ts";
import { Currency } from "./currency.ts";
import { timestamp, Option, None } from "../types.ts";


/**
 * Internal type for an edge registration.
 */
interface ConversionRegistration {
  timestamp: timestamp; // unix timestamp in ms
  rate: Rational;
}


/**
 * CurrencyConversionService implements two main features:
 *  1. Register a fractional conversion rate between two currencies at a given timestamp.
 *     Registering from -> to automatically registers to -> from with the reciprocal rate,
 *     except that if the rate is zero then both directions are zero.
 *  2. Resolve the conversion rate between two currencies as of a given timestamp.
 *     The resolution uses the fewest‐edge (i.e. “shortest”) valid path.
 *     For each direct edge, a binary search (O(log k)) over registrations is performed.
 */
export class CurrencyConversionService {
  // Map from currency id to Currency instance.
  private readonly currencies = new Map<string, Currency>();

  // The conversion graph is stored as a nested Map.
  // edges.get(fromId)?.get(toId) returns a sorted array (by timestamp ascending)
  // of registrations for conversion from currency "fromId" to "toId".
  private readonly edges = new Map<string, Map<string, ConversionRegistration[]>>();

  public readonly registrationRecords: {
    from: Currency, to: Currency, rate: Rational, timestamp: timestamp
  }[] = [];

  /**
   * Optionally registers a Currency if it isn’t already known.
   */
  public registerCurrency(currency: Currency): void {
    if (!this.currencies.has(currency.id)) {
      this.currencies.set(currency.id, currency);
      // Initialize its edge map.
      this.edges.set(currency.id, new Map());
    }
  }

  /**
   * Registers a conversion rate from one currency to another at a given timestamp.
   * Automatically registers the reciprocal conversion (or zero conversion if rate is zero).
   * @param from The source currency.
   * @param to The target currency.
   * @param rate The conversion rate as a Rational.
   * @param timestamp Unix timestamp in ms.
   */
  public registerConversion(from: Currency, to: Currency, rate: Rational, timestamp: timestamp): void {
    // Ensure both currencies are registered.
    this.registerCurrency(from);
    this.registerCurrency(to);

    this.registrationRecords.push({ from, to, rate, timestamp });

    // Insert the registration for from -> to.
    this.insertEdgeRegistration(from.id, to.id, { timestamp, rate });

    // For the reciprocal edge:
    let reciprocalRate: Rational;
    if (rate.eq(Rational.ZERO)) {
      reciprocalRate = Rational.ZERO;
    } else {
      // Compute reciprocal as b/a. (Rational constructor takes care of sign.)
      reciprocalRate = new Rational(rate.denominator, rate.numerator);
    }
    this.insertEdgeRegistration(to.id, from.id, { timestamp, rate: reciprocalRate });
  }

  /**
   * Resolves the conversion rate from one currency to another at the specified timestamp.
   * It uses a breadth-first search over the currency graph (each edge lookup is O(log k) using binary search).
   * The search finds the path with the fewest hops that is fully defined at the given timestamp.
   * @param from The source currency.
   * @param to The target currency.
   * @param timestamp Unix timestamp in ms.
   * @returns The composite conversion rate (a Rational) such that (value in from)*rate = value in to. None if resolution failed.
   */
  public resolveConversion(from: Currency, to: Currency, timestamp: timestamp): Option<Rational> {
    if (from.id === to.id) {
      return Rational.ONE;
    }

    // BFS queue elements: { currencyId, compositeRate }
    const queue: { id: string, rate: Rational }[] = [];
    // visited map to record the minimum number of hops used to reach a currency.
    const visited = new Map<string, number>();

    queue.push({ id: from.id, rate: Rational.ONE });
    visited.set(from.id, 0);

    while (queue.length > 0) {
      const { id: currentId, rate: currentRate } = queue.shift()!;

      // Get neighbors of currentId.
      const neighborMap = this.edges.get(currentId);
      if (!neighborMap) {
        continue;
      }

      // For each neighbor, check if there is a valid registration at the timestamp.
      for (const [neighborId, registrations] of neighborMap.entries()) {
        // Binary search in registrations to get the latest registration at or before timestamp.
        const edgeRate = this.getRateAtTimestamp(registrations, timestamp);
        if (edgeRate === null) {
          continue; // no valid registration for this edge at query time.
        }

        // Compose conversion rate along the path.
        const newRate = currentRate.times(edgeRate);

        // If we reached the destination, return the composite rate.
        if (neighborId === to.id) {
          return newRate;
        }

        const nextHops = (visited.get(neighborId) ?? Number.MAX_SAFE_INTEGER);
        const currentHops = (visited.get(currentId) ?? 0) + 1;
        if (currentHops < nextHops) {
          visited.set(neighborId, currentHops);
          queue.push({ id: neighborId, rate: newRate });
        }
      }
    }

    return None;
  }

  /**
   * Inserts a registration into the edge map for the conversion from fromId to toId.
   * Registrations are kept sorted by timestamp (ascending).
   */
  private insertEdgeRegistration(fromId: string, toId: string, reg: ConversionRegistration): void {
    let fromMap = this.edges.get(fromId);
    if (!fromMap) {
      fromMap = new Map();
      this.edges.set(fromId, fromMap);
    }
    let regArray = fromMap.get(toId);
    if (!regArray) {
      regArray = [];
      fromMap.set(toId, regArray);
    }
    // If registrations are mostly in chronological order, we simply push.
    if (regArray.length === 0 || regArray[regArray.length - 1].timestamp <= reg.timestamp) {
      regArray.push(reg);
    } else {
      // Otherwise, insert it in sorted order.
      const index = this.binarySearchInsertIndex(regArray, reg.timestamp);
      regArray.splice(index, 0, reg);
    }
  }

  /**
   * Binary searches for the insertion index in a sorted array of ConversionRegistration.
   * @param arr The sorted array.
   * @param timestamp The timestamp to insert.
   * @returns The index at which the new registration should be inserted.
   */
  private binarySearchInsertIndex(arr: ConversionRegistration[], timestamp: number): number {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (arr[mid].timestamp < timestamp) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  /**
   * Given a sorted array of registrations for an edge, returns the conversion rate
   * from the latest registration whose timestamp is less than or equal to the given time.
   * Returns null if no registration is valid.
   */
  private getRateAtTimestamp(arr: ConversionRegistration[], timestamp: number): Rational | null {
    let lo = 0, hi = arr.length - 1;
    let resultIndex = -1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (arr[mid].timestamp <= timestamp) {
        resultIndex = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return resultIndex === -1 ? null : arr[resultIndex].rate;
  }
}
