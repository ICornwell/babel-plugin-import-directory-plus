import { foo } from 'my-lib/utils/index.js'; // has "types": "module" in package.json

import _cjsDefault from 'npm-cli/utils/index.js';
const bar = _cjsDefault.bar; // does not have "types": "module" in package.json
