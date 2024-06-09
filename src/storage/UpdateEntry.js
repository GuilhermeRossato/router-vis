
/**
 * @typedef {{
 *   type: 'removed' | 'created' | 'updated' | 'unchanged';
 *   varName: string;
 *   varType: 'object' | 'array' | 'value';
 *   time: number;
 *   value: any;
 *   lastTime?: number;
 *   lastValue?: any;
*    varSrc?: 'statistics' | 'status' | string;
*    fileName?: '2020-01-01-24.csv' | string;
 * }} UpdateEntry
 * 
 * @exports UpdateEntry
 */