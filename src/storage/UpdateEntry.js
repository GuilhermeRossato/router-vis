
/**
 * @typedef {{
 *   updateType: 'removed' | 'created' | 'updated' | 'unchanged';
 *   varName: string;
 *   varType: 'object' | 'array' | 'value';
 *   varSrc: 'statistics' | 'status' | string;
 *   time: number;
 *   value: any;
 *   lastTime?: number;
 *   lastValue?: any;
*    fileName?: '2020-01-01-24.csv' | string;
 * }} UpdateEntry
 * 
 * @exports UpdateEntry
 */