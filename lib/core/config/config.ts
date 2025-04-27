import { ValuationConfiguration } from "./valuationConfigs.ts";

/**
 * Configuration. Mutable during runtime.
 */
export class Configuration {
  public valuationConfig = new ValuationConfiguration();

  static getDefaults() {
    return new Configuration();
  }
}