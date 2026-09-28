// Lib/tailwind.js
import {create} from 'twrnc';
import type {TailwindFn, TwConfig} from 'twrnc';
import tailwindConfig from './tailwind.config';

const tw: TailwindFn = create(tailwindConfig as unknown as TwConfig); // <- your path may differ

export default tw;
